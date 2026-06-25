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
const FORCE_LOCAL = getConfigValue('FORCE_LOCAL', 'false') === 'true';

// Safely load Config value with fallback - handles Android null Config
// Cache values to avoid repeated Config access
let cachedLocalURL: string | null = null;
let cachedStagingURL: string | null = null;
let cachedProductionURL: string | null = null;

function normalizeHttpUrl(value: string, defaultPort: number): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  if (trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')) {
    return trimmedValue;
  }

  const hasPort = /:\d+$/.test(trimmedValue);
  return hasPort ? `http://${trimmedValue}` : `http://${trimmedValue}:${defaultPort}`;
}

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

/**
 * PERMANENT FIX — auto-derives the dev machine IP at runtime.
 *
 * In debug / Metro builds the device already has the right host URL because it
 * loaded the JS bundle from Metro. We parse that host out of
 * NativeModules.SourceCode.scriptURL (e.g. "http://192.168.1.42:8081/...") and
 * use port 3000 for the API.  This means the IP is NEVER hardcoded — no .env
 * edit, no rebuild needed when your Wi-Fi IP changes.
 *
 * Fallback chain (in order):
 *  1. Metro scriptURL  → derive host at runtime  (debug / physical device / sim)
 *  2. LOCAL_API_URL in .env / .env.staging       (release builds with FORCE_LOCAL)
 *  3. Platform defaults (localhost / 10.0.2.2)
 */
const getLocalURL = () => {
  if (cachedLocalURL === null) {
    // ── 1. Auto-detect from Metro script URL (zero-config, always up-to-date) ──
    try {
      const scriptURL: string | undefined = NativeModules.SourceCode?.scriptURL;
      if (scriptURL && scriptURL.startsWith('http')) {
        const match = scriptURL.match(/^https?:\/\/([^/:]+)/);
        const host = match?.[1];
        // On Android + adb reverse, Metro loads from "localhost" — the backend
        // is also reachable on localhost (via adb reverse tcp:3000 tcp:3000).
        const isAndroidAdbReverse = Platform.OS === 'android' && host === 'localhost';
        // Exclude simulator-only addresses — a physical device will never have these
        // (but do allow localhost on Android, which signals adb reverse is active)
        if (host && (isAndroidAdbReverse || (host !== 'localhost' && host !== '127.0.0.1' && host !== '10.0.2.2'))) {
          cachedLocalURL = `http://${host}:3000`;
          console.log(`📡 Local API URL (auto from Metro): ${cachedLocalURL}`);
          return cachedLocalURL;
        }
      }
    } catch (_) { /* SourceCode module unavailable — fall through */ }

    // ── 2. Explicit full backend URL in .env / .env.staging ──────────────────
    const backendURL = normalizeHttpUrl(getConfigValue('BACKEND_URL', ''), 3000);
    if (backendURL && !backendURL.includes('localhost')) {
      cachedLocalURL = backendURL;
      console.log(`📡 Local API URL (from BACKEND_URL): ${cachedLocalURL}`);
      return cachedLocalURL;
    }

    // ── 3. Explicit Metro/dev-machine host in .env / .env.staging ────────────
    const metroHost = getConfigValue('METRO_HOST', '');
    if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
      cachedLocalURL = normalizeHttpUrl(metroHost, 3000);
      console.log(`📡 Local API URL (from METRO_HOST): ${cachedLocalURL}`);
      return cachedLocalURL;
    }

    // ── 4. Explicit override in .env / .env.staging ───────────────────────────
    const envURL = getConfigValue('LOCAL_API_URL', '');
    if (envURL) {
      cachedLocalURL = normalizeHttpUrl(envURL, 3000);
      console.log(`📡 Local API URL (from .env): ${cachedLocalURL}`);
      return cachedLocalURL;
    }

    // ── 5. Platform defaults (simulator / emulator) ───────────────────────────
    if (Platform.OS === 'android') {
      cachedLocalURL = 'http://10.0.2.2:3000';  // Android emulator → host loopback
    } else {
      cachedLocalURL = 'http://localhost:3000';  // iOS simulator shares host network
    }
    console.log(`📡 Local API URL (platform default): ${cachedLocalURL}`);
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
      'https://bisetka.io',
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
  // Priority 1: Development builds with FORCE_LOCAL use local server
  if (__DEV__ && FORCE_LOCAL) {
    return 'local';
  }

  // Priority 2: Development builds without FORCE_LOCAL hit production by
  // default so the app talks to the main backend, matching what App Store
  // / TestFlight users see. Set FORCE_LOCAL=true (or change this) to point
  // dev builds at a different env.
  if (__DEV__) {
    return 'production';
  }

  // Priority 3: Release builds - check bundle identifier
  const bundleId = getBundleId();
  console.log('🔍 Bundle ID detected:', bundleId);

  // Staging release build: bundle ID contains 'staging'
  if (bundleId.includes('staging')) {
    return 'staging';
  }

  // Production release build: default
  return 'production';
}

function getBaseURL(env: Environment): string {
  switch (env) {
    case 'local':
      return getLocalURL();
    case 'production':
      return getProductionURL();
    case 'staging':
      // Product requirement: staging and production app builds must both
      // authenticate against the production backend.
      return getProductionURL();
    default:
      return getProductionURL();
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