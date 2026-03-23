import { useState, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import axios from 'axios';
import apiConfig from '../libs/utils/api.utils';
import bisetkaStorageService from '../services/bisetkaStorage.service';

const bundledLocationData = require('../../data/bisetka-locations-enriched.json') as {
  neighborhoods?: Neighborhood[];
};

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

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) => {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const findNearestNeighborhoodFromBundle = (
  lat: number,
  lng: number,
): Neighborhood | null => {
  const neighborhoods = bundledLocationData.neighborhoods || [];
  if (neighborhoods.length === 0) {
    return null;
  }

  let nearest: Neighborhood | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  neighborhoods.forEach((candidate) => {
    const distance = calculateDistanceKm(lat, lng, candidate.lat, candidate.lng);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  });

  return nearest;
};

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

    try {
      const status = await Geolocation.requestAuthorization('whenInUse');
      return status === 'granted';
    } catch (err) {
      console.warn('iOS location permission error:', err);
      return false;
    }
  };

  const findNearestNeighborhood = async (lat: number, lng: number): Promise<Neighborhood | null> => {
    try {
      const response = await axios.get(`${apiConfig.apiURL}/bisetka/nearest`, {
        params: { lat, lng },
      });
      return response.data.neighborhood;
    } catch (error: any) {
      console.warn('Remote nearest neighborhood lookup failed, using bundled fallback:', {
        message: error?.message,
        status: error?.response?.status,
      });

      const bundledNearest = findNearestNeighborhoodFromBundle(lat, lng);
      if (bundledNearest) {
        return bundledNearest;
      }

      console.error('Error finding neighborhood:', error);
      throw new Error('Failed to find nearest neighborhood');
    }
  };

  const findOrCreateBisetka = async (neighborhoodId: string): Promise<Bisetka | null> => {
    try {
      const response = await axios.post(`${apiConfig.apiURL}/bisetka/find-or-create`, {
        neighborhood_id: neighborhoodId,
      });
      return response.data.bisetka;
    } catch (error: any) {
      console.warn('Remote find/create Bisetka failed, using local display fallback:', {
        message: error?.message,
        status: error?.response?.status,
      });
      return null;
    }
  };

  const buildLocalBisetkaFallback = (neighborhood: Neighborhood): Bisetka => ({
    id: `local:${neighborhood.id}`,
    neighborhood_id: neighborhood.id,
    neighborhood_name: neighborhood.name,
    city: neighborhood.city,
    country: neighborhood.country,
    active_users: 0,
    created_at: new Date().toISOString(),
  });

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

  const loadBisetkaLocation = async (options?: { forcePreciseLocation?: boolean }) => {
    const forcePreciseLocation = options?.forcePreciseLocation === true;
    let storedNeighborhood: Neighborhood | null = null;
    let storedBisetkaForFallback: Bisetka | null = null;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Use the stored Bisetka immediately as a fallback, then try to refine it with GPS.
      const storedBisetka = await bisetkaStorageService.getStoredBisetka();
      if (storedBisetka) {
        console.log(`✅ Using stored Bisetka: ${storedBisetka.neighborhood}, ${storedBisetka.city} (${storedBisetka.source})`);
        
        storedBisetkaForFallback = {
          id: storedBisetka.id,
          neighborhood_id: '', // Not needed for display
          neighborhood_name: storedBisetka.neighborhood,
          city: storedBisetka.city,
          country: storedBisetka.country,
          active_users: storedBisetka.active_users,
          created_at: storedBisetka.connectedAt,
        };

        storedNeighborhood = {
          id: '', // Not needed
          name: storedBisetka.neighborhood,
          city: storedBisetka.city,
          country: storedBisetka.country,
          lat: 0, // Not needed for display
          lng: 0,
        };

        setState(prev => ({ 
          ...prev, 
          bisetka: storedBisetkaForFallback,
          neighborhood: storedNeighborhood,
          loading: false 
        }));

        if (!forcePreciseLocation) {
          return {
            location: null,
            neighborhood: storedNeighborhood,
            bisetka: storedBisetkaForFallback,
          };
        }
      }

      console.log('📍 Trying GPS-based Bisetka lookup...');

      // 1. Request permission
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        if (storedBisetkaForFallback && storedNeighborhood) {
          console.log('ℹ️ Location permission denied, keeping stored Bisetka');
          return {
            location: null,
            neighborhood: storedNeighborhood,
            bisetka: storedBisetkaForFallback,
          };
        }
        throw new Error('Location permission denied');
      }

      // 2. Get current location
      const location = await getCurrentLocation();
      setState(prev => ({ ...prev, location }));

      // 3. Find nearest neighborhood
      const neighborhood = await findNearestNeighborhood(location.latitude, location.longitude);
      if (!neighborhood) {
        if (storedBisetkaForFallback && storedNeighborhood) {
          console.log('ℹ️ GPS lookup found no neighborhood, keeping stored Bisetka');
          return {
            location,
            neighborhood: storedNeighborhood,
            bisetka: storedBisetkaForFallback,
          };
        }
        throw new Error('No neighborhood found for your location');
      }
      setState(prev => ({ ...prev, neighborhood }));

      // 4. Find or create Bisetka for this neighborhood
      const remoteBisetka = await findOrCreateBisetka(neighborhood.id);
      const bisetka = remoteBisetka || buildLocalBisetkaFallback(neighborhood);
      setState(prev => ({ ...prev, bisetka, loading: false }));

      if (remoteBisetka) {
        await bisetkaStorageService.storeBisetka({
          id: bisetka.id,
          neighborhood: bisetka.neighborhood_name,
          city: bisetka.city,
          country: bisetka.country,
          active_users: bisetka.active_users,
          source: 'gps',
        });
      }

      return { location, neighborhood, bisetka };
    } catch (error: any) {
      if (storedBisetkaForFallback && storedNeighborhood) {
        console.warn('⚠️ GPS Bisetka lookup failed, using stored fallback:', error?.message || error);
        setState(prev => ({
          ...prev,
          bisetka: storedBisetkaForFallback,
          neighborhood: storedNeighborhood,
          loading: false,
          error: null,
        }));
        return {
          location: null,
          neighborhood: storedNeighborhood,
          bisetka: storedBisetkaForFallback,
        };
      }

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
    refreshLocation: () => loadBisetkaLocation({ forcePreciseLocation: true }),
  };
};

export { useBisetkaLocation };
export default useBisetkaLocation;
