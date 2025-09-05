'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  Card,
  CardBody,
  Avatar,
  Flex,
  IconButton,
  useColorModeValue,
  Spinner,
  Link,
  Badge,
  Divider,
  Heading,
  useToast,
  Tooltip,
} from '@chakra-ui/react';
import { FiSend, FiUser, FiMessageCircle, FiExternalLink, FiTrash2 } from 'react-icons/fi';
import { Bookmark, OrganizedBookmarks } from '@/types';
import * as aiService from '@/services/aiService';
import * as Logger from '@/services/logService';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  bookmarks?: Bookmark[];
  isLoading?: boolean;
}

interface BookmarkChatbotProps {
  organizedBookmarks: OrganizedBookmarks;
}



export default function BookmarkChatbot({ organizedBookmarks }: BookmarkChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'bot',
      content: "Hi! I'm your AI bookmark assistant. Ask me anything about your bookmarks using natural language. For example:\n\n• \"Do I have any bookmarks about AI and machine learning?\"\n• \"Show me bookmarks I saved last week about productivity\"\n• \"Find bookmarks related to React development\"",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get all bookmarks as a flat array for searching
  const allBookmarks = organizedBookmarks.categories.flatMap(category => 
    category.bookmarks.map(bookmark => ({
      ...bookmark,
      category: category.name
    }))
  );

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    // Add user message
    setMessages(prev => [...prev, userMessage]);

    // Add loading bot message
    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'bot',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, loadingMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      Logger.info('BookmarkChatbot', `Processing query: ${userMessage.content}`);

      // Call AI service to search bookmarks with natural language
      const searchResults = await searchBookmarksWithAI(userMessage.content, allBookmarks);

      // Remove loading message and add response
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => msg.id !== loadingMessage.id);
        return [...withoutLoading, searchResults];
      });

    } catch (error) {
      Logger.error('BookmarkChatbot', 'Error processing query', error);

      // Remove loading message and add error response
      setMessages(prev => {
        const withoutLoading = prev.filter(msg => msg.id !== loadingMessage.id);
        const errorMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: 'bot',
          content: "I'm sorry, I encountered an error while searching your bookmarks. Please try again or rephrase your question.",
          timestamp: new Date(),
        };
        return [...withoutLoading, errorMessage];
      });

      toast({
        title: 'Search Error',
        description: 'Failed to process your query. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const searchBookmarksWithAI = async (query: string, bookmarks: Bookmark[]): Promise<ChatMessage> => {
    try {
      // Prepare bookmark data for AI analysis
      const bookmarkData = bookmarks.map((bookmark, index) => ({
        index,
        title: bookmark.title || 'Untitled',
        url: bookmark.url,
        category: (bookmark as any).category || 'Uncategorized',
        folder: bookmark.folder || '',
        dateAdded: bookmark.dateAdded,
      }));

      const systemPrompt = `You are a helpful AI assistant that helps users search through their bookmarks using natural language queries.

Your job is to:
1. Understand the user's natural language query
2. Find the most relevant bookmarks from their collection
3. Provide a conversational, helpful response
4. Include the most relevant bookmarks in your response

Guidelines:
- Be conversational and friendly
- Explain why you selected certain bookmarks
- If no relevant bookmarks are found, suggest alternative searches
- Consider semantic meaning, not just keyword matching
- Pay attention to dates, and context
- Limit results to the most relevant bookmarks (typically 3-8)

Return your response in this JSON format:
{
  "response": "Your conversational response explaining what you found",
  "bookmarks": [array of bookmark indices that are most relevant],
  "confidence": "high|medium|low - how confident you are in the results"
}`;

      const userPrompt = `User Query: "${query}"

Here are the user's bookmarks to search through:
${JSON.stringify(bookmarkData.slice(0, 100), null, 2)}

${bookmarkData.length > 100 ? `\n(Note: Showing first 100 of ${bookmarkData.length} total bookmarks for analysis)` : ''}

Please analyze the query and find the most relevant bookmarks, then provide a helpful response.`;

      const aiResponse = await aiService.callOpenAI(systemPrompt, userPrompt);

      // Parse the AI response
      const responseData = JSON.parse(aiResponse.content);

      // Get the relevant bookmarks
      const relevantBookmarks = responseData.bookmarks
        .filter((index: number) => index >= 0 && index < bookmarks.length)
        .map((index: number) => bookmarks[index]);

      return {
        id: Date.now().toString(),
        type: 'bot',
        content: responseData.response,
        timestamp: new Date(),
        bookmarks: relevantBookmarks,
      };

    } catch (error) {
      Logger.error('BookmarkChatbot', 'Error in AI search', error);
      throw error;
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        type: 'bot',
        content: "Hi! I'm your AI bookmark assistant. Ask me anything about your bookmarks using natural language.",
        timestamp: new Date(),
      }
    ]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card h="600px" bg={bgColor} borderColor={borderColor}>
      <CardBody p={0} display="flex" flexDirection="column">
        {/* Header */}
        <Flex p={4} borderBottomWidth="1px" borderColor={borderColor} align="center" justify="space-between">
          <HStack>
            <Avatar size="sm" icon={<FiMessageCircle />} bg="blue.500" />
            <VStack align="start" spacing={0}>
              <Heading size="sm">AI Bookmark Assistant</Heading>
              <Text fontSize="xs" color="gray.500">
                Search {allBookmarks.length} bookmarks with natural language
              </Text>
            </VStack>
          </HStack>
          <Tooltip label="Clear chat">
            <IconButton
              aria-label="Clear chat"
              icon={<FiTrash2 />}
              size="sm"
              variant="ghost"
              onClick={clearChat}
            />
          </Tooltip>
        </Flex>

        {/* Messages */}
        <Box flex="1" overflowY="auto" p={4}>
          <VStack spacing={4} align="stretch">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </VStack>
        </Box>

        {/* Input */}
        <Box p={4} borderTopWidth="1px" borderColor={borderColor}>
          <HStack>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about your bookmarks..."
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              isLoading={isLoading}
              disabled={!inputValue.trim()}
              colorScheme="blue"
              leftIcon={<FiSend />}
            >
              Send
            </Button>
          </HStack>
        </Box>
      </CardBody>
    </Card>
  );
}

// Message bubble component (defined before usage)
const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.type === 'user';
  const bgColor = useColorModeValue(
    isUser ? 'blue.500' : 'gray.100',
    isUser ? 'blue.600' : 'gray.700'
  );
  const textColor = useColorModeValue(
    isUser ? 'white' : 'black',
    isUser ? 'white' : 'white'
  );

  if (message.isLoading) {
    return (
      <HStack align="start" justify="flex-start">
        <Avatar size="sm" icon={<FiMessageCircle />} bg="blue.500" />
        <Box
          bg={bgColor}
          color={textColor}
          px={3}
          py={2}
          borderRadius="lg"
          maxW="70%"
        >
          <HStack>
            <Spinner size="sm" />
            <Text>Searching your bookmarks...</Text>
          </HStack>
        </Box>
      </HStack>
    );
  }

  return (
    <HStack align="start" justify={isUser ? 'flex-end' : 'flex-start'}>
      {!isUser && <Avatar size="sm" icon={<FiMessageCircle />} bg="blue.500" />}
      <VStack align={isUser ? 'end' : 'start'} spacing={2} maxW="70%">
        <Box
          bg={bgColor}
          color={textColor}
          px={3}
          py={2}
          borderRadius="lg"
        >
          <Text whiteSpace="pre-wrap">{message.content}</Text>
        </Box>

        {/* Show bookmarks if any */}
        {message.bookmarks && message.bookmarks.length > 0 && (
          <VStack spacing={2} align="stretch" w="full">
            <Text fontSize="sm" fontWeight="medium" color="gray.600">
              Found {message.bookmarks.length} relevant bookmark{message.bookmarks.length !== 1 ? 's' : ''}:
            </Text>
            {message.bookmarks.map((bookmark, index) => (
              <BookmarkResult key={`${bookmark.id}-${index}`} bookmark={bookmark} />
            ))}
          </VStack>
        )}

        <Text fontSize="xs" color="gray.500">
          {message.timestamp.toLocaleTimeString()}
        </Text>
      </VStack>
      {isUser && <Avatar size="sm" icon={<FiUser />} />}
    </HStack>
  );
};

// Bookmark result component
const BookmarkResult = ({ bookmark }: { bookmark: Bookmark }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Card size="sm" bg={bgColor} borderColor={borderColor}>
      <CardBody p={3}>
        <VStack align="start" spacing={2}>
          <HStack justify="space-between" w="full">
            <Text fontWeight="medium" fontSize="sm" noOfLines={1}>
              {bookmark.title || 'Untitled'}
            </Text>
            <Link href={bookmark.url} isExternal>
              <IconButton
                aria-label="Open bookmark"
                icon={<FiExternalLink />}
                size="xs"
                variant="ghost"
              />
            </Link>
          </HStack>

          {(bookmark as any).category && (
            <Badge size="sm" colorScheme="blue">
              {(bookmark as any).category}
            </Badge>
          )}

          <Text fontSize="xs" color="gray.500" noOfLines={1}>
            {bookmark.url}
          </Text>
        </VStack>
      </CardBody>
    </Card>
  );
};