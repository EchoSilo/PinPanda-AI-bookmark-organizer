'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Text,
  VStack,
  Heading,
  Code,
  Alert,
  AlertIcon,
  Spinner,
  Container,
  Flex
} from '@chakra-ui/react';
import { API_KEY } from '@/services/aiService/constants';

export default function APITestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testDirectAPI = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Clean the API key - remove any line breaks or whitespace
      const apiKey = API_KEY.replace(/\s+/g, '');
      
      // Log the API key (first few characters only for security)
      const maskedKey = apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}` : 'Not found';
      console.log('API Key (masked):', maskedKey);
      console.log('API Key exists:', !!apiKey);
      console.log('API Key length:', apiKey?.length || 0);

      if (!apiKey) {
        throw new Error('No API key found. Please add your OpenAI API key to the .env.local file.');
      }

      // Make a direct fetch call to OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Say hello and confirm the API is working." }
          ],
          temperature: 0.3,
          max_tokens: 50
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${JSON.stringify(data)}`);
      }
      
      setResult(data);
    } catch (err) {
      console.error('API Test Error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="container.md" py={8}>
      <VStack spacing={6} align="stretch">
        <Flex justifyContent="space-between" alignItems="center">
          <Heading as="h1" size="xl">OpenAI API Test</Heading>
          <Button 
            as="a" 
            href="/" 
            colorScheme="blue" 
            variant="outline"
            leftIcon={<Box as="span" transform="rotate(180deg)">→</Box>}
          >
            Back to Home
          </Button>
        </Flex>
        
        <Box p={4} borderWidth="1px" borderRadius="md">
          <VStack spacing={4} align="stretch">
            <Text>
              This page tests a direct connection to the OpenAI API using the API key from your environment variables.
            </Text>
            
            <Button 
              colorScheme="blue" 
              onClick={testDirectAPI} 
              isLoading={isLoading}
              loadingText="Testing API"
            >
              Test OpenAI API Connection
            </Button>
            
            {isLoading && (
              <Box textAlign="center" py={4}>
                <Spinner size="lg" color="blue.500" />
                <Text mt={2}>Testing API connection...</Text>
              </Box>
            )}
            
            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <Text>{error}</Text>
              </Alert>
            )}
            
            {result && (
              <Box>
                <Text fontWeight="bold" mb={2}>API Response:</Text>
                <Code p={3} borderRadius="md" whiteSpace="pre-wrap" display="block" overflowX="auto">
                  {JSON.stringify(result, null, 2)}
                </Code>
                
                <Text fontWeight="bold" mt={4} mb={2}>Response Content:</Text>
                <Box p={3} borderWidth="1px" borderRadius="md" bg="gray.50">
                  {result.choices && result.choices[0] && result.choices[0].message ? (
                    <Text>{result.choices[0].message.content}</Text>
                  ) : (
                    <Text color="red.500">No content found in response</Text>
                  )}
                </Box>
              </Box>
            )}
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
} 