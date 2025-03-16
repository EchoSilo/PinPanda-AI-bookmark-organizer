'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  VStack,
  Text,
  Button,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Heading,
  Badge,
  Link,
  HStack,
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Divider,
  useColorModeValue,
  Icon,
  Tooltip,
  useToast,
  Progress
} from '@chakra-ui/react';
import { FiFolder, FiExternalLink, FiCopy, FiAlertCircle, FiBarChart2, FiLayers, FiTag, FiDownload } from 'react-icons/fi';
import { OrganizedBookmarks, Bookmark } from '@/types';

// Virtualized bookmark list component for large categories
const VirtualizedBookmarkList = ({ bookmarks }: { bookmarks: Bookmark[] }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const ITEMS_PER_PAGE = 50;
  
  // Load more items when scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // If scrolled to bottom, load more items
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      setVisibleRange(prev => ({
        start: prev.start,
        end: Math.min(prev.end + ITEMS_PER_PAGE, bookmarks.length)
      }));
    }
  }, [bookmarks.length]);
  
  // Get visible bookmarks
  const visibleBookmarks = useMemo(() => {
    return bookmarks.slice(0, visibleRange.end);
  }, [bookmarks, visibleRange.end]);
  
  return (
    <Box 
      maxH="500px" 
      overflowY="auto"
      onScroll={handleScroll}
    >
      <VStack align="stretch" spacing={2}>
        {visibleBookmarks.map((bookmark, bookmarkIndex) => (
          <Box 
            key={bookmarkIndex} 
            p={2} 
            borderWidth="1px" 
            borderRadius="md"
            _hover={{ bg: 'gray.50' }}
          >
            <Flex justify="space-between" align="center">
              <Link 
                href={bookmark.url} 
                isExternal 
                color="blue.600" 
                fontWeight="medium"
                maxWidth="80%"
                isTruncated
              >
                <HStack>
                  <Text>{bookmark.title || bookmark.url}</Text>
                  <Icon as={FiExternalLink} boxSize={3} />
                </HStack>
              </Link>
              {bookmark.folder && (
                <Tooltip label={`Original folder: ${bookmark.folder}`}>
                  <Badge colorScheme="gray" fontSize="xs">
                    {bookmark.folder.split('/').pop()}
                  </Badge>
                </Tooltip>
              )}
            </Flex>
          </Box>
        ))}
        {visibleRange.end < bookmarks.length && (
          <Box textAlign="center" py={2}>
            <Text fontSize="sm" color="gray.500">
              Showing {visibleRange.end} of {bookmarks.length} bookmarks
            </Text>
            <Progress 
              size="xs" 
              value={(visibleRange.end / bookmarks.length) * 100} 
              colorScheme="green" 
              mt={1}
            />
          </Box>
        )}
      </VStack>
    </Box>
  );
};

// Dashboard summary component
const DashboardSummary = ({ organizedBookmarks }: { organizedBookmarks: OrganizedBookmarks }) => {
  // Memoize expensive calculations to reduce re-renders
  const { 
    totalCategories,
    totalUniqueBookmarks,
    totalBookmarksWithDuplicates,
    duplicatesCount,
    estimatedTokens,
    estimatedMemoryKB
  } = useMemo(() => {
    // Calculate statistics
    const totalCategories = organizedBookmarks.categories.length;
    
    // Count total bookmarks (accounting for duplicates)
    const bookmarkSet = new Set<string>();
    organizedBookmarks.categories.forEach(category => {
      category.bookmarks.forEach(bookmark => {
        bookmarkSet.add(bookmark.id);
      });
    });
    const totalUniqueBookmarks = bookmarkSet.size;
    
    // Count total bookmarks including duplicates
    const totalBookmarksWithDuplicates = organizedBookmarks.categories.reduce(
      (sum, category) => sum + category.bookmarks.length, 0
    );
    
    // Count duplicates
    const duplicatesCount = organizedBookmarks.duplicateBookmarks.length;
    
    // Estimate total tokens - use a more efficient approach
    // Instead of stringifying the entire object, estimate based on counts
    const avgBookmarkSize = 200; // Average characters per bookmark
    const estimatedTokens = Math.ceil(
      (totalUniqueBookmarks * avgBookmarkSize + 
       totalCategories * 50) / 4 // Rough estimate: 1 token ≈ 4 chars
    );
    
    // Calculate memory usage
    const estimatedMemoryKB = Math.ceil(estimatedTokens * 4 / 1024);
    
    return {
      totalCategories,
      totalUniqueBookmarks,
      totalBookmarksWithDuplicates,
      duplicatesCount,
      estimatedTokens,
      estimatedMemoryKB
    };
  }, [organizedBookmarks]);
  
  // Get duplicate stats from the organized bookmarks or calculate them
  const duplicateDetails = useMemo(() => {
    // If we have pre-calculated stats, use them
    if (organizedBookmarks.duplicateStats) {
      return {
        uniqueUrlsWithDuplicates: organizedBookmarks.duplicateStats.urlsWithDuplicates,
        totalDuplicateReferences: organizedBookmarks.duplicateStats.totalDuplicateReferences,
        topDuplicates: organizedBookmarks.duplicateStats.mostDuplicatedUrls.map(dup => ({
          url: dup.url,
          count: dup.count
        }))
      };
    }
    
    // Otherwise calculate them (fallback)
    const urlCounts = new Map<string, number>();
    
    // Count occurrences of each URL across all categories
    organizedBookmarks.categories.forEach(category => {
      category.bookmarks.forEach(bookmark => {
        const normalizedUrl = bookmark.url.toLowerCase().replace(/\/$/, '');
        urlCounts.set(normalizedUrl, (urlCounts.get(normalizedUrl) || 0) + 1);
      });
    });
    
    // Filter to only URLs that appear more than once
    const duplicateUrls = Array.from(urlCounts.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]); // Sort by count (descending)
    
    return {
      uniqueUrlsWithDuplicates: duplicateUrls.length,
      totalDuplicateReferences: duplicateUrls.reduce((sum, [_, count]) => sum + count - 1, 0),
      topDuplicates: duplicateUrls.slice(0, 5).map(([url, count]) => ({ url, count }))
    };
  }, [organizedBookmarks]);
  
  return (
    <Box 
      p={4} 
      borderWidth="1px" 
      borderRadius="md" 
      bg={useColorModeValue('white', 'gray.700')}
      mb={4}
      shadow="sm"
    >
      <Heading size="md" mb={4}>Dashboard Summary</Heading>
      <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4}>
        <Stat>
          <StatLabel>Total Bookmarks</StatLabel>
          <StatNumber>{totalUniqueBookmarks}</StatNumber>
          <StatHelpText>
            <HStack>
              <Icon as={FiLayers} />
              <Text>Unique</Text>
            </HStack>
          </StatHelpText>
        </Stat>
        
        <Stat>
          <StatLabel>Categories</StatLabel>
          <StatNumber>{totalCategories}</StatNumber>
          <StatHelpText>
            <HStack>
              <Icon as={FiFolder} />
              <Text>Folders</Text>
            </HStack>
          </StatHelpText>
        </Stat>
        
        <Tooltip 
          label={
            <VStack align="start" spacing={1} p={2}>
              <Text fontWeight="bold">Duplicate Details:</Text>
              <Text>{duplicateDetails.uniqueUrlsWithDuplicates} URLs appear in multiple categories</Text>
              <Text>{duplicateDetails.totalDuplicateReferences} total duplicate references</Text>
              {duplicateDetails.topDuplicates.length > 0 && (
                <>
                  <Text fontWeight="bold" mt={1}>Top duplicated URLs:</Text>
                  {duplicateDetails.topDuplicates.map((dup, i) => (
                    <Text key={i} fontSize="xs" noOfLines={1}>
                      {dup.url.substring(0, 30)}... ({dup.count} times)
                    </Text>
                  ))}
                </>
              )}
            </VStack>
          }
          hasArrow
          placement="top"
          maxW="400px"
        >
          <Stat cursor="help">
            <StatLabel>Duplicates</StatLabel>
            <StatNumber>{duplicatesCount}</StatNumber>
            <StatHelpText>
              <HStack>
                <Icon as={FiCopy} />
                <Text>Found</Text>
              </HStack>
            </StatHelpText>
          </Stat>
        </Tooltip>
        
        <Stat>
          <StatLabel>References</StatLabel>
          <StatNumber>{totalBookmarksWithDuplicates}</StatNumber>
          <StatHelpText>
            <HStack>
              <Icon as={FiTag} />
              <Text>Total</Text>
            </HStack>
          </StatHelpText>
        </Stat>
        
        <Stat>
          <StatLabel>Tokens</StatLabel>
          <StatNumber>{(estimatedTokens / 1000).toFixed(1)}K</StatNumber>
          <StatHelpText>
            <HStack>
              <Icon as={FiBarChart2} />
              <Text>Estimated</Text>
            </HStack>
          </StatHelpText>
        </Stat>
        
        <Stat>
          <StatLabel>Memory</StatLabel>
          <StatNumber>{estimatedMemoryKB > 1024 ? (estimatedMemoryKB / 1024).toFixed(1) + 'MB' : estimatedMemoryKB + 'KB'}</StatNumber>
          <StatHelpText>
            <HStack>
              <Icon as={FiAlertCircle} />
              <Text>Usage</Text>
            </HStack>
          </StatHelpText>
        </Stat>
      </SimpleGrid>
    </Box>
  );
};

interface BookmarkOrganizerProps {
  organizedBookmarks: OrganizedBookmarks;
  onReset: () => void;
}

export default function BookmarkOrganizer({ organizedBookmarks, onReset }: BookmarkOrganizerProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [visibleCategories, setVisibleCategories] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [loadedBookmarks, setLoadedBookmarks] = useState<Record<number, boolean>>({});
  const categoriesPerPage = 25;
  const toast = useToast();
  
  // Memoize sorted categories to avoid re-sorting on every render
  const sortedCategories = useMemo(() => {
    return [...organizedBookmarks.categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [organizedBookmarks.categories]);
  
  // Implement pagination for categories
  const totalPages = Math.ceil(sortedCategories.length / categoriesPerPage);
  
  // Get current page categories
  const currentCategories = useMemo(() => {
    const startIndex = (currentPage - 1) * categoriesPerPage;
    return sortedCategories.slice(startIndex, startIndex + categoriesPerPage);
  }, [sortedCategories, currentPage, categoriesPerPage]);
  
  // Initialize visible categories on component mount and when page changes
  useEffect(() => {
    // Only show the first 25 categories initially to reduce memory usage
    setVisibleCategories(currentCategories.map((_, index) => index));
    // Reset loaded bookmarks when page changes
    setLoadedBookmarks({});
  }, [currentCategories]);
  
  const toggleCategory = useCallback((index: number) => {
    const newExpandedCategories = new Set(expandedCategories);
    if (newExpandedCategories.has(index)) {
      newExpandedCategories.delete(index);
    } else {
      newExpandedCategories.add(index);
      // Mark this category's bookmarks as loaded
      setLoadedBookmarks(prev => ({...prev, [index]: true}));
    }
    setExpandedCategories(newExpandedCategories);
  }, [expandedCategories]);
  
  // Check if bookmarks for a category are loaded
  const areBookmarksLoaded = useCallback((index: number) => {
    return loadedBookmarks[index] === true;
  }, [loadedBookmarks]);
  
  // Pagination controls
  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
    // Reset expanded categories when changing pages
    setExpandedCategories(new Set());
    // Reset loaded bookmarks when changing pages
    setLoadedBookmarks({});
    window.scrollTo(0, 0);
  }, []);
  
  // Convert Set to array for Accordion index prop
  const expandedIndicesArray = Array.from(expandedCategories).map(Number);
  
  // Export bookmarks to HTML file
  const handleExport = () => {
    try {
      setIsExporting(true);
      
      // Create HTML bookmark file
      const bookmarkHtml = generateBookmarkHtml(organizedBookmarks);
      
      // Create download link
      const blob = new Blob([bookmarkHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organized_bookmarks_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: "Your bookmarks have been exported successfully.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your bookmarks.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  // Generate HTML for bookmarks file
  const generateBookmarkHtml = (bookmarks: OrganizedBookmarks): string => {
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    // Add each category as a folder
    bookmarks.categories.forEach(category => {
      html += `    <DT><H3 FOLDED ADD_DATE="${Math.floor(Date.now() / 1000)}">${category.name}</H3>\n    <DL><p>\n`;
      
      // Add bookmarks in this category
      category.bookmarks.forEach(bookmark => {
        const dateAdded = bookmark.dateAdded 
          ? Math.floor(new Date(bookmark.dateAdded).getTime() / 1000) 
          : Math.floor(Date.now() / 1000);
        
        html += `        <DT><A HREF="${bookmark.url}" ADD_DATE="${dateAdded}">${bookmark.title}</A>\n`;
      });
      
      html += `    </DL><p>\n`;
    });
    
    html += `</DL><p>`;
    
    return html;
  };
  
  return (
    <VStack spacing={4} align="stretch">
      {/* Dashboard Summary */}
      <DashboardSummary organizedBookmarks={organizedBookmarks} />
      
      {/* Pagination Info */}
      <Flex justify="space-between" align="center">
        <Text>
          Showing page {currentPage} of {totalPages} ({sortedCategories.length} categories)
        </Text>
        <HStack>
          <Button
            colorScheme="green"
            leftIcon={<Icon as={FiDownload} />}
            onClick={handleExport}
            isLoading={isExporting}
            loadingText="Exporting"
            size="sm"
          >
            Export Bookmarks
          </Button>
          <Button 
            size="sm" 
            onClick={() => goToPage(currentPage - 1)} 
            isDisabled={currentPage === 1}
          >
            Previous
          </Button>
          <Text>{currentPage} / {totalPages}</Text>
          <Button 
            size="sm" 
            onClick={() => goToPage(currentPage + 1)} 
            isDisabled={currentPage === totalPages}
          >
            Next
          </Button>
        </HStack>
      </Flex>
      
      {/* Categories */}
      <Accordion 
        allowMultiple 
        index={expandedIndicesArray}
      >
        {currentCategories.map((category, index) => (
          <AccordionItem key={index}>
            <AccordionButton 
              py={2} 
              onClick={() => toggleCategory(index)}
              _hover={{ bg: 'gray.50' }}
            >
              <HStack flex="1" textAlign="left" spacing={2}>
                <Icon as={FiFolder} color="green.500" />
                <Text fontWeight="medium">{category.name}</Text>
                <Badge colorScheme="green" ml={2}>
                  {category.bookmarks.length}
                </Badge>
              </HStack>
              <AccordionIcon />
            </AccordionButton>
            
            <AccordionPanel pb={4}>
              {areBookmarksLoaded(index) ? (
                category.bookmarks.length > 100 ? (
                  // Use virtualized list for large categories
                  <VirtualizedBookmarkList bookmarks={category.bookmarks} />
                ) : (
                  // Use regular list for smaller categories
                  <VStack align="stretch" spacing={2}>
                    {category.bookmarks.map((bookmark, bookmarkIndex) => (
                      <Box 
                        key={bookmarkIndex} 
                        p={2} 
                        borderWidth="1px" 
                        borderRadius="md"
                        _hover={{ bg: 'gray.50' }}
                      >
                        <Flex justify="space-between" align="center">
                          <Link 
                            href={bookmark.url} 
                            isExternal 
                            color="blue.600" 
                            fontWeight="medium"
                            maxWidth="80%"
                            isTruncated
                          >
                            <HStack>
                              <Text>{bookmark.title || bookmark.url}</Text>
                              <Icon as={FiExternalLink} boxSize={3} />
                            </HStack>
                          </Link>
                          {bookmark.folder && (
                            <Tooltip label={`Original folder: ${bookmark.folder}`}>
                              <Badge colorScheme="gray" fontSize="xs">
                                {bookmark.folder.split('/').pop()}
                              </Badge>
                            </Tooltip>
                          )}
                        </Flex>
                      </Box>
                    ))}
                  </VStack>
                )
              ) : (
                <Box textAlign="center" py={4}>
                  <Text color="gray.500">Loading {category.bookmarks.length} bookmarks...</Text>
                  <Progress size="xs" isIndeterminate colorScheme="green" mt={2} />
                </Box>
              )}
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Flex justify="center" mt={4}>
          <HStack>
            <Button 
              size="sm" 
              onClick={() => goToPage(1)} 
              isDisabled={currentPage === 1}
            >
              First
            </Button>
            <Button 
              size="sm" 
              onClick={() => goToPage(currentPage - 1)} 
              isDisabled={currentPage === 1}
            >
              Previous
            </Button>
            
            {/* Page numbers - optimized to render fewer buttons */}
            {useMemo(() => {
              // Calculate which page numbers to show
              const pageNumbers: number[] = [];
              
              if (totalPages <= 5) {
                // Show all pages if 5 or fewer
                for (let i = 1; i <= totalPages; i++) {
                  pageNumbers.push(i);
                }
              } else if (currentPage <= 3) {
                // Near the start
                pageNumbers.push(1, 2, 3, 4, 5);
              } else if (currentPage >= totalPages - 2) {
                // Near the end
                for (let i = totalPages - 4; i <= totalPages; i++) {
                  pageNumbers.push(i);
                }
              } else {
                // In the middle
                for (let i = currentPage - 2; i <= currentPage + 2; i++) {
                  pageNumbers.push(i);
                }
              }
              
              return pageNumbers.map(pageNum => (
                <Button 
                  key={pageNum} 
                  size="sm" 
                  colorScheme={currentPage === pageNum ? "green" : "gray"}
                  onClick={() => goToPage(pageNum)}
                >
                  {pageNum}
                </Button>
              ));
            }, [currentPage, totalPages, goToPage])}
            
            <Button 
              size="sm" 
              onClick={() => goToPage(currentPage + 1)} 
              isDisabled={currentPage === totalPages}
            >
              Next
            </Button>
            <Button 
              size="sm" 
              onClick={() => goToPage(totalPages)} 
              isDisabled={currentPage === totalPages}
            >
              Last
            </Button>
          </HStack>
        </Flex>
      )}
      
      <Box textAlign="center" mt={4}>
        <Button colorScheme="red" onClick={onReset}>
          Reset & Start Over
        </Button>
      </Box>
    </VStack>
  );
} 