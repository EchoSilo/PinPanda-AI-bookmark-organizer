'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Input,
  InputGroup,
  InputRightElement,
  Button,
  VStack,
  Text,
  useToast,
  HStack,
  IconButton,
} from '@chakra-ui/react';
import { CheckIcon, CloseIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import APIKeyInstructions from './APIKeyInstructions';

interface APIKeyInputProps {
  onApiKeyChange?: (key: string, isValid: boolean) => void;
}

export default function APIKeyInput({ onApiKeyChange }: APIKeyInputProps) {
  const [apiKey, setApiKey] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // Load API key from localStorage on component mount
    const storedKey = localStorage.getItem('openai_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      validateApiKey(storedKey);
    }
  }, []);

  const validateApiKey = async (key: string) => {
    if (!key.startsWith('sk-')) {
      setIsValid(false);
      if (onApiKeyChange) onApiKeyChange(key, false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`,
        },
      });

      const isValid = response.ok;
      setIsValid(isValid);

      if (isValid) {
        localStorage.setItem('openai_api_key', key);
        toast({
          title: 'API Key Valid',
          description: 'Your OpenAI API key has been saved.',
          status: 'success',
          duration: 3000,
        });
        if (onApiKeyChange) onApiKeyChange(key, true);
      } else {
        toast({
          title: 'Invalid API Key',
          description: 'Please check your API key and try again.',
          status: 'error',
          duration: 3000,
        });
        if (onApiKeyChange) onApiKeyChange(key, false);
      }
    } catch (error) {
      setIsValid(false);
      toast({
        title: 'Error',
        description: 'Failed to validate API key. Please try again.',
        status: 'error',
        duration: 3000,
      });
      if (onApiKeyChange) onApiKeyChange(key, false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    setIsValid(null);
  };

  const handleSubmit = () => {
    validateApiKey(apiKey);
  };

  const handleClear = () => {
    setApiKey('');
    setIsValid(null);
    localStorage.removeItem('openai_api_key');
    toast({
      title: 'API Key Cleared',
      description: 'Your OpenAI API key has been removed.',
      status: 'info',
      duration: 3000,
    });
    if (onApiKeyChange) onApiKeyChange('', false);
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && apiKey.trim() !== '') {
      handleSubmit();
    }
  };

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        <InputGroup size="md">
          <Input
            pr="4.5rem"
            type={showApiKey ? "text" : "password"}
            placeholder="Enter your OpenAI API key"
            value={apiKey}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <InputRightElement width="4.5rem">
            <IconButton
              h="1.75rem"
              size="sm"
              aria-label={showApiKey ? "Hide API key" : "Show API key"}
              icon={showApiKey ? <ViewOffIcon /> : <ViewIcon />}
              onClick={() => setShowApiKey(!showApiKey)}
            />
          </InputRightElement>
        </InputGroup>

        <HStack spacing={2}>
          <Button
            colorScheme={isValid ? "green" : "blue"}
            onClick={handleSubmit}
            isLoading={isLoading}
            leftIcon={isValid ? <CheckIcon /> : undefined}
            isDisabled={apiKey.trim() === ''}
          >
            {isValid ? "Verified" : "Verify Key"}
          </Button>
          <Button
            variant="outline"
            colorScheme="red"
            onClick={handleClear}
            leftIcon={<CloseIcon />}
            isDisabled={apiKey.trim() === ''}
          >
            Clear
          </Button>
          <APIKeyInstructions />
        </HStack>

        {isValid === false && (
          <Text color="red.500" fontSize="sm">
            Invalid API key. Please check your key and try again.
          </Text>
        )}
      </VStack>
    </Box>
  );
} 