import { Dimensions } from 'react-native';

/**
 * Calculate optimal game board size based on device type
 * 
 * Phone: Full width minus padding
 * Tablet Portrait: 60% of screen width (leave room for UI)
 * Tablet Landscape: 50% of screen width (side-by-side with chat)
 * 
 * @param isTablet - Whether device is a tablet
 * @param isLandscape - Whether device is in landscape
 * @param maxSize - Maximum board size (default 600)
 * @param padding - Horizontal padding (default 32)
 * @returns Optimal board size in pixels
 */
export const getGameBoardSize = (
  isTablet: boolean,
  isLandscape: boolean,
  maxSize: number = 600,
  padding: number = 32,
): number => {
  const { width, height } = Dimensions.get('window');

  // Reserve space for toolbar (~60), status bar (~50), bottom safe area (~40)
  // plus generous padding so the board never clips at the bottom.
  const heightCap = height * 0.56;

  if (!isTablet) {
    // Phone: Use almost full width, but never taller than the height cap
    return Math.min(width - padding, maxSize, heightCap);
  }
  
  if (isLandscape) {
    // Tablet landscape: Use 50% width (leave room for chat sidebar)
    const availableWidth = width * 0.5;
    return Math.min(availableWidth - padding, maxSize, heightCap);
  }
  
  // Tablet portrait: Use 60% width
  const availableWidth = width * 0.6;
  return Math.min(availableWidth - padding, maxSize, heightCap);
};

/**
 * Calculate piece/cell size for board games
 */
export const getCellSize = (boardSize: number, gridSize: number): number => {
  return boardSize / gridSize;
};

export default {
  getGameBoardSize,
  getCellSize,
};
