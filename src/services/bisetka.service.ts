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

type GlobeBisetka = Bisetka & { lat: number; lng: number };

type BisetkaLookupCandidate = {
  id?: string | null;
  neighborhood_id?: string | null;
  neighborhood_name?: string | null;
  city?: string | null;
  country?: string | null;
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
        { lat, lng }
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
      const response = await apiService.get<{ bisetka: Bisetka }>('/bisetka/my');
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
  async getByIpBisetka(): Promise<{ bisetka: Bisetka; neighborhood: Neighborhood } | null> {
    try {
      const response = await apiService.get<{
        bisetka: Bisetka;
        neighborhood: Neighborhood;
        source: string;
      }>('/bisetka/by-ip');
      if (response.bisetka) {
        return { bisetka: response.bisetka, neighborhood: response.neighborhood };
      }
      return null;
    } catch (error) {
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
   * Returns bundled neighborhood data
   */
  async getAllNeighborhoods(): Promise<Neighborhood[]> {
    try {
      // Return bundled neighborhood data
      const neighborhoods = bundledLocationData.neighborhoods || [];
      console.log('📍 [BisetkaService] Loaded neighborhoods:', neighborhoods.length);
      return neighborhoods;
    } catch (error: any) {
      console.error('❌ [BisetkaService] Failed to load neighborhoods:', error);
      throw error;
    }
  }
}

export const bisetkaService = new BisetkaService();
export default bisetkaService;
