'use client';

import {
  Box,
  Heading,
  Text,
  OrderedList,
  ListItem,
  Link,
  Code,
  Divider,
  Button,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';

export default function APIKeyInstructions() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Button colorScheme="blue" variant="outline" onClick={onOpen} size="sm">
        How to Get an API Key
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>How to Get an OpenAI API Key</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Text>
                To use the AI features of this application, you need an OpenAI API key. Follow these steps to get one:
              </Text>

              <OrderedList spacing={3} pl={4}>
                <ListItem>
                  <Text>
                    Go to{' '}
                    <Link href="https://platform.openai.com/signup" isExternal color="blue.500">
                      OpenAI's signup page <ExternalLinkIcon mx="2px" />
                    </Link>{' '}
                    and create an account if you don't have one.
                  </Text>
                </ListItem>

                <ListItem>
                  <Text>
                    Once logged in, navigate to{' '}
                    <Link href="https://platform.openai.com/api-keys" isExternal color="blue.500">
                      API Keys <ExternalLinkIcon mx="2px" />
                    </Link>
                  </Text>
                </ListItem>

                <ListItem>
                  <Text>Click on "Create new secret key" and give it a name (e.g., "Bookmark Organizer")</Text>
                </ListItem>

                <ListItem>
                  <Text>Copy the generated API key (it starts with "sk-")</Text>
                </ListItem>

                <ListItem>
                  <Text>Open the <Code>.env.local</Code> file in the root of this project</Text>
                </ListItem>

                <ListItem>
                  <Text>
                    Add your API key to the file like this:
                    <Code p={2} mt={2} display="block" whiteSpace="pre">
                      NEXT_PUBLIC_OPENAI_API_KEY=sk-your-api-key-here
                    </Code>
                  </Text>
                </ListItem>

                <ListItem>
                  <Text>Save the file and restart the development server</Text>
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
        </ModalContent>
      </Modal>
    </>
  );
} 