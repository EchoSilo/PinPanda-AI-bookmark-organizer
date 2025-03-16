'use client';

import { Box, Heading, Text, Button } from '@chakra-ui/react';

export default function MinimalPage() {
  return (
    <Box p={8} maxW="4xl" mx="auto">
      <Heading as="h1" size="xl" mb={4}>Minimal Chakra UI Page</Heading>
      <Text mb={4}>
        This is a minimal page with Chakra UI to test if it loads correctly.
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