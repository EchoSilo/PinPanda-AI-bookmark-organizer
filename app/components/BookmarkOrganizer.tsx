
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  VStack,
  Text,
  Button,
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
  Progress,
  Input,
  InputGroup,
  InputLeftElement,
  Grid,
  GridItem,
  Card,
  CardBody,
  Image,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react';
import { 
  FiFolder, 
  FiExternalLink, 
  FiCopy, 
  FiAlertCircle, 
  FiBarChart2, 
  FiLayers, 
  FiTag, 
  FiDownload, 
  FiSearch,
  FiChevronRight,
  FiArrowLeft,
  FiGrid,
  FiList
} from 'react-icons/fi';
import { OrganizedBookmarks, Bookmark } from '@/types';

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

// BookmarkCard component for displaying bookmark
const BookmarkCard = ({ bookmark }: { bookmark: Bookmark }) => {
  // Extract domain for favicon
  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
      return '/globe.svg';
    }
  };
  
  const faviconUrl = getFaviconUrl(bookmark.url);
  const bgColor = useColorModeValue('white', 'gray.700');
  const hoverBgColor = useColorModeValue('gray.50', 'gray.600');
  
  return (
    <Card 
      borderWidth="1px" 
      borderRadius="md" 
      overflow="hidden"
      bg={bgColor} 
      _hover={{ 
        bg: hoverBgColor,
        shadow: 'md',
        transform: 'translateY(-2px)',
        transition: 'all 0.2s'
      }}
      transition="all 0.2s"
      h="full"
    >
      <CardBody p={3}>
        <VStack spacing={2} align="center">
          <Image
            src={faviconUrl}
            alt={bookmark.title}
            boxSize="32px"
            fallbackSrc="/globe.svg"
            borderRadius="md"
          />
          <Link 
            href={bookmark.url} 
            isExternal
            color="blue.600"
            fontWeight="medium"
            fontSize="sm"
            noOfLines={2}
            textAlign="center"
            width="100%"
          >
            {bookmark.title || bookmark.url}
          </Link>
        </VStack>
      </CardBody>
    </Card>
  );
};

// FolderCard component for displaying category
const FolderCard = ({ 
  name, 
  count, 
  onClick 
}: { 
  name: string; 
  count: number; 
  onClick: () => void;
}) => {
  const bgColor = useColorModeValue('blue.50', 'blue.900');
  const hoverBgColor = useColorModeValue('blue.100', 'blue.800');
  
  return (
    <Card 
      borderWidth="1px" 
      borderRadius="md" 
      overflow="hidden"
      bg={bgColor} 
      _hover={{ 
        bg: hoverBgColor,
        shadow: 'md',
        transform: 'translateY(-2px)',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onClick={onClick}
      transition="all 0.2s"
      h="full"
    >
      <CardBody p={3}>
        <VStack spacing={2} align="center">
          <Icon as={FiFolder} boxSize="32px" color="blue.500" />
          <Text 
            fontWeight="medium"
            fontSize="sm"
            noOfLines={2}
            textAlign="center"
          >
            {name}
          </Text>
          <Badge colorScheme="blue">{count}</Badge>
        </VStack>
      </CardBody>
    </Card>
  );
};

// Bookmark Detail Modal
const BookmarkDetailModal = ({ 
  isOpen, 
  onClose, 
  bookmark 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  bookmark: Bookmark | null;
}) => {
  if (!bookmark) return null;
  
  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
      return '/globe.svg';
    }
  };
  
  const faviconUrl = getFaviconUrl(bookmark.url);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Bookmark Details</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4} align="start">
            <HStack spacing={4} width="100%">
              <Image
                src={faviconUrl}
                alt={bookmark.title}
                boxSize="64px"
                fallbackSrc="/globe.svg"
                borderRadius="md"
              />
              <VStack align="start" spacing={1}>
                <Heading size="md">{bookmark.title || 'Untitled'}</Heading>
                <Link href={bookmark.url} isExternal color="blue.600">
                  <HStack>
                    <Text>{bookmark.url}</Text>
                    <Icon as={FiExternalLink} />
                  </HStack>
                </Link>
              </VStack>
            </HStack>
            
            <Divider />
            
            {bookmark.folder && (
              <Box>
                <Text fontWeight="bold">Original Folder:</Text>
                <Text>{bookmark.folder}</Text>
              </Box>
            )}
            
            {bookmark.dateAdded && (
              <Box>
                <Text fontWeight="bold">Date Added:</Text>
                <Text>{new Date(bookmark.dateAdded).toLocaleString()}</Text>
              </Box>
            )}
            
            <Button 
              as={Link} 
              href={bookmark.url} 
              isExternal 
              colorScheme="blue" 
              width="100%"
              mt={2}
            >
              Visit Site
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

interface BookmarkOrganizerProps {
  organizedBookmarks: OrganizedBookmarks;
  onReset: () => void;
}

export default function BookmarkOrganizer({ organizedBookmarks, onReset }: BookmarkOrganizerProps) {
  const [currentCategoryPath, setCurrentCategoryPath] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  // Sort categories alphabetically
  const sortedCategories = useMemo(() => {
    return [...organizedBookmarks.categories].sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }, [organizedBookmarks.categories]);
  
  // Filter categories and bookmarks based on search term and current path
  const filteredItems = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    // If searching, show all matching categories and bookmarks
    if (searchTerm) {
      const matchingCategories = sortedCategories.filter(category => 
        category.name.toLowerCase().includes(searchLower)
      );
      
      const matchingBookmarks = sortedCategories.flatMap(category => 
        category.bookmarks.filter(bookmark => 
          bookmark.title.toLowerCase().includes(searchLower) ||
          bookmark.url.toLowerCase().includes(searchLower)
        )
      );
      
      return { categories: matchingCategories, bookmarks: matchingBookmarks };
    }
    
    // If not searching, show items based on current path
    if (currentCategoryPath.length === 0) {
      // At root level, show all categories
      return { categories: sortedCategories, bookmarks: [] };
    } else {
      // Inside a category, show its bookmarks
      const currentCategory = sortedCategories.find(
        category => category.name === currentCategoryPath[currentCategoryPath.length - 1]
      );
      
      return { 
        categories: [], 
        bookmarks: currentCategory ? currentCategory.bookmarks : [] 
      };
    }
  }, [sortedCategories, searchTerm, currentCategoryPath]);
  
  // Handle clicking on a category
  const handleCategoryClick = useCallback((categoryName: string) => {
    setCurrentCategoryPath([...currentCategoryPath, categoryName]);
  }, [currentCategoryPath]);
  
  // Handle navigation breadcrumb click
  const handleBreadcrumbClick = useCallback((index: number) => {
    // Navigate to specific level in the path
    setCurrentCategoryPath(prev => prev.slice(0, index + 1));
  }, []);
  
  // Handle going back to parent category
  const handleBackClick = useCallback(() => {
    setCurrentCategoryPath(prev => prev.slice(0, prev.length - 1));
  }, []);
  
  // Handle bookmark click to show details
  const handleBookmarkClick = useCallback((bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    onOpen();
  }, [onOpen]);
  
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
      
      {/* Search, View Mode and Export Controls */}
      <Flex justify="space-between" align="center" mb={2} wrap="wrap" gap={2}>
        <HStack>
          {currentCategoryPath.length > 0 && (
            <Button 
              leftIcon={<Icon as={FiArrowLeft} />} 
              onClick={handleBackClick}
              variant="ghost"
              size="sm"
            >
              Back
            </Button>
          )}
          
          <InputGroup maxW="400px">
            <InputLeftElement pointerEvents="none">
              <Icon as={FiSearch} color="gray.300" />
            </InputLeftElement>
            <Input 
              placeholder="Search bookmarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </HStack>
        
        <HStack>
          <Button
            leftIcon={<Icon as={viewMode === 'grid' ? FiList : FiGrid} />}
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            size="sm"
            variant="outline"
          >
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </Button>
          
          <Button
            colorScheme="green"
            leftIcon={<Icon as={FiDownload} />}
            onClick={handleExport}
            isLoading={isExporting}
            loadingText="Exporting"
            size="sm"
          >
            Export
          </Button>
        </HStack>
      </Flex>
      
      {/* Navigation Breadcrumbs */}
      {(currentCategoryPath.length > 0 || searchTerm) && (
        <Breadcrumb 
          spacing="8px" 
          separator={<Icon as={FiChevronRight} color="gray.500" />}
          mb={2}
        >
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => setCurrentCategoryPath([])} fontWeight="medium">
              All Bookmarks
            </BreadcrumbLink>
          </BreadcrumbItem>
          
          {searchTerm ? (
            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink>
                Search: {searchTerm}
              </BreadcrumbLink>
            </BreadcrumbItem>
          ) : (
            currentCategoryPath.map((category, index) => (
              <BreadcrumbItem 
                key={category} 
                isCurrentPage={index === currentCategoryPath.length - 1}
              >
                <BreadcrumbLink onClick={() => handleBreadcrumbClick(index)}>
                  {category}
                </BreadcrumbLink>
              </BreadcrumbItem>
            ))
          )}
        </Breadcrumb>
      )}
      
      {/* Status info */}
      <Box mb={2}>
        <Text fontSize="sm" color="gray.600">
          {searchTerm
            ? `Showing ${filteredItems.categories.length} folders and ${filteredItems.bookmarks.length} bookmarks matching "${searchTerm}"`
            : currentCategoryPath.length === 0
            ? `Showing ${filteredItems.categories.length} folders`
            : `Showing ${filteredItems.bookmarks.length} bookmarks in "${currentCategoryPath[currentCategoryPath.length - 1]}"`
          }
        </Text>
      </Box>
      
      {/* Content Area */}
      <Box 
        borderWidth="1px" 
        borderRadius="md" 
        p={4} 
        bg={useColorModeValue('gray.50', 'gray.800')}
        overflowY="auto" 
        height="70vh"
      >
        {viewMode === 'grid' ? (
          // Grid View
          <Grid 
            templateColumns={{
              base: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(4, 1fr)',
              lg: 'repeat(6, 1fr)'
            }}
            gap={4}
          >
            {/* Folders */}
            {filteredItems.categories.map(category => (
              <GridItem key={category.name}>
                <FolderCard 
                  name={category.name} 
                  count={category.bookmarks.length}
                  onClick={() => handleCategoryClick(category.name)}
                />
              </GridItem>
            ))}
            
            {/* Bookmarks */}
            {filteredItems.bookmarks.map((bookmark, index) => (
              <GridItem key={`${bookmark.id}-${index}`}>
                <Box onClick={() => handleBookmarkClick(bookmark)} cursor="pointer">
                  <BookmarkCard bookmark={bookmark} />
                </Box>
              </GridItem>
            ))}
            
            {/* Empty state */}
            {filteredItems.categories.length === 0 && filteredItems.bookmarks.length === 0 && (
              <GridItem colSpan={{ base: 2, sm: 3, md: 4, lg: 6 }}>
                <Box textAlign="center" p={8}>
                  <Icon as={FiSearch} boxSize="40px" color="gray.400" mb={4} />
                  <Heading size="md" mb={2}>No items found</Heading>
                  <Text color="gray.500">
                    {searchTerm 
                      ? `No bookmarks or folders match "${searchTerm}"`
                      : "This folder is empty"
                    }
                  </Text>
                </Box>
              </GridItem>
            )}
          </Grid>
        ) : (
          // List View
          <VStack spacing={2} align="stretch">
            {/* Folders */}
            {filteredItems.categories.length > 0 && (
              <>
                <Text fontWeight="bold" mb={1}>Folders</Text>
                {filteredItems.categories.map(category => (
                  <HStack 
                    key={category.name}
                    p={2}
                    borderWidth="1px"
                    borderRadius="md"
                    _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                    cursor="pointer"
                    onClick={() => handleCategoryClick(category.name)}
                  >
                    <Icon as={FiFolder} color="blue.500" />
                    <Text>{category.name}</Text>
                    <Badge ml="auto" colorScheme="blue">{category.bookmarks.length}</Badge>
                  </HStack>
                ))}
                {filteredItems.bookmarks.length > 0 && <Divider my={2} />}
              </>
            )}
            
            {/* Bookmarks */}
            {filteredItems.bookmarks.length > 0 && (
              <>
                <Text fontWeight="bold" mb={1}>Bookmarks</Text>
                {filteredItems.bookmarks.map((bookmark, index) => {
                  const getFaviconUrl = (url: string) => {
                    try {
                      const domain = new URL(url).hostname;
                      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
                    } catch (e) {
                      return '/globe.svg';
                    }
                  };
                
                  return (
                    <HStack 
                      key={`${bookmark.id}-${index}`}
                      p={2}
                      borderWidth="1px"
                      borderRadius="md"
                      _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                      cursor="pointer"
                      onClick={() => handleBookmarkClick(bookmark)}
                    >
                      <Image
                        src={getFaviconUrl(bookmark.url)}
                        alt={bookmark.title}
                        boxSize="16px"
                        fallbackSrc="/globe.svg"
                      />
                      <Text>{bookmark.title || bookmark.url}</Text>
                      <Icon as={FiExternalLink} ml="auto" boxSize="14px" color="gray.500" />
                    </HStack>
                  );
                })}
              </>
            )}
            
            {/* Empty state */}
            {filteredItems.categories.length === 0 && filteredItems.bookmarks.length === 0 && (
              <Box textAlign="center" p={8}>
                <Icon as={FiSearch} boxSize="40px" color="gray.400" mb={4} />
                <Heading size="md" mb={2}>No items found</Heading>
                <Text color="gray.500">
                  {searchTerm 
                    ? `No bookmarks or folders match "${searchTerm}"`
                    : "This folder is empty"
                  }
                </Text>
              </Box>
            )}
          </VStack>
        )}
      </Box>
      
      {/* Reset Button */}
      <Box textAlign="center" mt={4}>
        <Button colorScheme="red" onClick={onReset}>
          Reset & Start Over
        </Button>
      </Box>
      
      {/* Bookmark Detail Modal */}
      <BookmarkDetailModal 
        isOpen={isOpen} 
        onClose={onClose} 
        bookmark={selectedBookmark} 
      />
    </VStack>
  );
}
