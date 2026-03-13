/**
 * CardAnimations.ts
 * Comprehensive animation utilities for card games
 * Supports both React Native Animated and Reanimated APIs
 * Fully responsive based on Dimensions.get('window')
 */

import { Animated, Dimensions } from 'react-native';
import { useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, withSequence, withRepeat } from 'react-native-reanimated';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

// ─── TYPES ────────────────────────────────────────────────────────────────
export interface CardAnimationConfig {
  duration?: number;
  delay?: number;
  useNativeDriver?: boolean;
}

export interface CardPosition {
  x: number;
  y: number;
}

// ─── ANIMATED API UTILITIES (React Native Animated) ─────────────────────
/**
 * Create animated values for a card
 */
export const createCardAnimatedValues = () => ({
  opacity: new Animated.Value(0),
  scale: new Animated.Value(0.8),
  translateX: new Animated.Value(0),
  translateY: new Animated.Value(0),
  rotate: new Animated.Value(0),
});

/**
 * Deal animation - cards slide in from deck position
 * @param animValues - Animated values object
 * @param fromPosition - Starting position (deck)
 * @param toPosition - Ending position (player hand)
 * @param config - Animation config
 */
export const animateDealCard = (
  animValues: any,
  fromPosition: CardPosition,
  toPosition: CardPosition,
  config: CardAnimationConfig = {}
) => {
  const { duration = 400, delay = 0, useNativeDriver = true } = config;

  const translateX = fromPosition.x - toPosition.x;
  const translateY = fromPosition.y - toPosition.y;

  // Set initial position
  animValues.translateX.setValue(translateX);
  animValues.translateY.setValue(translateY);
  animValues.opacity.setValue(0);

  // Animate to final position
  return Animated.parallel([
    Animated.timing(animValues.opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver,
    }),
    Animated.timing(animValues.translateX, {
      toValue: 0,
      duration,
      delay,
      useNativeDriver,
    }),
    Animated.timing(animValues.translateY, {
      toValue: 0,
      duration,
      delay,
      useNativeDriver,
    }),
  ]);
};

/**
 * Flip animation - card rotates to show face/back
 * @param animValues - Animated values object
 * @param faceUp - Flip to face up or face down
 * @param config - Animation config
 */
export const animateFlipCard = (
  animValues: any,
  faceUp: boolean = true,
  config: CardAnimationConfig = {}
) => {
  const { duration = 300, delay = 0, useNativeDriver = true } = config;

  return Animated.timing(animValues.rotate, {
    toValue: faceUp ? 0 : 180,
    duration,
    delay,
    useNativeDriver,
  });
};

/**
 * Fade in animation for cards
 * @param animValues - Animated values object
 * @param config - Animation config
 */
export const animateFadeInCard = (
  animValues: any,
  config: CardAnimationConfig = {}
) => {
  const { duration = 300, delay = 0, useNativeDriver = true } = config;

  animValues.opacity.setValue(0);

  return Animated.timing(animValues.opacity, {
    toValue: 1,
    duration,
    delay,
    useNativeDriver,
  });
};

/**
 * Scale animation for card emphasis
 * @param animValues - Animated values object
 * @param toScale - Target scale value
 * @param config - Animation config
 */
export const animateScaleCard = (
  animValues: any,
  toScale: number = 1,
  config: CardAnimationConfig = {}
) => {
  const { duration = 250, delay = 0, useNativeDriver = true } = config;

  return Animated.timing(animValues.scale, {
    toValue: toScale,
    duration,
    delay,
    useNativeDriver,
  });
};

/**
 * Sequence multiple card animations
 * @param animations - Array of animations to run in sequence
 */
export const sequenceCardAnimations = (animations: Animated.CompositeAnimation[]) => {
  return Animated.sequence(animations);
};

/**
 * Play multiple card animations in parallel
 * @param animations - Array of animations to run in parallel
 */
export const parallelCardAnimations = (animations: Animated.CompositeAnimation[]) => {
  return Animated.parallel(animations);
};

/**
 * Create staggered deal animation for multiple cards
 * @param cardAnimations - Array of animated value objects
 * @param positions - Array of position pairs [fromPosition, toPosition]
 * @param staggerDelay - Delay between each card (ms)
 * @param cardDuration - Duration of each card animation (ms)
 */
export const staggeredDealAnimation = (
  cardAnimations: any[],
  positions: Array<[CardPosition, CardPosition]>,
  staggerDelay: number = 100,
  cardDuration: number = 400
) => {
  const animations = cardAnimations.map((animValues, index) =>
    animateDealCard(animValues, positions[index][0], positions[index][1], {
      duration: cardDuration,
      delay: index * staggerDelay,
    })
  );

  return Animated.parallel(animations);
};

/**
 * Create animation for player action feedback
 * @param animValues - Animated values object
 * @param action - Action type: 'fold', 'raise', 'call', 'check'
 * @param config - Animation config
 */
export const animatePlayerAction = (
  animValues: any,
  action: 'fold' | 'raise' | 'call' | 'check',
  config: CardAnimationConfig = {}
) => {
  const { duration = 300, useNativeDriver = true } = config;

  switch (action) {
    case 'fold':
      // Fold: cards slide away
      return Animated.parallel([
        Animated.timing(animValues.opacity, {
          toValue: 0.3,
          duration,
          useNativeDriver,
        }),
        Animated.timing(animValues.translateX, {
          toValue: 80,
          duration,
          useNativeDriver,
        }),
      ]);

    case 'raise':
      // Raise: cards pulse up
      return Animated.sequence([
        Animated.timing(animValues.scale, {
          toValue: 1.1,
          duration: duration / 2,
          useNativeDriver,
        }),
        Animated.timing(animValues.scale, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver,
        }),
      ]);

    case 'call':
      // Call: subtle highlight
      return Animated.timing(animValues.opacity, {
        toValue: 1,
        duration,
        useNativeDriver,
      });

    case 'check':
      // Check: fade slightly
      return Animated.timing(animValues.opacity, {
        toValue: 0.8,
        duration,
        useNativeDriver,
      });

    default:
      return Animated.timing(animValues.opacity, {
        toValue: 1,
        duration,
        useNativeDriver,
      });
  }
};

/**
 * Create animation for phase transitions
 * @param animValues - Animated values object
 * @param fromPhase - Starting phase (flop, turn, river, etc)
 * @param config - Animation config
 */
export const animatePhaseTransition = (
  animValues: any,
  fromPhase: string,
  config: CardAnimationConfig = {}
) => {
  const { duration = 400, useNativeDriver = true } = config;

  // Fade out old phase, fade in new
  return Animated.sequence([
    Animated.timing(animValues.opacity, {
      toValue: 0.5,
      duration: duration / 2,
      useNativeDriver,
    }),
    Animated.timing(animValues.opacity, {
      toValue: 1,
      duration: duration / 2,
      useNativeDriver,
    }),
  ]);
};

/**
 * Create animation for card reveal on showdown
 * @param animValues - Animated values object
 * @param config - Animation config
 */
export const animateCardReveal = (
  animValues: any,
  config: CardAnimationConfig = {}
) => {
  const { duration = 500, delay = 0, useNativeDriver = true } = config;

  animValues.rotate.setValue(0);

  return Animated.parallel([
    Animated.timing(animValues.rotate, {
      toValue: 360,
      duration,
      delay,
      useNativeDriver,
    }),
    Animated.timing(animValues.scale, {
      toValue: 1.05,
      duration: duration / 2,
      delay,
      useNativeDriver,
    }),
  ]);
};

// ─── REANIMATED API UTILITIES ──────────────────────────────────────────
/**
 * Create shared values for Reanimated animations
 */
export const createReanimatedCardValues = () => ({
  opacity: useSharedValue(0),
  scale: useSharedValue(0.8),
  translateX: useSharedValue(0),
  translateY: useSharedValue(0),
  rotate: useSharedValue(0),
});

/**
 * Deal animation style for Reanimated
 */
export const useReanimatedDealStyle = (
  sharedValues: any,
  fromPosition: CardPosition,
  toPosition: CardPosition
) => {
  const translateX = fromPosition.x - toPosition.x;
  const translateY = fromPosition.y - toPosition.y;

  // Initialize positions
  sharedValues.translateX.value = translateX;
  sharedValues.translateY.value = translateY;
  sharedValues.opacity.value = 0;

  // Animate
  sharedValues.opacity.value = withTiming(1, { duration: 400 });
  sharedValues.translateX.value = withTiming(0, { duration: 400 });
  sharedValues.translateY.value = withTiming(0, { duration: 400 });

  return useAnimatedStyle(() => ({
    opacity: sharedValues.opacity.value,
    transform: [
      { translateX: sharedValues.translateX.value },
      { translateY: sharedValues.translateY.value },
      { scale: sharedValues.scale.value },
    ],
  }));
};

/**
 * Fade in animation style for Reanimated
 */
export const useReanimatedFadeInStyle = (sharedValues: any) => {
  sharedValues.opacity.value = withTiming(1, { duration: 300 });

  return useAnimatedStyle(() => ({
    opacity: sharedValues.opacity.value,
  }));
};

/**
 * Scale animation style for Reanimated
 */
export const useReanimatedScaleStyle = (sharedValues: any, toScale: number = 1) => {
  sharedValues.scale.value = withTiming(toScale, { duration: 250 });

  return useAnimatedStyle(() => ({
    transform: [{ scale: sharedValues.scale.value }],
  }));
};

/**
 * Flip animation style for Reanimated
 */
export const useReanimatedFlipStyle = (sharedValues: any, faceUp: boolean = true) => {
  sharedValues.rotate.value = withTiming(faceUp ? 0 : 180, { duration: 300 });

  return useAnimatedStyle(() => ({
    transform: [{ rotateY: `${sharedValues.rotate.value}deg` }],
  }));
};

// ─── RESPONSIVE POSITIONING ────────────────────────────────────────────
/**
 * Calculate responsive card positions for players
 * Works for 2-4 player games
 * @param playerIndex - Index of the player (0-3)
 * @param totalPlayers - Total number of players
 * @param deckPosition - Position of the deck (origin)
 */
export const getPlayerCardPosition = (
  playerIndex: number,
  totalPlayers: number = 4,
  deckPosition: CardPosition = { x: windowWidth / 2, y: windowHeight / 2 }
): CardPosition => {
  const padding = 20;
  const cardWidth = 80;
  const cardHeight = 110;

  switch (totalPlayers) {
    case 2:
      // Heads up: top and bottom
      if (playerIndex === 0) {
        return { x: windowWidth / 2 - cardWidth / 2, y: padding };
      } else {
        return { x: windowWidth / 2 - cardWidth / 2, y: windowHeight - cardHeight - padding };
      }

    case 3:
      // Triangle layout
      if (playerIndex === 0) {
        return { x: windowWidth / 2 - cardWidth / 2, y: padding };
      } else if (playerIndex === 1) {
        return { x: windowWidth - cardWidth - padding, y: windowHeight / 2 - cardHeight / 2 };
      } else {
        return { x: padding, y: windowHeight / 2 - cardHeight / 2 };
      }

    case 4:
    default:
      // Classic 4-player layout (North, East, South, West)
      if (playerIndex === 0) {
        // North (top)
        return { x: windowWidth / 2 - cardWidth / 2, y: padding };
      } else if (playerIndex === 1) {
        // East (right)
        return { x: windowWidth - cardWidth - padding, y: windowHeight / 2 - cardHeight / 2 };
      } else if (playerIndex === 2) {
        // South (bottom)
        return { x: windowWidth / 2 - cardWidth / 2, y: windowHeight - cardHeight - padding };
      } else {
        // West (left)
        return { x: padding, y: windowHeight / 2 - cardHeight / 2 };
      }
  }
};

/**
 * Get deck position (center of screen)
 */
export const getDeckPosition = (): CardPosition => ({
  x: windowWidth / 2,
  y: windowHeight / 2,
});

/**
 * Get table center position for community cards (Poker)
 */
export const getTableCenterPosition = (): CardPosition => ({
  x: windowWidth / 2,
  y: windowHeight / 2 - 50,
});

/**
 * Calculate card fan positions for hand display
 * @param cardIndex - Index of card in hand
 * @param totalCards - Total cards in hand
 * @param containerWidth - Width of container
 * @param baseY - Y position of hand
 */
export const getCardFanPosition = (
  cardIndex: number,
  totalCards: number,
  containerWidth: number = windowWidth,
  baseY: number = windowHeight - 150
): CardPosition => {
  const cardWidth = 80;
  const spacing = 10;
  const totalWidth = totalCards * cardWidth + (totalCards - 1) * spacing;
  const startX = (containerWidth - totalWidth) / 2;

  return {
    x: startX + cardIndex * (cardWidth + spacing),
    y: baseY,
  };
};

// ─── ANIMATION STATE HELPERS ──────────────────────────────────────────
/**
 * Reset all animation values to initial state
 */
export const resetCardAnimations = (animValues: any) => {
  animValues.opacity.setValue(1);
  animValues.scale.setValue(1);
  animValues.translateX.setValue(0);
  animValues.translateY.setValue(0);
  animValues.rotate.setValue(0);
};

/**
 * Get transform style from animated values
 */
export const getCardTransformStyle = (animValues: any) => ({
  opacity: animValues.opacity,
  transform: [
    { scale: animValues.scale },
    { translateX: animValues.translateX },
    { translateY: animValues.translateY },
    {
      rotateZ: animValues.rotate.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg'],
      }),
    },
  ],
});

/**
 * Create dealer button animation (pulsing scale)
 */
export const createDealerButtonAnimation = () => {
  const scale = new Animated.Value(1);

  const pulse = () => {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
  };

  return { scale, pulse };
};

/**
 * Create betting highlight animation
 */
export const createBettingHighlightAnimation = () => {
  const opacity = new Animated.Value(0.5);

  const highlight = () => {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    );
  };

  return { opacity, highlight };
};

export default {
  createCardAnimatedValues,
  animateDealCard,
  animateFlipCard,
  animateFadeInCard,
  animateScaleCard,
  sequenceCardAnimations,
  parallelCardAnimations,
  staggeredDealAnimation,
  animatePlayerAction,
  animatePhaseTransition,
  animateCardReveal,
  createReanimatedCardValues,
  useReanimatedDealStyle,
  useReanimatedFadeInStyle,
  useReanimatedScaleStyle,
  useReanimatedFlipStyle,
  getPlayerCardPosition,
  getDeckPosition,
  getTableCenterPosition,
  getCardFanPosition,
  resetCardAnimations,
  getCardTransformStyle,
  createDealerButtonAnimation,
  createBettingHighlightAnimation,
};
