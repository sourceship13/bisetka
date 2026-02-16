import { Platform, NativeModules } from 'react-native';

/**
 * API CONFIGURATION
 *
 * Automatic Environment Detection:
 * - Checks bundle identifier to determine staging vs production
 * - Staging bundle: org.sera.dev.bisetka.staging → staging.bisetka.io
 * - Production bundle: org.sera.dev.bisetka → bisetka.io
 * - Development builds (__DEV__ = true) → local or staging.bisetka.io
 *
 * Environment Variables:
 * - Uses react-native-config to read from .env files
 * - .env.staging for staging builds
 * - .env.production for production builds
 * - .env for development
 *
 * Override Flags (for local development only):
 * - FORCE_LOCAL: Set to true to use local development server
 */

// ========== CONFIGURATION FLAGS ==========
const FORCE_LOCAL = true; // Set to true to use local server

// Safely load Config value with fallback - handles Android null Config
// Cache values to avoid repeated Config access
let cachedLocalURL: string | null = null;
let cachedStagingURL: string | null = null;
let cachedProductionURL: string | null = null;

function getConfigValue(key: string, fallback: string): string {
  try {
    const ConfigModule = require('react-native-config');
    if (!ConfigModule || !ConfigModule.default) {
      return fallback;
    }
    const value = ConfigModule.default[key];
    return value || fallback;
  } catch (error) {
    // Config not ready yet, use fallback
    return fallback;
  }
}

// ========== API URLS ==========
// Lazy load environment URLs from Config with fallbacks and caching
const getLocalURL = () => {
  if (cachedLocalURL === null) {
    // Check for env override first
    const envURL = getConfigValue('LOCAL_API_URL', '');
    if (envURL) {
      // Handle both full URLs and IP addresses
      cachedLocalURL = envURL.startsWith('http') ? envURL : `http://${envURL}:3000`;
    } else {
      // Auto-detect based on platform:
      // - iOS Simulator: use localhost (shares host network)
      // - Android Emulator: use 10.0.2.2 (special alias for host)
      // - Physical devices: need actual machine IP (set LOCAL_API_URL in .env)
      if (Platform.OS === 'ios') {
        // iOS Simulator can use localhost directly
        cachedLocalURL = 'http://localhost:3000';
      } else if (Platform.OS === 'android') {
        // Android emulator needs special IP to reach host
        cachedLocalURL = 'http://10.0.2.2:3000';
      } else {
        cachedLocalURL = 'http://localhost:3000';
      }
    }
    console.log(`📡 Local API URL: ${cachedLocalURL} (${Platform.OS})`);
  }
  return cachedLocalURL;
};

const getStagingURL = () => {
  if (cachedStagingURL === null) {
    cachedStagingURL = getConfigValue(
      'STAGING_API_URL',
      'https://staging.bisetka.io',
    );
  }
  return cachedStagingURL;
};

const getProductionURL = () => {
  if (cachedProductionURL === null) {
    cachedProductionURL = getConfigValue(
      'PRODUCTION_API_URL',
      'https://prod.bisetka.io',
    );
  }
  return cachedProductionURL;
};

// ========== ENVIRONMENT DETECTION ==========
type Environment = 'local' | 'staging' | 'production';

// Get bundle identifier to detect staging vs production builds
function getBundleId(): string {
  if (Platform.OS === 'ios') {
    return (
      NativeModules.RNDeviceInfo?.bundleId ||
      NativeModules.PlatformConstants?.bundleIdentifier ||
      'org.sera.dev.bisetka'
    ); // fallback
  }
  // Android
  return NativeModules.RNDeviceInfo?.bundleId || 'org.sera.dev.bisetka'; // fallback
}

function getEnvironment(): Environment {
  // Priority 1: Force local (for local development only)
  if (FORCE_LOCAL && __DEV__) {
    return 'local';
  }

  // Priority 2: Development builds always use staging
  if (__DEV__) {
    return 'staging';
  }

  // Priority 3: Check bundle identifier for release builds
  const bundleId = getBundleId();
  console.log('🔍 Bundle ID detected:', bundleId);

  // If bundle ID contains 'staging', use staging environment
  if (bundleId.includes('staging')) {
    return 'staging';
  }

  // Default: production for release builds
  return 'production';
}

function getBaseURL(env: Environment): string {
  switch (env) {
    case 'local':
      return getLocalURL();
    case 'production':
      return getProductionURL();
    case 'staging':
    default:
      return getStagingURL();
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
    // Log config only once when baseURL is first accessed
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

// Export getBaseURL for backward compatibility
export { getBaseURL };

// Helper to get current config (for debugging)
export const getCurrentConfig = () => ({
  environment: apiConfig.environment,
  baseURL: apiConfig.baseURL,
  apiURL: apiConfig.apiURL,
  isStaging: apiConfig.isStaging,
  isProduction: apiConfig.isProduction,
});