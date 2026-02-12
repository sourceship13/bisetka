import { Platform, Dimensions, PixelRatio, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import packageJson from '../../../package.json';

// ============================================================================
// DEVICE ID (persistent across sessions)
// ============================================================================

export const getDeviceId = async (): Promise<string> => {
  try {
    const deviceId = await AsyncStorage.getItem('deviceId');
    if (deviceId) {
      return deviceId;
    }
    const newDeviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem('deviceId', newDeviceId);
    return newDeviceId;
  } catch (error) {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

// ============================================================================
// FULL DEVICE INFO INTERFACE
// ============================================================================

export interface DeviceInfoData {
  // Basic device info
  platform: 'ios' | 'android' | 'web' | string;
  deviceName: string;
  deviceModel?: string;
  deviceBrand?: string;
  osVersion: string;
  
  // App info
  appVersion: string;
  appBuild?: string;
  bundleId?: string;
  
  // Push notifications
  pushToken?: string;
  pushEnabled?: boolean;
  
  // Network info
  connectionType?: string;
  connectionEffectiveType?: string;
  isConnected?: boolean;
  isWifiEnabled?: boolean;
  isInternetReachable?: boolean;
  
  // Cellular
  carrierName?: string;
  carrierCountryCode?: string;
  carrierMcc?: string;
  carrierMnc?: string;
  
  // WiFi
  wifiSsid?: string;
  wifiBssid?: string;
  wifiFrequency?: number;
  wifiStrength?: number;
  
  // Screen
  screenWidth: number;
  screenHeight: number;
  screenScale: number;
  fontScale: number;
  isTablet: boolean;
  hasNotch?: boolean;
  
  // Locale
  locale?: string;
  timezone?: string;
  is24Hour?: boolean;
  
  // Security
  isEmulator?: boolean;
  isRooted?: boolean;
  
  // Biometrics
  supportsBiometrics?: boolean;
  biometricType?: string;
}

// ============================================================================
// BASIC DEVICE INFO (no extra dependencies)
// ============================================================================

export const getDeviceInfo = async (pushToken?: string): Promise<DeviceInfoData> => {
  try {
    console.log('📱 Getting device info...');
    
    const { width, height } = Dimensions.get('window');
    const screenScale = PixelRatio.get();
    const fontScale = PixelRatio.getFontScale();
    
    // Platform-specific device name
    const deviceName = Platform.select({
      ios: (Platform.constants as any)?.systemName || 'iOS Device',
      android: (Platform.constants as any)?.Model || 'Android Device',
      default: 'Unknown Device',
    }) as string;

    // Device model (more specific)
    const deviceModel = Platform.select({
      ios: (Platform.constants as any)?.systemName,
      android: (Platform.constants as any)?.Model,
      default: undefined,
    });

    // Device brand
    const deviceBrand = Platform.select({
      ios: 'Apple',
      android: (Platform.constants as any)?.Brand || (Platform.constants as any)?.Manufacturer,
      default: undefined,
    });

    const osVersion = Platform.Version?.toString() || 'Unknown';
    const appVersion = packageJson.version || '0.0.0';

    // Determine if tablet
    const isTablet = Platform.select({
      ios: (Platform as any).isPad === true,
      android: Math.min(width, height) >= 600,
      default: false,
    }) || false;

    const deviceInfo: DeviceInfoData = {
      platform: Platform.OS,
      deviceName,
      deviceModel,
      deviceBrand,
      osVersion,
      appVersion,
      screenWidth: Math.round(width),
      screenHeight: Math.round(height),
      screenScale,
      fontScale,
      isTablet,
      ...(pushToken && { pushToken, pushEnabled: true }),
    };

    console.log('✅ Device info collected:', JSON.stringify(deviceInfo, null, 2));
    return deviceInfo;
  } catch (error) {
    console.error('Error getting device info:', error);
    const { width, height } = Dimensions.get('window');
    return {
      platform: Platform.OS,
      deviceName: 'Unknown Device',
      osVersion: 'Unknown',
      appVersion: packageJson.version || '0.0.0',
      screenWidth: Math.round(width),
      screenHeight: Math.round(height),
      screenScale: PixelRatio.get(),
      fontScale: PixelRatio.getFontScale(),
      isTablet: false,
      ...(pushToken && { pushToken }),
    };
  }
};

// ============================================================================
// NETWORK INFO (requires @react-native-community/netinfo)
// ============================================================================

export interface NetworkInfoData {
  connectionType: string;
  connectionEffectiveType?: string;
  isConnected: boolean;
  isWifiEnabled?: boolean;
  isInternetReachable: boolean | null;
  carrierName?: string;
  wifiSsid?: string;
  wifiBssid?: string;
  wifiStrength?: number;
  details?: any;
}

export const getNetworkInfo = async (): Promise<NetworkInfoData> => {
  try {
    const state: NetInfoState = await NetInfo.fetch();
    
    const networkInfo: NetworkInfoData = {
      connectionType: state.type,
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
    };

    // WiFi-specific details
    if (state.type === 'wifi' && state.details) {
      const wifiDetails = state.details as any;
      networkInfo.isWifiEnabled = true;
      networkInfo.wifiSsid = wifiDetails.ssid;
      networkInfo.wifiBssid = wifiDetails.bssid;
      networkInfo.wifiStrength = wifiDetails.strength;
    }

    // Cellular-specific details
    if (state.type === 'cellular' && state.details) {
      const cellDetails = state.details as any;
      networkInfo.connectionEffectiveType = cellDetails.cellularGeneration; // '2g', '3g', '4g', '5g'
      networkInfo.carrierName = cellDetails.carrier;
    }

    networkInfo.details = state.details;
    
    console.log('🌐 Network info collected:', JSON.stringify(networkInfo, null, 2));
    return networkInfo;
  } catch (error) {
    console.error('Error getting network info:', error);
    return {
      connectionType: 'unknown',
      isConnected: false,
      isInternetReachable: null,
    };
  }
};

// ============================================================================
// COMBINED: FULL DEVICE + NETWORK INFO
// ============================================================================

export interface FullDeviceInfo {
  deviceId: string;
  collectedAt: string;
  // Device info
  platform: string;
  deviceName: string;
  deviceModel?: string;
  deviceBrand?: string;
  osVersion: string;
  appVersion: string;
  screenWidth: number;
  screenHeight: number;
  screenScale: number;
  fontScale: number;
  isTablet: boolean;
  pushToken?: string;
  pushEnabled?: boolean;
  // Network info (optional)
  connectionType?: string;
  connectionEffectiveType?: string;
  isConnected?: boolean;
  isWifiEnabled?: boolean;
  isInternetReachable?: boolean | null;
  carrierName?: string;
  wifiSsid?: string;
  wifiBssid?: string;
  wifiStrength?: number;
}

export const getFullDeviceInfo = async (pushToken?: string): Promise<FullDeviceInfo> => {
  const [deviceId, deviceInfo, networkInfo] = await Promise.all([
    getDeviceId(),
    getDeviceInfo(pushToken),
    getNetworkInfo(),
  ]);

  return {
    deviceId,
    collectedAt: new Date().toISOString(),
    // Device info
    platform: deviceInfo.platform,
    deviceName: deviceInfo.deviceName,
    deviceModel: deviceInfo.deviceModel,
    deviceBrand: deviceInfo.deviceBrand,
    osVersion: deviceInfo.osVersion,
    appVersion: deviceInfo.appVersion,
    screenWidth: deviceInfo.screenWidth,
    screenHeight: deviceInfo.screenHeight,
    screenScale: deviceInfo.screenScale,
    fontScale: deviceInfo.fontScale,
    isTablet: deviceInfo.isTablet,
    pushToken: deviceInfo.pushToken,
    pushEnabled: deviceInfo.pushEnabled,
    // Network info
    connectionType: networkInfo.connectionType,
    connectionEffectiveType: networkInfo.connectionEffectiveType,
    isConnected: networkInfo.isConnected,
    isWifiEnabled: networkInfo.isWifiEnabled,
    isInternetReachable: networkInfo.isInternetReachable,
    carrierName: networkInfo.carrierName,
    wifiSsid: networkInfo.wifiSsid,
    wifiBssid: networkInfo.wifiBssid,
    wifiStrength: networkInfo.wifiStrength,
  };
};

// ============================================================================
// REGISTER/UPDATE DEVICE ON BACKEND
// ============================================================================

export const registerDevice = async (
  apiUrl: string,
  accessToken: string | null,
  pushToken?: string
): Promise<void> => {
  try {
    const fullInfo = await getFullDeviceInfo(pushToken);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-device-id': fullInfo.deviceId,
    };
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${apiUrl}/devices/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify(fullInfo),
    });

    if (!response.ok) {
      console.warn('Device registration failed:', response.status);
    } else {
      console.log('✅ Device registered successfully');
    }
  } catch (error) {
    console.warn('Device registration error:', error);
  }
};
