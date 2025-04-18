
'use client';

import React from 'react';
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  VStack,
  Text,
  Box,
  Link,
  OrderedList,
  ListItem,
  Code,
  Divider
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';

export default function APIKeyInstructions() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Button size="sm" colorScheme="teal" variant="outline" onClick={onOpen}>
        API Key Help
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Setting Up OpenAI API Key</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                To use the AI features, you need to set up an OpenAI API key:
              </Text>

              <OrderedList spacing={3} pl={5}>
                <ListItem>
                  <Text>
                    <Link href="https://platform.openai.com/signup" isExternal color="blue.500">
                      Sign up for an OpenAI account <ExternalLinkIcon mx="2px" />
                    </Link>{' '}
                    if you don't have one already.
                  </Text>
                </ListItem>
                <ListItem>
                  <Text>
                    Go to{' '}
                    <Link href="https://platform.openai.com/api-keys" isExternal color="blue.500">
                      API Keys section <ExternalLinkIcon mx="2px" />
                    </Link>{' '}
                    in your OpenAI account.
                  </Text>
                </ListItem>
                <ListItem>
                  <Text>Click on "Create new secret key" and give it a name.</Text>
                </ListItem>
                <ListItem>
                  <Text>Copy the generated API key (you won't be able to see it again).</Text>
                </ListItem>
                <ListItem>
                  <Text>Create or edit a <Code>.env.local</Code> file in your project root and add:</Text>
                  <Code p={2} mt={1} display="block" bg="gray.50">
                    NEXT_PUBLIC_OPENAI_API_KEY=your_api_key_here
                  </Code>
                </ListItem>
                <ListItem>
                  <Text>Restart your app for the changes to take effect.</Text>
                </ListItem>
              </OrderedList>

              <Divider my={2} />

              <Box bg="yellow.50" p={3} borderRadius="md">
                <Text fontWeight="medium">Important Notes:</Text>
                <Text fontSize="sm" mt={2}>
                  • OpenAI API usage is not free. You will be charged based on your usage.
                </Text>
                <Text fontSize="sm" mt={1}>
                  • New accounts typically come with some free credits to get started.
                </Text>
                <Text fontSize="sm" mt={1}>
                  • Keep your API key secure and never share it publicly.
                </Text>
                <Text fontSize="sm" mt={1}>
                  • You can set usage limits in your OpenAI account to control costs.
                </Text>
              </Box>

              <Link href="https://platform.openai.com/docs/quickstart" isExternal color="blue.500">
                Learn more about using the OpenAI API <ExternalLinkIcon mx="2px" />
              </Link>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
