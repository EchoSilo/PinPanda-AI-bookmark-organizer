'use client';

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as Logger from '../logService';
import { Bookmark, OrganizedBookmarks, ProcessingProgress, AIResponse } from '@/types';
import { 
  getApiKey,
  PROCESSING_TIMEOUT_MS, 
  CATEGORIZATION_SYSTEM_PROMPT,
  REORGANIZATION_SYSTEM_PROMPT,
  isValidApiKey,
  OPENAI_MODEL,
  MAX_TOKENS
} from './constants';
import { 
  findDuplicateBookmarks, 
  extractJsonFromResponse, 
  chunkBookmarks,
  estimateTokenCount
} from './utils';

// Define interfaces for the hierarchical category structure
interface HierarchicalCategory {
  bookmarks: number[];
  subcategories: Record<string, number[]>;
}

// Create a minimal result structure when AI processing fails
const createMinimalResult = (bookmarks: Bookmark[]): OrganizedBookmarks => {
  Logger.info('AIService', 'Creating minimal fallback result with all bookmarks in a single category');
  
  // Ensure each bookmark has an ID
  const bookmarksWithIds = bookmarks.map(bookmark => ({
    ...bookmark,
    id: bookmark.id || uuidv4()
  }));
  
  // Find duplicates even in minimal result
  const duplicates = findDuplicateBookmarks(bookmarksWithIds);
  
  // Calculate basic duplicate stats
  const urlMap = new Map<string, number[]>();
  bookmarksWithIds.forEach((bookmark, index) => {
    const normalizedUrl = bookmark.url.toLowerCase().replace(/\/$/, '');
    if (!urlMap.has(normalizedUrl)) {
      urlMap.set(normalizedUrl, []);
    }
    urlMap.get(normalizedUrl)!.push(index);
  });
  
  const uniqueUrls = urlMap.size;
  const urlsWithDuplicates = Array.from(urlMap.entries())
    .filter(([_, indices]) => indices.length > 1).length;
  
  // Find the most duplicated URLs (top 5)
  const mostDuplicatedUrls = Array.from(urlMap.entries())
    .filter(([_, indices]) => indices.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([url, indices]) => ({
      url,
      count: indices.length,
      indices
    }));
  
  // Log the number of bookmarks being included
  Logger.info('AIService', `Including ${bookmarksWithIds.length} bookmarks in the "All Bookmarks" category`);
  Logger.info('AIService', `Found ${duplicates.length} duplicate bookmarks`);
  
  return {
    categories: [{
      name: 'All Bookmarks',
      bookmarks: bookmarksWithIds
    }],
    invalidBookmarks: [],
    duplicateBookmarks: duplicates,
    duplicateStats: {
      uniqueUrls,
      urlsWithDuplicates,
      totalDuplicateReferences: duplicates.length,
      mostDuplicatedUrls
    }
  };
};

// Add this helper function at the top of the file after imports
const getPandaProgressMessage = (start: number, end: number, total: number): string => {
  const messages = [
    `🐼 Munching through bamboo batch ${start} to ${end} of ${total}...`,
    `🎋 Climbing up the data tree: branches ${start} to ${end} of ${total}...`,
    `🐾 Paws-ing at checkpoints ${start} to ${end} of ${total}...`,
    `😴 Napping through sections ${start} to ${end} of ${total}...`,
    `🎍 Rolling through data shoots ${start} to ${end} of ${total}...`,
    `🌿 Snacking on bookmark leaves ${start} to ${end} of ${total}...`,
    `🏮 Exploring data forests ${start} to ${end} of ${total}...`,
    `🎋 Bamboo-zling through chunks ${start} to ${end} of ${total}...`
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};

// Main function to organize bookmarks
export const organizeBookmarks = async (
  bookmarks: Bookmark[],
  progressCallback: ((progress: ProcessingProgress) => void) | null = null,
  aiResponseCallback: ((response: AIResponse) => void) | null = null
): Promise<OrganizedBookmarks> => {
  Logger.info('AIService', `Starting to organize ${bookmarks.length} bookmarks`);
  
  // Ensure each bookmark has an ID
  const bookmarksWithIds = bookmarks.map(bookmark => ({
    ...bookmark,
    id: bookmark.id || uuidv4()
  }));

  // Find duplicate bookmarks
  const duplicates = findDuplicateBookmarks(
    bookmarksWithIds, 
    progressCallback ? (progress: any) => progressCallback(progress as ProcessingProgress) : undefined
  );
  
  // Store duplicate statistics for later use
  let duplicateStats: OrganizedBookmarks['duplicateStats'] | undefined;
  
  // Extract duplicate stats from the findDuplicateBookmarks function
  // We'll calculate this here to avoid the recursive call
  const urlMap = new Map<string, number[]>();
  bookmarksWithIds.forEach((bookmark, index) => {
    const normalizedUrl = bookmark.url.toLowerCase().replace(/\/$/, '');
    if (!urlMap.has(normalizedUrl)) {
      urlMap.set(normalizedUrl, []);
    }
    urlMap.get(normalizedUrl)!.push(index);
  });
  
  const uniqueUrls = urlMap.size;
  const urlsWithDuplicates = Array.from(urlMap.entries())
    .filter(([_, indices]) => indices.length > 1).length;
  
  // Find the most duplicated URLs (top 5)
  const mostDuplicatedUrls = Array.from(urlMap.entries())
    .filter(([_, indices]) => indices.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([url, indices]) => ({
      url,
      count: indices.length,
      indices
    }));
  
  // Create the duplicate stats object
  duplicateStats = {
    uniqueUrls,
    urlsWithDuplicates,
    totalDuplicateReferences: duplicates.length,
    mostDuplicatedUrls
  };
  
  // If we have progress callback, send the duplicate stats
  if (progressCallback) {
    progressCallback({
      step: 0,
      message: `Found ${duplicates.length} duplicate bookmarks across ${urlsWithDuplicates} unique URLs`,
      progress: 12,
      bookmarksProcessed: bookmarksWithIds.length,
      duplicatesFound: duplicates.length,
      duplicateStats
    });
  }
  
  try {
    // Get the API key from localStorage
    const apiKey = getApiKey();
    
    // Check if API key is valid
    if (!isValidApiKey(apiKey)) {
      Logger.warning('AIService', 'Invalid or missing API key, using fallback categorization');
      return createMinimalResult(bookmarksWithIds);
    }
    
    // Update progress
    if (progressCallback) {
      progressCallback({
        step: 1,
        message: '🧠 Training AI on your bookmark collection...',
        progress: 15
      });
    }
    
    // Prepare bookmarks for AI processing
    const bookmarkData = bookmarksWithIds.map((bookmark, index) => ({
      index,
      title: bookmark.title,
      url: bookmark.url,
      folder: bookmark.folder || 'Uncategorized'
    }));
    
    Logger.info('AIService', `Prepared ${bookmarkData.length} bookmarks for AI processing`);
    
    // Create chunks if needed
    const chunks = chunkBookmarks(bookmarksWithIds);
    const isSingleChunk = chunks.length === 1;
    
    Logger.info('AIService', `Split bookmarks into ${chunks.length} chunks for processing`);
    
    if (progressCallback) {
      progressCallback({
        step: 1,
        message: isSingleChunk 
          ? '🤖 AI is analyzing your bookmarks...' 
          : `✨ Processing ${chunks.length} batches in parallel for faster results...`,
        progress: 20
      });
    }
    
    // Process single chunk or multiple chunks
    let categorization: Record<string, number[]> = {};
    
    try {
      if (isSingleChunk) {
        // Process all bookmarks at once
        Logger.info('AIService', 'Processing all bookmarks in a single chunk');
        categorization = await processSingleChunk(bookmarkData, progressCallback, aiResponseCallback);
      } else {
        // Process in chunks and merge results
        Logger.info('AIService', `Processing bookmarks in ${chunks.length} separate chunks using parallel requests`);
        categorization = await processMultipleChunks(chunks, progressCallback, aiResponseCallback);
      }
      
      Logger.info('AIService', `Received categorization with ${Object.keys(categorization).length} categories`);
      
      // Validate categorization
      if (!categorization || Object.keys(categorization).length === 0) {
        Logger.error('AIService', 'Received empty categorization from AI, using fallback');
        return createMinimalResult(bookmarksWithIds);
      }
    } catch (error) {
      Logger.error('AIService', `Error during AI categorization: ${error}`);
      return createMinimalResult(bookmarksWithIds);
    }
    
    // Convert categorization to organized bookmarks structure
    const categories: { name: string; bookmarks: Bookmark[] }[] = [];
    
    // Process each category from the AI response
    Object.entries(categorization).forEach(([name, data]) => {
      if (Array.isArray(data)) {
        // Old format - just an array of indices
        const validIndices = data.filter(index => index >= 0 && index < bookmarksWithIds.length);
        
        if (validIndices.length > 0) {
          categories.push({
            name,
            bookmarks: validIndices.map(index => bookmarksWithIds[index])
          });
        }
      } else {
        // New hierarchical format
        const categoryData = data as any; // Use any to bypass type checking
        
        // Add main category bookmarks
        if (categoryData.bookmarks && Array.isArray(categoryData.bookmarks)) {
          const validIndices = categoryData.bookmarks.filter((index: number) => 
            index >= 0 && index < bookmarksWithIds.length
          );
          
          if (validIndices.length > 0) {
            categories.push({
              name,
              bookmarks: validIndices.map((index: number) => bookmarksWithIds[index])
            });
          }
        }
        
        // Add subcategories
        if (categoryData.subcategories && typeof categoryData.subcategories === 'object') {
          Object.entries(categoryData.subcategories).forEach(([subName, subIndices]) => {
            if (Array.isArray(subIndices)) {
              const validSubIndices = (subIndices as number[]).filter(index => 
                index >= 0 && index < bookmarksWithIds.length
              );
              
              if (validSubIndices.length > 0) {
                categories.push({
                  name: `${name} / ${subName}`,
                  bookmarks: validSubIndices.map(index => bookmarksWithIds[index])
                });
              }
            }
          });
        }
      }
    });
    
    Logger.info('AIService', `Created ${categories.length} categories with bookmarks`);
    
    // Log category statistics
    categories.forEach(category => {
      Logger.info('AIService', `Category "${category.name}": ${category.bookmarks.length} bookmarks`);
    });
    
    // Create the final result
    const result: OrganizedBookmarks = {
      categories,
      invalidBookmarks: [],
      duplicateBookmarks: duplicates,
      duplicateStats: duplicateStats
    };
    
    // Update progress
    if (progressCallback) {
      progressCallback({
        step: 1,
        message: `🎨 Creating your personalized bookmark organization with ${categories.length} categories`,
        progress: 80
      });
    }
    
    return result;
  } catch (error) {
    Logger.error('AIService', `Error organizing bookmarks: ${error}`);
    
    // Return a minimal result on error
    return createMinimalResult(bookmarksWithIds);
  }
};

// Process a single chunk of bookmarks
const processSingleChunk = async (
  bookmarkData: any[],
  progressCallback: ((progress: ProcessingProgress) => void) | null,
  aiResponseCallback: ((response: AIResponse) => void) | null
): Promise<Record<string, number[]>> => {
  try {
    // Check if we need to further limit the data due to size
    const MAX_BOOKMARKS_PER_REQUEST = 75; // Reduced from 500 to a very conservative value between 50-100
    let dataToProcess = bookmarkData;
    
    if (bookmarkData.length > MAX_BOOKMARKS_PER_REQUEST) {
      Logger.warning('AIService', `Bookmark data is too large (${bookmarkData.length} bookmarks), limiting to ${MAX_BOOKMARKS_PER_REQUEST} bookmarks`);
      
      // Take a representative sample from across the full dataset
      const samplingInterval = Math.ceil(bookmarkData.length / MAX_BOOKMARKS_PER_REQUEST);
      dataToProcess = [];
      
      for (let i = 0; i < bookmarkData.length; i += samplingInterval) {
        dataToProcess.push(bookmarkData[i]);
        if (dataToProcess.length >= MAX_BOOKMARKS_PER_REQUEST) break;
      }
      
      Logger.info('AIService', `Sampled ${dataToProcess.length} bookmarks for categorization`);
      
      if (progressCallback) {
        progressCallback({
          step: 1,
          message: `Processing a sample of ${dataToProcess.length} bookmarks to create categories...`,
          progress: 25
        });
      }
    }
    
    // Prepare the prompt
    const prompt = `
Here are ${dataToProcess.length} bookmarks to categorize:

${JSON.stringify(dataToProcess, null, 2)}

IMPORTANT INSTRUCTIONS:
1. Analyze these bookmarks deeply to understand their content, purpose, and relationships
2. Create a hierarchical organization with main categories and subcategories
3. Group similar bookmarks together based on themes, topics, and content
4. Use descriptive, concise category names that clearly indicate the content
5. Ensure every bookmark is assigned to the most specific appropriate category
6. Create a clean, intuitive hierarchy that eliminates clutter
7. Make categories easy to browse by limiting the number of items in each category

Return ONLY a valid JSON object with main categories and subcategories as shown in the system prompt.
`;
    
    // Log token estimates
    const promptTokens = estimateTokenCount(prompt);
    const systemTokens = estimateTokenCount(CATEGORIZATION_SYSTEM_PROMPT);
    const totalTokens = promptTokens + systemTokens;
    
    Logger.debug('AIService', `Prompt token estimate: ${promptTokens}`, { promptTokens });
    Logger.debug('AIService', `System prompt token estimate: ${systemTokens}`, { systemTokens });
    Logger.debug('AIService', `Total token estimate: ${totalTokens}`, { totalTokens });
    
    if (progressCallback) {
      progressCallback({
        step: 1,
        message: `Sending request to OpenAI API (est. ${totalTokens} tokens)...`,
        progress: 30
      });
    }
    
    // Call the OpenAI API
    const startTime = Date.now();
    const response = await callOpenAI(CATEGORIZATION_SYSTEM_PROMPT, prompt);
    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000;
    
    Logger.info('AIService', `OpenAI API response received in ${responseTime.toFixed(2)} seconds`);
    
    // Log response details
    const responseTokens = estimateTokenCount(response.content);
    Logger.debug('AIService', `Response token estimate: ${responseTokens}`, { responseTokens });
    Logger.debug('AIService', `Response content preview: ${response.content.substring(0, 100)}...`);
    
    if (progressCallback) {
      progressCallback({
        step: 1,
        message: `Processing AI response (${responseTokens} tokens)...`,
        progress: 60
      });
    }
    
    // Record the AI response
    if (aiResponseCallback) {
      aiResponseCallback({
        step: 'categorization',
        prompt,
        response: response.content,
        timestamp: Date.now()
      });
    }
    
    // Extract JSON from response
    Logger.info('AIService', 'Extracting categorization from AI response');
    const categorization = extractJsonFromResponse(response.content);
    
    if (!categorization) {
      Logger.error('AIService', 'Failed to extract categorization from AI response');
      throw new Error('Failed to extract categorization from AI response');
    }
    
    // If we used a sample, we need to apply the categories to all bookmarks
    if (dataToProcess.length < bookmarkData.length) {
      Logger.info('AIService', 'Applying categories from sample to all bookmarks');
      
      if (progressCallback) {
        progressCallback({
          step: 1,
          message: `Applying categories to all ${bookmarkData.length} bookmarks...`,
          progress: 70
        });
      }
      
      // Create a map of folder paths to category names
      const folderToCategory: Record<string, string[]> = {};
      const urlToCategory: Record<string, string[]> = {};
      const domainToCategory: Record<string, string[]> = {};
      
      // First, build the mapping from the sample data
      dataToProcess.forEach((bookmark, index) => {
        // Find all categories this bookmark belongs to
        Object.entries(categorization).forEach(([category, indices]) => {
          if ((indices as number[]).includes(index)) {
            // Map by folder
            const folder = bookmark.folder || '';
            if (!folderToCategory[folder]) folderToCategory[folder] = [];
            if (!folderToCategory[folder].includes(category)) {
              folderToCategory[folder].push(category);
            }
            
            // Map by URL domain
            try {
              const url = new URL(bookmark.url);
              const domain = url.hostname;
              if (!domainToCategory[domain]) domainToCategory[domain] = [];
              if (!domainToCategory[domain].includes(category)) {
                domainToCategory[domain].push(category);
              }
            } catch (e) {
              // Invalid URL, skip domain mapping
            }
            
            // Map by exact URL
            if (!urlToCategory[bookmark.url]) urlToCategory[bookmark.url] = [];
            if (!urlToCategory[bookmark.url].includes(category)) {
              urlToCategory[bookmark.url].push(category);
            }
          }
        });
      });
      
      // Now create a new categorization for all bookmarks
      const fullCategorization: Record<string, number[]> = {};
      
      // Initialize categories
      Object.keys(categorization).forEach(category => {
        fullCategorization[category] = [];
      });
      
      // Categorize all bookmarks based on the mappings
      bookmarkData.forEach((bookmark, index) => {
        let categorized = false;
        
        // Try exact URL match first (highest priority)
        if (urlToCategory[bookmark.url]) {
          urlToCategory[bookmark.url].forEach(category => {
            if (!fullCategorization[category].includes(index)) {
              fullCategorization[category].push(index);
              categorized = true;
            }
          });
        }
        
        // Try domain match next
        if (!categorized) {
          try {
            const url = new URL(bookmark.url);
            const domain = url.hostname;
            if (domainToCategory[domain]) {
              domainToCategory[domain].forEach(category => {
                if (!fullCategorization[category].includes(index)) {
                  fullCategorization[category].push(index);
                  categorized = true;
                }
              });
            }
          } catch (e) {
            // Invalid URL, skip domain matching
          }
        }
        
        // Try folder match last (lowest priority)
        if (!categorized) {
          const folder = bookmark.folder || '';
          if (folderToCategory[folder]) {
            folderToCategory[folder].forEach(category => {
              if (!fullCategorization[category].includes(index)) {
                fullCategorization[category].push(index);
                categorized = true;
              }
            });
          }
        }
        
        // If still not categorized, put in the largest category
        if (!categorized) {
          let largestCategory = '';
          let largestSize = 0;
          
          Object.entries(fullCategorization).forEach(([category, indices]) => {
            if (indices.length > largestSize) {
              largestCategory = category;
              largestSize = indices.length;
            }
          });
          
          if (largestCategory) {
            fullCategorization[largestCategory].push(index);
          } else {
            // If no categories exist yet, create an "Uncategorized" category
            if (!fullCategorization['Uncategorized']) {
              fullCategorization['Uncategorized'] = [];
            }
            fullCategorization['Uncategorized'].push(index);
          }
        }
      });
      
      // Use the full categorization
      return fullCategorization;
    }
    
    // Log categorization details
    const categoryCount = Object.keys(categorization).length;
    const totalBookmarksAssigned = Object.values(categorization).reduce((sum: number, indices) => sum + (indices as number[]).length, 0);
    
    Logger.info('AIService', `Successfully extracted categorization with ${categoryCount} categories`);
    Logger.debug('AIService', `Categories: ${Object.keys(categorization).join(', ')}`);
    Logger.debug('AIService', `Total bookmarks assigned: ${totalBookmarksAssigned}`, { 
      categoryCount, 
      totalBookmarksAssigned,
      categoriesWithCounts: Object.entries(categorization).map(([name, indices]) => ({ 
        name, 
        count: (indices as number[]).length 
      }))
    });
    
    if (progressCallback) {
      progressCallback({
        step: 1,
        message: `🎯 Processed ${totalBookmarksAssigned} bookmarks across ${categoryCount} categories`,
        progress: 80
      });
    }
    
    return categorization;
  } catch (error) {
    Logger.error('AIService', `Error processing single chunk: ${error}`);
    throw error;
  }
};

// Process multiple chunks of bookmarks in parallel
const processMultipleChunks = async (
  chunks: Bookmark[][],
  progressCallback: ((progress: ProcessingProgress) => void) | null,
  aiResponseCallback: ((response: AIResponse) => void) | null
): Promise<Record<string, number[]>> => {
  try {
    Logger.info('AIService', `Processing ${chunks.length} chunks in parallel`);
    
    if (progressCallback) {
      progressCallback({
        step: 1,
        message: `Processing ${chunks.length} chunks in parallel...`,
        progress: 20
      });
    }
    
    // Maximum number of concurrent API requests
    // Adjust this based on rate limits and performance needs
    const MAX_CONCURRENT_REQUESTS = 5; // Increased to 5 for better parallelization
    
    // Process chunks in batches to avoid overwhelming the API
    const categorizations: Record<string, number[]>[] = [];
    let processedChunks = 0;
    
    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_REQUESTS) {
      const currentBatch = chunks.slice(i, i + MAX_CONCURRENT_REQUESTS);
      Logger.info('AIService', `Processing batch of ${currentBatch.length} chunks (${i+1} to ${Math.min(i+MAX_CONCURRENT_REQUESTS, chunks.length)} of ${chunks.length})`);
      
      // Update progress
      if (progressCallback) {
        progressCallback({
          step: 1,
          message: getPandaProgressMessage(i+1, Math.min(i+MAX_CONCURRENT_REQUESTS, chunks.length), chunks.length),
          progress: 20 + Math.round((i / chunks.length) * 60)
        });
      }
      
      // Prepare all chunk data in the current batch
      const batchPromises = currentBatch.map(async (chunk, batchIndex) => {
        const chunkIndex = i + batchIndex;
        
        // Process the chunk with retry mechanism
        return processChunkWithRetry(chunk, chunkIndex, chunks.length, 2, chunks, aiResponseCallback);
      });
      
      // Wait for all chunks in this batch to be processed
      const batchStartTime = Date.now();
      Logger.info('AIService', `Starting batch processing of ${currentBatch.length} chunks in parallel`);
      
      const batchResults = await Promise.all(batchPromises);
      
      const batchDuration = (Date.now() - batchStartTime) / 1000;
      Logger.info('AIService', `Completed batch processing in ${batchDuration.toFixed(2)} seconds`);
      
      // Filter out null results and add to categorizations
      const validResults = batchResults.filter(Boolean);
      Logger.info('AIService', `Got ${validResults.length} valid results out of ${batchResults.length} chunks in this batch`);
      
      validResults.forEach(result => {
        if (result) categorizations.push(result);
      });
      
      // Update processed chunks count
      processedChunks += currentBatch.length;
      
      // Update progress
      if (progressCallback) {
        progressCallback({
          step: 1,
          message: processedChunks === chunks.length 
            ? '🐼 Taking a well-deserved bamboo break after processing all chunks!'
            : `🐾 Panda progress: ${processedChunks} of ${chunks.length} batches sorted - chomping along!`,
          progress: 20 + Math.round((processedChunks / chunks.length) * 60)
        });
      }
    }
    
    // Merge all categorizations - convert hierarchical to flat for compatibility
    const mergedCategorization: Record<string, number[]> = {};
    
    categorizations.forEach(categorization => {
      // Process each category
      Object.entries(categorization).forEach(([category, value]) => {
        // Initialize category if needed
        if (!mergedCategorization[category]) {
          mergedCategorization[category] = [];
        }
        
        // Handle both formats
        if (Array.isArray(value)) {
          // Old format - just add the indices
          mergedCategorization[category] = [...mergedCategorization[category], ...value];
        } else if (typeof value === 'object' && value !== null) {
          // New hierarchical format - flatten it
          const hierarchicalValue = value as unknown as { 
            bookmarks?: number[]; 
            subcategories?: Record<string, number[]> 
          };
          
          // Add main category bookmarks
          if (hierarchicalValue.bookmarks && Array.isArray(hierarchicalValue.bookmarks)) {
            mergedCategorization[category] = [...mergedCategorization[category], ...hierarchicalValue.bookmarks];
          }
          
          // Add subcategories as separate categories
          if (hierarchicalValue.subcategories && typeof hierarchicalValue.subcategories === 'object') {
            Object.entries(hierarchicalValue.subcategories).forEach(([subName, subIndices]) => {
              const fullCategoryName = `${category} / ${subName}`;
              
              if (!mergedCategorization[fullCategoryName]) {
                mergedCategorization[fullCategoryName] = [];
              }
              
              if (Array.isArray(subIndices)) {
                mergedCategorization[fullCategoryName] = [
                  ...mergedCategorization[fullCategoryName], 
                  ...subIndices
                ];
              }
            });
          }
        }
      });
    });
    
    // Log the results
    const categoryCount = Object.keys(mergedCategorization).length;
    Logger.info('AIService', `Merged categorizations with ${categoryCount} total categories`);
    
    if (progressCallback) {
      progressCallback({
        step: 1,
        message: `🎋 PinPanda has organized your bookmarks into ${categoryCount} cozy bamboo groves`,
        progress: 80
      });
    }
    
    return mergedCategorization;
  } catch (error) {
    Logger.error('AIService', `Error processing multiple chunks: ${error}`);
    throw error;
  }
};

// Process a chunk with retry mechanism
const processChunkWithRetry = async (
  chunk: Bookmark[],
  chunkIndex: number,
  totalChunks: number,
  maxRetries: number = 2,
  allChunks: Bookmark[][],
  aiResponseCallback: ((response: AIResponse) => void) | null
): Promise<Record<string, number[]> | null> => {
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    try {
      // Prepare chunk data
      const chunkData = chunk.map((bookmark, chunkItemIndex) => ({
        // Use local index within this chunk for simplicity
        index: chunkItemIndex,
        title: bookmark.title,
        url: bookmark.url,
        folder: bookmark.folder || 'Uncategorized'
      }));
      
      // Process the chunk
      const prompt = `
Here are ${chunkData.length} bookmarks to categorize (chunk ${chunkIndex + 1} of ${totalChunks}):

${JSON.stringify(chunkData, null, 2)}

IMPORTANT INSTRUCTIONS:
1. Analyze these bookmarks deeply to understand their content, purpose, and relationships
2. Create a hierarchical organization with main categories and subcategories
3. Group similar bookmarks together based on themes, topics, and content
4. Use descriptive, concise category names that clearly indicate the content
5. Ensure every bookmark is assigned to the most specific appropriate category
6. Create a clean, intuitive hierarchy that eliminates clutter
7. Make categories easy to browse by limiting the number of items in each category

Return ONLY a valid JSON object with main categories and subcategories as shown in the system prompt.
`;
      
      // Call the OpenAI API
      const response = await callOpenAI(CATEGORIZATION_SYSTEM_PROMPT, prompt);
      
      // Record the AI response
      if (aiResponseCallback) {
        aiResponseCallback({
          step: `categorization_chunk_${chunkIndex + 1}${retryCount > 0 ? `_retry_${retryCount}` : ''}`,
          prompt,
          response: response.content,
          timestamp: Date.now()
        });
      }
      
      // Extract JSON from response
      const chunkCategorization = extractJsonFromResponse(response.content);
      
      if (!chunkCategorization) {
        Logger.error('AIService', `Failed to extract categorization from AI response for chunk ${chunkIndex + 1}`);
        retryCount++;
        
        if (retryCount <= maxRetries) {
          Logger.info('AIService', `Retrying chunk ${chunkIndex + 1} (attempt ${retryCount} of ${maxRetries})`);
          continue;
        }
        
        return null;
      }
      
      // Remap indices to be relative to this chunk
      const remappedCategorization: Record<string, any> = {};
      
      // Calculate the global index offset for this chunk
      const globalIndexOffset = allChunks.slice(0, chunkIndex).reduce((sum: number, c: Bookmark[]) => sum + c.length, 0);
      
      // Remap each category's indices
      Object.entries(chunkCategorization).forEach(([category, data]) => {
        if (Array.isArray(data)) {
          // Old format - just an array of indices
          remappedCategorization[category] = (data as number[]).map(index => index + globalIndexOffset);
        } else {
          // New hierarchical format
          const categoryData = data as any;
          remappedCategorization[category] = {
            bookmarks: [],
            subcategories: {}
          };
          
          // Remap main category bookmarks
          if (categoryData.bookmarks && Array.isArray(categoryData.bookmarks)) {
            remappedCategorization[category].bookmarks = 
              categoryData.bookmarks.map((index: number) => index + globalIndexOffset);
          }
          
          // Remap subcategories
          if (categoryData.subcategories && typeof categoryData.subcategories === 'object') {
            Object.entries(categoryData.subcategories).forEach(([subName, subIndices]) => {
              if (Array.isArray(subIndices)) {
                remappedCategorization[category].subcategories[subName] = 
                  (subIndices as number[]).map(index => index + globalIndexOffset);
              }
            });
          }
        }
      });
      
      Logger.info('AIService', `Successfully processed chunk ${chunkIndex + 1} of ${totalChunks} with ${Object.keys(remappedCategorization).length} categories`);
      return remappedCategorization;
    } catch (error) {
      Logger.error('AIService', `Error processing chunk ${chunkIndex + 1}: ${error}`);
      retryCount++;
      
      if (retryCount <= maxRetries) {
        Logger.info('AIService', `Retrying chunk ${chunkIndex + 1} (attempt ${retryCount} of ${maxRetries})`);
        continue;
      }
      
      return null;
    }
  }
  
  return null;
};

// Call the OpenAI API
export const callOpenAI = async (
  systemPrompt: string, 
  userPrompt: string
): Promise<{ content: string }> => {
  const apiKey = getApiKey();
  
  if (!isValidApiKey(apiKey)) {
    throw new Error('Invalid or missing API key');
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: MAX_TOKENS
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return { content: response.data.choices[0].message.content };
  } catch (error) {
    Logger.error('AIService', `OpenAI API call failed: ${error}`);
    throw error;
  }
};

// Test the OpenAI connection
export const testAIConnection = async (): Promise<boolean> => {
  try {
    const apiKey = getApiKey();
    
    if (!isValidApiKey(apiKey)) {
      return false;
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say hello!" }
        ],
        temperature: 0.3,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.status === 200;
  } catch (error) {
    Logger.error('AIService', `API connection test failed: ${error}`);
    return false;
  }
};

const makeOpenAIRequest = async (messages: any[], onProgress?: (chunk: string) => void) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please enter your API key.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      stream: !!onProgress,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  if (onProgress) {
    // Handle streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) onProgress(content);
          } catch (e) {
            console.error('Error parsing SSE:', e);
          }
        }
      }
    }

    return null;
  } else {
    // Handle regular response
    const data = await response.json();
    return data.choices[0]?.message?.content;
  }
};