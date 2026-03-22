/**
 * Bisetka Storage Service
 * Stores and retrieves the user's connected Bisetka
 * (from login auto-connect using GPS or IP geolocation)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const BISETKA_KEY = '@bisetka:connected';

export interface StoredBisetka {
  id: string;
  neighborhood: string;
  city: string;
  country: string;
  active_users: number;
  connectedAt: string; // ISO timestamp
  source: 'gps' | 'ip' | 'manual'; // How was this Bisetka determined
}

class BisetkaStorageService {
  /**
   * Store Bisetka info from login response
   */
  async storeBisetka(bisetka: Omit<StoredBisetka, 'connectedAt'>): Promise<void> {
    try {
      const stored: StoredBisetka = {
        ...bisetka,
        connectedAt: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(BISETKA_KEY, JSON.stringify(stored));
      console.log(`✅ [BisetkaStorage] Stored: ${bisetka.neighborhood}, ${bisetka.city}`);
    } catch (error) {
      console.error('❌ [BisetkaStorage] Failed to store:', error);
    }
  }

  /**
   * Get stored Bisetka info
   */
  async getStoredBisetka(): Promise<StoredBisetka | null> {
    try {
      const stored = await AsyncStorage.getItem(BISETKA_KEY);
      if (!stored) {
        console.log('ℹ️  [BisetkaStorage] No stored Bisetka found');
        return null;
      }

      const bisetka: StoredBisetka = JSON.parse(stored);
      console.log(`✅ [BisetkaStorage] Retrieved: ${bisetka.neighborhood}, ${bisetka.city}`);
      return bisetka;
    } catch (error) {
      console.error('❌ [BisetkaStorage] Failed to retrieve:', error);
      return null;
    }
  }

  /**
   * Clear stored Bisetka (e.g., on logout)
   */
  async clearBisetka(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BISETKA_KEY);
      console.log('✅ [BisetkaStorage] Cleared');
    } catch (error) {
      console.error('❌ [BisetkaStorage] Failed to clear:', error);
    }
  }

  /**
   * Check if stored Bisetka is still fresh
   * (optional: implement cache expiry logic)
   */
  async isStoredBisetkaFresh(maxAgeHours: number = 24): Promise<boolean> {
    const stored = await this.getStoredBisetka();
    if (!stored) return false;

    const connectedAt = new Date(stored.connectedAt);
    const ageMs = Date.now() - connectedAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    return ageHours < maxAgeHours;
  }
}

export const bisetkaStorageService = new BisetkaStorageService();
export default bisetkaStorageService;
