import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { apiConfig } from '../libs/utils/api.utils';
import { getDeviceId, getDeviceInfo } from '../libs/utils/deviceInfo';
import type { AuthResponse, User } from '../types/auth';

// Base64 decode helper (atob not available in RN)
const base64Decode = (str: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  const input = str.replace(/[^A-Za-z0-9+/=]/g, '');
  while (i < input.length) {
    const enc1 = chars.indexOf(input.charAt(i++));
    const enc2 = chars.indexOf(input.charAt(i++));
    const enc3 = chars.indexOf(input.charAt(i++));
    const enc4 = chars.indexOf(input.charAt(i++));
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }
  return output;
};

const ACCESS_TOKEN_KEY = '@bisetka_access_token';
const REFRESH_TOKEN_BACKUP_KEY = '@bisetka_refresh_token_backup';
const USER_STORAGE_KEY = '@bisetka_user';
const KEYCHAIN_SERVICE = 'org.sera.dev.bisetka.refresh';

class TokenService {
  private accessTokenCache: string | null = null;
  private refreshTokenCache: string | null = null;
  private refreshPromise: Promise<AuthResponse> | null = null;
  private initialized = false;
  private userUpdater?: (user: User | null) => void;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenExpiresAt: number | null = null;

  registerUserUpdater(callback?: (user: User | null) => void) {
    this.userUpdater = callback;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const [accessToken, refreshTokenBackup] = await Promise.all([
        AsyncStorage.getItem(ACCESS_TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_BACKUP_KEY),
      ]);

      this.accessTokenCache = accessToken;
      this.refreshTokenCache = refreshTokenBackup;

      if (!this.refreshTokenCache) {
        const credentials = await Keychain.getInternetCredentials(KEYCHAIN_SERVICE);
        if (credentials && typeof credentials === 'object' && 'password' in credentials) {
          this.refreshTokenCache = credentials.password;
          await AsyncStorage.setItem(REFRESH_TOKEN_BACKUP_KEY, credentials.password);
        }
      }

      // Decode existing token to set up expiration tracking
      if (this.accessTokenCache) {
        try {
          const payload = JSON.parse(base64Decode(this.accessTokenCache.split('.')[1]!));
          if (payload.exp) {
            this.tokenExpiresAt = payload.exp * 1000;
            // If token is expired or will expire in next minute, schedule refresh (don't block init)
            if (this.tokenExpiresAt < Date.now() + 60 * 1000) {
              console.log('🔄 Token expired or expiring soon, scheduling background refresh...');
              // Don't await — refresh in background so init completes quickly
              this.refreshSession().catch(err => {
                console.warn('Background refresh during init failed:', err.message);
              });
            } else {
              this.scheduleProactiveRefresh();
            }
          }
        } catch (error) {
          console.warn('Unable to decode existing token:', error);
        }
      }

      const storedUser = await this.getStoredUser();
      if (storedUser && this.userUpdater) {
        this.userUpdater(storedUser);
      }
    } catch (error) {
      console.warn('TokenService initialize error:', error);
    } finally {
      this.initialized = true;
    }
  }

  async storeSession(session: AuthResponse): Promise<void> {
    await this.storeTokens(session.token, session.refreshToken);
    await this.setStoredUser(session.user);
  }

  async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
    this.accessTokenCache = accessToken;
    this.refreshTokenCache = refreshToken;

    // Decode JWT to get expiration time (tokens are JWT format)
    try {
      const payload = JSON.parse(base64Decode(accessToken.split('.')[1]!));
      if (payload.exp) {
        this.tokenExpiresAt = payload.exp * 1000; // Convert to milliseconds
        this.scheduleProactiveRefresh();
      }
    } catch (error) {
      console.warn('Unable to decode access token expiration:', error);
      // Default: refresh after 12 minutes (assumes 15min TTL)
      this.tokenExpiresAt = Date.now() + 12 * 60 * 1000;
      this.scheduleProactiveRefresh();
    }

    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_BACKUP_KEY, refreshToken);

    try {
      await Keychain.setInternetCredentials(KEYCHAIN_SERVICE, 'refreshToken', refreshToken);
    } catch (error) {
      console.warn('Unable to persist refresh token in Keychain:', error);
    }
  }

  private scheduleProactiveRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.tokenExpiresAt) return;

    // Refresh 3 minutes before expiration
    const refreshAt = this.tokenExpiresAt - 3 * 60 * 1000;
    const delay = refreshAt - Date.now();

    if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
      // Only schedule if delay is positive and less than 24 hours
      this.refreshTimer = setTimeout(async () => {
        try {
          console.log('🔄 Proactively refreshing token...');
          await this.refreshSession();
        } catch (error) {
          console.warn('Proactive refresh failed:', error);
        }
      }, delay);
    }
  }

  async clearSession(): Promise<void> {
    this.accessTokenCache = null;
    this.refreshTokenCache = null;
    this.tokenExpiresAt = null;

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_BACKUP_KEY, USER_STORAGE_KEY]);

    try {
      await Keychain.resetInternetCredentials({ server: KEYCHAIN_SERVICE });
    } catch (error) {
      console.warn('Unable to reset Keychain credentials:', error);
    }

    if (this.userUpdater) {
      this.userUpdater(null);
    }
  }

  async getStoredUser(): Promise<User | null> {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as User) : null;
    } catch (error) {
      console.warn('Unable to parse stored user', error);
      return null;
    }
  }

  private async setStoredUser(user: User | null): Promise<void> {
    if (user) {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
    }

    if (this.userUpdater) {
      this.userUpdater(user);
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.accessTokenCache) {
      return this.accessTokenCache;
    }

    const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    this.accessTokenCache = token;
    return token;
  }

  async getRefreshToken(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.refreshTokenCache) {
      return this.refreshTokenCache;
    }

    const backup = await AsyncStorage.getItem(REFRESH_TOKEN_BACKUP_KEY);
    if (backup) {
      this.refreshTokenCache = backup;
      return backup;
    }

    const credentials = await Keychain.getInternetCredentials(KEYCHAIN_SERVICE);
    if (credentials && typeof credentials === 'object' && 'password' in credentials) {
      this.refreshTokenCache = credentials.password;
      await AsyncStorage.setItem(REFRESH_TOKEN_BACKUP_KEY, credentials.password);
      return credentials.password;
    }

    return null;
  }

  async checkAndRefreshIfNeeded(): Promise<void> {
    if (!this.accessTokenCache || !this.tokenExpiresAt) {
      return;
    }

    const now = Date.now();
    const expiresIn = this.tokenExpiresAt - now;

    // If token expired or expires in next 2 minutes, refresh now
    if (expiresIn < 2 * 60 * 1000) {
      console.log(`⏰ Token expires in ${Math.round(expiresIn / 1000)}s — refreshing now`);
      try {
        await this.refreshSession();
      } catch (error) {
        console.warn('Refresh on foreground failed:', error);
        // Don't throw — let the next API request handle it
      }
    } else {
      console.log(`✅ Token still valid for ${Math.round(expiresIn / 60000)} minutes`);
    }
  }

  async refreshSession(): Promise<AuthResponse> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const deviceId = await getDeviceId();
      const deviceInfo = await getDeviceInfo();

      // Add timeout to prevent hanging forever
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      let response: Response;
      try {
        response = await fetch(`${apiConfig.apiURL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-id': deviceId,
          },
          body: JSON.stringify({ refreshToken, deviceInfo }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        let message = 'Unable to refresh session';
        let shouldClearSession = false;

        if (errorBody) {
          try {
            const parsed = JSON.parse(errorBody);
            if (parsed?.message) {
              message = parsed.message;
            }
          } catch (error) {
            // Ignore JSON parse errors
          }
        }

        // Only clear session on 401 (invalid/expired refresh token) or 403 (revoked)
        // Network errors (5xx, timeouts) shouldn't log the user out
        if (response.status === 401 || response.status === 403) {
          shouldClearSession = true;
        }

        if (shouldClearSession) {
          console.warn('Refresh token invalid or expired — clearing session');
          await this.clearSession();
        } else {
          console.warn(`Token refresh failed with ${response.status}, will retry on next request`);
        }

        throw new Error(message);
      }

      const data: AuthResponse = await response.json();
      await this.storeSession(data);
      return data;
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }
}

const tokenService = new TokenService();
export default tokenService;
