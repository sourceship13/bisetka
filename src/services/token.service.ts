import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { apiConfig } from '../libs/utils/api.utils';
import { getDeviceId, getDeviceInfo } from '../libs/utils/deviceInfo';
import type { AuthResponse, User } from '../types/auth';

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
        if (credentials?.password) {
          this.refreshTokenCache = credentials.password;
          await AsyncStorage.setItem(REFRESH_TOKEN_BACKUP_KEY, credentials.password);
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

    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_BACKUP_KEY, refreshToken);

    try {
      await Keychain.setInternetCredentials(KEYCHAIN_SERVICE, 'refreshToken', refreshToken);
    } catch (error) {
      console.warn('Unable to persist refresh token in Keychain:', error);
    }
  }

  async clearSession(): Promise<void> {
    this.accessTokenCache = null;
    this.refreshTokenCache = null;

    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_BACKUP_KEY, USER_STORAGE_KEY]);

    try {
      await Keychain.resetInternetCredentials(KEYCHAIN_SERVICE);
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
    if (credentials?.password) {
      this.refreshTokenCache = credentials.password;
      await AsyncStorage.setItem(REFRESH_TOKEN_BACKUP_KEY, credentials.password);
      return credentials.password;
    }

    return null;
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

      const response = await fetch(`${apiConfig.apiURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({ refreshToken, deviceInfo }),
      });

      if (!response.ok) {
        await this.clearSession();
        const errorBody = await response.text();
        let message = 'Unable to refresh session';
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
