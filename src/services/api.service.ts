import apiConfig from '../libs/utils/api.utils';
import { getDeviceId, getFullDeviceInfo } from '../libs/utils/deviceInfo';
import tokenService from './token.service';
import type { AuthResponse, User } from '../types/auth';

// ========== TYPE DEFINITIONS ==========

export interface AppleAuthRequest {
  idToken: string;
  email: string | null;
  fullName?: string;
}

export interface GoogleAuthRequest {
  idToken: string;
  user: {
    email: string;
    name: string;
    photo?: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName?: {
    givenName: string;
    familyName: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

// ========== API SERVICE CLASS ==========

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = apiConfig.apiURL;
  }

  // ========== HELPER METHODS ==========

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false,
    retry: boolean = true
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    console.log('🌐 API Request:', url);
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...(options.headers as Record<string, string>),
    };

    try {
      const deviceId = await getDeviceId();
      headers['x-device-id'] = deviceId;

      if (requireAuth) {
        const accessToken = await tokenService.getAccessToken();
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
      }

      console.log('📤 Request headers:', headers);
      const response = await fetch(url, {
        ...options,
        headers,
      });
      console.log('📥 Response status:', response.status);

      if (response.status === 401 && requireAuth && retry) {
        try {
          console.log('🔄 Token expired, attempting refresh...');
          await tokenService.refreshSession();
          console.log('✅ Token refreshed, retrying request');
          return this.request<T>(endpoint, options, true, false);
        } catch (refreshError: any) {
          console.warn('❌ Token refresh failed:', refreshError.message);
          // If refresh failed, return the original 401 error
          // The session will already be cleared by tokenService if appropriate
          throw {
            message: 'Session expired. Please sign in again.',
            code: 'SESSION_EXPIRED',
            status: 401,
          } as ApiError;
        }
      }

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (!response.ok) {
        throw {
          message: data?.message || 'API request failed',
          code: data?.code,
          status: response.status,
        } as ApiError;
      }

      return data as T;
    } catch (error: any) {
      console.error('❌ API Error:', error);
      if (error.message && error.status !== undefined) {
        throw error;
      }

      throw {
        message: `Network request failed: ${error.message || 'Unable to connect to server'}`,
        status: 0,
      } as ApiError;
    }
  }

  // ========== AUTHENTICATION ENDPOINTS ==========

  /**
   * Sign in with Apple
   * POST /api/auth/apple
   */
  async appleSignIn(data: AppleAuthRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Sign in with Google
   * POST /api/auth/google
   */
  async googleSignIn(data: GoogleAuthRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Register with email/password
   * POST /api/auth/register
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Login with email/password
   * POST /api/auth/login
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get user profile (authenticated)
   * GET /api/auth/profile
   */
  async getProfile(): Promise<User> {
    return this.request<User>('/auth/profile', {
      method: 'GET',
    }, true);
  }

  /**
   * Check if username is available
   * GET /api/auth/check-username/:username
   */
  async checkUsername(username: string): Promise<{ available: boolean; message: string }> {
    return this.request<{ available: boolean; message: string }>(
      `/auth/check-username/${encodeURIComponent(username)}`,
      { method: 'GET' }
    );
  }

  /**
   * Update username (authenticated)
   * POST /api/auth/update-username
   */
  async updateUsername(username: string): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>(
      '/auth/update-username',
      {
        method: 'POST',
        body: JSON.stringify({ username }),
      },
      true
    );
  }

  /**
   * Update avatar (authenticated)
   * POST /api/auth/update-avatar
   */
  async updateAvatar(avatarUrl: string): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>(
      '/auth/update-avatar',
      {
        method: 'POST',
        body: JSON.stringify({ avatarUrl }),
      },
      true
    );
  }

  /**
   * Mark onboarding as completed for the authenticated user
   * POST /api/auth/onboarding-complete
   */
  async markOnboardingComplete(): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      '/auth/onboarding-complete',
      { method: 'POST' },
      true
    );
  }

  /**
   * Upsert device data (authenticated)
   * Collects full device + network info and sends to backend
   * POST /api/devices/register
   */
  async upsertDeviceData(): Promise<void> {
    try {
      const fullInfo = await getFullDeviceInfo();
      await this.request('/devices/register', {
        method: 'POST',
        body: JSON.stringify(fullInfo),
      }, true);
    } catch (error) {
      console.warn('⚠️ Device data upsert failed:', error);
    }
  }

  // ========== GAME ENDPOINTS ==========

  /**
   * Cards game endpoints
   * TODO: Implement specific card game methods
   */
  cards = {
    // Placeholder for cards game endpoints
    getGames: async () => {
      return this.request('/cards/games', { method: 'GET' });
    },
  };

  /**
   * Checkers game endpoints
   * TODO: Implement specific checkers game methods
   */
  checkers = {
    // Placeholder for checkers game endpoints
    getGames: async () => {
      return this.request('/checkers/games', { method: 'GET' });
    },
  };

  /**
   * Chess game endpoints
   * TODO: Implement specific chess game methods
   */
  chess = {
    // Placeholder for chess game endpoints
    getGames: async () => {
      return this.request('/chess/games', { method: 'GET' });
    },
  };

  /**
   * Poker game endpoints
   * TODO: Implement specific poker game methods
   */
  poker = {
    // Placeholder for poker game endpoints
    getGames: async () => {
      return this.request('/poker/games', { method: 'GET' });
    },
  };

  /**
   * Slots game endpoints
   * TODO: Implement specific slots game methods
   */
  slots = {
    // Placeholder for slots game endpoints
    getGames: async () => {
      return this.request('/slots/games', { method: 'GET' });
    },
  };

  // ========== IMAGE GENERATION ENDPOINTS ==========

  /**
   * Generate a board background image via AI
   * POST /api/images/board-background
   */
  async generateBoardBackground(
    prompt: string,
  ): Promise<{ url: string; revisedPrompt?: string }> {
    return this.request<{ url: string; revisedPrompt?: string }>(
      '/images/board-background',
      {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      },
      true,
    );
  }

  /**
   * Generate a card face background image via AI
   * POST /api/images/card-face
   */
  async generateCardFaceBackground(
    prompt: string,
  ): Promise<{ url: string }> {
    return this.request<{ url: string }>(
      '/images/card-face',
      {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      },
      true,
    );
  }

  /**
   * Generate a card back design via AI
   * POST /api/images/card-back
   */
  async generateCardBackDesign(
    prompt: string,
  ): Promise<{ url: string }> {
    return this.request<{ url: string }>(
      '/images/card-back',
      {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      },
      true,
    );
  }
}

// ========== EXPORT ==========
export const apiService = new ApiService();
export default apiService;
