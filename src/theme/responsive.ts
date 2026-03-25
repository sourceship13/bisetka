import { Platform } from 'react-native';

/**
 * Breakpoints for responsive design
 */
export const breakpoints = {
  phone: 0,
  tablet: 600,
  desktop: 1024,
} as const;

/**
 * Get current breakpoint based on width
 */
export const getBreakpoint = (width: number): keyof typeof breakpoints => {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'phone';
};

/**
 * Responsive spacing values
 */
export const responsiveSpacing = {
  phone: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  tablet: {
    xs: 6,
    sm: 12,
    md: 20,
    lg: 32,
    xl: 48,
  },
} as const;

/**
 * Get spacing value based on device type
 */
export const getSpacing = (size: keyof typeof responsiveSpacing.phone, isTablet: boolean) => {
  return isTablet ? responsiveSpacing.tablet[size] : responsiveSpacing.phone[size];
};

/**
 * Responsive font sizes
 */
export const responsiveFontSizes = {
  phone: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  tablet: {
    xs: 13,
    sm: 15,
    md: 17,
    lg: 20,
    xl: 26,
    xxl: 34,
  },
} as const;

/**
 * Get font size based on device type
 */
export const getFontSize = (size: keyof typeof responsiveFontSizes.phone, isTablet: boolean) => {
  return isTablet ? responsiveFontSizes.tablet[size] : responsiveFontSizes.phone[size];
};

/**
 * Minimum touch target size
 * Apple HIG: 44x44 points
 * Material Design: 48x48 dp
 */
export const touchTarget = {
  phone: 44,
  tablet: 56,
} as const;

/**
 * Get touch target size based on device type
 */
export const getTouchTarget = (isTablet: boolean) => {
  return isTablet ? touchTarget.tablet : touchTarget.phone;
};

/**
 * Grid columns based on device type
 */
export const gridColumns = {
  phone: 2,
  tablet: 3,
  tabletLandscape: 4,
} as const;

/**
 * Get grid columns based on device type and orientation
 */
export const getGridColumns = (isTablet: boolean, isLandscape: boolean) => {
  if (isTablet && isLandscape) return gridColumns.tabletLandscape;
  if (isTablet) return gridColumns.tablet;
  return gridColumns.phone;
};

/**
 * Container max widths
 */
export const containerMaxWidth = {
  phone: '100%',
  tablet: 1200,
} as const;

/**
 * Responsive utility to scale values
 */
export const scale = (value: number, isTablet: boolean, factor: number = 1.25) => {
  return isTablet ? Math.round(value * factor) : value;
};

export default {
  breakpoints,
  getBreakpoint,
  responsiveSpacing,
  getSpacing,
  responsiveFontSizes,
  getFontSize,
  touchTarget,
  getTouchTarget,
  gridColumns,
  getGridColumns,
  containerMaxWidth,
  scale,
};
