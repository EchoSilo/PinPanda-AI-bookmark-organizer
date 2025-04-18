
import { Bookmark } from '@/types';
import * as Logger from '../logService';
import { callOpenAI } from './index';

// Interface for bookmark metadata
export interface BookmarkMetadata {
  title: string;
  description: string;
  keywords: string[];
  categories: string[];
  summary: string;
  isActive: boolean; // Whether the URL is still valid
  lastChecked: string; // ISO date string
}

/**
 * Enriches a bookmark with additional metadata
 */
export const enrichBookmark = async (bookmark: Bookmark): Promise<Bookmark & { metadata?: BookmarkMetadata }> => {
  try {
    Logger.info('AIService', `Enriching bookmark: ${bookmark.title}`);
    
    // First check if URL is valid/accessible
    const isActive = await isUrlActive(bookmark.url);
    
    if (!isActive) {
      Logger.warning('AIService', `Bookmark URL is not accessible: ${bookmark.url}`);
      return {
        ...bookmark,
        metadata: {
          title: bookmark.title,
          description: '',
          keywords: [],
          categories: [],
          summary: 'This URL appears to be inaccessible.',
          isActive: false,
          lastChecked: new Date().toISOString()
        }
      };
    }
    
    // Fetch page content using a backend proxy (to avoid CORS issues)
    // This would need to be implemented in a real backend
    // For now, we'll simulate with AI-generated content
    const pageContent = await simulatePageContent(bookmark.url);
    
    // Use AI to generate metadata
    const metadata = await generateMetadata(bookmark, pageContent);
    
    return {
      ...bookmark,
      metadata
    };
  } catch (error) {
    Logger.error('AIService', `Error enriching bookmark: ${error}`);
    return bookmark;
  }
};

/**
 * Check if a URL is still active
 */
const isUrlActive = async (url: string): Promise<boolean> => {
  try {
    // In a real implementation, this would make a request to the URL
    // For now, we'll simulate with a >90% success rate
    return Math.random() > 0.1;
  } catch (error) {
    Logger.error('AIService', `Error checking URL status: ${error}`);
    return false;
  }
};

/**
 * Simulate fetching page content (since we can't do this client-side due to CORS)
 */
const simulatePageContent = async (url: string): Promise<string> => {
  // In a real implementation, this would be a backend API call
  // For now, just return a placeholder
  return `This is simulated content for ${url}. In a real implementation, we would fetch actual page content through a backend proxy to avoid CORS issues.`;
};

/**
 * Generate metadata for a bookmark using AI
 */
const generateMetadata = async (bookmark: Bookmark, pageContent: string): Promise<BookmarkMetadata> => {
  try {
    const prompt = `
I need metadata about this webpage:
URL: ${bookmark.url}
Title: ${bookmark.title}

Based on the URL and title, generate the following metadata:
1. A brief description (1-2 sentences)
2. 5-10 relevant keywords
3. 3-5 category suggestions
4. A very brief summary (max 50 words)

Return your response in this JSON format:
{
  "description": "Brief description here",
  "keywords": ["keyword1", "keyword2", "..."],
  "categories": ["category1", "category2", "..."],
  "summary": "Brief summary here"
}
`;

    const systemPrompt = `
You are a web page analyzer that extracts key information from URLs and titles.
Your job is to infer as much meaningful information as possible about a webpage to help categorize and search for it later.
You will return only valid JSON with no additional text.
`;

    const response = await callOpenAI(systemPrompt, prompt);
    
    // Parse the JSON response
    const jsonStart = response.content.indexOf('{');
    const jsonEnd = response.content.lastIndexOf('}') + 1;
    const jsonStr = response.content.substring(jsonStart, jsonEnd);
    
    const data = JSON.parse(jsonStr);
    
    return {
      title: bookmark.title,
      description: data.description || '',
      keywords: data.keywords || [],
      categories: data.categories || [],
      summary: data.summary || '',
      isActive: true,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    Logger.error('AIService', `Error generating metadata: ${error}`);
    
    // Return basic metadata if AI fails
    return {
      title: bookmark.title,
      description: '',
      keywords: [],
      categories: [],
      summary: '',
      isActive: true,
      lastChecked: new Date().toISOString()
    };
  }
};

/**
 * Batch process bookmarks for enrichment
 * This would typically be run as a background job
 */
export const batchEnrichBookmarks = async (
  bookmarks: Bookmark[], 
  progressCallback?: (progress: number, processed: number, total: number) => void
): Promise<Array<Bookmark & { metadata?: BookmarkMetadata }>> => {
  const enrichedBookmarks: Array<Bookmark & { metadata?: BookmarkMetadata }> = [];
  const total = bookmarks.length;
  
  // Process in small batches to avoid rate limits
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
    const batch = bookmarks.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(bookmark => enrichBookmark(bookmark))
    );
    
    enrichedBookmarks.push(...batchResults);
    
    // Report progress
    if (progressCallback) {
      progressCallback(
        Math.round((enrichedBookmarks.length / total) * 100),
        enrichedBookmarks.length,
        total
      );
    }
    
    // Add delay to avoid rate limits
    if (i + BATCH_SIZE < bookmarks.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return enrichedBookmarks;
};
