import { Bookmark } from '@/types';
import { info, debug, warning } from '../logService';

// Logger alias for consistency
const Logger = {
  info,
  debug,
  warning
};

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

    // Look for JSON object pattern
    const jsonPattern = /\{[\s\S]*\}/g;
    const match = text.match(jsonPattern);

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

/**
 * Estimates token count for a string using a simple heuristic
 * @param text Text to estimate token count for
 * @returns Estimated token count
 */
export const estimateTokenCount = (text: string): number => {
  // A rough estimate: 1 token ~= 4 characters for English text
  return Math.ceil(text.length / 4);
};

/**
 * Splits bookmarks into chunks that can be processed by the AI
 * @param bookmarks Array of bookmarks to split
 * @param maxTokens Maximum tokens per chunk
 * @returns Array of bookmark chunks
 */
export const splitBookmarksIntoChunks = (
  bookmarks: Bookmark[],
  maxTokens: number = 4000
): Bookmark[][] => {
  const chunks: Bookmark[][] = [];
  let currentChunk: Bookmark[] = [];
  let currentTokens = 0;

  // Reserve tokens for the prompt and completion
  const reservedTokens = 1000;
  const effectiveMaxTokens = maxTokens - reservedTokens;

  for (const bookmark of bookmarks) {
    // Estimate tokens for this bookmark
    const bookmarkJson = JSON.stringify(bookmark);
    const bookmarkTokens = estimateTokenCount(bookmarkJson);

    // If adding this bookmark would exceed the limit, start a new chunk
    if (currentTokens + bookmarkTokens > effectiveMaxTokens) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentTokens = 0;
      }

      // If a single bookmark is too large, it gets its own chunk
      if (bookmarkTokens > effectiveMaxTokens) {
        Logger.warning('AIService', `Bookmark too large (${bookmarkTokens} tokens): ${bookmark.title}`);
        chunks.push([bookmark]);
        continue;
      }
    }

    // Add the bookmark to the current chunk
    currentChunk.push(bookmark);
    currentTokens += bookmarkTokens;
  }

  // Don't forget the last chunk
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