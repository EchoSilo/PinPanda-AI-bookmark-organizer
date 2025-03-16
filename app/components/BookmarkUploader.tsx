'use client';

import { useState, useRef } from 'react';
import { 
  Box, 
  Button, 
  Text, 
  VStack, 
  HStack, 
  Flex, 
  Icon, 
  useColorModeValue, 
  Progress, 
  List, 
  ListItem, 
  Badge, 
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  StatHelpText,
  Card,
  CardBody,
  CardHeader,
  Heading
} from '@chakra-ui/react';
import { FiUpload, FiFolder, FiLink, FiPlay } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import * as Logger from '@/services/logService';
import { Bookmark } from '@/types';

interface BookmarkUploaderProps {
  onBookmarksUploaded: (bookmarks: Bookmark[]) => void;
}

export default function BookmarkUploader({ onBookmarksUploaded }: BookmarkUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedBookmarks, setParsedBookmarks] = useState<Bookmark[] | null>(null);
  const [folderStats, setFolderStats] = useState<Record<string, number> | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const dropBgColor = useColorModeValue('gray.100', 'gray.700');
  const activeBgColor = useColorModeValue('green.50', 'green.900');
  const borderColor = useColorModeValue('gray.300', 'gray.600');
  const activeBorderColor = useColorModeValue('green.300', 'green.500');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.html')) {
        processFile(file);
      } else {
        setError('Please upload an HTML bookmark file exported from your browser.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.endsWith('.html')) {
        processFile(file);
      } else {
        setError('Please upload an HTML bookmark file exported from your browser.');
      }
    }
  };

  const processFile = (file: File) => {
    setIsLoading(true);
    setError(null);
    
    Logger.info('BookmarkUploader', `Processing file: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        if (!e.target || typeof e.target.result !== 'string') {
          throw new Error('Failed to read file');
        }
        
        const content = e.target.result;
        Logger.info('BookmarkUploader', `File loaded, content length: ${content.length} characters`);
        
        // Extract folder structure first
        const folderStructure = extractFolderStructure(content);
        Logger.info('BookmarkUploader', `Extracted folder structure with ${Object.keys(folderStructure).length} folders`);
        
        // For large files, use chunked processing
        if (content.length > 500000) { // 500KB
          Logger.info('BookmarkUploader', `Large file detected (${Math.round(content.length / 1024)} KB), using chunked processing`);
          setProcessingStatus('📚 Processing your large bookmark collection in chunks...');
          
          try {
            const bookmarks = await processLargeFile(content, folderStructure);
            Logger.info('BookmarkUploader', `Successfully processed large file, extracted ${bookmarks.length} bookmarks`);
            
            // Calculate folder statistics
            const stats = calculateFolderStats(bookmarks);
            
            setParsedBookmarks(bookmarks);
            setFolderStats(stats);
            setProcessingStatus('');
            setProcessingProgress(100);
          } catch (error) {
            Logger.error('BookmarkUploader', `Error processing large file: ${error}`);
            setError(`Error processing large bookmark file: ${error}`);
          }
        } else {
          // For smaller files, process normally
          Logger.info('BookmarkUploader', 'Processing file normally');
          
          // Regular expression to find all bookmark entries
          const bookmarkRegex = /<A[^>]*HREF="([^"]*)"[^>]*>(.*?)<\/A>/gi;
          let match;
          const bookmarks: Bookmark[] = [];
          
          // Keep track of the current folder path
          let currentFolder = '';
          
          // Find all folder markers and bookmark entries
          const lines = content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Update progress for large files
            if (i % 100 === 0) {
              setProcessingProgress(Math.round((i / lines.length) * 100));
              setProcessingStatus(`📖 Reading bookmark ${i} of ${lines.length}...`);
            }
            
            // Check if this line contains a folder marker
            if (line.includes('<H3')) {
              // Extract folder name
              const folderMatch = line.match(/>([^<]+)<\/H3>/);
              if (folderMatch && folderMatch[1]) {
                currentFolder = folderMatch[1].trim();
              }
            }
            
            // Check if this line contains a bookmark
            if (line.includes('<A HREF=')) {
              // Reset the regex index
              bookmarkRegex.lastIndex = 0;
              
              // Extract bookmark details
              match = bookmarkRegex.exec(line);
              if (match) {
                const url = match[1];
                const title = match[2].replace(/<[^>]*>/g, '').trim();
                
                // Extract date added if available
                const dateMatch = line.match(/ADD_DATE="(\d+)"/);
                const dateAdded = dateMatch ? new Date(parseInt(dateMatch[1]) * 1000).toISOString() : undefined;
                
                bookmarks.push({
                  id: uuidv4(),
                  url,
                  title,
                  folder: currentFolder,
                  dateAdded
                });
              }
            }
          }
          
          Logger.info('BookmarkUploader', `Extracted ${bookmarks.length} bookmarks`);
          
          // Calculate folder statistics
          const stats = calculateFolderStats(bookmarks);
          
          setParsedBookmarks(bookmarks);
          setFolderStats(stats);
          setProcessingStatus('');
          setProcessingProgress(100);
        }
      } catch (error) {
        Logger.error('BookmarkUploader', `Error processing file: ${error}`);
        setError(`Error processing bookmark file: ${error}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      Logger.error('BookmarkUploader', 'Error reading file');
      setError('Error reading file. Please try again.');
      setIsLoading(false);
    };
    
    reader.readAsText(file);
  };

  const extractFolderStructure = (content: string): Record<string, string> => {
    const folderStructure: Record<string, string> = {};
    const folderStack: string[] = [];
    
    // Regular expression to find folder markers
    const folderStartRegex = /<DT><H3[^>]*>(.*?)<\/H3>/g;
    const folderEndRegex = /<\/DL><\/DT>/g;
    
    let match;
    let lastIndex = 0;
    
    // Find all folder start markers
    while ((match = folderStartRegex.exec(content)) !== null) {
      const folderName = match[1].replace(/<[^>]*>/g, '').trim();
      folderStack.push(folderName);
      
      // Current path is the joined folder stack
      const currentPath = folderStack.join('/');
      folderStructure[currentPath] = currentPath;
      
      // Update last index to continue search from this point
      lastIndex = folderStartRegex.lastIndex;
      
      // Find the next folder end marker
      folderEndRegex.lastIndex = lastIndex;
      if (folderEndRegex.exec(content)) {
        // If we found an end marker, pop the last folder from the stack
        folderStack.pop();
        
        // Update last index to continue search from this point
        lastIndex = folderEndRegex.lastIndex;
        folderStartRegex.lastIndex = lastIndex;
      }
    }
    
    return folderStructure;
  };

  const processLargeFile = async (content: string, folderStructure: Record<string, string>): Promise<Bookmark[]> => {
    return new Promise((resolve, reject) => {
      try {
        const bookmarks: Bookmark[] = [];
        const lines = content.split('\n');
        let currentFolder = '';
        let processedLines = 0;
        
        // Process in chunks to avoid blocking the UI
        const processChunk = () => {
          const chunkSize = 1000;
          const endLine = Math.min(processedLines + chunkSize, lines.length);
          
          // Regular expression to find all bookmark entries
          const bookmarkRegex = /<A[^>]*HREF="([^"]*)"[^>]*>(.*?)<\/A>/gi;
          
          for (let i = processedLines; i < endLine; i++) {
            const line = lines[i];
            
            // Update progress
            if (i % 100 === 0) {
              setProcessingProgress(Math.round((i / lines.length) * 100));
              setProcessingStatus(`📖 Reading bookmark ${i} of ${lines.length}...`);
            }
            
            // Check if this line contains a folder marker
            if (line.includes('<H3')) {
              // Extract folder name
              const folderMatch = line.match(/>([^<]+)<\/H3>/);
              if (folderMatch && folderMatch[1]) {
                currentFolder = folderMatch[1].trim();
              }
            }
            
            // Check if this line contains a bookmark
            if (line.includes('<A HREF=')) {
              // Reset the regex index
              bookmarkRegex.lastIndex = 0;
              
              // Extract bookmark details
              const match = bookmarkRegex.exec(line);
              if (match) {
                const url = match[1];
                const title = match[2].replace(/<[^>]*>/g, '').trim();
                
                // Extract date added if available
                const dateMatch = line.match(/ADD_DATE="(\d+)"/);
                const dateAdded = dateMatch ? new Date(parseInt(dateMatch[1]) * 1000).toISOString() : undefined;
                
                bookmarks.push({
                  id: uuidv4(),
                  url,
                  title,
                  folder: currentFolder,
                  dateAdded
                });
              }
            }
          }
          
          processedLines = endLine;
          
          if (processedLines < lines.length) {
            // Schedule the next chunk
            setTimeout(processChunk, 0);
          } else {
            // All done
            resolve(bookmarks);
          }
        };
        
        // Start processing
        processChunk();
      } catch (error) {
        reject(error);
      }
    });
  };

  const calculateFolderStats = (bookmarks: Bookmark[]): Record<string, number> => {
    const stats: Record<string, number> = {};
    
    bookmarks.forEach(bookmark => {
      const folder = bookmark.folder || 'Uncategorized';
      stats[folder] = (stats[folder] || 0) + 1;
    });
    
    return stats;
  };

  const handleProcess = () => {
    if (parsedBookmarks) {
      onBookmarksUploaded(parsedBookmarks);
    }
  };

  return (
    <VStack spacing={6} width="100%">
      <Box
        width="100%"
        borderWidth={2}
        borderStyle="dashed"
        borderColor={isDragging ? activeBorderColor : borderColor}
        borderRadius="md"
        bg={isDragging ? activeBgColor : dropBgColor}
        p={10}
        textAlign="center"
        transition="all 0.2s"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <VStack spacing={4}>
          <Icon as={FiUpload} boxSize={12} color="green.500" />
          <Text fontSize="xl" fontWeight="bold">
            Drag & Drop your bookmark file here
          </Text>
          <Text color="gray.500">
            or
          </Text>
          <Button
            colorScheme="green"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<FiFolder />}
          >
            Select File
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept=".html"
          />
          <Text fontSize="sm" color="gray.500">
            Accepts HTML bookmark files exported from Chrome, Firefox, Safari, or Edge
          </Text>
        </VStack>
      </Box>

      {error && (
        <Box width="100%" p={4} bg="red.50" color="red.600" borderRadius="md">
          <Text>{error}</Text>
        </Box>
      )}

      {isLoading && (
        <Box width="100%">
          <Text mb={2}>{processingStatus || 'Processing bookmark file...'}</Text>
          <Progress value={processingProgress} size="sm" colorScheme="green" borderRadius="md" />
        </Box>
      )}

      {parsedBookmarks && folderStats && !isLoading && (
        <Card width="100%" variant="outline">
          <CardHeader>
            <Heading size="md">Bookmarks Found</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <StatGroup>
                <Stat>
                  <StatLabel>Total Bookmarks</StatLabel>
                  <StatNumber>{parsedBookmarks.length}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Folders</StatLabel>
                  <StatNumber>{Object.keys(folderStats).length}</StatNumber>
                </Stat>
              </StatGroup>
              
              <Divider />
              
              <Box maxH="200px" overflowY="auto">
                <List spacing={2}>
                  {Object.entries(folderStats)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([folder, count]) => (
                      <ListItem key={folder} display="flex" justifyContent="space-between">
                        <HStack>
                          <Icon as={FiFolder} color="green.500" />
                          <Text fontWeight="medium" isTruncated maxW="300px">{folder}</Text>
                        </HStack>
                        <Badge colorScheme="green">{count}</Badge>
                      </ListItem>
                    ))}
                </List>
              </Box>
              
              <Button
                colorScheme="green"
                size="lg"
                width="100%"
                leftIcon={<FiPlay />}
                onClick={handleProcess}
              >
                Process Bookmarks with PinPanda
              </Button>
            </VStack>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
} 