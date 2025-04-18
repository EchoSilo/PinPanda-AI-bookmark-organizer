'use client';

import { 
  Box, 
  VStack, 
  Text, 
  Progress, 
  Card, 
  CardBody, 
  Heading, 
  Icon, 
  HStack, 
  Spinner,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Divider,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Button,
  useToast
} from '@chakra-ui/react';
import { FiCpu, FiSearch, FiCheckCircle, FiAlertCircle, FiClock, FiX } from 'react-icons/fi';
import { ProcessingProgress } from '@/types';
import { useState, useEffect } from 'react';
import { cancelOngoingProcess } from '@/services/aiService';

interface AIProcessingScreenProps {
  progress: ProcessingProgress;
}

export default function AIProcessingScreen({ progress }: AIProcessingScreenProps) {
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [startTime] = useState<number>(Date.now());
  const toast = useToast();

  // Update processing time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setProcessingTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const getStepIcon = (step: number) => {
    switch (step) {
      case 0:
        return FiSearch; // Scanning for duplicates
      case 1:
        return FiCpu; // AI processing
      case 2:
        return FiCheckCircle; // Complete
      default:
        return FiCpu;
    }
  };

  const getStepName = (step: number) => {
    switch (step) {
      case 0:
        return 'Analyzing Bookmarks';
      case 1:
        return 'AI Processing';
      case 2:
        return 'Organizing Results';
      default:
        return 'Processing';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancel = async () => {
    try {
      await cancelOngoingProcess();
      toast({
        title: 'Process Cancelled',
        status: 'success',
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error Cancelling Process',
        description: error.message,
        status: 'error',
        isClosable: true,
      });
    }
  };

  return (
    <Card variant="outline" width="100%">
      <CardBody>
        <VStack spacing={6} align="stretch">
          <HStack spacing={4}>
            <Icon as={getStepIcon(progress.step)} boxSize={6} color="green.500" />
            <Heading size="md">{getStepName(progress.step)}</Heading>
            {(progress.progress ?? 0) !== 100 && <Spinner size="sm" color="green.500" ml="auto" />}
          </HStack>

          <Box>
            <Text mb={2} fontWeight="medium">{progress.message}</Text>
            <Progress 
              value={progress.progress ?? 0} 
              size="lg" 
              colorScheme="green" 
              borderRadius="md" 
              hasStripe={(progress.progress ?? 0) < 100}
              isAnimated={(progress.progress ?? 0) < 100}
            />
          </Box>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Stat>
              <StatLabel>Processing Time</StatLabel>
              <StatNumber>{formatTime(processingTime)}</StatNumber>
              <StatHelpText>
                <HStack>
                  <Icon as={FiClock} />
                  <Text>Elapsed</Text>
                </HStack>
              </StatHelpText>
            </Stat>

            {progress.bookmarksProcessed !== undefined && (
              <Stat>
                <StatLabel>Bookmarks</StatLabel>
                <StatNumber>{progress.bookmarksProcessed}</StatNumber>
                <StatHelpText>
                  <HStack>
                    <Icon as={FiSearch} />
                    <Text>Processed</Text>
                  </HStack>
                </StatHelpText>
              </Stat>
            )}

            {progress.duplicatesFound !== undefined && (
              <Stat>
                <StatLabel>Duplicates</StatLabel>
                <StatNumber>{progress.duplicatesFound}</StatNumber>
                <StatHelpText>
                  <HStack>
                    <Icon as={FiAlertCircle} />
                    <Text>Found</Text>
                  </HStack>
                </StatHelpText>
              </Stat>
            )}
          </SimpleGrid>

          {/* Display duplicate statistics if available */}
          {progress.duplicateStats && progress.step === 0 && (
            <Box mt={4} p={3} borderWidth="1px" borderRadius="md" bg="gray.50" _dark={{ bg: "gray.700" }}>
              <Heading size="xs" mb={2}>Duplicate Analysis</Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Text fontSize="sm">
                  <strong>{progress.duplicateStats.urlsWithDuplicates}</strong> URLs appear multiple times
                </Text>
                <Text fontSize="sm">
                  <strong>{progress.duplicateStats.totalDuplicateReferences}</strong> duplicate references found
                </Text>
              </SimpleGrid>

              {progress.duplicateStats.mostDuplicatedUrls.length > 0 && (
                <Box mt={2}>
                  <Text fontSize="xs" fontWeight="medium" mb={1}>Most duplicated URLs:</Text>
                  {progress.duplicateStats.mostDuplicatedUrls.map((dup, i) => (
                    <Text key={i} fontSize="xs" noOfLines={1} color="gray.600" _dark={{ color: "gray.300" }}>
                      {dup.url.substring(0, 40)}... ({dup.count} times)
                    </Text>
                  ))}
                </Box>
              )}
            </Box>
          )}

          <Divider />

          <Accordion allowToggle>
            <AccordionItem border="none">
              <AccordionButton px={0}>
                <Box flex="1" textAlign="left">
                  <Heading size="sm">Processing Details</Heading>
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={4} px={0}>
                <VStack align="stretch" spacing={3}>
                  <HStack>
                    <Text fontWeight="medium">Current Step:</Text>
                    <Badge colorScheme="blue">{progress.step}</Badge>
                    <Text>{getStepName(progress.step)}</Text>
                  </HStack>

                  <HStack>
                    <Text fontWeight="medium">Progress:</Text>
                    <Text>{progress.progress ?? 0}%</Text>
                  </HStack>

                  {progress.validationProgress !== undefined && (
                    <HStack>
                      <Text fontWeight="medium">Link Validation:</Text>
                      <Text>{Math.round((progress.validationProgress ?? 0) * 100)}% complete</Text>
                    </HStack>
                  )}

                  <Box>
                    <Text fontWeight="medium" mb={1}>Status Message:</Text>
                    <Box p={2} borderWidth="1px" borderRadius="md" bg="gray.50">
                      <Text>{progress.message}</Text>
                    </Box>
                  </Box>
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
          <Box textAlign="center" mt={4}>
            <HStack spacing={3} justify="center">
              <Badge colorScheme="blue" p={2} borderRadius="md">
                <HStack spacing={2}>
                  <Icon as={FiClock} />
                  <Text>Processing time: {formatTime(processingTime)}</Text>
                </HStack>
              </Badge>
              <Button 
                colorScheme="orange" 
                leftIcon={<Icon as={FiX} />} 
                size="sm" 
                onClick={handleCancel}
              >
                Cancel Process
              </Button>
            </HStack>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
}