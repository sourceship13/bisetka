import apiService from './api.service';

const bundledLocationData = require('../../data/bisetka-locations-enriched.json') as {
  neighborhoods?: Neighborhood[];
};

export interface Bisetka {
  id: string;
  neighborhood_id: string;
  neighborhood_name: string;
  city: string;
  country: string;
  active_users: number;
  created_at: string;
  updated_at: string;
}

export interface Neighborhood {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  distance_km?: number;
}

export interface IpLocationHint {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

type GlobeBisetka = Bisetka & { lat: number; lng: number };

type BisetkaLookupCandidate = {
  id?: string | null;
  neighborhood_id?: string | null;
  neighborhood_name?: string | null;
  city?: string | null;
  country?: string | null;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const normalizeLocationPart = (value?: string | null) =>
  (value || '').trim().toLowerCase();

const findBundledNeighborhoodForBisetka = (bisetka: Bisetka): Neighborhood | null => {
  const neighborhoods = bundledLocationData.neighborhoods || [];

  const byId = neighborhoods.find(
    neighborhood => neighborhood.id === bisetka.neighborhood_id,
  );
  if (byId) {
    return byId;
  }

  const neighborhoodName = normalizeLocationPart(bisetka.neighborhood_name);
  const city = normalizeLocationPart(bisetka.city);
  const country = normalizeLocationPart(bisetka.country);

  return (
    neighborhoods.find(
      neighborhood =>
        normalizeLocationPart(neighborhood.name) === neighborhoodName &&
        normalizeLocationPart(neighborhood.city) === city &&
        normalizeLocationPart(neighborhood.country) === country,
    ) || null
  );
};

const findBundledCoordinatesFallback = (bisetka: Bisetka): Pick<Neighborhood, 'lat' | 'lng'> | null => {
  const neighborhoods = bundledLocationData.neighborhoods || [];
  const exactNeighborhood = findBundledNeighborhoodForBisetka(bisetka);

  if (exactNeighborhood) {
    return {
      lat: exactNeighborhood.lat,
      lng: exactNeighborhood.lng,
    };
  }

  const city = normalizeLocationPart(bisetka.city);
  const country = normalizeLocationPart(bisetka.country);

  const cityMatch = neighborhoods.find(
    neighborhood =>
      normalizeLocationPart(neighborhood.city) === city &&
      normalizeLocationPart(neighborhood.country) === country,
  );

  if (cityMatch) {
    return {
      lat: cityMatch.lat,
      lng: cityMatch.lng,
    };
  }

  const countryMatch = neighborhoods.find(
    neighborhood => normalizeLocationPart(neighborhood.country) === country,
  );

  if (countryMatch) {
    return {
      lat: countryMatch.lat,
      lng: countryMatch.lng,
    };
  }

  return null;
};

const dedupeGlobeBisetkas = (bisetkas: GlobeBisetka[]): GlobeBisetka[] => {
  const unique = new Map<string, GlobeBisetka>();

  bisetkas.forEach((bisetka) => {
    const idKey = bisetka.id;
    const neighborhoodKey = bisetka.neighborhood_id
      ? `neighborhood:${bisetka.neighborhood_id}`
      : null;

    if (!unique.has(idKey)) {
      unique.set(idKey, bisetka);
    }

    if (neighborhoodKey && !unique.has(neighborhoodKey)) {
      unique.set(neighborhoodKey, bisetka);
    }
  });

  return Array.from(new Set(unique.values()));
};

const isRemoteBisetkaId = (id?: string | null) => Boolean(id && !id.startsWith('local:'));

const findMatchingBisetka = (
  bisetkas: Bisetka[],
  candidate?: BisetkaLookupCandidate | null,
): Bisetka | null => {
  if (!candidate) {
    return null;
  }

  const remoteId = isRemoteBisetkaId(candidate.id) ? candidate.id!.trim() : null;
  if (remoteId) {
    const byId = bisetkas.find((bisetka) => bisetka.id === remoteId);
    if (byId) {
      return byId;
    }
  }

  const neighborhoodId = normalizeLocationPart(candidate.neighborhood_id);
  if (neighborhoodId) {
    const byNeighborhoodId = bisetkas.find(
      (bisetka) => normalizeLocationPart(bisetka.neighborhood_id) === neighborhoodId,
    );
    if (byNeighborhoodId) {
      return byNeighborhoodId;
    }
  }

  const neighborhoodName = normalizeLocationPart(candidate.neighborhood_name);
  const city = normalizeLocationPart(candidate.city);
  const country = normalizeLocationPart(candidate.country);

  if (!neighborhoodName && !city && !country) {
    return null;
  }

  return (
    bisetkas.find((bisetka) => {
      const bisetkaNeighborhoodName = normalizeLocationPart(bisetka.neighborhood_name);
      const bisetkaCity = normalizeLocationPart(bisetka.city);
      const bisetkaCountry = normalizeLocationPart(bisetka.country);

      const neighborhoodMatches = neighborhoodName
        ? bisetkaNeighborhoodName === neighborhoodName
        : true;
      const cityMatches = city ? bisetkaCity === city : true;
      const countryMatches = country ? bisetkaCountry === country : true;

      return neighborhoodMatches && cityMatches && countryMatches;
    }) || null
  );
};

class BisetkaService {
  private async getExistingBisetkasWithCoordinates(limit: number = 500): Promise<GlobeBisetka[]> {
    const bisetkas = await this.getAllBisetkas(limit);
    const enrichedBisetkas = bisetkas
      .map((bisetka) => {
        const coordinates = findBundledCoordinatesFallback(bisetka);
        if (!coordinates) {
          return null;
        }

        return {
          ...bisetka,
          lat: coordinates.lat,
          lng: coordinates.lng,
        };
      })
      .filter((bisetka): bisetka is GlobeBisetka => Boolean(bisetka));

    console.log('🌍 [BisetkaService] Fallback existing Bisetkas:', {
      requested: bisetkas.length,
      mapped: enrichedBisetkas.length,
      firstBisetka: enrichedBisetkas[0],
    });

    return enrichedBisetkas;
  }

  /**
   * Get all active Bisetkas for GlobalView
   */
  async getAllBisetkas(limit: number = 500): Promise<Bisetka[]> {
    try {
      const response = await apiService.get<{ bisetkas: Bisetka[]; count: number }>(
        `/bisetka/all?limit=${limit}`
      );
      return response.bisetkas || [];
    } catch (error) {
      console.error('Failed to fetch Bisetkas:', error);
      return [];
    }
  }

  /**
   * Find nearest neighborhood to coordinates
   */
  async findNearestNeighborhood(lat: number, lng: number): Promise<Neighborhood | null> {
    try {
      const response = await apiService.get<{ neighborhood: Neighborhood }>(
        `/bisetka/nearest?lat=${lat}&lng=${lng}`
      );
      return response.neighborhood || null;
    } catch (error) {
      console.error('Failed to find nearest neighborhood:', error);
      return null;
    }
  }

  findNearestBundledNeighborhood(
    lat: number,
    lng: number,
    hint?: { city?: string; country?: string },
  ): Neighborhood | null {
    const neighborhoods = bundledLocationData.neighborhoods || [];
    if (!neighborhoods.length) {
      return null;
    }

    const hintCity = normalizeLocationPart(hint?.city);
    const hintCountry = normalizeLocationPart(hint?.country);

    const scopedNeighborhoods = neighborhoods.filter((neighborhood) => {
      if (hintCountry && normalizeLocationPart(neighborhood.country) !== hintCountry) {
        return false;
      }

      if (!hintCity) {
        return true;
      }

      return normalizeLocationPart(neighborhood.city) === hintCity;
    });

    const candidates = scopedNeighborhoods.length ? scopedNeighborhoods : neighborhoods;

    return candidates.reduce<Neighborhood | null>((closest, neighborhood) => {
      if (typeof neighborhood.lat !== 'number' || typeof neighborhood.lng !== 'number') {
        return closest;
      }

      if (!closest) {
        return neighborhood;
      }

      const currentDistance = calculateDistanceKm(lat, lng, neighborhood.lat, neighborhood.lng);
      const closestDistance = calculateDistanceKm(lat, lng, closest.lat, closest.lng);

      return currentDistance < closestDistance ? neighborhood : closest;
    }, null);
  }

  async resolveFromCoordinates(
    lat: number,
    lng: number,
    hint?: { city?: string; country?: string },
  ): Promise<{ bisetka: Bisetka; neighborhood: Neighborhood } | null> {
    const nearestNeighborhood = this.findNearestBundledNeighborhood(lat, lng, hint);
    if (!nearestNeighborhood) {
      return null;
    }

    const bisetka = await this.findOrCreateBisetka(nearestNeighborhood.id);
    if (bisetka) {
      return { bisetka, neighborhood: nearestNeighborhood };
    }

    return {
      bisetka: {
        id: `local:${nearestNeighborhood.id}`,
        neighborhood_id: nearestNeighborhood.id,
        neighborhood_name: nearestNeighborhood.name,
        city: nearestNeighborhood.city,
        country: nearestNeighborhood.country,
        active_users: 0,
        created_at: '',
        updated_at: '',
      },
      neighborhood: nearestNeighborhood,
    };
  }

  /**
   * Find or create Bisetka for a neighborhood
   */
  async findOrCreateBisetka(neighborhoodId: string): Promise<Bisetka | null> {
    try {
      const response = await apiService.post<{ bisetka: Bisetka }>(
        '/bisetka/find-or-create',
        { neighborhood_id: neighborhoodId }
      );
      return response.bisetka || null;
    } catch (error) {
      console.error('Failed to find/create Bisetka:', error);
      return null;
    }
  }

  /**
   * Auto-connect to local Bisetka based on GPS
   */
  async autoConnect(lat: number, lng: number): Promise<Bisetka | null> {
    try {
      const response = await apiService.post<{ bisetka: Bisetka; message: string }>(
        '/bisetka/auto-connect',
        { lat, lng },
        true,
      );
      return response.bisetka || null;
    } catch (error) {
      console.error('Failed to auto-connect to Bisetka:', error);
      return null;
    }
  }

  /**
   * Get user's current Bisetka
   */
  async getMyBisetka(): Promise<Bisetka | null> {
    try {
      const response = await apiService.get<{ bisetka: Bisetka }>('/bisetka/my', true);
      return response.bisetka || null;
    } catch (error) {
      console.error('Failed to get user Bisetka:', error);
      return null;
    }
  }

  /**
   * Find the nearest Bisetka by the device's IP address — no GPS needed.
   * Used as the first-open fallback when there is no stored or profile bisetka.
   */
  async getByIpBisetka(): Promise<{
    bisetka: Bisetka;
    neighborhood: Neighborhood;
    location?: IpLocationHint;
  } | null> {
    try {
      const response = await apiService.get<{
        bisetka: Bisetka;
        neighborhood: Neighborhood;
        source: string;
        location?: IpLocationHint;
      }>('/bisetka/by-ip', false, { suppressErrorLogging: true });
      if (response.bisetka) {
        return {
          bisetka: response.bisetka,
          neighborhood: response.neighborhood,
          location: response.location,
        };
      }
      return null;
    } catch (error: any) {
      if (error?.status === 422) {
        console.warn('IP-based bisetka lookup unavailable for this connection');
        return null;
      }
      console.warn('IP-based bisetka lookup failed:', error);
      return null;
    }
  }

  async resolvePlayableBisetka(candidate?: BisetkaLookupCandidate | null): Promise<Bisetka | null> {
    const currentBisetka = await this.getMyBisetka();
    if (currentBisetka) {
      return currentBisetka;
    }

    if (!candidate) {
      return null;
    }

    const allBisetkas = await this.getAllBisetkas();
    return findMatchingBisetka(allBisetkas, candidate);
  }

  /**
   * Get Bisetkas with coordinates for mapping on GlobalView
   */
  async getGlobeBisetkas(): Promise<GlobeBisetka[]> {
    console.log('🌍 [BisetkaService] Fetching globe Bisetkas...');
    const fallbackBisetkasPromise = this.getExistingBisetkasWithCoordinates();

    try {
      console.log('🌍 [BisetkaService] API URL:', apiService['baseURL']);
      const response = await apiService.get<{ 
        bisetkas: GlobeBisetka[]; 
        count: number 
      }>('/bisetka/globe');
      const fallbackBisetkas = await fallbackBisetkasPromise;
      console.log('✅ [BisetkaService] Got response:', {
        count: response.count,
        firstBisetka: response.bisetkas?.[0],
        totalReceived: response.bisetkas?.length
      });

      const mergedBisetkas = dedupeGlobeBisetkas([
        ...(response.bisetkas || []),
        ...fallbackBisetkas,
      ]);

      console.log('🌍 [BisetkaService] Merged globe + existing Bisetkas:', {
        globeCount: response.bisetkas?.length || 0,
        existingCount: fallbackBisetkas.length,
        mergedCount: mergedBisetkas.length,
      });

      return mergedBisetkas;
    } catch (error: any) {
      const fallbackBisetkas = await fallbackBisetkasPromise;
      console.error('❌ [BisetkaService] Failed to get globe Bisetkas:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      return fallbackBisetkas;
    }
  }

  /**
   * Get all neighborhoods for travel selection
   * Fetches live bisetka list from the API so IDs always match the DB
   */
  async getAllNeighborhoods(): Promise<Neighborhood[]> {
    try {
      const bisetkas = await this.getAllBisetkas(500);
      const neighborhoods: Neighborhood[] = bisetkas.map(b => ({
        id: b.neighborhood_id,
        name: b.neighborhood_name,
        city: b.city,
        country: b.country,
        lat: 0,
        lng: 0,
      }));
      console.log('📍 [BisetkaService] Loaded neighborhoods from API:', neighborhoods.length);
      return neighborhoods;
    } catch (error: any) {
      console.error('❌ [BisetkaService] Failed to load neighborhoods:', error);
      // Fall back to bundled data if API fails
      const neighborhoods = bundledLocationData.neighborhoods || [];
      console.log('📍 [BisetkaService] Falling back to bundled neighborhoods:', neighborhoods.length);
      return neighborhoods;
    }
  }

  /**
   * Join user to a Bisetka (sets current_bisetka_id)
   */

  /**
   * Travel to a different Bisetka (costs points)
   */
  async travelToBisetka(bisetkaId: string, cost: number): Promise<{ success: boolean; newPoints?: number; error?: string }> {
    try {
      const response = await apiService.post('/bisetka/travel-bisetka', { 
        bisetka_id: bisetkaId, 
        cost 
      }, true);
      
      console.log('✅ [BisetkaService] Traveled to Bisetka:', bisetkaId);
      return { 
        success: true, 
        newPoints: response.newPoints || response.new_points 
      };
    } catch (error: any) {
      console.error('❌ [BisetkaService] Failed to travel:', error);
      return { 
        success: false, 
        error: error?.response?.data?.error || error?.message || 'Failed to travel' 
      };
    }
  }
  async joinBisetka(bisetkaId: string): Promise<void> {
    try {
      await apiService.post('/bisetka/join', { bisetka_id: bisetkaId }, true);
      console.log('✅ [BisetkaService] Joined Bisetka:', bisetkaId);
    } catch (error: any) {
      console.error('❌ [BisetkaService] Failed to join Bisetka:', error);
      throw error;
    }
  }
}

export const bisetkaService = new BisetkaService();
export default bisetkaService;
