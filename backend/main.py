from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import httpx
import json
import logging
from datetime import datetime
import uuid

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

class ReorganizeRequest(BaseModel):
    bookmarks: List[Bookmark]
    apiKey: str
    model: str = "gpt-5-mini"
    categorizationDepth: str = "balanced"
    sessionId: str

class ProgressUpdate(BaseModel):
    sessionId: str
    progress: float
    status: str
    message: str
    completedBatches: int
    totalBatches: int

# Global storage for progress tracking
progress_store: Dict[str, ProgressUpdate] = {}

# Processing configuration
BATCH_SIZE = 15  # Smaller batches for better progress tracking
MAX_CONCURRENT_REQUESTS = 3  # Limit concurrent API calls
REQUEST_DELAY = 1.0  # Delay between batches in seconds

def get_model_name(selected_model: str) -> str:
    """Map UI model names to actual OpenAI API model names"""
    model_map = {
        'gpt-5': 'gpt-5',
        'gpt-5-mini': 'gpt-5-mini',
        'gpt-5-nano': 'gpt-5-nano',
        'o3-mini': 'o3-mini',
        'gpt-4o': 'gpt-4o',
        'gpt-4o-mini': 'gpt-4o-mini',
        'gpt-4.1': 'gpt-4.1',
        'gpt-3.5-turbo': 'gpt-3.5-turbo',
        # Legacy mappings
        'gpt-3.5': 'gpt-3.5-turbo',
        'gpt-4': 'gpt-4o'
    }
    return model_map.get(selected_model, 'gpt-5-mini')

def create_categorization_prompt(bookmarks: List[Bookmark], depth: str) -> str:
    """Create optimized prompt for bookmark categorization"""
    depth_instructions = {
        'simple': 'Use broad, general categories (5-8 categories max). Examples: Work, Entertainment, Shopping, News, Social Media',
        'balanced': 'Use specific but not overly detailed categories (10-15 categories). Create logical groupings.',
        'detailed': 'Create detailed subcategories for precise organization (20+ categories). Use hierarchical structure with "/" separators.'
    }
    
    instruction = depth_instructions.get(depth, depth_instructions['balanced'])
    
    bookmark_list = [
        {
            "index": i,
            "title": bookmark.title,
            "url": bookmark.url,
            "description": bookmark.description or ""
        }
        for i, bookmark in enumerate(bookmarks)
    ]
    
    return f"""{instruction}

Analyze these bookmarks and assign appropriate categories:

{json.dumps(bookmark_list, indent=2)}

Return a JSON array with exactly {len(bookmarks)} items, each containing only a "category" field. 
For detailed categorization, use "/" to separate hierarchy levels (e.g., "Development/JavaScript/React").

Example response format:
[
  {{"category": "Development/Frontend"}},
  {{"category": "News/Technology"}},
  {{"category": "Entertainment/Streaming"}}
]"""

async def process_batch_with_ai(
    bookmarks: List[Bookmark], 
    api_key: str, 
    model: str, 
    depth: str
) -> List[Dict[str, str]]:
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
                            "content": "You are an expert at organizing bookmarks. Analyze each bookmark and assign it to an appropriate category. Return only a valid JSON array with the same number of items, each containing a 'category' field."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2000
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
            
            # Parse and validate response
            try:
                categories = json.loads(content)
                if len(categories) != len(bookmarks):
                    logger.warning(f"Category count mismatch: expected {len(bookmarks)}, got {len(categories)}")
                    # Pad or truncate to match
                    while len(categories) < len(bookmarks):
                        categories.append({"category": "Uncategorized"})
                    categories = categories[:len(bookmarks)]
                
                return categories
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse AI response: {content}")
                # Return fallback categories
                return [{"category": "Uncategorized"} for _ in bookmarks]
                
        except httpx.TimeoutException:
            logger.error("Request timeout")
            raise HTTPException(status_code=408, detail="Request timeout")
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

async def reorganize_bookmarks_background(
    request: ReorganizeRequest
):
    """Background task to reorganize bookmarks with progress tracking"""
    session_id = request.sessionId
    bookmarks = request.bookmarks
    
    try:
        # Initialize progress
        total_bookmarks = len(bookmarks)
        batches = [bookmarks[i:i + BATCH_SIZE] for i in range(0, len(bookmarks), BATCH_SIZE)]
        total_batches = len(batches)
        
        progress_store[session_id] = ProgressUpdate(
            sessionId=session_id,
            progress=0.0,
            status="processing",
            message="Starting AI categorization...",
            completedBatches=0,
            totalBatches=total_batches
        )
        
        categorized_bookmarks = []
        
        # Process batches with controlled concurrency
        for i, batch in enumerate(batches):
            try:
                logger.info(f"Processing batch {i+1}/{total_batches} with {len(batch)} bookmarks")
                
                # Update progress
                progress_store[session_id] = ProgressUpdate(
                    sessionId=session_id,
                    progress=(i / total_batches) * 100,
                    status="processing",
                    message=f"Processing batch {i+1} of {total_batches}...",
                    completedBatches=i,
                    totalBatches=total_batches
                )
                
                # Process batch
                categories = await process_batch_with_ai(
                    batch, 
                    request.apiKey, 
                    request.model, 
                    request.categorizationDepth
                )
                
                # Apply categories to bookmarks
                for j, category_result in enumerate(categories):
                    if i * BATCH_SIZE + j < len(bookmarks):
                        bookmark = bookmarks[i * BATCH_SIZE + j]
                        bookmark.category = category_result.get('category', 'Uncategorized')
                        categorized_bookmarks.append(bookmark)
                
                # Add delay between batches to avoid rate limits
                if i < total_batches - 1:  # Don't delay after the last batch
                    await asyncio.sleep(REQUEST_DELAY)
                    
            except Exception as e:
                logger.error(f"Error processing batch {i+1}: {str(e)}")
                # Continue with remaining batches, mark failed bookmarks as uncategorized
                for j in range(len(batch)):
                    if i * BATCH_SIZE + j < len(bookmarks):
                        bookmark = bookmarks[i * BATCH_SIZE + j]
                        bookmark.category = "Uncategorized"
                        categorized_bookmarks.append(bookmark)
        
        # Mark as completed
        progress_store[session_id] = ProgressUpdate(
            sessionId=session_id,
            progress=100.0,
            status="completed",
            message=f"Successfully reorganized {len(categorized_bookmarks)} bookmarks!",
            completedBatches=total_batches,
            totalBatches=total_batches
        )
        
        # Store the result (in a real app, you'd use a proper database)
        progress_store[f"{session_id}_result"] = categorized_bookmarks
        
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