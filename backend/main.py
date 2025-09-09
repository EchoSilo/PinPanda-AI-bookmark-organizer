from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import asyncio
import httpx
import json
import logging
from datetime import datetime
import uuid
import re
import math
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PinPanda AI Backend", version="1.0.0")

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
    model: str = "gpt-4o-mini"
    categorizationDepth: str = "balanced"
    sessionId: str

# Global storage for progress tracking
progress_store: Dict[str, ProgressUpdate] = {}

# Processing configuration
BATCH_SIZE = 75  # Optimized batch size
MAX_CONCURRENT_REQUESTS = 5  # Increased for better parallelization
REQUEST_DELAY = 1.0  # Delay between batches in seconds
MAX_TOKENS_PER_CHUNK = 20000  # Conservative token limit
PROCESSING_TIMEOUT_MS = 120000  # 2 minutes

def get_model_name(selected_model: str) -> str:
    """Map UI model names to actual OpenAI API model names"""
    model_map = {
        'gpt-5': 'gpt-4o-mini',  # Map to available model
        'gpt-5-mini': 'gpt-4o-mini',
        'gpt-5-nano': 'gpt-4o-mini',
        'o3-mini': 'gpt-4o-mini',  # Map to available model
        'gpt-4o': 'gpt-4o',
        'gpt-4o-mini': 'gpt-4o-mini',
        'gpt-4.1': 'gpt-4o',  # Map to available model
        'gpt-3.5-turbo': 'gpt-3.5-turbo',
        # Legacy mappings
        'gpt-3.5': 'gpt-3.5-turbo',
        'gpt-4': 'gpt-4o'
    }
    return model_map.get(selected_model, 'gpt-4o-mini')

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
You are a professional bookmark organization expert using the powerful GPT-4o-mini model. Your task is to create a clean, intuitive, hierarchical organization system for the user's bookmarks.

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

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)