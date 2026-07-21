import apiConfig from '../libs/utils/api.utils';
import { getDeviceId, registerDevice as registerBackendDevice } from '../libs/utils/deviceInfo';
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

interface RequestBehavior {
  suppressErrorLogging?: boolean;
}

export interface PointsPurchaseResponse {
  success: boolean;
  packId: string;
  pointsAdded: number;
  basePoints: number;
  bonusPoints: number;
  newBalance: number;
  transactionId: string;
  message: string;
  error?: string;
}

// ========== API SERVICE CLASS ==========

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = apiConfig.apiURL;
  }

  // ========== HELPER METHODS ==========

  private parseResponseBody(text: string, contentType: string | null): unknown {
    if (!text) {
      return null;
    }

    const trimmedText = text.trim();
    const looksLikeJson =
      contentType?.includes('application/json') ||
      trimmedText.startsWith('{') ||
      trimmedText.startsWith('[');

    if (!looksLikeJson) {
      return trimmedText;
    }

    try {
      return JSON.parse(text);
    } catch {
      return trimmedText;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false,
    retry: boolean = true,
    behavior: RequestBehavior = {},
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
        console.log('🔑 Access token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'NONE');
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        } else {
          console.warn('⚠️ No access token available for authenticated request!');
        }
      }

      console.log('📤 Request headers:', headers);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let response: Response;
      try {
        response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr?.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection.');
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);
      console.log('📥 Response status:', response.status);

      if (response.status === 401 && requireAuth && retry) {
        try {
          console.log('🔄 Token expired, attempting refresh...');
          await tokenService.refreshSession();
          console.log('✅ Token refreshed, retrying request');
          return this.request<T>(endpoint, options, true, false, behavior);
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
      const contentType = response.headers.get('content-type');
      const data = this.parseResponseBody(text, contentType);

      if (!response.ok) {
        const errorPayload = typeof data === 'object' && data !== null
          ? (data as Record<string, unknown>)
          : null;

        throw {
          message:
            (errorPayload?.message || errorPayload?.error) ||
            (typeof data === 'string' && data.startsWith('<')
              ? `Server returned HTML instead of JSON for ${endpoint}`
              : typeof data === 'string'
                ? data
                : 'API request failed'),
          code: typeof errorPayload?.code === 'string' ? errorPayload.code : undefined,
          status: response.status,
        } as ApiError;
      }

      return data as T;
    } catch (error: any) {
      if (!behavior.suppressErrorLogging) {
        const method = (options.method || 'GET').toUpperCase();
        console.error(`❌ API Error [${method} ${endpoint}]:`, error);
      }
      if (error.message && error.status !== undefined) {
        error.endpoint = endpoint;
        throw error;
      }

      throw {
        message: `Network request failed: ${error.message || 'Unable to connect to server'}`,
        status: 0,
      } as ApiError;
    }
  }

  async get<T>(
    endpoint: string,
    requireAuth: boolean = false,
    behavior: RequestBehavior = {},
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, requireAuth, true, behavior);
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    requireAuth: boolean = false,
    behavior: RequestBehavior = {},
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      requireAuth,
      true,
      behavior,
    );
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    requireAuth: boolean = false,
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      requireAuth,
    );
  }

  async delete<T>(endpoint: string, requireAuth: boolean = false): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, requireAuth);
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
    // Suppress the auto console.error: a 404 here is an expected, handled
    // case (user row deleted from DB while a JWT is still cached) — useAuth
    // bootstrap clears the session and routes back to sign-in. Logging it
    // shows up as a red runtime error overlay every cold start in dev.
    return this.request<User>('/auth/profile', {
      method: 'GET',
    }, true, true, { suppressErrorLogging: true });
  }

  /**
   * Claim the random-reward bonus for the current user (authenticated).
   * POST /api/users/claim-daily-points  body: { points }
   * Returns the updated balance + breakdown of points totals.
   */
  async claimDailyPoints(points: number, expiresAt?: number): Promise<{
    success: boolean;
    pointsAwarded: number;
    totalPoints: number;
    availablePoints: number;
    lifetimePoints: number;
    balance: number;
  }> {
    return this.request(
      '/users/claim-daily-points',
      {
        method: 'POST',
        body: JSON.stringify(
          typeof expiresAt === 'number' ? { points, expiresAt } : { points },
        ),
      },
      true,
    );
  }

  /**
   * Fetch the avatar appearance config (base + equipped) for any user.
   * GET /api/avatar/appearance/:userId
   */
  async getAvatarAppearance(userId: string): Promise<{
    appearance: {
      baseAvatarId: string | null;
      gender: 'male' | 'female' | null;
      equipped: Record<string, string>;
      updatedAt: string;
    };
  }> {
    return this.request(
      `/avatar/appearance/${encodeURIComponent(userId)}`,
      { method: 'GET' },
      true,
      true,
      { suppressErrorLogging: true },
    );
  }

  /**
   * Upsert the caller's avatar appearance config.
   * PUT /api/avatar/appearance
   */
  async saveAvatarAppearance(payload: {
    baseAvatarId: string | null;
    gender: 'male' | 'female' | null;
    equipped: Record<string, string>;
  }): Promise<unknown> {
    return this.request(
      '/avatar/appearance',
      { method: 'PUT', body: JSON.stringify(payload) },
      true,
      true,
      { suppressErrorLogging: true },
    );
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
   * Update user's language preference (authenticated)
   * POST /api/auth/update-language
   */
  async updateLanguage(language: string, script?: string): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>(
      '/auth/update-language',
      {
        method: 'POST',
        body: JSON.stringify({ language, script }),
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
   * Permanently delete the authenticated user's account and all associated data.
   * DELETE /api/auth/account
   */
  async deleteAccount(): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      '/auth/account',
      { method: 'DELETE' },
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
      const accessToken = await tokenService.getAccessToken();
      if (!accessToken) {
        return;
      }

      await registerBackendDevice(this.baseURL, accessToken);
    } catch (error) {
      console.warn('⚠️ Device data upsert failed:', error);
    }
  }

  // ========== GAME POINTS ENDPOINTS ==========

  /**
   * Deduct entry cost from user's points
   * POST /api/game/deduct-entry
   */
  async deductEntry(gameType: string, gameId?: string): Promise<{
    success: boolean;
    newBalance: number;
    transactionId: string;
    error?: string;
  }> {
    console.log('🔵 deductEntry called:', { gameType, gameId });
    console.log('   Base URL:', this.baseURL);
    console.log('   Full URL:', `${this.baseURL}/game/deduct-entry`);
    
    try {
      const result = await this.request<{
        success: boolean;
        newBalance: number;
        transactionId: string;
        error?: string;
      }>(
        '/game/deduct-entry',
        {
          method: 'POST',
          body: JSON.stringify({ gameType, gameId }),
        },
        true
      );
      console.log('🔵 deductEntry result:', result);
      return result;
    } catch (error) {
      console.error('🔵 deductEntry error:', error);
      throw error;
    }
  }

  /**
   * Award prize to user based on game result
   * POST /api/game/award-prize
   */
  async awardPrize(
    gameType: string,
    result: 'win' | 'draw' | 'loss',
    gameId?: string,
    customPrize?: number
  ): Promise<{
    success: boolean;
    prize: number;
    newBalance: number;
    transactionId: string;
    error?: string;
  }> {
    return this.request<{
      success: boolean;
      prize: number;
      newBalance: number;
      transactionId: string;
      error?: string;
    }>(
      '/game/award-prize',
      {
        method: 'POST',
        body: JSON.stringify({ gameType, result, gameId, customPrize }),
      },
      true
    );
  }

  /**
   * Get entry cost and prize info for a game
   * GET /api/game/:gameType/entry-info
   */
  async getEntryInfo(gameType: string): Promise<{
    success: boolean;
    gameType: string;
    displayName: string;
    icon: string;
    entryCost: number;
    prizes: {
      win: number;
      draw: number;
      loss: number;
    };
    profit: {
      win: number;
      draw: number;
      loss: number;
    };
    multiplier: number;
    userPoints?: number;
    canAfford?: boolean;
  }> {
    return this.request<{
      success: boolean;
      gameType: string;
      displayName: string;
      icon: string;
      entryCost: number;
      prizes: {
        win: number;
        draw: number;
        loss: number;
      };
      profit: {
        win: number;
        draw: number;
        loss: number;
      };
      multiplier: number;
      userPoints?: number;
      canAfford?: boolean;
    }>(
      `/game/${gameType}/entry-info`,
      { method: 'GET' },
      false // Auth is optional - returns can_afford only if authenticated
    );
  }

  /**
   * Get user's points transaction history
   * GET /api/game/transaction-history
   */
  async getTransactionHistory(limit: number = 20, offset: number = 0): Promise<{
    success: boolean;
    transactions: Array<{
      id: string;
      points_change: number;
      reason: string;
      game_type?: string;
      game_result?: string;
      balance_before: number;
      balance_after: number;
      created_at: string;
    }>;
    count: number;
    limit: number;
    offset: number;
  }> {
    return this.request<{
      success: boolean;
      transactions: Array<{
        id: string;
        points_change: number;
        reason: string;
        game_type?: string;
        game_result?: string;
        balance_before: number;
        balance_after: number;
        created_at: string;
      }>;
      count: number;
      limit: number;
      offset: number;
    }>(
      `/game/transaction-history?limit=${limit}&offset=${offset}`,
      { method: 'GET' },
      true
    );
  }

  /**
   * Purchase a points pack and credit the user's account
   * POST /api/game/purchase-points
   */
  async purchasePoints(packId: string): Promise<PointsPurchaseResponse> {
    return this.request<PointsPurchaseResponse>(
      '/game/purchase-points',
      {
        method: 'POST',
        body: JSON.stringify({ packId }),
      },
      true,
    );
  }

  /**
   * Verify an Apple/Google receipt for a points-pack IAP and credit
   * the user's balance server-side. Idempotent: replaying the same
   * receipt returns alreadyApplied=true.
   */
  async verifyPointsPurchase(body: {
    productId: string;
    platform: 'ios' | 'android';
    appleReceipt?: string;
    googlePurchaseToken?: string;
  }): Promise<PointsPurchaseResponse & { alreadyApplied?: boolean }> {
    return this.request<PointsPurchaseResponse & { alreadyApplied?: boolean }>(
      '/iap/verify-points',
      { method: 'POST', body: JSON.stringify(body) },
      true,
    );
  }

  /**
   * Verify an Apple/Google receipt for a clothing-tier IAP and grant + auto-equip
   * the chosen clothing item.
   */
  async verifyClothingPurchase(body: {
    productId: string;
    clothingId: string;
    clothingType: string;
    clothingPriceCents: number;
    platform: 'ios' | 'android';
    appleReceipt?: string;
    googlePurchaseToken?: string;
  }): Promise<{
    success: boolean;
    productId: string;
    clothingId: string;
    clothingType: string | null;
    equipped: boolean;
    alreadyApplied?: boolean;
    error?: string;
  }> {
    return this.request(
      '/iap/verify-clothing',
      { method: 'POST', body: JSON.stringify(body) },
      true,
    );
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
    provider?: 'openai' | 'fal',
  ): Promise<{ url: string; revisedPrompt?: string }> {
    return this.request<{ url: string; revisedPrompt?: string }>(
      '/images/board-background',
      {
        method: 'POST',
        body: JSON.stringify({ prompt, provider }),
      },
      true,
    );
  }

  /**
   * Generate or fetch a cached bisetka background image for a city.
   * POST /api/images/bisetka-background
   */
  async getOrGenerateBisetkaBackground(data: {
    city: string;
    neighborhood?: string;
    country?: string;
    promptTemplate?: string;
    forceRegenerate?: boolean;
  }): Promise<{ url: string | null; prompt: string | null; city: string | null; cached: boolean; disabled?: boolean }> {
    return this.request<{ url: string | null; prompt: string | null; city: string | null; cached: boolean; disabled?: boolean }>(
      '/images/bisetka-background',
      {
        method: 'POST',
        body: JSON.stringify(data),
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
    provider?: 'openai' | 'fal',
  ): Promise<{ url: string }> {
    return this.request<{ url: string }>(
      '/images/card-face',
      {
        method: 'POST',
        body: JSON.stringify({ prompt, provider }),
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
    provider?: 'openai' | 'fal',
  ): Promise<{ url: string }> {
    return this.request<{ url: string }>(
      '/images/card-back',
      {
        method: 'POST',
        body: JSON.stringify({ prompt, provider }),
      },
      true,
    );
  }

  /**
   * Log a theme being applied — fire-and-forget for IAP analytics.
   * POST /api/images/log-theme
   */
  async logThemeApplied(data: {
    gameType: string;
    roomId?: string;
    themeName?: string;
    backgroundImageUrl?: string;
    boardImageUrl?: string;
    cardBackImageUrl?: string;
    fontFamily?: string;
    backgroundPrompt?: string;
    boardPrompt?: string;
    cardBackPrompt?: string;
    aiProvider?: string;
    source?: 'preset' | 'generated';
  }): Promise<void> {
    try {
      await this.request(
        '/images/log-theme',
        {
          method: 'POST',
          body: JSON.stringify({ source: 'generated', ...data }),
        },
        true,
      );
    } catch {
      // Non-fatal — logging should never crash the game
    }
  }

  /**
   * Combined: Award prize + Log game result + Log activity
   * POST /api/game/award-and-log
   */
  async awardPrizeAndLog(
    gameType: string,
    result: 'win' | 'draw' | 'loss',
    gameMode: 'ai' | 'random' | 'private',
    options?: {
      gameId?: string;
      playerScore?: number;
      opponentId?: string;
      opponentScore?: number;
      customPrize?: number;
      durationSeconds?: number;
      movesCount?: number;
      monetaryResult?: number;
    }
  ): Promise<{
    success: boolean;
    prize: number;
    newBalance: number;
    transactionId: string;
    gameResultId: string;
    message: string;
    unlockedAchievements?: Array<{
      achievement_id: string;
      name: string;
      description: string;
      icon: string;
      tier: string;
      points_reward: number;
    }>;
    error?: string;
  }> {
    console.log('🎯 awardPrizeAndLog called:', { gameType, result, gameMode, options });
    
    try {
      const body = {
        gameType,
        result,
        gameMode,
        ...options,
      };

      const response = await this.request<{
        success: boolean;
        prize: number;
        newBalance: number;
        transactionId: string;
        gameResultId: string;
        message: string;
        unlockedAchievements?: Array<{
          achievement_id: string;
          name: string;
          description: string;
          icon: string;
          tier: string;
          points_reward: number;
        }>;
        error?: string;
      }>(
        '/game/award-and-log',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
        true
      );
      
      console.log('✅ awardPrizeAndLog result:', response);
      return response;
    } catch (error) {
      console.error('❌ awardPrizeAndLog error:', error);
      throw error;
    }
  }
}

// ========== EXPORT ==========
export const apiService = new ApiService();
export default apiService;
