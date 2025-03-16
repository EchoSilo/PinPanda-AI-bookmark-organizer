'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Text,
  Heading,
  Badge,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Button,
  HStack,
  Select,
  Flex,
  useClipboard,
  Divider
} from '@chakra-ui/react';
import { getLogs, getLogLevel, setLogLevel, LogLevel, clearLogs } from '@/services/logService';

export default function DebugPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [logLevel, setLogLevelState] = useState<LogLevel>(getLogLevel());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copyText, setCopyText] = useState('');
  const { onCopy, hasCopied } = useClipboard(copyText);

  // Update logs every second
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(getLogs());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Initial load
  useEffect(() => {
    setLogs(getLogs());
  }, []);

  const handleLogLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const level = parseInt(e.target.value) as LogLevel;
    setLogLevel(level);
    setLogLevelState(level);
  };

  const handleClearLogs = () => {
    clearLogs();
    setLogs([]);
  };

  const copyLogToClipboard = (log: any) => {
    const logText = JSON.stringify(log, null, 2);
    setCopyText(logText);
    setTimeout(() => {
      onCopy();
    }, 100);
  };

  const getLogLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.DEBUG:
        return 'gray';
      case LogLevel.INFO:
        return 'blue';
      case LogLevel.WARNING:
        return 'yellow';
      case LogLevel.ERROR:
        return 'red';
      default:
        return 'gray';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Box borderWidth="1px" borderRadius="md" bg="white" overflow="hidden">
      <Box p={4} bg="gray.50" borderBottomWidth="1px">
        <Flex justify="space-between" align="center">
          <Heading size="sm">Debug Logs ({logs.length})</Heading>
          <HStack spacing={2}>
            <Select size="sm" value={logLevel} onChange={handleLogLevelChange} width="auto">
              <option value={LogLevel.DEBUG}>DEBUG</option>
              <option value={LogLevel.INFO}>INFO</option>
              <option value={LogLevel.WARNING}>WARNING</option>
              <option value={LogLevel.ERROR}>ERROR</option>
            </Select>
            <Button size="sm" colorScheme="red" variant="outline" onClick={handleClearLogs}>
              Clear Logs
            </Button>
          </HStack>
        </Flex>
      </Box>
      
      {logs.length === 0 ? (
        <Box p={4} textAlign="center">
          <Text color="gray.500">No logs available.</Text>
        </Box>
      ) : (
        <Accordion allowToggle index={expandedIndex as number} onChange={(index) => setExpandedIndex(index as number)}>
          {logs.map((log, index) => (
            <AccordionItem key={index} borderBottomWidth={index === logs.length - 1 ? '0' : '1px'}>
              <AccordionButton py={2}>
                <HStack flex="1" textAlign="left" spacing={3}>
                  <Badge colorScheme={getLogLevelColor(log.level)}>
                    {LogLevel[log.level]}
                  </Badge>
                  <Text fontWeight="medium" fontSize="sm">
                    [{log.component}]
                  </Text>
                  <Text fontSize="sm" isTruncated>
                    {log.message}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {formatTimestamp(log.timestamp)}
                  </Text>
                </HStack>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={4} bg="gray.50">
                <VStack align="stretch" spacing={3}>
                  <Box>
                    <Flex justify="space-between" align="center" mb={1}>
                      <Text fontWeight="medium" fontSize="sm">Log Details:</Text>
                      <Button 
                        size="xs" 
                        onClick={() => copyLogToClipboard(log)}
                        variant="outline"
                      >
                        {hasCopied ? 'Copied!' : 'Copy'}
                      </Button>
                    </Flex>
                    <Code p={2} borderRadius="md" fontSize="xs" whiteSpace="pre-wrap" display="block" overflowX="auto">
                      {JSON.stringify(log, null, 2)}
                    </Code>
                  </Box>
                  
                  {log.data && (
                    <Box>
                      <Text fontWeight="medium" fontSize="sm" mb={1}>Additional Data:</Text>
                      <Code p={2} borderRadius="md" fontSize="xs" whiteSpace="pre-wrap" display="block" overflowX="auto">
                        {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : log.data}
                      </Code>
                    </Box>
                  )}
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Box>
  );
} 