
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
      const apiKey = currentProfile?.apiKey;
      
      // Add to search history if profile exists
      if (currentProfile) {
        const searchHistory = currentProfile.searchHistory || [];
        currentProfile.searchHistory = [query, ...searchHistory.slice(0, 9)]; // Keep last 10 searches
        ProfileService.saveProfile(currentProfile);
      }

      // Perform AI-powered search
      const results = await aiService.searchBookmarks(bookmarks, query, apiKey);
      
      onSearchResults(results);
      Logger.info('BookmarkSearch', `Search completed with ${results.categories.length} categories`);
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
