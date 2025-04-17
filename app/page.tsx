'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Heading, 
  Text, 
  VStack, 
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Divider,
  Flex,
  Badge,
  HStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Tooltip,
  Switch,
  FormControl,
  FormLabel
} from '@chakra-ui/react';
import { info, warning, debug, error as logError, setLogLevel, LogLevel } from '@/services/logService';
import { organizeBookmarks } from '@/services/aiService';
import { testAIConnection } from '@/services/aiService';
import { Bookmark, OrganizedBookmarks, ProcessingProgress, AIResponse } from '@/types';
import { PROCESSING_TIMEOUT_MS } from '@/services/aiService/constants';
import BookmarkUploader from './components/BookmarkUploader';
import AIProcessingScreen from './components/AIProcessingScreen';
import BookmarkOrganizer from './components/BookmarkOrganizer';
import AIResponseViewer from './components/AIResponseViewer';
import BookmarkSearch from './components/BookmarkSearch';
import APIKeyInput from './components/APIKeyInput';
import DebugPanel from './components/DebugPanel';
import PinPandaLogo from './components/PinPandaLogo';
import { InfoIcon, EditIcon } from '@chakra-ui/icons';

export default function Home() {
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);
  const [organizedBookmarks, setOrganizedBookmarks] = useState<OrganizedBookmarks | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress>({ 
    step: 0, 
    message: '', 
    progress: 0 
  });
  const [error, setError] = useState<string | null>(null);
  const [aiResponses, setAiResponses] = useState<AIResponse[]>([]);
  const [showDebugger, setShowDebugger] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Log application startup
  useEffect(() => {
    try {
      // Set log level to DEBUG for more detailed logging
      setLogLevel(LogLevel.DEBUG);
      info('App', 'Application started with DEBUG log level');
      // Check connection on startup
      checkConnection();
    } catch (err) {
      console.error('Failed to log application start:', err);
    }
  }, []);

  const checkConnection = async () => {
    setIsCheckingConnection(true);
    try {
      info('App', 'Testing AI connection');
      const isConnected = await testAIConnection();
      setConnectionStatus(isConnected ? 'connected' : 'failed');
      if (isConnected) {
        info('App', 'AI connection successful');
      } else {
        warning('App', 'AI connection failed');
      }
    } catch (err) {
      console.error('Failed to check connection:', err);
      setConnectionStatus('failed');
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Handle API key changes from the APIKeyInput component
  const handleApiKeyChange = (key: string, isValid: boolean) => {
    info('App', `API key ${isValid ? 'validated successfully' : 'validation failed'}`);
    setConnectionStatus(isValid ? 'connected' : 'failed');
    
    // If the key was cleared or found invalid, update the connection status
    if (!key || !isValid) {
      setConnectionStatus('failed');
    }
  };

  const processBookmarks = async (uploadedBookmarks: Bookmark[]) => {
    try {
      info('App', `Starting to process ${uploadedBookmarks.length} bookmarks`);
      
      setIsProcessing(true);
      setBookmarks(uploadedBookmarks);
      setOrganizedBookmarks(null);
      setError(null);
      setAiResponses([]);

      // Set a timeout to prevent indefinite processing
      const processingTimeout = setTimeout(() => {
        logError('App', `Processing is taking longer than expected (${PROCESSING_TIMEOUT_MS/1000} seconds)`);
        setError('Processing is taking longer than expected. Results will be shown when complete, but you may want to try with fewer bookmarks next time.');
      }, PROCESSING_TIMEOUT_MS);

      // Process the bookmarks with AI categorization
      info('App', 'Calling organizeBookmarks function');
      const result = await organizeBookmarks(
        uploadedBookmarks,
        (progress) => {
          debug('App', `Progress update: ${progress.message}`, progress);
          setProcessingProgress(progress);
        },
        // Only collect AI responses if debug mode is enabled
        showDebugger ? (aiResponse) => {
          debug('App', `AI response: ${aiResponse.step}`, aiResponse);
          setAiResponses(prev => [...prev, aiResponse]);
        } : null
      );

      // Cancel the timeout since processing completed
      clearTimeout(processingTimeout);

      // Set the organized bookmarks
      setOrganizedBookmarks(result);
      
      toast({
        title: 'Bookmarks organized!',
        description: `Organized into ${result.categories.length} categories`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      logError('App', `Error processing bookmarks: ${err}`);
      setError(`Error processing bookmarks: ${err}`);
      
      toast({
        title: 'Error',
        description: 'Failed to process bookmarks. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setBookmarks(null);
    setOrganizedBookmarks(null);
    setError(null);
    setAiResponses([]);
    setProcessingProgress({ step: 0, message: '', progress: 0 });
    info('App', 'Reset application state');
  };

  // Run connection check when modal opens
  const handleModalOpen = () => {
    onOpen();
    checkConnection();
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Flex justifyContent="center" alignItems="center" position="relative">
          <HStack spacing={3}>
            <PinPandaLogo size="lg" withTagline={true} />
            <Tooltip 
              label={connectionStatus === 'connected' 
                ? 'OpenAI API Connected' 
                : connectionStatus === 'failed' 
                  ? 'OpenAI API Connection Failed' 
                  : 'OpenAI API Connection Unknown'
              }
            >
              <Badge 
                colorScheme={
                  connectionStatus === 'connected' 
                    ? 'green' 
                    : connectionStatus === 'failed' 
                      ? 'red' 
                      : 'gray'
                }
                fontSize="md"
                py={1}
                px={2}
                borderRadius="full"
                cursor="pointer"
                onClick={handleModalOpen}
                display="flex"
                alignItems="center"
              >
                {isCheckingConnection ? 'Checking...' : connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </Badge>
            </Tooltip>
          </HStack>
        </Flex>

        <Box textAlign="center">
          <Text fontSize="lg" color="gray.600" mb={4}>
            Upload your bookmarks and organize them with AI
          </Text>
          
          <Box maxW="md" mx="auto" mb={6}>
            {connectionStatus === 'connected' ? (
              <Flex 
                direction="column" 
                alignItems="center" 
                bg="green.50" 
                p={3} 
                borderRadius="md"
              >
                <Flex alignItems="center" mb={2}>
                  <Text color="green.600" fontWeight="medium" mr={2}>
                    OpenAI API Key connected successfully
                  </Text>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    colorScheme="green" 
                    leftIcon={<EditIcon />}
                    onClick={handleModalOpen}
                  >
                    Edit
                  </Button>
                </Flex>
                <Text fontSize="sm" color="gray.600">
                  <InfoIcon mr={1} />
                  Your bookmarks will be processed with AI categorization
                </Text>
              </Flex>
            ) : (
              <APIKeyInput onApiKeyChange={handleApiKeyChange} />
            )}
          </Box>
        </Box>

        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isProcessing && !organizedBookmarks && (
          <Box>
            <BookmarkUploader onBookmarksUploaded={processBookmarks} />
          </Box>
        )}
        
        {isProcessing && (
          <VStack spacing={4} align="stretch">
            <AIProcessingScreen progress={processingProgress} />
            {aiResponses.length > 0 && (
              <AIResponseViewer responses={aiResponses} />
            )}
          </VStack>
        )}

        {organizedBookmarks && !isProcessing && (
          <>
            {bookmarks && (
              <BookmarkSearch 
                bookmarks={bookmarks} 
                onSearchResults={setOrganizedBookmarks} 
              />
            )}
            <Tabs variant="enclosed" colorScheme="green">
              <TabList>
                <Tab>Organized Bookmarks</Tab>
                {showDebugger && aiResponses.length > 0 && (
                  <Tab>AI Responses ({aiResponses.length})</Tab>
                )}
              </TabList>
              <TabPanels>
                <TabPanel p={0} pt={4}>
                  <BookmarkOrganizer 
                    organizedBookmarks={organizedBookmarks} 
                    onReset={handleReset}
                  />
                </TabPanel>
                {showDebugger && aiResponses.length > 0 && (
                  <TabPanel p={0} pt={4}>
                    <AIResponseViewer responses={aiResponses} />
                  </TabPanel>
                )}
              </TabPanels>
            </Tabs>
          </>
        )}

        {/* Debug Panel Toggle */}
        <Box>
          <FormControl display="flex" alignItems="center" justifyContent="flex-end">
            <FormLabel htmlFor="debug-mode" mb="0" mr={2}>
              Debug Mode
            </FormLabel>
            <Tooltip 
              label="Enabling debug mode will increase memory usage significantly"
              hasArrow
              placement="top"
            >
              <Switch 
                id="debug-mode" 
                isChecked={showDebugger} 
                onChange={() => {
                  const newValue = !showDebugger;
                  setShowDebugger(newValue);
                  
                  // Show warning when enabling debug mode
                  if (newValue) {
                    toast({
                      title: "Debug Mode Enabled",
                      description: "This will increase memory usage. Disable when not needed.",
                      status: "warning",
                      duration: 5000,
                      isClosable: true,
                    });
                  }
                }}
                colorScheme="green"
              />
            </Tooltip>
          </FormControl>
        </Box>

        {/* Debug Panel */}
        {showDebugger && (
          <Box mt={4}>
            <DebugPanel />
          </Box>
        )}

        {/* API Connection Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>OpenAI API Connection</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={6} align="stretch">
                <Box p={4} borderWidth="1px" borderRadius="md" bg={connectionStatus === 'connected' ? 'green.50' : 'red.50'}>
                  <Flex alignItems="center" mb={2}>
                    <Badge 
                      colorScheme={connectionStatus === 'connected' ? 'green' : 'red'} 
                      fontSize="md" 
                      mr={2}
                    >
                      {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
                    </Badge>
                    <Text fontWeight="medium">
                      {connectionStatus === 'connected' 
                        ? 'Successfully connected to OpenAI API' 
                        : 'Failed to connect to OpenAI API'
                      }
                    </Text>
                  </Flex>
                  <Text fontSize="sm">
                    {connectionStatus === 'connected' 
                      ? 'Your API key is valid and working correctly.' 
                      : 'Please check your API key and try again.'
                    }
                  </Text>
                </Box>

                <Box>
                  <Heading size="sm" mb={3}>API Connection Options</Heading>
                  <HStack spacing={4}>
                    <Button 
                      colorScheme="blue" 
                      onClick={checkConnection} 
                      isLoading={isCheckingConnection}
                      loadingText="Testing"
                    >
                      Test Connection
                    </Button>
                    <Button 
                      as="a" 
                      href="/api-test" 
                      colorScheme="blue" 
                      variant="outline"
                    >
                      Advanced API Test
                    </Button>
                  </HStack>
                </Box>

                <Divider />

                <Box>
                  <Heading size="sm" mb={3}>Need an API Key?</Heading>
                  <Text mb={4}>
                    To use the AI features of this application, you need an OpenAI API key. 
                    Follow these steps to get one:
                  </Text>
                  <APIKeyInput onApiKeyChange={handleApiKeyChange} />
                </Box>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" mr={3} onClick={onClose}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </Container>
  );
}
