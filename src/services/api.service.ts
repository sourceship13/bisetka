import apiConfig from '../libs/utils/api.utils';

// ========== TYPE DEFINITIONS ==========

export interface User {
  id: string;
  email: string;
  fullName?: {
    givenName: string | null;
    familyName: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

export interface AppleAuthRequest {
  identityToken: string;
  authorizationCode: string;
  user: string;
  email: string | null;
  fullName: {
    givenName: string | null;
    familyName: string | null;
  };
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
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
      console.log(`📦 Request body:`, options.body);
      
      const response = await fetch(url, {
        ...options,
        headers,
      });

      console.log(`📡 Response status:`, response.status);
      
      const data = await response.json();
      console.log(`📥 Response data:`, data);

      if (!response.ok) {
        console.error(`❌ API Error Response:`, data);
        throw {
          message: data.message || 'API request failed',
          code: data.code,
          status: response.status,
        } as ApiError;
      }

      console.log(`✅ API Response: ${options.method || 'GET'} ${url}`);
      return data as T;
    } catch (error: any) {
      console.error(`❌ API Error: ${options.method || 'GET'} ${url}`, error);
      console.error(`❌ Error details:`, {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      
      if (error.message && error.status) {
        throw error;
      }
      
      // Network error
      throw {
        message: `Network request failed: ${error.message || 'Unable to connect to server'}`,
        status: 0,
      } as ApiError;
    }
  }

  private setAuthToken(token: string) {
    // Store token for future requests
    // You can implement token storage logic here
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
  async getProfile(token: string): Promise<User> {
    return this.request<User>('/auth/profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
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
}

// ========== EXPORT ==========
export const apiService = new ApiService();
export default apiService;
