import { Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

const LOCATION_TIMEOUT_MS = 15000;
const LOCATION_MAX_AGE_MS = 30000;

const platformPermission = () =>
  Platform.OS === 'ios'
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

async function requestPermission(): Promise<boolean> {
  const permission = platformPermission();
  const status = await check(permission);

  if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
    return true;
  }

  if (status === RESULTS.BLOCKED || status === RESULTS.UNAVAILABLE) {
    return false;
  }

  const result = await request(permission);
  return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
}

async function fetchLocation(): Promise<UserLocation | null> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('[locationService] getCurrentPosition error', error);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: LOCATION_TIMEOUT_MS,
        maximumAge: LOCATION_MAX_AGE_MS,
      },
    );
  });
}

export const locationService = {
  async requestPermission(): Promise<boolean> {
    try {
      return await requestPermission();
    } catch (error) {
      console.warn('[locationService] requestPermission error', error);
      return false;
    }
  },

  async getCurrentLocation(): Promise<UserLocation | null> {
    try {
      return await fetchLocation();
    } catch (error) {
      console.warn('[locationService] getCurrentLocation error', error);
      return null;
    }
  },

  async getLocationForBisetka(): Promise<UserLocation | null> {
    try {
      const granted = await requestPermission();
      if (!granted) {
        return null;
      }

      return await fetchLocation();
    } catch (error) {
      console.warn('[locationService] getLocationForBisetka error', error);
      return null;
    }
  },
};

export default locationService;