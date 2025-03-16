'use client';

import React from 'react';
import { Box, Flex, Text, Image, HStack } from '@chakra-ui/react';

interface PinPandaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withTagline?: boolean;
}

const PinPandaLogo: React.FC<PinPandaLogoProps> = ({ size = 'md', withTagline = false }) => {
  // Size mappings
  const sizeMap = {
    sm: {
      fontSize: 'xl',
      iconSize: '20px',
      taglineSize: 'xs',
    },
    md: {
      fontSize: '2xl',
      iconSize: '24px',
      taglineSize: 'sm',
    },
    lg: {
      fontSize: '3xl',
      iconSize: '28px',
      taglineSize: 'md',
    },
    xl: {
      fontSize: '4xl',
      iconSize: '32px',
      taglineSize: 'lg',
    },
  };

  return (
    <Flex direction="column" align="center">
      <HStack spacing={2} align="center">
        <Box 
          borderRadius="full" 
          display="flex" 
          alignItems="center" 
          justifyContent="center"
          overflow="hidden"
          width={sizeMap[size].iconSize}
          height={sizeMap[size].iconSize}
        >
          <Image 
            src="/favicon.svg" 
            alt="PinPanda"
            width="100%"
            height="100%"
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