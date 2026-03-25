import { useMemo } from 'react';
import { useWindowDimensions, Platform } from 'react-native';

export type DeviceType = 'phone' | 'tablet';
export type Orientation = 'portrait' | 'landscape';

export interface DeviceInfo {
  isTablet: boolean;
  isPhone: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  deviceType: DeviceType;
  orientation: Orientation;
  width: number;
  height: number;
}

/**
 * Hook to detect device type and orientation
 * 
 * iPad Detection:
 * - iOS: Uses Platform.isPad (most reliable)
 * - Android: Screen width >= 600dp is considered tablet
 * 
 * Usage:
 * ```tsx
 * const { isTablet, isLandscape, width } = useDeviceType();
 * 
 * return isTablet ? <TabletLayout /> : <PhoneLayout />;
 * ```
 */
export const useDeviceType = (): DeviceInfo => {
  const { width, height } = useWindowDimensions();
  
  const isTablet = useMemo(() => {
    // iOS: Use Platform.isPad (detects actual iPad hardware)
    if (Platform.OS === 'ios') {
      return Platform.isPad || false;
    }
    
    // Android: Use screen size heuristic
    // Tablets are generally >= 600dp in smallest dimension
    const minDimension = Math.min(width, height);
    return minDimension >= 600;
  }, [width, height]);
  
  const isLandscape = width > height;
  const isPortrait = !isLandscape;
  const isPhone = !isTablet;
  const deviceType: DeviceType = isTablet ? 'tablet' : 'phone';
  const orientation: Orientation = isLandscape ? 'landscape' : 'portrait';
  
  return {
    isTablet,
    isPhone,
    isLandscape,
    isPortrait,
    deviceType,
    orientation,
    width,
    height,
  };
};

export default useDeviceType;
