
import { Profile } from '@/types';
import * as Logger from './logService';

export const getCurrentProfile = (): Profile | null => {
  try {
    const profile = localStorage.getItem('currentProfile');
    return profile ? JSON.parse(profile) : null;
  } catch (error) {
    Logger.error('ProfileService', 'Error getting current profile', error);
    return null;
  }
};

export const saveProfile = (profile: Profile): void => {
  try {
    localStorage.setItem('currentProfile', JSON.stringify(profile));
    Logger.info('ProfileService', `Profile saved for user ${profile.username}`);
  } catch (error) {
    Logger.error('ProfileService', 'Error saving profile', error);
  }
};
