
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
  FiList,
  FiChevronDown,
  FiChevronUp,
  FiFolderPlus,
  FiEdit,
  FiTrash2
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

// FolderTree component for side navigation
const FolderTree = ({ 
  categories, 
  onSelectFolder, 
  selectedFolder, 
  onDrop,
  expandedFolders,
  toggleFolder,
}: { 
  categories: { name: string; bookmarks: Bookmark[] }[]; 
  onSelectFolder: (folderName: string) => void;
  selectedFolder: string | null;
  onDrop: (bookmark: Bookmark, targetFolder: string) => void;
  expandedFolders: string[];
  toggleFolder: (folderName: string) => void;
}) => {
  const bgColor = useColorModeValue('white', 'gray.700');
  const hoverBgColor = useColorModeValue('gray.100', 'gray.600');
  const selectedBgColor = useColorModeValue('blue.50', 'blue.900');
  
  // Sort categories alphabetically
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, folderName: string) => {
    e.preventDefault();
    const bookmarkData = e.dataTransfer.getData('bookmark');
    if (bookmarkData) {
      const bookmark = JSON.parse(bookmarkData);
      onDrop(bookmark, folderName);
    }
  };
  
  return (
    <VStack 
      spacing={1} 
      align="stretch" 
      p={2} 
      bg={bgColor}
      borderRadius="md"
      borderWidth="1px"
      height="100%"
      overflowY="auto"
    >
      <Heading size="sm" p={2}>Folders</Heading>
      <Divider />
      
      {/* All Bookmarks option */}
      <Box 
        p={2}
        borderRadius="md"
        bg={selectedFolder === null ? selectedBgColor : 'transparent'}
        _hover={{ bg: selectedFolder === null ? selectedBgColor : hoverBgColor }}
        cursor="pointer"
        onClick={() => onSelectFolder('')}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, '')}
      >
        <HStack>
          <Icon as={FiFolder} color="blue.500" />
          <Text fontWeight={selectedFolder === null ? "bold" : "normal"}>All Bookmarks</Text>
          <Badge ml="auto">{sortedCategories.reduce((sum, cat) => sum + cat.bookmarks.length, 0)}</Badge>
        </HStack>
      </Box>
      
      {/* Category folders */}
      {sortedCategories.map((category) => (
        <Box key={category.name}>
          <HStack 
            p={2}
            borderRadius="md"
            bg={selectedFolder === category.name ? selectedBgColor : 'transparent'}
            _hover={{ bg: selectedFolder === category.name ? selectedBgColor : hoverBgColor }}
            cursor="pointer"
            onClick={() => onSelectFolder(category.name)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, category.name)}
          >
            <Icon 
              as={expandedFolders.includes(category.name) ? FiChevronDown : FiChevronRight} 
              color="gray.500"
              boxSize="14px"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(category.name);
              }}
            />
            <Icon as={FiFolder} color="blue.500" />
            <Text fontWeight={selectedFolder === category.name ? "bold" : "normal"} isTruncated>
              {category.name}
            </Text>
            <Badge ml="auto">{category.bookmarks.length}</Badge>
          </HStack>
        </Box>
      ))}

      {/* Add Folder button */}
      <Box mt={2}>
        <Button 
          leftIcon={<Icon as={FiFolderPlus} />} 
          size="sm" 
          variant="outline" 
          width="100%"
          isDisabled
        >
          Add Folder
        </Button>
      </Box>
    </VStack>
  );
};

// BookmarkCard component for displaying bookmark
const BookmarkCard = ({ bookmark, onDragStart }: { bookmark: Bookmark, onDragStart: (bookmark: Bookmark) => void }) => {
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
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('bookmark', JSON.stringify(bookmark));
    onDragStart(bookmark);
  };
  
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
      draggable
      onDragStart={handleDragStart}
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

// BookmarkListItem component for displaying bookmark in list view
const BookmarkListItem = ({ 
  bookmark, 
  onClick, 
  onDragStart 
}: { 
  bookmark: Bookmark; 
  onClick: () => void; 
  onDragStart: (bookmark: Bookmark) => void;
}) => {
  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch (e) {
      return '/globe.svg';
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('bookmark', JSON.stringify(bookmark));
    onDragStart(bookmark);
  };
  
  return (
    <HStack 
      p={2}
      borderWidth="1px"
      borderRadius="md"
      _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
      cursor="pointer"
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
    >
      <Image
        src={getFaviconUrl(bookmark.url)}
        alt={bookmark.title}
        boxSize="16px"
        fallbackSrc="/globe.svg"
      />
      <Text isTruncated>{bookmark.title || bookmark.url}</Text>
      <Icon as={FiExternalLink} ml="auto" boxSize="14px" color="gray.500" />
    </HStack>
  );
};

// Bookmark Detail Modal
const BookmarkDetailModal = ({ 
  isOpen, 
  onClose, 
  bookmark,
  categories,
  onMoveBookmark
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  bookmark: Bookmark | null;
  categories: { name: string; bookmarks: Bookmark[] }[];
  onMoveBookmark: (bookmark: Bookmark, targetCategory: string) => void;
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
  const [selectedCategory, setSelectedCategory] = useState<string>(bookmark.folder || '');
  
  const handleMoveBookmark = () => {
    if (selectedCategory && selectedCategory !== bookmark.folder) {
      onMoveBookmark(bookmark, selectedCategory);
      onClose();
    }
  };
  
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
            
            <Box width="100%">
              <Text fontWeight="bold" mb={2}>Move to folder:</Text>
              <Box>
                <InputGroup>
                  <Input 
                    as="select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {categories.map(cat => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </Input>
                </InputGroup>
              </Box>
              <Button 
                mt={2} 
                colorScheme="blue" 
                size="sm" 
                width="100%"
                onClick={handleMoveBookmark}
                isDisabled={selectedCategory === bookmark.folder}
              >
                Move Bookmark
              </Button>
            </Box>
            
            <Divider />
            
            {bookmark.folder && (
              <Box>
                <Text fontWeight="bold">Current Folder:</Text>
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
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [draggingBookmark, setDraggingBookmark] = useState<Bookmark | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  // We keep a mutable version of the bookmark data to allow moving bookmarks
  const [bookmarkData, setBookmarkData] = useState<OrganizedBookmarks>(organizedBookmarks);
  
  // Initialize with sorted categories
  useEffect(() => {
    setBookmarkData(organizedBookmarks);
  }, [organizedBookmarks]);
  
  // Filter bookmarks based on search term and current folder
  const filteredBookmarks = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    // If searching, show all matching bookmarks across all categories
    if (searchTerm) {
      return bookmarkData.categories.flatMap(category => 
        category.bookmarks.filter(bookmark => 
          bookmark.title.toLowerCase().includes(searchLower) ||
          bookmark.url.toLowerCase().includes(searchLower)
        )
      );
    }
    
    // If no folder is selected, show all bookmarks
    if (currentFolder === null) {
      return bookmarkData.categories.flatMap(category => category.bookmarks);
    }
    
    // Show bookmarks in the selected folder
    const selectedCategory = bookmarkData.categories.find(
      category => category.name === currentFolder
    );
    
    return selectedCategory ? selectedCategory.bookmarks : [];
  }, [bookmarkData.categories, searchTerm, currentFolder]);
  
  // Toggle folder expansion in the tree view
  const toggleFolder = useCallback((folderName: string) => {
    setExpandedFolders(prev => 
      prev.includes(folderName)
        ? prev.filter(f => f !== folderName)
        : [...prev, folderName]
    );
  }, []);
  
  // Handle folder selection
  const handleFolderSelect = useCallback((folderName: string) => {
    setCurrentFolder(folderName ? folderName : null);
    setSearchTerm('');
  }, []);
  
  // Handle bookmark click to show details
  const handleBookmarkClick = useCallback((bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    onOpen();
  }, [onOpen]);
  
  // Handle moving a bookmark to a different folder
  const handleMoveBookmark = useCallback((bookmark: Bookmark, targetFolder: string) => {
    // Skip if moving to the same folder
    if (bookmark.folder === targetFolder) return;
    
    setBookmarkData(prevData => {
      // Deep clone the current data
      const newData = JSON.parse(JSON.stringify(prevData)) as OrganizedBookmarks;
      
      // Find the source category
      const sourceCategory = newData.categories.find(cat => cat.name === bookmark.folder);
      
      // Find the target category
      const targetCategory = newData.categories.find(cat => cat.name === targetFolder);
      
      if (sourceCategory && targetCategory) {
        // Remove from source category
        sourceCategory.bookmarks = sourceCategory.bookmarks.filter(b => b.id !== bookmark.id);
        
        // Add to target category with updated folder reference
        const newBookmark = {...bookmark, folder: targetFolder};
        targetCategory.bookmarks.push(newBookmark);
        
        toast({
          title: "Bookmark moved",
          description: `Moved to "${targetFolder}"`,
          status: "success",
          duration: 2000,
          isClosable: true,
        });
      }
      
      return newData;
    });
  }, [toast]);
  
  // Handle drag start
  const handleDragStart = useCallback((bookmark: Bookmark) => {
    setDraggingBookmark(bookmark);
  }, []);
  
  // Handle dropping a bookmark onto a folder in the tree
  const handleDropOnFolder = useCallback((bookmark: Bookmark, targetFolder: string) => {
    handleMoveBookmark(bookmark, targetFolder);
    setDraggingBookmark(null);
  }, [handleMoveBookmark]);
  
  // Export bookmarks to HTML file
  const handleExport = () => {
    try {
      setIsExporting(true);
      
      // Create HTML bookmark file
      const bookmarkHtml = generateBookmarkHtml(bookmarkData);
      
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
      <DashboardSummary organizedBookmarks={bookmarkData} />
      
      {/* Search and View Mode Controls */}
      <Flex justify="space-between" align="center" mb={2} wrap="wrap" gap={2}>
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
      
      {/* Main Content with Sidebar */}
      <Flex 
        height="70vh" 
        gap={4}
      >
        {/* Folder Tree Sidebar */}
        <Box width="250px" height="100%">
          <FolderTree 
            categories={bookmarkData.categories}
            onSelectFolder={handleFolderSelect}
            selectedFolder={currentFolder}
            onDrop={handleDropOnFolder}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
          />
        </Box>
        
        {/* Content Area */}
        <Box 
          flex="1"
          borderWidth="1px" 
          borderRadius="md" 
          p={4} 
          bg={useColorModeValue('gray.50', 'gray.800')}
          overflowY="auto"
          height="100%"
        >
          {/* Title and count */}
          <Flex justify="space-between" align="center" mb={4}>
            <Heading size="md">
              {searchTerm 
                ? `Search Results: "${searchTerm}"`
                : currentFolder === null
                ? "All Bookmarks"
                : currentFolder
              }
            </Heading>
            <Badge colorScheme="blue" fontSize="sm" p={1}>
              {filteredBookmarks.length} bookmark{filteredBookmarks.length !== 1 ? 's' : ''}
            </Badge>
          </Flex>
          
          {viewMode === 'grid' ? (
            // Grid View
            <Grid 
              templateColumns={{
                base: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
                lg: 'repeat(5, 1fr)'
              }}
              gap={4}
            >
              {filteredBookmarks.map((bookmark, index) => (
                <GridItem key={`${bookmark.id}-${index}`}>
                  <Box onClick={() => handleBookmarkClick(bookmark)} cursor="pointer">
                    <BookmarkCard 
                      bookmark={bookmark} 
                      onDragStart={handleDragStart}
                    />
                  </Box>
                </GridItem>
              ))}
              
              {/* Empty state */}
              {filteredBookmarks.length === 0 && (
                <GridItem colSpan={{ base: 2, sm: 3, md: 4, lg: 5 }}>
                  <Box textAlign="center" p={8}>
                    <Icon as={FiSearch} boxSize="40px" color="gray.400" mb={4} />
                    <Heading size="md" mb={2}>No bookmarks found</Heading>
                    <Text color="gray.500">
                      {searchTerm 
                        ? `No bookmarks match "${searchTerm}"`
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
              {filteredBookmarks.map((bookmark, index) => (
                <BookmarkListItem 
                  key={`${bookmark.id}-${index}`}
                  bookmark={bookmark}
                  onClick={() => handleBookmarkClick(bookmark)}
                  onDragStart={handleDragStart}
                />
              ))}
              
              {/* Empty state */}
              {filteredBookmarks.length === 0 && (
                <Box textAlign="center" p={8}>
                  <Icon as={FiSearch} boxSize="40px" color="gray.400" mb={4} />
                  <Heading size="md" mb={2}>No bookmarks found</Heading>
                  <Text color="gray.500">
                    {searchTerm 
                      ? `No bookmarks match "${searchTerm}"`
                      : "This folder is empty"
                    }
                  </Text>
                </Box>
              )}
            </VStack>
          )}
        </Box>
      </Flex>
      
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
        categories={bookmarkData.categories}
        onMoveBookmark={handleMoveBookmark}
      />
    </VStack>
  );
}
