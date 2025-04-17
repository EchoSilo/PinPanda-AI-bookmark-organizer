
'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  VStack, 
  HStack, 
  Button, 
  Text, 
  Input, 
  Modal, 
  ModalOverlay, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalCloseButton, 
  ModalFooter,
  useDisclosure,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useToast,
  Divider
} from '@chakra-ui/react';
import { FiUser, FiPlus, FiLogOut, FiSettings } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import { Profile } from '@/types';
import * as ProfileService from '@/services/profileService';
import * as Logger from '@/services/logService';

export default function ProfileManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Load profiles on component mount
  useEffect(() => {
    try {
      // Try to load current profile
      const profile = ProfileService.getCurrentProfile();
      if (profile) {
        setCurrentProfile(profile);
        Logger.info('ProfileManager', `Loaded current profile: ${profile.username}`);
      }

      // In a real app, you would load all profiles from localStorage or a backend
      // For now, we'll just create an empty array if there's no current profile
      const storedProfiles = localStorage.getItem('profiles');
      if (storedProfiles) {
        setProfiles(JSON.parse(storedProfiles));
      } else {
        setProfiles([]);
      }
    } catch (error) {
      Logger.error('ProfileManager', 'Error loading profiles', error);
    }
  }, []);

  const createNewProfile = () => {
    if (!newProfileName.trim()) {
      toast({
        title: 'Profile name required',
        description: 'Please enter a name for your profile.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const newProfile: Profile = {
        id: uuidv4(),
        username: newProfileName,
        bookmarkCategories: [],
        searchHistory: [],
        settings: {
          defaultView: 'grid',
          aiSearchEnabled: true
        }
      };

      const updatedProfiles = [...profiles, newProfile];
      setProfiles(updatedProfiles);
      setCurrentProfile(newProfile);
      ProfileService.saveProfile(newProfile);
      
      // Save all profiles to localStorage
      localStorage.setItem('profiles', JSON.stringify(updatedProfiles));
      
      toast({
        title: 'Profile created',
        description: `Profile "${newProfileName}" has been created.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      setNewProfileName('');
      onClose();
      
      Logger.info('ProfileManager', `Created new profile: ${newProfile.username}`);
    } catch (error) {
      Logger.error('ProfileManager', 'Error creating profile', error);
      toast({
        title: 'Error',
        description: 'Failed to create profile. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const switchProfile = (profile: Profile) => {
    try {
      setCurrentProfile(profile);
      ProfileService.saveProfile(profile);
      Logger.info('ProfileManager', `Switched to profile: ${profile.username}`);
      
      toast({
        title: 'Profile switched',
        description: `Now using "${profile.username}" profile.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      Logger.error('ProfileManager', 'Error switching profile', error);
    }
  };

  return (
    <Box>
      <Menu>
        <MenuButton as={Button} rightIcon={<FiUser />} colorScheme="teal" variant="outline">
          {currentProfile ? currentProfile.username : 'Select Profile'}
        </MenuButton>
        <MenuList>
          {profiles.map(profile => (
            <MenuItem key={profile.id} onClick={() => switchProfile(profile)}>
              <HStack>
                <Avatar size="xs" name={profile.username} />
                <Text>{profile.username}</Text>
              </HStack>
            </MenuItem>
          ))}
          <Divider my={2} />
          <MenuItem icon={<FiPlus />} onClick={onOpen}>
            Create New Profile
          </MenuItem>
        </MenuList>
      </Menu>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Profile</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text>Enter a name for your new profile:</Text>
              <Input
                placeholder="Profile Name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={createNewProfile}>
              Create Profile
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
