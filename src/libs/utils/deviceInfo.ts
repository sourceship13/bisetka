import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import packageJson from '../../../package.json';

const DEVICE_ID_KEY = '@bisetka_device_id';

export const getDeviceId = async (): Promise<string> => {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    const newDeviceId = `bisetka_device_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, newDeviceId);
    return newDeviceId;
  } catch (error) {
    return `bisetka_device_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }
};

export interface DeviceInfoData {
  platform: string;
  deviceName: string;
  osVersion: string;
  appVersion: string;
  pushToken?: string;
}

export const getDeviceInfo = async (pushToken?: string): Promise<DeviceInfoData> => {
  try {
    const deviceName = Platform.select({
      ios: Platform.constants?.systemName || 'iOS Device',
      android: Platform.constants?.Model || 'Android Device',
      default: 'Unknown Device',
    }) as string;

    const deviceInfo: DeviceInfoData = {
      platform: Platform.OS,
      deviceName,
      osVersion:
        typeof Platform.Version === 'string'
          ? Platform.Version
          : Platform.Version?.toString() || 'Unknown',
      appVersion: packageJson.version,
      ...(pushToken && { pushToken }),
    };

    return deviceInfo;
  } catch (error) {
    return {
      platform: Platform.OS,
      deviceName: 'Unknown Device',
      osVersion: 'Unknown',
      appVersion: packageJson.version || '0.0.0',
      ...(pushToken && { pushToken }),
    };
  }
};
