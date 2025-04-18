import { Bookmark, ProcessingProgress } from '@/types';
import * as Logger from '../logService';

// Helper function to find duplicate bookmarks
export const findDuplicateBookmarks = (
  bookmarks: Bookmark[], 
  progressCallback?: (progress: any) => void
): { originalIndex: number; duplicateIndex: number }[] => {
  const urlMap = new Map<string, number>();
  const duplicates: { originalIndex: number; duplicateIndex: number }[] = [];
  const total = bookmarks.length;
  
  bookmarks.forEach((bookmark, index) => {
    // Update progress every 50 bookmarks
    if (index % 50 === 0 && progressCallback) {
      progressCallback({ 
        step: 0, 
        message: `🔍 Scanning for duplicates (${index}/${total})`,
        bookmarksProcessed: index,
        progress: Math.round((index / total) * 10) // Progress from 0-10%
      });
    }
    
    // Normalize the URL to handle things like trailing slashes
    const normalizedUrl = bookmark.url.toLowerCase().replace(/\/$/, '');
    
    if (urlMap.has(normalizedUrl)) {
      duplicates.push({
        originalIndex: urlMap.get(normalizedUrl)!,
        duplicateIndex: index
      });
    } else {
      urlMap.set(normalizedUrl, index);
    }
  });
  
  if (progressCallback) {
    progressCallback({ 
      step: 0, 
      message: `✨ Found ${duplicates.length} duplicate bookmarks to clean up`,
      bookmarksProcessed: total,
      duplicatesFound: duplicates.length,
      progress: 10 // 10% progress after duplicate detection
    });
  }
  
  return duplicates;
};

// Extract JSON from AI response
export const extractJsonFromResponse = (text: string): any => {
  try {
    Logger.info('AIService', 'Extracting JSON from response');
    
    // First, try to parse the entire text as JSON
    try {
      const result = JSON.parse(text);
      Logger.info('AIService', 'Successfully parsed entire response as JSON');
      return result;
    } catch (e) {
      // Not valid JSON, continue with extraction
      Logger.info('AIService', 'Response is not pure JSON, trying to extract JSON portion');
    }
    
    // Preprocessing: Remove any markdown code block formatting
    let processedText = text.replace(/```json\s+|\s+```|```\s+|\s+```/g, '');
    
    // Try parsing again after removing markdown
    try {
      const result = JSON.parse(processedText);
      Logger.info('AIService', 'Successfully parsed JSON after removing markdown');
      return result;
    } catch (e) {
      Logger.info('AIService', 'Failed to parse after removing markdown, continuing with pattern extraction');
    }
    
    // Look for JSON object pattern
    const jsonPattern = /\{[\s\S]*\}/g;
    const match = processedText.match(jsonPattern);
    
    if (match && match[0]) {
      try {
        const result = JSON.parse(match[0]);
        Logger.info('AIService', 'Successfully extracted JSON using pattern match');
        return result;
      } catch (e) {
        Logger.warning('AIService', `Failed to parse extracted JSON pattern: ${e}`);
      }
    }
    
    // Try to find JSON with markdown code block
    const markdownPattern = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
    const markdownMatch = markdownPattern.exec(text);
    
    if (markdownMatch && markdownMatch[1]) {
      try {
        const result = JSON.parse(markdownMatch[1]);
        Logger.info('AIService', 'Successfully extracted JSON from markdown code block');
        return result;
      } catch (e) {
        Logger.warning('AIService', `Failed to parse markdown JSON: ${e}`);
      }
    }
    
    // Last resort: try to find anything that looks like a JSON object
    const lastResortPattern = /(\{[^{]*?\})/g;
    const matches = text.match(lastResortPattern);
    
    if (matches) {
      for (const potentialJson of matches) {
        try {
          const result = JSON.parse(potentialJson);
          Logger.info('AIService', 'Successfully extracted JSON using last resort pattern');
          return result;
        } catch (e) {
          // Continue to next match
        }
      }
    }
    
    // If we get here, log the response for debugging
    Logger.error('AIService', 'Could not extract valid JSON from response', { responseText: text });
    throw new Error('Could not extract valid JSON from response');
  } catch (error) {
    Logger.error('AIService', `JSON extraction failed: ${error}`);
    
    // Return a minimal fallback categorization
    Logger.warning('AIService', 'Using fallback categorization with "All Bookmarks" category');
    return { 
      "All Bookmarks": {
        "bookmarks": Array.from({ length: 1000 }, (_, i) => i),
        "subcategories": {}
      }
    };
  }
};

// Estimate token count for a text string
export const estimateTokenCount = (text: string): number => {
  // A very rough estimate: 1 token ~= 4 characters for English text
  return Math.ceil(text.length / 4);
};

// Create chunks of bookmarks for processing
export const chunkBookmarks = (
  bookmarks: Bookmark[], 
  maxTokens: number = 20000 // Reduced from 40000 to be even more conservative
): Bookmark[][] => {
  const chunks: Bookmark[][] = [];
  let currentChunk: Bookmark[] = [];
  let currentTokenCount = 0;
  
  // Add buffer for system prompt and other overhead
  const systemPromptBuffer = 3000;  // Reserve tokens for system prompt
  const responseBuffer = 16000;     // Reserve tokens for response (GPT-4o-mini can output up to 16,384 tokens)
  const overheadBuffer = 5000;      // Additional buffer for JSON formatting, etc. - increased for safety
  
  // Effective max tokens for the bookmarks themselves
  const effectiveMaxTokens = maxTokens - systemPromptBuffer - responseBuffer - overheadBuffer;
  
  // Log the chunking strategy
  Logger.info('AIService', `Chunking bookmarks with effective max tokens: ${effectiveMaxTokens} (total: ${maxTokens}, buffers: ${systemPromptBuffer + responseBuffer + overheadBuffer})`);
  
  // If the total number of bookmarks is small enough, just use a single chunk
  // This is more efficient for the GPT-4o-mini model which has a large context window
  const estimatedTotalTokens = estimateTokenCount(JSON.stringify(bookmarks));
  if (estimatedTotalTokens <= effectiveMaxTokens) {
    Logger.info('AIService', `All ${bookmarks.length} bookmarks fit in a single chunk (est. ${estimatedTotalTokens} tokens)`);
    return [bookmarks];
  }
  
  // If we have a very large number of bookmarks, use a more aggressive chunking strategy
  if (bookmarks.length > 1000 || estimatedTotalTokens > 100000) {
    Logger.warning('AIService', `Very large bookmark set detected (${bookmarks.length} bookmarks, ~${estimatedTotalTokens} tokens). Using aggressive chunking.`);
    
    // Create chunks of approximately equal size
    const CHUNK_SIZE = 75; // Reduced from 100 to a more conservative value between 50-100
    
    for (let i = 0; i < bookmarks.length; i += CHUNK_SIZE) {
      chunks.push(bookmarks.slice(i, i + CHUNK_SIZE));
    }
    
    // Log chunking results
    Logger.info('AIService', `Split ${bookmarks.length} bookmarks into ${chunks.length} fixed-size chunks of ~${CHUNK_SIZE} bookmarks each`);
    return chunks;
  }
  
  // Normal chunking for medium-sized collections
  for (const bookmark of bookmarks) {
    // Estimate tokens for this bookmark
    const bookmarkText = `${bookmark.title} ${bookmark.url} ${bookmark.folder || ''}`;
    const bookmarkTokens = estimateTokenCount(bookmarkText);
    
    // If adding this bookmark would exceed the limit, start a new chunk
    if (currentTokenCount + bookmarkTokens > effectiveMaxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokenCount = 0;
    }
    
    // Add the bookmark to the current chunk
    currentChunk.push(bookmark);
    currentTokenCount += bookmarkTokens;
  }
  
  // Add the last chunk if it has any bookmarks
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  // Log chunking results
  Logger.info('AIService', `Split ${bookmarks.length} bookmarks into ${chunks.length} chunks`);
  chunks.forEach((chunk, i) => {
    const chunkTokens = estimateTokenCount(JSON.stringify(chunk));
    Logger.info('AIService', `Chunk ${i+1}: ${chunk.length} bookmarks, ~${chunkTokens} tokens`);
    
    // Warning if any chunk is still too large
    if (chunkTokens > effectiveMaxTokens) {
      Logger.warning('AIService', `Chunk ${i+1} may be too large (${chunkTokens} tokens > ${effectiveMaxTokens} effective max)`);
    }
  });
  
  return chunks;
}; 