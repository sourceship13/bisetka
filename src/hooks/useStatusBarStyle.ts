import { useState, useEffect } from 'react';
import { ImageSourcePropType } from 'react-native';

type StatusBarStyle = 'light-content' | 'dark-content';

/**
 * Hook to determine the appropriate status bar style based on the background image
 * For generated backgrounds (with URI), we assume they have light tops (sky)
 * For local assets, we default to light-content (white icons)
 */
export const useStatusBarStyle = (
  imageSource: ImageSourcePropType | { uri: string } | number | null | undefined,
  hasGeneratedBackground: boolean
): StatusBarStyle => {
  const [statusBarStyle, setStatusBarStyle] = useState<StatusBarStyle>('light-content');

  useEffect(() => {
    if (!imageSource) {
      // No background, use light icons
      setStatusBarStyle('light-content');
      return;
    }

    // If it's a generated background with URI
    if (hasGeneratedBackground && typeof imageSource === 'object' && 'uri' in imageSource) {
      // Generated outdoor backgrounds typically have bright sky at the top
      // So we need dark status bar content (black icons) to be visible
      setStatusBarStyle('dark-content');
    } else {
      // Default static background is dark, use light icons
      setStatusBarStyle('light-content');
    }
  }, [imageSource, hasGeneratedBackground]);

  return statusBarStyle;
};

export default useStatusBarStyle;
