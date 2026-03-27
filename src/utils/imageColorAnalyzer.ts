import { Image } from 'react-native';

/**
 * Analyzes the brightness of the top portion of an image
 * Returns 'light' if the top area is bright, 'dark' if it's dark
 */
export const analyzeImageBrightness = async (
  imageUri: string | number
): Promise<'light' | 'dark'> => {
  try {
    // For local assets (require()), we can't easily analyze
    // Just return 'dark' as default
    if (typeof imageUri === 'number') {
      return 'dark';
    }

    // For remote URLs, we'll fetch and analyze
    // This is a simplified approach - in production you might want to use
    // react-native-image-colors or similar library
    
    // For now, use a heuristic based on common patterns
    // Generated images with sky/outdoor scenes tend to be lighter at top
    // You can implement actual pixel analysis if needed
    
    return 'light'; // Default for generated backgrounds (usually have sky)
  } catch (error) {
    console.warn('Failed to analyze image brightness:', error);
    return 'dark'; // Safe default
  }
};

/**
 * Alternative: Use react-native-image-colors for accurate color extraction
 * Install: npm install react-native-image-colors
 * 
 * import { getColors } from 'react-native-image-colors';
 * 
 * const colors = await getColors(imageUri, {
 *   fallback: '#000000',
 *   cache: true,
 *   key: imageUri,
 * });
 * 
 * // Calculate luminance
 * const rgb = hexToRgb(colors.average);
 * const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
 * return luminance > 0.5 ? 'light' : 'dark';
 */
