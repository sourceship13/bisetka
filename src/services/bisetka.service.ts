import apiService from './api.service';

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

class BisetkaService {
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
   * Get Bisetkas with coordinates for mapping on GlobalView
   */
  async getGlobeBisetkas(): Promise<Array<Bisetka & { lat: number; lng: number }>> {
    console.log('🌍 [BisetkaService] Fetching globe Bisetkas...');
    try {
      console.log('🌍 [BisetkaService] API URL:', apiService['baseURL']);
      const response = await apiService.get<{ 
        bisetkas: Array<Bisetka & { lat: number; lng: number }>; 
        count: number 
      }>('/bisetka/globe');
      console.log('✅ [BisetkaService] Got response:', {
        count: response.count,
        firstBisetka: response.bisetkas?.[0],
        totalReceived: response.bisetkas?.length
      });
      return response.bisetkas || [];
    } catch (error: any) {
      console.error('❌ [BisetkaService] Failed to get globe Bisetkas:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return [];
    }
  }
}

export const bisetkaService = new BisetkaService();
export default bisetkaService;
