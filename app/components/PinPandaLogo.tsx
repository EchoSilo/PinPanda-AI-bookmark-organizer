'use client';

import React from 'react';
import { Box, Flex, Text, Icon, HStack } from '@chakra-ui/react';
import { FiBookmark } from 'react-icons/fi';

interface PinPandaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withTagline?: boolean;
}

const PinPandaLogo: React.FC<PinPandaLogoProps> = ({ size = 'md', withTagline = false }) => {
  // Size mappings
  const sizeMap = {
    sm: {
      fontSize: 'xl',
      iconSize: 5,
      taglineSize: 'xs',
    },
    md: {
      fontSize: '2xl',
      iconSize: 6,
      taglineSize: 'sm',
    },
    lg: {
      fontSize: '3xl',
      iconSize: 7,
      taglineSize: 'md',
    },
    xl: {
      fontSize: '4xl',
      iconSize: 8,
      taglineSize: 'lg',
    },
  };

  return (
    <Flex direction="column" align="center">
      <HStack spacing={2} align="center">
        <Box 
          bg="green.500" 
          borderRadius="full" 
          p={1} 
          display="flex" 
          alignItems="center" 
          justifyContent="center"
        >
          <Icon 
            as={FiBookmark} 
            color="white" 
            boxSize={sizeMap[size].iconSize} 
          />
        </Box>
        <Text 
          fontWeight="bold" 
          fontSize={sizeMap[size].fontSize} 
          color="green.500"
          letterSpacing="tight"
        >
          Pin<Text as="span" color="gray.700">Panda</Text>
        </Text>
      </HStack>
      
      {withTagline && (
        <Text 
          fontSize={sizeMap[size].taglineSize} 
          color="gray.500" 
          mt={1}
          fontWeight="medium"
        >
          Smart Bookmark Organizer
        </Text>
      )}
    </Flex>
  );
};

export default PinPandaLogo; 