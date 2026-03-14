import React, { useEffect, useState } from 'react';
import { View, Animated, StyleSheet, Text, Dimensions } from 'react-native';
import DynamicCard from './DynamicCard';
import type { CardTheme } from './DynamicCard';

interface RiffleDealAnimationProps {
  visible: boolean;
  playerPositions: Array<{ x: number; y: number }>;
  dealerPosition?: { x: number; y: number };
  onComplete?: () => void;
  theme?: CardTheme;
}

/**
 * Riffle Shuffle + Deal Animation
 * 1. Shows two deck halves fanning and interleaving (riffle shuffle)
 * 2. Combines into single deck at center
 * 3. Deals cards fanning out to player positions
 */
export const RiffleDealAnimation: React.FC<RiffleDealAnimationProps> = ({
  visible,
  playerPositions,
  dealerPosition,
  onComplete,
  theme,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Center position for dealer
  const centerX = dealerPosition?.x ?? screenWidth / 2;
  const centerY = dealerPosition?.y ?? screenHeight * 0.35;

  // Left and right deck halves
  const leftDeckAnimations = Array.from({ length: 6 }).map(() => ({
    translateX: new Animated.Value(-40),
    translateY: new Animated.Value(0),
    rotateZ: new Animated.Value(-15),
    scale: new Animated.Value(1),
    opacity: new Animated.Value(1),
  }));

  const rightDeckAnimations = Array.from({ length: 6 }).map(() => ({
    translateX: new Animated.Value(40),
    translateY: new Animated.Value(0),
    rotateZ: new Animated.Value(15),
    scale: new Animated.Value(1),
    opacity: new Animated.Value(1),
  }));

  // Cards for dealing (one per player)
  const dealCardAnimations = playerPositions.map((pos, idx) => ({
    scale: new Animated.Value(1),
    translateX: new Animated.Value(0),
    translateY: new Animated.Value(0),
    rotateZ: new Animated.Value(0),
    opacity: new Animated.Value(0),
  }));

  useEffect(() => {
    if (visible && !isPlaying) {
      setIsPlaying(true);
      playRiffleDealAnimation();
    }
  }, [visible]);

  const playRiffleDealAnimation = () => {
    const animations: Animated.CompositeAnimation[] = [];

    // Phase 1: Riffle Shuffle (0-600ms)
    // Left and right decks fan and interleave
    animations.push(
      Animated.parallel([
        // Left deck cards fan out then come in
        ...leftDeckAnimations.map((anim, idx) =>
          Animated.sequence([
            Animated.delay(idx * 30),
            Animated.parallel([
              // Fan out
              Animated.timing(anim.translateX, {
                toValue: -60 - idx * 8,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(anim.translateY, {
                toValue: -40 + idx * 5,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(anim.rotateZ, {
                toValue: -25 - idx * 3,
                duration: 150,
                useNativeDriver: true,
              }),
            ]),
            // Come back for interleave
            Animated.parallel([
              Animated.timing(anim.translateX, {
                toValue: -20 + idx * 4,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(anim.translateY, {
                toValue: 10 - idx * 3,
                duration: 150,
                useNativeDriver: true,
              }),
            ]),
          ])
        ),
        // Right deck cards fan out then come in
        ...rightDeckAnimations.map((anim, idx) =>
          Animated.sequence([
            Animated.delay(idx * 30),
            Animated.parallel([
              // Fan out
              Animated.timing(anim.translateX, {
                toValue: 60 + idx * 8,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(anim.translateY, {
                toValue: -40 + idx * 5,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(anim.rotateZ, {
                toValue: 25 + idx * 3,
                duration: 150,
                useNativeDriver: true,
              }),
            ]),
            // Come back for interleave
            Animated.parallel([
              Animated.timing(anim.translateX, {
                toValue: 20 - idx * 4,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(anim.translateY, {
                toValue: 10 - idx * 3,
                duration: 150,
                useNativeDriver: true,
              }),
            ]),
          ])
        ),
      ])
    );

    // Phase 2: Combine into single deck (600-900ms)
    animations.push(
      Animated.parallel([
        ...leftDeckAnimations.map((anim, idx) =>
          Animated.parallel([
            Animated.timing(anim.translateX, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateY, {
              toValue: idx * 2, // Slight stack
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim.rotateZ, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        ),
        ...rightDeckAnimations.map((anim, idx) =>
          Animated.parallel([
            Animated.timing(anim.translateX, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translateY, {
              toValue: idx * 2,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim.rotateZ, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        ),
      ])
    );

    // Phase 3: Fade out shuffled deck, fade in dealing cards at center (900-1000ms)
    animations.push(
      Animated.parallel([
        ...leftDeckAnimations.map((anim) =>
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          })
        ),
        ...rightDeckAnimations.map((anim) =>
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          })
        ),
      ])
    );

    // Phase 4: Deal cards to players with fan animation (1000-1600ms)
    animations.push(
      Animated.parallel(
        dealCardAnimations.map((anim, idx) =>
          Animated.sequence([
            Animated.delay(idx * 80), // Sequential dealing
            Animated.parallel([
              // Fade in at center
              Animated.timing(anim.opacity, {
                toValue: 1,
                duration: 50,
                useNativeDriver: true,
              }),
              // Move to player position
              Animated.timing(anim.translateX, {
                toValue: playerPositions[idx]?.x ?? 0,
                duration: 350,
                useNativeDriver: true,
              }),
              Animated.timing(anim.translateY, {
                toValue: playerPositions[idx]?.y ?? 0,
                duration: 350,
                useNativeDriver: true,
              }),
              // Slight rotation for fanning effect
              Animated.timing(anim.rotateZ, {
                toValue: (idx - Math.floor(playerPositions.length / 2)) * 8,
                duration: 350,
                useNativeDriver: true,
              }),
            ]),
          ])
        )
      )
    );

    // Run all phases
    Animated.sequence(animations).start(() => {
      setIsPlaying(false);
      onComplete?.();
    });
  };

  if (!visible) return null;

  const dummyCard = {
    suit: 'hearts' as const,
    rank: 'A',
    value: 11,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.shuffleText}>Shuffling…</Text>

      {/* Dealer center position */}
      <View
        style={[
          styles.dealerArea,
          { left: centerX - 40, top: centerY - 40 },
        ]}>
        {/* Left deck half */}
        <View style={styles.deckStack}>
          {leftDeckAnimations.map((anim, idx) => (
            <Animated.View
              key={`left-${idx}`}
              style={[
                styles.cardWrapper,
                {
                  transform: [
                    { translateX: anim.translateX },
                    { translateY: anim.translateY },
                    {
                      rotateZ: anim.rotateZ.interpolate({
                        inputRange: [-360, 0, 360],
                        outputRange: ['-360deg', '0deg', '360deg'],
                      }),
                    },
                  ],
                  opacity: anim.opacity,
                },
              ]}>
              <DynamicCard
                card={dummyCard as any}
                faceDown={true}
                size="small"
                theme={theme}
              />
            </Animated.View>
          ))}
        </View>

        {/* Right deck half */}
        <View style={styles.deckStack}>
          {rightDeckAnimations.map((anim, idx) => (
            <Animated.View
              key={`right-${idx}`}
              style={[
                styles.cardWrapper,
                {
                  transform: [
                    { translateX: anim.translateX },
                    { translateY: anim.translateY },
                    {
                      rotateZ: anim.rotateZ.interpolate({
                        inputRange: [-360, 0, 360],
                        outputRange: ['-360deg', '0deg', '360deg'],
                      }),
                    },
                  ],
                  opacity: anim.opacity,
                },
              ]}>
              <DynamicCard
                card={dummyCard as any}
                faceDown={true}
                size="small"
                theme={theme}
              />
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Dealing cards that move to player positions */}
      {dealCardAnimations.map((anim, idx) => (
        <Animated.View
          key={`deal-${idx}`}
          style={[
            styles.dealingCard,
            {
              left: centerX - 30,
              top: centerY - 40,
              transform: [
                { translateX: anim.translateX },
                { translateY: anim.translateY },
                {
                  rotateZ: anim.rotateZ.interpolate({
                    inputRange: [-360, 0, 360],
                    outputRange: ['-360deg', '0deg', '360deg'],
                  }),
                },
              ],
              opacity: anim.opacity,
            },
          ]}>
          <DynamicCard
            card={dummyCard as any}
            faceDown={true}
            size="small"
            theme={theme}
          />
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    pointerEvents: 'none',
  },
  shuffleText: {
    position: 'absolute',
    top: '12%',
    alignSelf: 'center',
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  dealerArea: {
    position: 'absolute',
    width: 80,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckStack: {
    position: 'absolute',
    width: 60,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    position: 'absolute',
    width: 60,
    height: 80,
  },
  dealingCard: {
    position: 'absolute',
    width: 60,
    height: 80,
  },
});

export default RiffleDealAnimation;
