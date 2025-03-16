'use client';

import { Box, Heading, Text, Button } from '@chakra-ui/react';

export default function TestPage() {
  return (
    <Box p={8} maxW="4xl" mx="auto">
      <Heading as="h1" size="xl" mb={4}>Test Page</Heading>
      <Text mb={4}>
        If you can see this page, the app is working correctly!
      </Text>
      <Button 
        colorScheme="blue"
        onClick={() => alert('Button clicked!')}
      >
        Click Me
      </Button>
    </Box>
  );
} 