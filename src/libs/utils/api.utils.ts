import { Platform, NativeModules } from 'react-native';

/**
 * API CONFIGURATION
 *
 * Automatic Environment Detection:
 * - Development builds (__DEV__ = true) → local server
 * - Production builds → staging/production server (to be configured)
 *
 * Environment Variables:
 * - Uses react-native-config to read from .env files
 * - .env for development
 *
 * Override Flags (for local development only):
 * - FORCE_LOCAL: Set to true to use local development server
 */

// ========== CONFIGURATION FLAGS ==========
const FORCE_LOCAL = true; // Set to true to use local server

// Cache values to avoid repeated Config access
let cachedLocalURL: string | null = null;

function getConfigValue(key: string, fallback: string): string {
  try {
    const ConfigModule = require('react-native-config');
    if (!ConfigModule || !ConfigModule.default) {
      return fallback;
    }
    const value = ConfigModule.default[key];
    return value || fallback;
  } catch (error) {
    return fallback;
  }
}

// ========== API URLS ==========
const getLocalURL = () => {
  if (cachedLocalURL === null) {
    // Use computer's IP address for physical device testing
    // Change this to your computer's IP address when backend server is running
    cachedLocalURL = getConfigValue(
      'LOCAL_API_URL',
      'http://192.168.26.21:3000',
    );
  }
  return cachedLocalURL;
};

// ========== ENVIRONMENT DETECTION ==========
type Environment = 'local' | 'staging' | 'production';

function getEnvironment(): Environment {
  // Priority 1: Force local (for local development only)
  if (FORCE_LOCAL && __DEV__) {
    return 'local';
  }

  // Priority 2: Development builds always use local
  if (__DEV__) {
    return 'local';
  }

  // Default: production for release builds (configure URL when ready)
  return 'production';
}

function getBaseURL(env: Environment): string {
  switch (env) {
    case 'local':
      return getLocalURL();
    case 'staging':
      return 'http://192.168.26.21:3000'; // Change when staging server is ready
    case 'production':
    default:
      return 'http://192.168.26.21:3000'; // Change when production server is ready
  }
}

// ========== API CONFIG CLASS ==========
class ApiConfig {
  private static instance: ApiConfig;
  private env: Environment;
  private hasLoggedConfig = false;

  private constructor() {
    this.env = getEnvironment();
  }

  static getInstance(): ApiConfig {
    if (!ApiConfig.instance) {
      ApiConfig.instance = new ApiConfig();
    }
    return ApiConfig.instance;
  }

  get environment(): Environment {
    return this.env;
  }

  get baseURL(): string {
    const url = getBaseURL(this.env);
    if (!this.hasLoggedConfig) {
      this.hasLoggedConfig = true;
      console.log('🌐 API Config:', {
        environment: this.env,
        baseURL: url,
        isDev: __DEV__,
      });
    }
    return url;
  }

  get apiURL(): string {
    return `${this.baseURL}/api`;
  }

  get isLocal(): boolean {
    return this.env === 'local';
  }

  get isStaging(): boolean {
    return this.env === 'staging';
  }

  get isProduction(): boolean {
    return this.env === 'production';
  }
}

// ========== EXPORTS ==========
export const apiConfig = ApiConfig.getInstance();
export default apiConfig;

export const getCurrentConfig = () => ({
  environment: apiConfig.environment,
  baseURL: apiConfig.baseURL,
  apiURL: apiConfig.apiURL,
  isLocal: apiConfig.isLocal,
});