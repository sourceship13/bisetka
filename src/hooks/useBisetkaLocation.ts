import { useState, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import axios from 'axios';
import apiConfig from '../libs/utils/api.utils';
import bisetkaStorageService from '../services/bisetkaStorage.service';

interface Location {
  latitude: number;
  longitude: number;
}

interface Neighborhood {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

interface Bisetka {
  id: string;
  neighborhood_id: string;
  neighborhood_name: string;
  city: string;
  country: string;
  active_users: number;
  created_at: string;
}

interface BisetkaLocationState {
  location: Location | null;
  neighborhood: Neighborhood | null;
  bisetka: Bisetka | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to get user's location, find their neighborhood, and connect to local Bisetka
 * 
 * Usage:
 * const { location, neighborhood, bisetka, loading, error, refreshLocation } = useBisetkaLocation();
 * 
 * - Automatically requests location permissions
 * - Gets current GPS coordinates
 * - Finds nearest neighborhood from backend
 * - Auto-creates Bisetka if it doesn't exist
 * - Returns Bisetka info for the user's neighborhood
 */
const useBisetkaLocation = () => {
  const [state, setState] = useState<BisetkaLocationState>({
    location: null,
    neighborhood: null,
    bisetka: null,
    loading: true,
    error: null,
  });

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Bisetka Location Permission',
            message: 'Bisetka needs access to your location to connect you with local players',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Location permission error:', err);
        return false;
      }
    }
    return true; // iOS handles permissions differently
  };

  const findNearestNeighborhood = async (lat: number, lng: number): Promise<Neighborhood | null> => {
    try {
      const response = await axios.get(`${apiConfig.apiURL}/bisetka/nearest`, {
        params: { lat, lng },
      });
      return response.data.neighborhood;
    } catch (error) {
      console.error('Error finding neighborhood:', error);
      throw new Error('Failed to find nearest neighborhood');
    }
  };

  const findOrCreateBisetka = async (neighborhoodId: string): Promise<Bisetka> => {
    try {
      const response = await axios.post(`${apiConfig.apiURL}/bisetka/find-or-create`, {
        neighborhood_id: neighborhoodId,
      });
      return response.data.bisetka;
    } catch (error) {
      console.error('Error finding/creating Bisetka:', error);
      throw new Error('Failed to connect to local Bisetka');
    }
  };

  const getCurrentLocation = (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        error => {
          reject(new Error(error.message));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  };

  const loadBisetkaLocation = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // PRIORITY 1: Check for stored Bisetka from login (IP or GPS-based)
      const storedBisetka = await bisetkaStorageService.getStoredBisetka();
      if (storedBisetka) {
        console.log(`✅ Using stored Bisetka: ${storedBisetka.neighborhood}, ${storedBisetka.city} (${storedBisetka.source})`);
        
        // Convert stored format to hook format
        const bisetka: Bisetka = {
          id: storedBisetka.id,
          neighborhood_id: '', // Not needed for display
          neighborhood_name: storedBisetka.neighborhood,
          city: storedBisetka.city,
          country: storedBisetka.country,
          active_users: storedBisetka.active_users,
          created_at: storedBisetka.connectedAt,
        };

        const neighborhood: Neighborhood = {
          id: '', // Not needed
          name: storedBisetka.neighborhood,
          city: storedBisetka.city,
          country: storedBisetka.country,
          lat: 0, // Not needed for display
          lng: 0,
        };

        setState(prev => ({ 
          ...prev, 
          bisetka, 
          neighborhood,
          loading: false 
        }));

        return { location: null, neighborhood, bisetka };
      }

      // PRIORITY 2: Fall back to GPS detection
      console.log('📍 No stored Bisetka, trying GPS...');

      // 1. Request permission
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      // 2. Get current location
      const location = await getCurrentLocation();
      setState(prev => ({ ...prev, location }));

      // 3. Find nearest neighborhood
      const neighborhood = await findNearestNeighborhood(location.latitude, location.longitude);
      if (!neighborhood) {
        throw new Error('No neighborhood found for your location');
      }
      setState(prev => ({ ...prev, neighborhood }));

      // 4. Find or create Bisetka for this neighborhood
      const bisetka = await findOrCreateBisetka(neighborhood.id);
      setState(prev => ({ ...prev, bisetka, loading: false }));

      // Store for next time
      await bisetkaStorageService.storeBisetka({
        id: bisetka.id,
        neighborhood: bisetka.neighborhood_name,
        city: bisetka.city,
        country: bisetka.country,
        active_users: bisetka.active_users,
        source: 'gps',
      });

      return { location, neighborhood, bisetka };
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load Bisetka location',
      }));
      return null;
    }
  };

  useEffect(() => {
    loadBisetkaLocation();
  }, []);

  return {
    location: state.location,
    neighborhood: state.neighborhood,
    bisetka: state.bisetka,
    loading: state.loading,
    error: state.error,
    refreshLocation: loadBisetkaLocation,
  };
};

export { useBisetkaLocation };
export default useBisetkaLocation;
