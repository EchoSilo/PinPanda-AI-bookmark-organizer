'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Text,
  Flex,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  VStack,
  HStack,
  useToast
} from '@chakra-ui/react';
import { testAIConnection } from '@/services/aiService';
import { info, error as logError } from '@/services/logService';
import APIKeyInstructions from './APIKeyInstructions';

export default function AIStatusChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const toast = useToast();

  const checkConnection = async () => {
    setIsChecking(true);
    setErrorMessage(null);
    
    try {
      info('AIStatusChecker', 'Testing AI connection');
      
      // Check if API key exists
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        setConnectionStatus('failed');
        const message = 'No API key found. Please add your OpenAI API key to the .env.local file.';
        setErrorMessage(message);
        logError('AIStatusChecker', message);
        toast({
          title: 'API Key Missing',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setIsChecking(false);
        return;
      }
      
      // Check if API key format is valid
      if (!apiKey.startsWith('sk-')) {
        setConnectionStatus('failed');
        const message = 'Invalid API key format. OpenAI API keys should start with "sk-".';
        setErrorMessage(message);
        logError('AIStatusChecker', message);
        toast({
          title: 'Invalid API Key',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setIsChecking(false);
        return;
      }
      
      // Test the connection
      const isConnected = await testAIConnection();
      
      if (isConnected) {
        setConnectionStatus('connected');
        info('AIStatusChecker', 'AI connection successful');
        toast({
          title: 'Connection Successful',
          description: 'Successfully connected to OpenAI API',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } else {
        setConnectionStatus('failed');
        const message = 'Failed to connect to OpenAI API. Please check your API key and network connection.';
        setErrorMessage(message);
        logError('AIStatusChecker', message);
        toast({
          title: 'Connection Failed',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (err) {
      setConnectionStatus('failed');
      const errorMessage = err instanceof Error ? err.message : String(err);
      const message = `Error testing AI connection: ${errorMessage}`;
      setErrorMessage(message);
      logError('AIStatusChecker', message);
      toast({
        title: 'Connection Error',
        description: 'An error occurred while testing the connection. Check the console for details.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      console.error('AI Connection Error:', err);
    } finally {
      setIsChecking(false);
    }
  };

  // Check connection status on component mount
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      checkConnection();
    }
  }, []);

  return (
    <Box 
      p={4} 
      borderWidth="1px" 
      borderRadius="md" 
      borderColor="gray.200"
      bg="white"
      shadow="sm"
    >
      <VStack spacing={4} align="stretch">
        <Flex justifyContent="space-between" alignItems="center">
          <Text fontWeight="medium">AI Connection Status</Text>
          {connectionStatus === 'connected' && (
            <Badge colorScheme="green">Connected</Badge>
          )}
          {connectionStatus === 'failed' && (
            <Badge colorScheme="red">Failed</Badge>
          )}
          {connectionStatus === 'unknown' && (
            <Badge colorScheme="gray">Unknown</Badge>
          )}
        </Flex>
        
        {errorMessage && (
          <Alert status="error" borderRadius="md" size="sm">
            <AlertIcon />
            <AlertDescription fontSize="sm">{errorMessage}</AlertDescription>
          </Alert>
        )}
        
        <HStack>
          <Button 
            size="sm" 
            colorScheme="blue" 
            onClick={checkConnection} 
            isLoading={isChecking}
            loadingText="Checking"
          >
            Test Connection
          </Button>
          
          <APIKeyInstructions />
          
          <Text fontSize="sm" color="gray.500">
            {isChecking ? 'Checking connection...' : 'Click to verify OpenAI API connection'}
          </Text>
        </HStack>
      </VStack>
    </Box>
  );
} 