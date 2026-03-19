import {Platform} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {locationManager} from '@rnmapbox/maps';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

const LOCATION_TIMEOUT_MS = 6000;

const platformPermission = () =>
  Platform.OS === 'ios'
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

async function requestPermission(): Promise<boolean> {
  const permission = platformPermission();
  const status = await check(permission);

  if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) return true;
  if (status === RESULTS.BLOCKED || status === RESULTS.UNAVAILABLE) return false;

  const result = await request(permission);
  return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
}

async function fetchLocation(): Promise<UserLocation | null> {
  return new Promise(resolve => {
    let settled = false;

    const settle = (value: UserLocation | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      locationManager.removeListener(listener);
      resolve(value);
    };

    const listener = (loc: any) => {
      if (loc?.coords) {
        settle({latitude: loc.coords.latitude, longitude: loc.coords.longitude});
      }
    };

    // Timeout fallback: try last-known, then give up
    const timer = setTimeout(async () => {
      try {
        const last = await locationManager.getLastKnownLocation();
        settle(
          last?.coords
            ? {latitude: last.coords.latitude, longitude: last.coords.longitude}
            : null,
        );
      } catch {
        settle(null);
      }
    }, LOCATION_TIMEOUT_MS);

    // addListener also calls start() internally
    locationManager.addListener(listener);
  });
}

export const locationService = {
  /** Request when-in-use location permission. Returns true if granted. */
  requestPermission,

  /** Get current location (with timeout fallback to last-known). */
  async getCurrentLocation(): Promise<UserLocation | null> {
    try {
      return await fetchLocation();
    } catch (e) {
      console.warn('[locationService] getCurrentLocation error', e);
      return null;
    }
  },

  /**
   * Request permission then get location in one call.
   * Returns null silently if permission is denied or location unavailable.
   */
  async getLocationForGame(): Promise<UserLocation | null> {
    try {
      const granted = await requestPermission();
      if (!granted) return null;
      return await fetchLocation();
    } catch (e) {
      console.warn('[locationService] getLocationForGame error', e);
      return null;
    }
  },
};

export default locationService;
