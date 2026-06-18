from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import asyncio
import httpx
import json
import logging
import sqlite3
import os
from datetime import datetime
import uuid
import re
import math
from urllib.parse import urlparse

DB_PATH = os.environ.get("DB_PATH", "/app/data/pinpanda.db")


def _load_env_file() -> None:
    """Load KEY=VALUE pairs from a project-root .env into os.environ without overriding existing vars."""
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        os.path.join(os.getcwd(), ".env"),
    ]
    for path in candidates:
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, _, value = line.partition("=")
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = value
        except Exception as exc:
            logging.getLogger(__name__).warning("Failed to read %s: %s", path, exc)
        break


_load_env_file()


def get_env_api_key(model: str = "") -> str:
    """Return an env-configured API key matching the requested model's provider."""
    model_id = (model or "").lower()
    if model_id.startswith("gemini"):
        return os.environ.get("GOOGLE_GEMINI_API_KEY", "") or os.environ.get("GEMINI_API_KEY", "")
    return os.environ.get("OPENAI_API_KEY", "")


def resolve_api_key(client_key: str, model: str = "") -> str:
    """Prefer the client-supplied key; fall back to the env-configured one."""
    if client_key and client_key.strip():
        return client_key.strip()
    return get_env_api_key(model)


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PinPanda AI Backend", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info(f"SQLite database initialized at {DB_PATH}")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class Bookmark(BaseModel):
    title: str
    url: str
    description: Optional[str] = ""
    category: Optional[str] = "Uncategorized"
    dateAdded: Optional[str] = None
    favicon: Optional[str] = None
    folder: Optional[str] = None
    id: Optional[str] = None

class DuplicateStats(BaseModel):
    uniqueUrls: int
    urlsWithDuplicates: int
    totalDuplicateReferences: int
    mostDuplicatedUrls: List[Dict[str, Any]]

class ProgressUpdate(BaseModel):
    sessionId: str
    progress: float
    status: str
    message: str
    completedBatches: int
    totalBatches: int
    step: Optional[int] = 0
    bookmarksProcessed: Optional[int] = 0
    duplicatesFound: Optional[int] = 0
    duplicateStats: Optional[DuplicateStats] = None

class ReorganizeRequest(BaseModel):
    bookmarks: List[Bookmark]
    apiKey: str
    model: str = "gpt-5.4-mini"
    categorizationDepth: str = "balanced"
    sessionId: str

class ChatRequest(BaseModel):
    message: str
    bookmarks: List[Bookmark]
    apiKey: str
    chatModel: str = "gpt-5.4-mini"
    context: Optional[Dict[str, Any]] = {}

class ChatResponse(BaseModel):
    response: str
    intent: str
    action: Optional[str] = None
    results: Optional[List[Bookmark]] = None
    suggestions: Optional[List[str]] = None

class BookmarkSyncRequest(BaseModel):
    bookmarks: List[Bookmark]
    source: str = "manual"

class BookmarkSyncResponse(BaseModel):
    added: int
    updated: int
    deleted: int
    total: int

class HistoryEntry(BaseModel):
    id: int
    bookmark_id: str
    event: str
    source: str
    old_data: Optional[Dict] = None
    new_data: Optional[Dict] = None
    occurred_at: str

# Global storage for progress tracking
progress_store: Dict[str, ProgressUpdate] = {}

# --- SQLite helpers ---

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS bookmarks (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                url         TEXT NOT NULL UNIQUE,
                description TEXT DEFAULT '',
                category    TEXT DEFAULT 'Uncategorized',
                date_added  TEXT,
                favicon     TEXT,
                folder      TEXT,
                updated_at  TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                bookmark_id TEXT NOT NULL,
                event       TEXT NOT NULL,
                source      TEXT NOT NULL,
                old_data    TEXT,
                new_data    TEXT,
                occurred_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_history_bookmark_id ON history(bookmark_id);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
        """)
        conn.commit()
    finally:
        conn.close()

def record_history(
    conn: sqlite3.Connection,
    bookmark_id: str,
    event: str,
    source: str,
    old_data: Optional[Dict] = None,
    new_data: Optional[Dict] = None,
) -> None:
    conn.execute(
        """INSERT INTO history (bookmark_id, event, source, old_data, new_data, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            bookmark_id,
            event,
            source,
            json.dumps(old_data) if old_data else None,
            json.dumps(new_data) if new_data else None,
            datetime.utcnow().isoformat(),
        ),
    )

def upsert_bookmark(conn: sqlite3.Connection, bm: Dict, source: str) -> str:
    """Insert or update a bookmark by URL. Returns 'add', 'update', or 'category_change'."""
    now = datetime.utcnow().isoformat()
    existing = conn.execute("SELECT * FROM bookmarks WHERE url = ?", (bm["url"],)).fetchone()
    if existing is None:
        conn.execute(
            """INSERT INTO bookmarks (id, title, url, description, category,
               date_added, favicon, folder, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (bm["id"], bm["title"], bm["url"], bm.get("description", ""),
             bm.get("category", "Uncategorized"), bm.get("dateAdded"),
             bm.get("favicon"), bm.get("folder"), now),
        )
        record_history(conn, bm["id"], "add", source, new_data=bm)
        return "add"
    else:
        old = dict(existing)
        event = "category_change" if old["category"] != bm.get("category", "Uncategorized") else "update"
        conn.execute(
            """UPDATE bookmarks SET title=?, description=?, category=?,
               date_added=?, favicon=?, folder=?, updated_at=? WHERE url=?""",
            (bm["title"], bm.get("description", ""), bm.get("category", "Uncategorized"),
             bm.get("dateAdded"), bm.get("favicon"), bm.get("folder"), now, bm["url"]),
        )
        record_history(conn, old["id"], event, source, old_data=old, new_data=bm)
        return event

# Processing configuration
BATCH_SIZE = 75  # Optimized batch size
MAX_CONCURRENT_REQUESTS = 5  # Increased for better parallelization
REQUEST_DELAY = 1.0  # Delay between batches in seconds
MAX_TOKENS_PER_CHUNK = 20000  # Conservative token limit
PROCESSING_TIMEOUT_MS = 120000  # 2 minutes

async def detect_intent(message: str, api_key: str, model: str) -> Dict[str, Any]:
    """Detect user intent from chat message"""
    intent_prompt = f"""
Analyze this user message about bookmarks and determine the intent. Return ONLY a JSON object with this structure:

{{
    "intent": "search" | "reorganize" | "general" | "export" | "stats",
    "confidence": 0.0-1.0,
    "entities": {{
        "query": "extracted search terms if search intent",
        "category": "specific category if mentioned",
        "action": "specific action requested"
    }}
}}

User message: "{message}"

Intent definitions:
- search: Finding specific bookmarks, looking for content. Keywords: find, search, show, get, travel, work, coding, development, javascript, react, etc. Any mention of specific topics/categories.
- reorganize: Organizing, categorizing, cleaning up bookmarks. Keywords: organize, reorganize, categorize, clean up, restructure.
- general: Questions about the collection, help, information. Keywords: help, how, what, explain.
- export: Saving, downloading, exporting bookmarks. Keywords: export, download, save, backup.
- stats: Analytics, counts, duplicate info, statistics. Keywords: how many, count, stats, statistics, duplicates, analytics.
"""

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                },
                json={
                    "model": get_model_name(model),
                    "messages": [
                        {"role": "user", "content": intent_prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 300
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data['choices'][0]['message']['content']
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse intent JSON: {content}")
                    return {"intent": "general", "confidence": 0.5, "entities": {}}
            else:
                logger.error(f"Intent detection API error: {response.status_code}")
                return {"intent": "general", "confidence": 0.5, "entities": {}}
                
        except Exception as e:
            logger.error(f"Intent detection failed: {str(e)}")
            return {"intent": "general", "confidence": 0.5, "entities": {}}

def perform_keyword_search(query: str, bookmarks: List[Bookmark]) -> List[Bookmark]:
    """Perform keyword-based search on bookmarks"""
    query_lower = query.lower()
    keywords = query_lower.split()
    
    logger.info(f"Keyword search: '{query}' -> keywords: {keywords} in {len(bookmarks)} bookmarks")
    
    scored_bookmarks = []
    
    for bookmark in bookmarks:
        score = 0
        text_fields = [
            bookmark.title.lower(),
            bookmark.url.lower(),
            (bookmark.category or "").lower(),
            (bookmark.description or "").lower()
        ]
        
        combined_text = " ".join(text_fields)
        
        # Score based on keyword matches
        for keyword in keywords:
            if keyword in bookmark.title.lower():
                score += 10  # Title matches are most important
            elif keyword in bookmark.url.lower():
                score += 5   # URL matches are good
            elif keyword in (bookmark.category or "").lower():
                score += 3   # Category matches
            elif keyword in (bookmark.description or "").lower():
                score += 2   # Description matches
            elif keyword in combined_text:
                score += 1   # Any other match
        
        if score > 0:
            scored_bookmarks.append((bookmark, score))
    
    # Sort by score and return top results
    scored_bookmarks.sort(key=lambda x: x[1], reverse=True)
    result_bookmarks = [bookmark for bookmark, score in scored_bookmarks[:50]]
    
    logger.info(f"Keyword search found {len(scored_bookmarks)} matches, returning top {len(result_bookmarks)}")
    return result_bookmarks

async def search_bookmarks_with_ai(query: str, bookmarks: List[Bookmark], api_key: str, model: str) -> List[Bookmark]:
    """Search bookmarks using keyword pre-filtering + AI semantic search"""
    if not bookmarks:
        return []
    
    # Step 1: Pre-filter with keyword search to reduce context size
    keyword_results = perform_keyword_search(query, bookmarks)
    
    # If keyword search found very few results, use all bookmarks for AI
    search_candidates = keyword_results if len(keyword_results) >= 5 else bookmarks
    
    # If we have too many candidates, limit to top 100 to stay within token limits
    if len(search_candidates) > 100:
        search_candidates = search_candidates[:100]
    
    # Step 2: Use AI for semantic search on the filtered candidates
    bookmark_data = [
        {
            "index": i,
            "title": bookmark.title,
            "url": bookmark.url,
            "category": bookmark.category or "Uncategorized",
            "description": bookmark.description or ""
        }
        for i, bookmark in enumerate(search_candidates)
    ]
    
    search_prompt = f"""
Given this user query: "{query}"

Find the most relevant bookmarks from this pre-filtered collection and return ONLY a JSON array of bookmark indices (numbers only):

{json.dumps(bookmark_data, indent=2)}

Return format: [1, 5, 12, 23]
Return the indices of the most relevant bookmarks, sorted by relevance (most relevant first).
Consider semantic meaning, not just keyword matches.
Limit results to 15 bookmarks maximum.
"""

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                },
                json={
                    "model": get_model_name(model),
                    "messages": [
                        {"role": "user", "content": search_prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data['choices'][0]['message']['content']
                try:
                    indices = json.loads(content)
                    # Return bookmarks at specified indices from search candidates
                    return [search_candidates[i] for i in indices if 0 <= i < len(search_candidates)]
                except (json.JSONDecodeError, IndexError, TypeError):
                    logger.warning(f"Failed to parse search results: {content}")
                    return []
            else:
                logger.error(f"Search API error: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"AI search failed: {str(e)}")
            return []

async def generate_bookmark_stats(bookmarks: List[Bookmark]) -> Dict[str, Any]:
    """Generate statistics about bookmark collection"""
    if not bookmarks:
        return {
            "total": 0,
            "categories": {},
            "domains": {},
            "duplicates": 0
        }
    
    # Count categories
    categories = {}
    domains = {}
    
    for bookmark in bookmarks:
        # Category stats
        category = bookmark.category or "Uncategorized"
        categories[category] = categories.get(category, 0) + 1
        
        # Domain stats
        try:
            domain = urlparse(bookmark.url).netloc.lower()
            domains[domain] = domains.get(domain, 0) + 1
        except:
            pass
    
    # Find duplicates
    urls_seen = set()
    duplicates = 0
    for bookmark in bookmarks:
        url = bookmark.url.lower().strip('/')
        if url in urls_seen:
            duplicates += 1
        urls_seen.add(url)
    
    # Sort by count
    top_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:10]
    top_domains = sorted(domains.items(), key=lambda x: x[1], reverse=True)[:10]
    
    return {
        "total": len(bookmarks),
        "categories": dict(top_categories),
        "domains": dict(top_domains),
        "duplicates": duplicates,
        "unique_domains": len(domains),
        "unique_categories": len(categories)
    }

def get_model_name(selected_model: str) -> str:
    """Map UI model names to API model names"""
    model_map = {
        'gpt-5.5': 'gpt-5.5',
        'gpt-5.5-pro': 'gpt-5.5-pro',
        'gpt-5.4-mini': 'gpt-5.4-mini',
        'gpt-5.4-nano': 'gpt-5.4-nano',
        'gpt-5': 'gpt-5',
        'gpt-5-mini': 'gpt-5-mini',
        'gpt-5-nano': 'gpt-5-nano',
        'o3': 'o3',
        'o3-mini': 'o3-mini',
        'gpt-4o': 'gpt-4o',
        'gpt-4.1': 'gpt-4.1',
        'gpt-4o-mini': 'gpt-4o-mini',
        'gpt-3.5-turbo': 'gpt-3.5-turbo',
        # Legacy mappings
        'gpt-3.5': 'gpt-3.5-turbo',
        'gpt-4': 'gpt-4o',
        # Gemini — pass through as-is
        'gemini-3.5-flash': 'gemini-3.5-flash',
        'gemini-3.1-pro-preview': 'gemini-3.1-pro-preview',
        'gemini-3.1-flash-lite': 'gemini-3.1-flash-lite',
        'gemini-2.5-pro': 'gemini-2.5-pro',
        'gemini-2.5-flash': 'gemini-2.5-flash',
        'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
    }
    return model_map.get(selected_model, selected_model or 'gpt-5.4-mini')

# Advanced utility functions
def estimate_token_count(text: str) -> int:
    """Estimate token count for a text string"""
    return math.ceil(len(text) / 4)

def get_panda_progress_message(start: int, end: int, total: int) -> str:
    """Get engaging progress messages with personality"""
    messages = [
        f"🐼 Munching through bamboo batch {start} to {end} of {total}...",
        f"🎋 Climbing up the data tree: branches {start} to {end} of {total}...",
        f"🐾 Paws-ing at checkpoints {start} to {end} of {total}...",
        f"😴 Napping through sections {start} to {end} of {total}...",
        f"🎍 Rolling through data shoots {start} to {end} of {total}...",
        f"🌿 Snacking on bookmark leaves {start} to {end} of {total}...",
        f"🏮 Exploring data forests {start} to {end} of {total}...",
        f"🎋 Bamboo-zling through chunks {start} to {end} of {total}..."
    ]
    return messages[hash(f"{start}-{end}") % len(messages)]

def find_duplicate_bookmarks(bookmarks: List[Bookmark]) -> tuple[List[Dict[str, int]], DuplicateStats]:
    """Find duplicate bookmarks and generate statistics"""
    url_map = {}
    duplicates = []
    
    for index, bookmark in enumerate(bookmarks):
        # Normalize URL
        normalized_url = bookmark.url.lower().rstrip('/')
        
        if normalized_url in url_map:
            duplicates.append({
                "originalIndex": url_map[normalized_url],
                "duplicateIndex": index
            })
        else:
            url_map[normalized_url] = index
    
    # Calculate duplicate statistics
    url_counts = {}
    for bookmark in bookmarks:
        normalized_url = bookmark.url.lower().rstrip('/')
        url_counts[normalized_url] = url_counts.get(normalized_url, 0) + 1
    
    unique_urls = len(url_counts)
    urls_with_duplicates = sum(1 for count in url_counts.values() if count > 1)
    
    # Find most duplicated URLs
    most_duplicated = sorted(
        [(url, count) for url, count in url_counts.items() if count > 1],
        key=lambda x: x[1],
        reverse=True
    )[:5]
    
    most_duplicated_urls = [
        {
            "url": url,
            "count": count,
            "indices": [i for i, b in enumerate(bookmarks) if b.url.lower().rstrip('/') == url]
        }
        for url, count in most_duplicated
    ]
    
    stats = DuplicateStats(
        uniqueUrls=unique_urls,
        urlsWithDuplicates=urls_with_duplicates,
        totalDuplicateReferences=len(duplicates),
        mostDuplicatedUrls=most_duplicated_urls
    )
    
    return duplicates, stats

def create_categorization_prompt(bookmarks: List[Bookmark], depth: str) -> str:
    """Create sophisticated categorization prompt matching aiService quality"""
    bookmark_data = [
        {
            "index": i,
            "title": bookmark.title,
            "url": bookmark.url,
            "folder": bookmark.folder or "Uncategorized"
        }
        for i, bookmark in enumerate(bookmarks)
    ]
    
    return f"""
Here are {len(bookmarks)} bookmarks to categorize:

{json.dumps(bookmark_data, indent=2)}

IMPORTANT INSTRUCTIONS:
1. Analyze these bookmarks deeply to understand their content, purpose, and relationships
2. Create a hierarchical organization with main categories and subcategories
3. Group similar bookmarks together based on themes, topics, and content
4. Use descriptive, concise category names that clearly indicate the content
5. Ensure every bookmark is assigned to the most specific appropriate category
6. Create a clean, intuitive hierarchy that eliminates clutter
7. Make categories easy to browse by limiting the number of items in each category

Return ONLY a valid JSON object with main categories and subcategories as shown in the system prompt."""

def chunk_bookmarks(bookmarks: List[Bookmark], max_tokens: int = 20000) -> List[List[Bookmark]]:
    """Create intelligent chunks of bookmarks for processing"""
    chunks = []
    current_chunk = []
    current_token_count = 0
    
    # Add buffer for system prompt and response
    system_prompt_buffer = 3000
    response_buffer = 16000
    overhead_buffer = 5000
    effective_max_tokens = max_tokens - system_prompt_buffer - response_buffer - overhead_buffer
    
    logger.info(f"Chunking bookmarks with effective max tokens: {effective_max_tokens}")
    
    # If total is small enough, use single chunk
    estimated_total_tokens = estimate_token_count(json.dumps([b.dict() for b in bookmarks]))
    if estimated_total_tokens <= effective_max_tokens:
        logger.info(f"All {len(bookmarks)} bookmarks fit in a single chunk ({estimated_total_tokens} tokens)")
        return [bookmarks]
    
    # For very large collections, use fixed chunk size
    if len(bookmarks) > 1000 or estimated_total_tokens > 100000:
        logger.warning(f"Very large bookmark set detected ({len(bookmarks)} bookmarks, ~{estimated_total_tokens} tokens). Using aggressive chunking.")
        chunk_size = 75
        for i in range(0, len(bookmarks), chunk_size):
            chunks.append(bookmarks[i:i + chunk_size])
        logger.info(f"Split {len(bookmarks)} bookmarks into {len(chunks)} fixed-size chunks")
        return chunks
    
    # Normal chunking for medium-sized collections
    for bookmark in bookmarks:
        bookmark_text = f"{bookmark.title} {bookmark.url} {bookmark.folder or ''}"
        bookmark_tokens = estimate_token_count(bookmark_text)
        
        if current_token_count + bookmark_tokens > effective_max_tokens and current_chunk:
            chunks.append(current_chunk)
            current_chunk = []
            current_token_count = 0
        
        current_chunk.append(bookmark)
        current_token_count += bookmark_tokens
    
    if current_chunk:
        chunks.append(current_chunk)
    
    logger.info(f"Split {len(bookmarks)} bookmarks into {len(chunks)} chunks")
    return chunks

def extract_json_from_response(text: str) -> Dict[str, Any]:
    """Extract JSON from AI response with multiple fallback strategies"""
    try:
        # Try parsing entire text as JSON
        try:
            result = json.loads(text)
            logger.info("Successfully parsed entire response as JSON")
            return result
        except json.JSONDecodeError:
            logger.info("Response is not pure JSON, trying to extract JSON portion")
        
        # Look for JSON object pattern
        json_pattern = r'\{[\s\S]*\}'
        match = re.search(json_pattern, text)
        
        if match:
            try:
                result = json.loads(match.group(0))
                logger.info("Successfully extracted JSON using pattern match")
                return result
            except json.JSONDecodeError:
                logger.warning("Failed to parse extracted JSON pattern")
        
        # Try markdown code block
        markdown_pattern = r'```(?:json)?\s*(\{[\s\S]*?\})\s*```'
        markdown_match = re.search(markdown_pattern, text)
        
        if markdown_match:
            try:
                result = json.loads(markdown_match.group(1))
                logger.info("Successfully extracted JSON from markdown code block")
                return result
            except json.JSONDecodeError:
                logger.warning("Failed to parse markdown JSON")
        
        # Fallback categorization
        logger.warning("Using fallback categorization with 'All Bookmarks' category")
        return {
            "All Bookmarks": {
                "bookmarks": list(range(1000)),  # Large range to cover most cases
                "subcategories": {}
            }
        }
        
    except Exception as e:
        logger.error(f"JSON extraction failed: {e}")
        return {
            "All Bookmarks": {
                "bookmarks": list(range(1000)),
                "subcategories": {}
            }
        }

# System prompt for hierarchical categorization
CATEGORIZATION_SYSTEM_PROMPT = """
You are a professional bookmark organization expert. Your task is to create a clean, intuitive, hierarchical organization system for the user's bookmarks.

IMPORTANT: Analyze the bookmarks deeply to understand their content, purpose, and relationships. Look for common themes, topics, domains, and usage patterns.

Return ONLY a valid JSON object with the following structure:
{
  "Main Category 1": {
    "bookmarks": [0, 5, 9],  // Indices of bookmarks that belong directly in this main category
    "subcategories": {
      "Subcategory 1A": [1, 2],  // Indices of bookmarks that belong in this subcategory
      "Subcategory 1B": [3, 4]   // Indices of bookmarks that belong in this subcategory
    }
  },
  "Main Category 2": {
    "bookmarks": [6, 10],
    "subcategories": {
      "Subcategory 2A": [7, 8]
    }
  }
}

ORGANIZATION GUIDELINES:
1. Create 5-8 meaningful MAIN CATEGORIES based on major themes (e.g., Work, Personal, Technology, Finance, Education)
2. Create relevant SUBCATEGORIES within each main category for more specific groupings
3. Ensure EVERY bookmark is assigned to the most specific appropriate category
4. Use DESCRIPTIVE, CONCISE category names that clearly indicate the content
5. Group SIMILAR content together logically
6. ELIMINATE CLUTTER by creating a clean, intuitive hierarchy
7. Make categories EASY TO BROWSE by limiting the number of items in each category
8. BALANCE the number of bookmarks across categories when possible
9. Use existing folder structure as a HINT, but prioritize logical organization

CATEGORY NAMING GUIDELINES:
- Use clear, descriptive nouns or short phrases (e.g., "Software Development" not "Code Stuff")
- Be specific enough to be meaningful (e.g., "JavaScript Resources" not just "Programming")
- Be consistent in naming style across categories
- Avoid overly technical terms unless the content is highly specialized
- Use title case for category names (e.g., "Financial Planning" not "financial planning")

CATEGORIZATION STRATEGY:
1. First, identify the major themes across all bookmarks
2. Create main categories for these themes
3. Within each main category, identify logical subgroups
4. Create subcategories for these subgroups
5. Assign each bookmark to the most specific appropriate category
6. Ensure no category is too large or too small
7. Review and refine the structure for balance and usability
"""

async def process_batch_with_ai(
    bookmarks: List[Bookmark], 
    api_key: str, 
    model: str, 
    depth: str
) -> Dict[str, Any]:
    """Process a single batch of bookmarks with OpenAI API"""
    prompt = create_categorization_prompt(bookmarks, depth)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                },
                json={
                    "model": get_model_name(model),
                    "messages": [
                        {
                            "role": "system",
                            "content": CATEGORIZATION_SYSTEM_PROMPT
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.3,
                    "max_tokens": 4000
                }
            )
            
            if response.status_code != 200:
                logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"OpenAI API error: {response.text}"
                )
            
            data = response.json()
            content = data['choices'][0]['message']['content']
            
            # Extract and validate response
            categorization = extract_json_from_response(content)
            
            if not categorization:
                logger.error("Failed to extract categorization from AI response")
                raise HTTPException(status_code=500, detail="Failed to extract categorization from AI response")
            
            return categorization
                
        except httpx.TimeoutException:
            logger.error("Request timeout")
            raise HTTPException(status_code=408, detail="Request timeout")
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

async def reorganize_bookmarks_background(request: ReorganizeRequest):
    """Background task to reorganize bookmarks with progress tracking"""
    session_id = request.sessionId
    bookmarks = request.bookmarks
    
    try:
        # Add IDs to bookmarks if missing
        for i, bookmark in enumerate(bookmarks):
            if not bookmark.id:
                bookmark.id = str(uuid.uuid4())
        
        # Find duplicates and calculate stats
        duplicates, duplicate_stats = find_duplicate_bookmarks(bookmarks)
        
        # Initialize progress with duplicate detection results
        progress_store[session_id] = ProgressUpdate(
            sessionId=session_id,
            progress=10.0,
            status="processing",
            message=f"🔍 Found {len(duplicates)} duplicate bookmarks across {duplicate_stats.urlsWithDuplicates} unique URLs",
            completedBatches=0,
            totalBatches=0,
            step=0,
            bookmarksProcessed=len(bookmarks),
            duplicatesFound=len(duplicates),
            duplicateStats=duplicate_stats
        )
        
        # Create chunks for processing
        chunks = chunk_bookmarks(bookmarks)
        total_batches = len(chunks)
        
        progress_store[session_id].totalBatches = total_batches
        progress_store[session_id].message = f"🧠 Training AI on your bookmark collection..."
        progress_store[session_id].progress = 15.0
        
        categorized_results = {}
        
        # Process chunks
        for i, chunk in enumerate(chunks):
            try:
                logger.info(f"Processing chunk {i+1}/{total_batches} with {len(chunk)} bookmarks")
                
                # Update progress with engaging message
                chunk_start = i * len(chunk) + 1
                chunk_end = min((i + 1) * len(chunk), len(bookmarks))
                panda_message = get_panda_progress_message(chunk_start, chunk_end, len(bookmarks))
                
                progress_store[session_id].message = panda_message
                progress_store[session_id].progress = 20.0 + (i / total_batches) * 60.0
                progress_store[session_id].completedBatches = i
                
                # Process batch with AI
                batch_result = await process_batch_with_ai(
                    chunk, 
                    request.apiKey, 
                    request.model, 
                    request.categorizationDepth
                )
                
                # Merge results - adjust indices for chunk offset
                chunk_offset = sum(len(chunks[j]) for j in range(i))
                for category_name, category_data in batch_result.items():
                    if category_name not in categorized_results:
                        categorized_results[category_name] = {
                            "bookmarks": [],
                            "subcategories": {}
                        }
                    
                    # Adjust main category bookmarks
                    if "bookmarks" in category_data:
                        adjusted_bookmarks = [idx + chunk_offset for idx in category_data["bookmarks"] 
                                            if idx + chunk_offset < len(bookmarks)]
                        categorized_results[category_name]["bookmarks"].extend(adjusted_bookmarks)
                    
                    # Adjust subcategory bookmarks
                    if "subcategories" in category_data:
                        for sub_name, sub_indices in category_data["subcategories"].items():
                            if sub_name not in categorized_results[category_name]["subcategories"]:
                                categorized_results[category_name]["subcategories"][sub_name] = []
                            
                            adjusted_sub_bookmarks = [idx + chunk_offset for idx in sub_indices 
                                                    if idx + chunk_offset < len(bookmarks)]
                            categorized_results[category_name]["subcategories"][sub_name].extend(adjusted_sub_bookmarks)
                
                # Add delay between batches
                if i < total_batches - 1:
                    await asyncio.sleep(REQUEST_DELAY)
                    
            except Exception as e:
                logger.error(f"Error processing chunk {i+1}: {str(e)}")
                # Continue with remaining chunks
        
        # Convert to final bookmark structure
        final_bookmarks = []
        for bookmark_idx, bookmark in enumerate(bookmarks):
            # Find which category this bookmark belongs to
            assigned_category = "Uncategorized"
            
            for category_name, category_data in categorized_results.items():
                # Check main category
                if bookmark_idx in category_data.get("bookmarks", []):
                    assigned_category = category_name
                    break
                
                # Check subcategories
                for sub_name, sub_indices in category_data.get("subcategories", {}).items():
                    if bookmark_idx in sub_indices:
                        assigned_category = f"{category_name} / {sub_name}"
                        break
                
                if assigned_category != "Uncategorized":
                    break
            
            # Update bookmark with new category
            bookmark.category = assigned_category
            final_bookmarks.append(bookmark)
        
        # Mark as completed
        progress_store[session_id] = ProgressUpdate(
            sessionId=session_id,
            progress=100.0,
            status="completed",
            message=f"🎨 Successfully reorganized {len(final_bookmarks)} bookmarks into {len(categorized_results)} categories!",
            completedBatches=total_batches,
            totalBatches=total_batches,
            duplicateStats=duplicate_stats
        )
        
        # Store the result
        progress_store[f"{session_id}_result"] = final_bookmarks
        
    except Exception as e:
        logger.error(f"Fatal error in reorganization: {str(e)}")
        progress_store[session_id] = ProgressUpdate(
            sessionId=session_id,
            progress=0.0,
            status="error",
            message=f"Error: {str(e)}",
            completedBatches=0,
            totalBatches=0
        )

@app.post("/api/reorganize")
async def start_reorganization(request: ReorganizeRequest, background_tasks: BackgroundTasks):
    """Start bookmark reorganization process"""
    try:
        # Validate request
        if not request.bookmarks:
            raise HTTPException(status_code=400, detail="No bookmarks provided")

        request.apiKey = resolve_api_key(request.apiKey, request.model)
        if not request.apiKey:
            raise HTTPException(status_code=400, detail="API key required")
        
        # Generate session ID if not provided
        if not request.sessionId:
            request.sessionId = str(uuid.uuid4())
        
        logger.info(f"Starting reorganization for {len(request.bookmarks)} bookmarks")
        
        # Start background task
        background_tasks.add_task(reorganize_bookmarks_background, request)
        
        return {
            "sessionId": request.sessionId,
            "status": "started",
            "message": f"Started reorganization of {len(request.bookmarks)} bookmarks"
        }
        
    except Exception as e:
        logger.error(f"Error starting reorganization: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/progress/{session_id}")
async def get_progress(session_id: str):
    """Get progress for a reorganization session"""
    if session_id not in progress_store:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return progress_store[session_id]

@app.get("/api/result/{session_id}")
async def get_result(session_id: str):
    """Get the final result of reorganization"""
    result_key = f"{session_id}_result"
    if result_key not in progress_store:
        raise HTTPException(status_code=404, detail="Result not found")
    
    result = progress_store[result_key]
    
    # Clean up stored data
    if session_id in progress_store:
        del progress_store[session_id]
    del progress_store[result_key]
    
    return {"bookmarks": result}

@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest):
    """Unified chat interface for AI assistant"""
    try:
        request.apiKey = resolve_api_key(request.apiKey, request.chatModel)
        if not request.apiKey:
            raise HTTPException(status_code=400, detail="API key required")
        
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        logger.info(f"Processing chat message: {request.message[:100]}...")
        
        # Detect intent
        intent_result = await detect_intent(request.message, request.apiKey, request.chatModel)
        intent = intent_result.get("intent", "general")
        entities = intent_result.get("entities", {})
        
        logger.info(f"Detected intent: {intent} with confidence: {intent_result.get('confidence', 0)}")
        
        # Fallback intent detection for simple cases
        message_lower = request.message.lower()
        if intent == "general" and any(word in message_lower for word in ["find", "search", "show", "get", "travel", "work", "coding", "javascript", "react", "vue", "python", "bookmarks"]):
            logger.info("Overriding intent to 'search' based on keywords")
            intent = "search"
            entities["query"] = request.message
        
        # Route based on intent
        if intent == "search":
            query = entities.get("query", request.message)
            results = await search_bookmarks_with_ai(query, request.bookmarks, request.apiKey, request.chatModel)
            
            if results:
                response_text = f"Found {len(results)} bookmarks matching '{query}'. Here are the most relevant ones:"
                suggestions = ["Show all results", "Refine search", "Organize these results"]
            else:
                response_text = f"No bookmarks found matching '{query}'. Try different search terms or check if you have bookmarks loaded."
                suggestions = ["View all bookmarks", "Try different keywords", "Upload more bookmarks"]
            
            return ChatResponse(
                response=response_text,
                intent=intent,
                action="search_results",
                results=results,
                suggestions=suggestions
            )
        
        elif intent == "reorganize":
            bookmark_count = len(request.bookmarks)
            if bookmark_count == 0:
                response_text = "You don't have any bookmarks to reorganize. Please upload some bookmarks first."
                suggestions = ["Upload bookmarks", "Learn about bookmark formats"]
            else:
                response_text = f"I can help you reorganize your {bookmark_count} bookmarks! This will use AI to create intelligent categories and subcategories. Would you like to start the reorganization process?"
                suggestions = ["Start reorganization", "Preview categories", "Learn about reorganization"]
            
            return ChatResponse(
                response=response_text,
                intent=intent,
                action="reorganize_prompt",
                suggestions=suggestions
            )
        
        elif intent == "stats":
            stats = await generate_bookmark_stats(request.bookmarks)
            
            if stats["total"] == 0:
                response_text = "You don't have any bookmarks loaded. Upload your bookmarks to see statistics."
                suggestions = ["Upload bookmarks", "Learn about supported formats"]
            else:
                top_category = max(stats["categories"].items(), key=lambda x: x[1]) if stats["categories"] else ("None", 0)
                top_domain = max(stats["domains"].items(), key=lambda x: x[1]) if stats["domains"] else ("None", 0)
                
                response_text = f"""📊 **Bookmark Collection Stats:**

**Total Bookmarks:** {stats['total']}
**Categories:** {stats['unique_categories']} ({top_category[0]} has {top_category[1]} bookmarks)
**Unique Domains:** {stats['unique_domains']} ({top_domain[0]} appears {top_domain[1]} times)
**Potential Duplicates:** {stats['duplicates']} bookmarks

Your collection is {'well-organized' if stats['unique_categories'] > 5 else 'ready for organization'}!"""
                
                suggestions = ["Show detailed breakdown", "Find duplicates", "Reorganize bookmarks"]
            
            return ChatResponse(
                response=response_text,
                intent=intent,
                action="show_stats",
                suggestions=suggestions
            )
        
        elif intent == "export":
            bookmark_count = len(request.bookmarks)
            if bookmark_count == 0:
                response_text = "You don't have any bookmarks to export. Upload bookmarks first."
                suggestions = ["Upload bookmarks"]
            else:
                response_text = f"I can help you export your {bookmark_count} bookmarks in various formats including HTML (for browsers), JSON, or CSV."
                suggestions = ["Export as HTML", "Export as JSON", "Export as CSV"]
            
            return ChatResponse(
                response=response_text,
                intent=intent,
                action="export_options",
                suggestions=suggestions
            )
        
        else:  # general intent
            # Provide general help and information
            bookmark_count = len(request.bookmarks)
            
            if "help" in request.message.lower():
                response_text = f"""🐼 **PinPanda AI Assistant Help**

I can help you with:
• **Search**: "Find my React bookmarks" or "Show me coding resources"
• **Organize**: "Reorganize my bookmarks" or "Clean up my collection"  
• **Stats**: "How many bookmarks do I have?" or "Show my collection stats"
• **Export**: "Export my bookmarks" or "Download as HTML"

You currently have {bookmark_count} bookmarks loaded."""
                
                suggestions = ["Search bookmarks", "Reorganize collection", "View statistics", "Export bookmarks"]
            
            else:
                # General conversational response
                response_text = f"I'm your AI bookmark assistant! I can help you search, organize, and manage your {bookmark_count} bookmarks. What would you like to do?"
                suggestions = ["Search for bookmarks", "Reorganize my collection", "Show me statistics"]
            
            return ChatResponse(
                response=response_text,
                intent=intent,
                suggestions=suggestions
            )
    
    except Exception as e:
        logger.error(f"Chat processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")

@app.get("/api/chrome-bookmarks")
async def get_chrome_bookmarks():
    """Read Chrome bookmarks file from the local filesystem"""
    import platform
    import os

    docker_path = "/chrome-bookmarks/Bookmarks"
    if os.path.exists(docker_path):
        path = docker_path
    else:
        system = platform.system()
        if system == "Windows":
            base = os.environ.get("LOCALAPPDATA", "")
            path = os.path.join(base, "Google", "Chrome", "User Data", "Default", "Bookmarks")
        elif system == "Darwin":
            path = os.path.expanduser("~/Library/Application Support/Google/Chrome/Default/Bookmarks")
        else:
            path = os.path.expanduser("~/.config/google-chrome/Default/Bookmarks")

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Chrome bookmarks file not found at: {path}")

    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read Chrome bookmarks: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "has_openai_key": bool(os.environ.get("OPENAI_API_KEY")),
        "has_gemini_key": bool(os.environ.get("GOOGLE_GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")),
    }


async def _probe_openai(api_key: str) -> Dict[str, Any]:
    model = "gpt-4o-mini"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                json={"model": model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1, "temperature": 0},
            )
        if resp.status_code == 200:
            return {"ok": True, "model": model}
        err = resp.json().get("error", {}).get("message", resp.text)
        return {"ok": False, "error": f"{resp.status_code}: {err}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def _probe_gemini(api_key: str) -> Dict[str, Any]:
    model = "gemini-2.5-flash"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                params={"key": api_key},
                headers={"Content-Type": "application/json"},
                json={"contents": [{"parts": [{"text": "ping"}]}], "generationConfig": {"maxOutputTokens": 1, "temperature": 0}},
            )
        if resp.status_code == 200:
            return {"ok": True, "model": model}
        err = resp.json().get("error", {}).get("message", resp.text)
        return {"ok": False, "error": f"{resp.status_code}: {err}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@app.get("/api/test-keys")
async def test_keys():
    """Make a real test call against each .env-configured provider key.

    Returns per-provider status: configured (key present), ok (test call succeeded),
    model used, and error message on failure. Use to drive a trustworthy "AI Ready" indicator.
    """
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    gemini_key = os.environ.get("GOOGLE_GEMINI_API_KEY", "") or os.environ.get("GEMINI_API_KEY", "")

    tasks = []
    if openai_key:
        tasks.append(("openai", _probe_openai(openai_key)))
    if gemini_key:
        tasks.append(("gemini", _probe_gemini(gemini_key)))

    results: Dict[str, Any] = {
        "openai": {"configured": bool(openai_key), "ok": False, "error": None, "model": None},
        "gemini": {"configured": bool(gemini_key), "ok": False, "error": None, "model": None},
    }

    if tasks:
        outcomes = await asyncio.gather(*(t[1] for t in tasks), return_exceptions=True)
        for (provider, _), outcome in zip(tasks, outcomes):
            if isinstance(outcome, Exception):
                results[provider].update({"ok": False, "error": str(outcome)})
            else:
                results[provider].update(outcome)

    any_configured = results["openai"]["configured"] or results["gemini"]["configured"]
    all_pass = all(p["ok"] for p in results.values() if p["configured"])
    return {"providers": results, "any_configured": any_configured, "all_pass": all_pass and any_configured}

@app.get("/api/bookmarks", response_model=List[Bookmark])
async def get_bookmarks():
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT id, title, url, description, category, date_added, favicon, folder FROM bookmarks ORDER BY updated_at DESC"
        ).fetchall()
        return [
            Bookmark(
                id=r["id"], title=r["title"], url=r["url"],
                description=r["description"] or "", category=r["category"] or "Uncategorized",
                dateAdded=r["date_added"], favicon=r["favicon"], folder=r["folder"],
            )
            for r in rows
        ]
    finally:
        conn.close()

@app.post("/api/bookmarks/sync", response_model=BookmarkSyncResponse)
async def sync_bookmarks(request: BookmarkSyncRequest):
    if not request.bookmarks:
        return BookmarkSyncResponse(added=0, updated=0, deleted=0, total=0)
    added = updated = 0
    conn = get_db_connection()
    try:
        for bm in request.bookmarks:
            bm_dict = {
                "id": bm.id or str(uuid.uuid4()),
                "title": bm.title, "url": bm.url,
                "description": bm.description or "",
                "category": bm.category or "Uncategorized",
                "dateAdded": bm.dateAdded,
                "favicon": bm.favicon, "folder": bm.folder,
            }
            event = upsert_bookmark(conn, bm_dict, request.source)
            if event == "add":
                added += 1
            else:
                updated += 1
        conn.commit()
        total = conn.execute("SELECT COUNT(*) FROM bookmarks").fetchone()[0]
        return BookmarkSyncResponse(added=added, updated=updated, deleted=0, total=total)
    except Exception as e:
        conn.rollback()
        logger.error(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/bookmarks/{bookmark_id}")
async def delete_bookmark(bookmark_id: str):
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        record_history(conn, bookmark_id, "delete", "manual", old_data=dict(row))
        conn.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
        conn.commit()
        return {"deleted": True, "id": bookmark_id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/history", response_model=List[HistoryEntry])
async def get_history(limit: int = 100, offset: int = 0):
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM history ORDER BY occurred_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return [
            HistoryEntry(
                id=r["id"], bookmark_id=r["bookmark_id"],
                event=r["event"], source=r["source"],
                old_data=json.loads(r["old_data"]) if r["old_data"] else None,
                new_data=json.loads(r["new_data"]) if r["new_data"] else None,
                occurred_at=r["occurred_at"],
            )
            for r in rows
        ]
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)