export interface Bookmark {
  id: string;
  title: string;
  url: string;
  folder?: string;
  dateAdded?: string;
  isValid?: boolean;
  validationError?: string;
  favicon?: string;
}

export interface BookmarkCategory {
  name: string;
  bookmarks: Bookmark[];
}

export interface OrganizedBookmarks {
  categories: BookmarkCategory[];
  invalidBookmarks: Bookmark[];
  duplicateBookmarks: {
    originalIndex: number;
    duplicateIndex: number;
  }[];
  duplicateStats?: {
    uniqueUrls: number;
    urlsWithDuplicates: number;
    totalDuplicateReferences: number;
    mostDuplicatedUrls: Array<{
      url: string;
      count: number;
      indices: number[];
    }>;
  };
}

export interface ProcessingProgress {
  step: number;
  message: string;
  progress?: number;
  bookmarksProcessed?: number;
  duplicatesFound?: number;
  validationProgress?: number;
  duplicateStats?: {
    uniqueUrls: number;
    urlsWithDuplicates: number;
    totalDuplicateReferences: number;
    mostDuplicatedUrls: Array<{
      url: string;
      count: number;
      indices: number[];
    }>;
  };


export interface Profile {
  id: string;
  username: string;
  bookmarkCategories: BookmarkCategory[];
  apiKey?: string;
  searchHistory?: string[];
  settings?: {
    defaultView?: string;
    aiSearchEnabled?: boolean;
  };
}

}

export interface AIResponse {
  step: string;
  prompt: string;
  response: string;
  timestamp: number;
} 