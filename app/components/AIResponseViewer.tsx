'use client';

import { useState } from 'react';
import {
  Box,
  Text,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Badge,
  Code,
  Flex,
  Heading,
  VStack,
  HStack,
  Button,
  useClipboard
} from '@chakra-ui/react';
import { AIResponse } from '@/types';

interface AIResponseViewerProps {
  responses: AIResponse[];
}

export default function AIResponseViewer({ responses }: AIResponseViewerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copyText, setCopyText] = useState('');
  const { onCopy, hasCopied } = useClipboard(copyText);

  if (responses.length === 0) {
    return (
      <Box p={4} borderWidth="1px" borderRadius="md" borderColor="gray.200" bg="white">
        <Text color="gray.500">No AI responses yet.</Text>
      </Box>
    );
  }

  const copyResponse = (text: string) => {
    setCopyText(text);
    onCopy();
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Box borderWidth="1px" borderRadius="md" borderColor="gray.200" bg="white" overflow="hidden">
      <Box p={4} bg="gray.50" borderBottomWidth="1px">
        <Heading size="sm">AI Processing Responses ({responses.length})</Heading>
      </Box>
      
      <Accordion allowToggle index={expandedIndex as number} onChange={(index) => setExpandedIndex(index as number)}>
        {responses.map((response, index) => (
          <AccordionItem key={index} borderBottomWidth={index === responses.length - 1 ? '0' : '1px'}>
            <AccordionButton py={3}>
              <HStack flex="1" textAlign="left" spacing={3}>
                <Badge colorScheme="blue">{response.step}</Badge>
                <Text fontWeight="medium" fontSize="sm" isTruncated>
                  {response.prompt.length > 50 ? `${response.prompt.substring(0, 50)}...` : response.prompt}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {formatTimestamp(response.timestamp)}
                </Text>
              </HStack>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4} bg="gray.50">
              <VStack align="stretch" spacing={3}>
                <Box>
                  <Text fontWeight="medium" fontSize="sm" mb={1}>Prompt:</Text>
                  <Code p={2} borderRadius="md" fontSize="xs" whiteSpace="pre-wrap" display="block" overflowX="auto">
                    {response.prompt}
                  </Code>
                </Box>
                
                <Box>
                  <Flex justify="space-between" align="center" mb={1}>
                    <Text fontWeight="medium" fontSize="sm">Response:</Text>
                    <Button 
                      size="xs" 
                      onClick={() => copyResponse(response.response)}
                      variant="outline"
                    >
                      {hasCopied ? 'Copied!' : 'Copy'}
                    </Button>
                  </Flex>
                  <Code p={2} borderRadius="md" fontSize="xs" whiteSpace="pre-wrap" display="block" overflowX="auto">
                    {response.response}
                  </Code>
                </Box>
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </Box>
  );
} 