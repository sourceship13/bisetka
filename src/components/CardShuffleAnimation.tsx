import React, { useEffect, useState } from 'react';
import { View, Animated, StyleSheet, Text, Image } from 'react-native';
import type { CardTheme } from './global/GameCustomizationModal';

const CARD_BG = require('../../assets/cards_new/cardBackground.jpg');

interface CardShuffleAnimationProps {
  visible: boolean;
  onComplete?: () => void;
  theme?: CardTheme;
}

/**
 * Card Shuffle Animation
 * Shows 5 stacked cards being shuffled with rotation, scale, and position animations
 * - Cards scale down by 10% initially
 * - Animated shuffle sequence plays once
 * - No repeating
 */
export const CardShuffleAnimation: React.FC<CardShuffleAnimationProps> = ({
  visible,
  onComplete,
  theme,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Individual card animations
  const cardAnimations = Array.from({ length: 5 }).map(() => ({
    scale: new Animated.Value(0.9),           // Start at 90% (10% decrease)
    rotateX: new Animated.Value(0),
    rotateY: new Animated.Value(0),
    translateY: new Animated.Value(0),
  }));

  useEffect(() => {
    if (visible && !isPlaying) {
      setIsPlaying(true);
      playShuffleAnimation();
    }
  }, [visible]);

  const playShuffleAnimation = () => {
    // Create sequence of shuffle animations
    const animations: Animated.CompositeAnimation[] = [];

    // Phase 1: Cards fan out (0-300ms)
    animations.push(
      Animated.parallel(
        cardAnimations.map((anim, idx) =>
          Animated.sequence([
            // Slight delay for cascade effect
            Animated.delay(idx * 40),
            Animated.parallel([
              Animated.timing(anim.rotateY, {
                toValue: 180 + (idx - 2) * 15, // Fan effect
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(anim.translateY, {
                toValue: idx * 8, // Cascade down
                duration: 300,
                useNativeDriver: true,
              }),
            ]),
          ])
        )
      )
    );

    // Phase 2: Shuffle wiggles (300-800ms)
    animations.push(
      Animated.parallel(
        cardAnimations.map((anim, idx) =>
          Animated.sequence([
            // Each card shuffles at slightly different time
            Animated.delay(idx * 50),
            // Wiggle left-right-left
            Animated.sequence([
              Animated.timing(anim.rotateX, {
                toValue: 5,
                duration: 100,
                useNativeDriver: true,
              }),
              Animated.timing(anim.rotateX, {
                toValue: -5,
                duration: 100,
                useNativeDriver: true,
              }),
              Animated.timing(anim.rotateX, {
                toValue: 3,
                duration: 80,
                useNativeDriver: true,
              }),
              Animated.timing(anim.rotateX, {
                toValue: -3,
                duration: 80,
                useNativeDriver: true,
              }),
              Animated.timing(anim.rotateX, {
                toValue: 0,
                duration: 60,
                useNativeDriver: true,
              }),
            ]),
          ])
        )
      )
    );

    // Phase 3: Cards shuffle positions and return to stack (800-1200ms)
    animations.push(
      Animated.parallel(
        cardAnimations.map((anim, idx) =>
          Animated.sequence([
            Animated.delay(Math.random() * 100), // Randomize for chaos
            Animated.parallel([
              // Return to center rotation
              Animated.timing(anim.rotateY, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
              }),
              // Return to stack position
              Animated.timing(anim.translateY, {
                toValue: idx * 3, // Slightly stacked
                duration: 400,
                useNativeDriver: true,
              }),
            ]),
          ])
        )
      )
    );

    // Run all phases in sequence
    Animated.sequence(animations).start(() => {
      setIsPlaying(false);
      onComplete?.();
    });
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.shuffleText}>Shuffling Deck...</Text>
      <View style={styles.cardStack}>
        {cardAnimations.map((anim, idx) => (
          <Animated.View
            key={idx}
            style={[
              styles.cardWrapper,
              {
                transform: [
                  { scale: anim.scale },
                  { rotateX: anim.rotateX.interpolate({
                    inputRange: [-10, 0, 10],
                    outputRange: ['-10deg', '0deg', '10deg'],
                  })},
                  { rotateY: anim.rotateY.interpolate({
                    inputRange: [0, 180, 360],
                    outputRange: ['0deg', '180deg', '360deg'],
                  })},
                  { translateY: anim.translateY },
                ],
              },
            ]}>
            <Image source={CARD_BG} style={styles.cardImage} resizeMode="cover" />
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '15%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'none',
  },
  shuffleText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  cardStack: {
    width: 80,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    perspective: 1000,
  },
  cardWrapper: {
    position: 'absolute',
    width: 60,
    height: 80,
    borderRadius: 5,
    overflow: 'hidden',
  },
  cardImage: {
    width: 60,
    height: 80,
  },
});

export default CardShuffleAnimation;
