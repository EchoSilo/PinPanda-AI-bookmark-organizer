
'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  VStack,
  Text,
  Spinner,
  useToast,
  Button,
  HStack,
  Switch,
  FormControl,
  FormLabel,
  Tooltip
} from '@chakra-ui/react';
import { FiSearch, FiZap } from 'react-icons/fi';
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
  const [useAISearch, setUseAISearch] = useState(false);
  const [lastSearchTerm, setLastSearchTerm] = useState('');
  const toast = useToast();

  // Load preference from profile
  useEffect(() => {
    const currentProfile = ProfileService.getCurrentProfile();
    if (currentProfile?.settings?.aiSearchEnabled) {
      setUseAISearch(currentProfile.settings.aiSearchEnabled);
    }
  }, []);
  
  // Update preference in profile
  const saveAISearchPreference = useCallback((enabled: boolean) => {
    const currentProfile = ProfileService.getCurrentProfile();
    if (currentProfile) {
      currentProfile.settings = currentProfile.settings || {};
      currentProfile.settings.aiSearchEnabled = enabled;
      ProfileService.saveProfile(currentProfile);
    }
  }, []);

  // Perform basic search (faster)
  const performBasicSearch = useCallback((searchTerm: string): OrganizedBookmarks => {
    Logger.info('BookmarkSearch', `Performing basic search for: "${searchTerm}"`);
    const searchTermLower = searchTerm.toLowerCase();
    
    // Filter bookmarks that match the search term
    const matchedBookmarks = bookmarks.filter(bookmark =>
      bookmark.title.toLowerCase().includes(searchTermLower) ||
      bookmark.url.toLowerCase().includes(searchTermLower) ||
      (bookmark.folder && bookmark.folder.toLowerCase().includes(searchTermLower))
    );
    
    // Return basic organized structure
    return {
      categories: [
        {
          name: `Search Results for "${searchTerm}"`,
          bookmarks: matchedBookmarks
        }
      ],
      invalidBookmarks: [],
      duplicateBookmarks: [],
      duplicateStats: {
        uniqueUrls: matchedBookmarks.length,
        urlsWithDuplicates: 0,
        totalDuplicateReferences: 0,
        mostDuplicatedUrls: []
      }
    };
  }, [bookmarks]);

  // Add debounce function to avoid unnecessary API calls
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

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

    const searchTerm = query.trim();
    setLastSearchTerm(searchTerm);
    
    try {
      setIsSearching(true);
      Logger.info('BookmarkSearch', `Starting search for: ${searchTerm}`);

      // Add to search history if profile exists
      const currentProfile = ProfileService.getCurrentProfile();
      if (currentProfile) {
        const searchHistory = currentProfile.searchHistory || [];
        currentProfile.searchHistory = [searchTerm, ...searchHistory.filter(s => s !== searchTerm).slice(0, 9)];
        ProfileService.saveProfile(currentProfile);
      }

      // Always start with basic search for immediate results
      const basicResults = performBasicSearch(searchTerm);
      
      // Show basic results immediately
      onSearchResults(basicResults);
      
      // If AI search is enabled and there are enough results to categorize, use AI
      if (useAISearch && basicResults.categories[0].bookmarks.length > 3) {
        try {
          Logger.info('BookmarkSearch', 'Starting AI-powered search...');
          
          // Only process basic results with AI if we have enough to work with
          const aiResults = await aiService.searchBookmarks(
            basicResults.categories[0].bookmarks, 
            searchTerm
          );
          
          if (aiResults.categories.length > 0) {
            // Check if the search term is still the same (user hasn't changed it)
            if (searchTerm === lastSearchTerm) {
              onSearchResults(aiResults);
              Logger.info('BookmarkSearch', `AI search completed with ${aiResults.categories.length} categories`);
            }
          }
        } catch (error) {
          Logger.error('BookmarkSearch', 'Error during AI search', error);
          // We already displayed basic results, so no need to fall back
        }
      }
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
  
  const toggleAISearch = () => {
    const newValue = !useAISearch;
    setUseAISearch(newValue);
    saveAISearchPreference(newValue);
    
    toast({
      title: newValue ? 'AI Search Enabled' : 'AI Search Disabled',
      description: newValue 
        ? 'Search will use AI to categorize and understand your intention' 
        : 'Using fast keyword search only',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  // Add auto-search with debouncing
  const debouncedSearchTerm = useDebounce(query, 500);
  
  // Effect to auto-search when debounced search term changes
  useEffect(() => {
    if (debouncedSearchTerm && debouncedSearchTerm.length >= 3) {
      handleSearch();
    }
  }, [debouncedSearchTerm]);

  return (
    <VStack width="100%" maxW="600px" mx="auto" mb={4} spacing={2}>
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
      
      <HStack width="100%" justifyContent="flex-end">
        <Tooltip label={useAISearch 
          ? "AI search understands natural language queries but is slower" 
          : "Quick keyword-based search"}>
          <FormControl display="flex" alignItems="center" justifyContent="flex-end" width="auto">
            <FormLabel htmlFor="ai-search" mb="0" fontSize="xs" color="gray.500">
              <HStack spacing={1}>
                <FiZap />
                <Text>AI Search</Text>
              </HStack>
            </FormLabel>
            <Switch 
              id="ai-search" 
              isChecked={useAISearch} 
              onChange={toggleAISearch}
              colorScheme="blue"
              size="sm"
            />
          </FormControl>
        </Tooltip>
      </HStack>
    </VStack>
  );
}
