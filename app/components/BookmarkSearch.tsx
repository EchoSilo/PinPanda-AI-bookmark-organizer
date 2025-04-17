
'use client';

import { useState } from 'react';
import {
  Box,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  VStack,
  Text,
  Spinner,
  useToast
} from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';
import { Bookmark, OrganizedBookmarks } from '@/types';
import * as aiService from '@/services/aiService';
import * as ProfileService from '@/services/profileService';
import * as Logger from '@/services/logService';

interface BookmarkSearchProps {
  bookmarks: Bookmark[];
  onSearchResults: (results: OrganizedBookmarks) => void;
}

export default function BookmarkSearch({ bookmarks, onSearchResults }: BookmarkSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const toast = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: 'Search query required',
        description: 'Please enter a search term',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsSearching(true);
      Logger.info('BookmarkSearch', `Starting search for: ${query}`);

      // Get current profile for API key if available
      const currentProfile = ProfileService.getCurrentProfile();
      
      // Add to search history if profile exists
      if (currentProfile) {
        const searchHistory = currentProfile.searchHistory || [];
        currentProfile.searchHistory = [query, ...searchHistory.slice(0, 9)]; // Keep last 10 searches
        ProfileService.saveProfile(currentProfile);
      }

      // Basic search as fallback
      const basicResults = {
        categories: [
          {
            name: `Search Results for "${query}"`,
            bookmarks: bookmarks.filter(bookmark =>
              bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
              bookmark.url.toLowerCase().includes(query.toLowerCase())
            )
          }
        ],
        invalidBookmarks: [],
        duplicateBookmarks: [],
        duplicateStats: {
          uniqueUrls: 0,
          urlsWithDuplicates: 0,
          totalDuplicateReferences: 0,
          mostDuplicatedUrls: []
        }
      };

      // If no matching bookmarks, still show empty results
      if (basicResults.categories[0].bookmarks.length === 0) {
        basicResults.categories[0].bookmarks = [];
      }

      try {
        // Perform AI-powered search only if we have results to work with
        if (basicResults.categories[0].bookmarks.length > 0) {
          const aiResults = await aiService.searchBookmarks(bookmarks, query);
          if (aiResults.categories.length > 0) {
            onSearchResults(aiResults);
            Logger.info('BookmarkSearch', `Search completed with ${aiResults.categories.length} categories`);
          } else {
            onSearchResults(basicResults);
            Logger.info('BookmarkSearch', 'Using basic search results');
          }
        } else {
          // If no results, just use the empty basic results
          onSearchResults(basicResults);
          Logger.info('BookmarkSearch', 'No results found for query');
        }
      } catch (error) {
        Logger.error('BookmarkSearch', 'Error during AI search, falling back to basic search', error);
        onSearchResults(basicResults);
      }
    } catch (error) {
      Logger.error('BookmarkSearch', 'Error during search', error);
      toast({
</old_str>
    } catch (error) {
      Logger.error('BookmarkSearch', 'Error during search', error);
      toast({
        title: 'Search failed',
        description: 'An error occurred while searching your bookmarks',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box width="100%" maxW="600px" mx="auto" mb={4}>
      <InputGroup size="md">
        <Input
          placeholder="Search your bookmarks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isSearching}
        />
        <InputRightElement>
          {isSearching ? (
            <Spinner size="sm" color="blue.500" />
          ) : (
            <IconButton
              aria-label="Search"
              icon={<FiSearch />}
              size="sm"
              onClick={handleSearch}
              isDisabled={!query.trim()}
            />
          )}
        </InputRightElement>
      </InputGroup>
    </Box>
  );
}
