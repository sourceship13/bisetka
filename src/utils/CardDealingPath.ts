/**
 * CardDealingPath - Path-based card dealing animations
 * Cards animate from dealer position to player positions in a straight line
 */

import { Animated, Dimensions } from 'react-native';

interface Coordinates {
  x: number;
  y: number;
}

interface DealingAnimation {
  translateX: Animated.Value;
  translateY: Animated.Value;
  opacity: Animated.Value;
  animate: () => void;
  reset: () => void;
}

/**
 * Create a dealing animation for a single card
 * Card slides from dealer position to player position
 */
export const createDealingAnimation = (
  fromCoords: Coordinates,
  toCoords: Coordinates,
  duration: number = 600
): DealingAnimation => {
  const translateX = new Animated.Value(0);
  const translateY = new Animated.Value(0);
  const opacity = new Animated.Value(1);

  const animate = () => {
    // Calculate the displacement
    const deltaX = toCoords.x - fromCoords.x;
    const deltaY = toCoords.y - fromCoords.y;

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: deltaX,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: deltaY,
        duration,
        useNativeDriver: true,
      }),
      // Slight opacity change for subtle effect
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const reset = () => {
    translateX.setValue(0);
    translateY.setValue(0);
    opacity.setValue(1);
  };

  return { translateX, translateY, opacity, animate, reset };
};

/**
 * Calculate dealer position based on screen dimensions and chosen side
 */
export const getDealerPosition = (
  side: 'center-left' | 'center-right'
): Coordinates => {
  const { width, height } = Dimensions.get('window');
  const centerX = width / 2;
  const centerY = height * 0.45;

  if (side === 'center-left') {
    return {
      x: centerX * 0.4,
      y: centerY,
    };
  } else {
    return {
      x: centerX * 1.6,
      y: centerY,
    };
  }
};

/**
 * Calculate player positions around a 6-seat poker table
 */
export const calculatePlayerPositions = (): Coordinates[] => {
  const { width, height } = Dimensions.get('window');
  const centerX = width / 2;
  const centerY = height * 0.45;
  const radius = Math.min(width, height) * 0.25;

  // 6 players positioned around the table
  // Position 0: Top
  // Position 1: Top-Right
  // Position 2: Bottom-Right
  // Position 3: Bottom
  // Position 4: Bottom-Left
  // Position 5: Top-Left
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2; // Start from top
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
};

/**
 * Generate all card dealing animations for a round
 * Returns a map of card IDs to their animations
 */
export const generateDealingSequence = (
  dealerSide: 'center-left' | 'center-right',
  playerCount: number = 6,
  cardsPerPlayer: number = 2,
  cardDuration: number = 600,
  delayBetweenCards: number = 150
): {
  animations: Map<string, DealingAnimation>;
  totalDuration: number;
} => {
  const dealerCoords = getDealerPosition(dealerSide);
  const playerPositions = calculatePlayerPositions();
  const animations = new Map<string, DealingAnimation>();

  // Generate animations for each card in dealing order
  let cardIndex = 0;
  for (let round = 0; round < cardsPerPlayer; round++) {
    for (let playerIdx = 0; playerIdx < playerCount; playerIdx++) {
      const cardId = `card_${round}_${playerIdx}`;
      const playerCoords = playerPositions[playerIdx];

      const animation = createDealingAnimation(
        dealerCoords,
        playerCoords,
        cardDuration
      );

      animations.set(cardId, animation);
      cardIndex++;
    }
  }

  const totalDuration = (cardIndex * delayBetweenCards) + cardDuration;

  return { animations, totalDuration };
};

/**
 * Trigger dealing sequence with proper timing
 */
export const triggerDealingSequence = (
  animations: Map<string, DealingAnimation>,
  onCardDeal?: (cardIndex: number) => void,
  delayBetweenCards: number = 150
): void => {
  let cardIndex = 0;
  const animationEntries = Array.from(animations.entries());

  animationEntries.forEach(([cardId, animation], index) => {
    setTimeout(() => {
      animation.animate();
      if (onCardDeal) {
        onCardDeal(index);
      }
    }, index * delayBetweenCards);
  });
};

export default {
  createDealingAnimation,
  getDealerPosition,
  calculatePlayerPositions,
  generateDealingSequence,
  triggerDealingSequence,
};
