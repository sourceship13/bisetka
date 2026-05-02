import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Text, Dimensions } from 'react-native';
import type { CardTheme } from './global/GameCustomizationModal';

// Lightweight native card-back — no WebView, avoids Android layer limit.
const CardBack: React.FC<{ size: number }> = ({ size }) => (
  <View style={[cardBackStyles.card, { width: size, height: Math.floor(size * 1.4) }]}>
    <View style={cardBackStyles.inner} />
  </View>
);
const cardBackStyles = StyleSheet.create({
  card:  { backgroundColor: '#1a237e', borderRadius: 6, borderWidth: 1, borderColor: '#7986cb', overflow: 'hidden' },
  inner: { flex: 1, margin: 4, borderRadius: 4, backgroundColor: '#283593', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
});

interface RiffleDealAnimationProps {
  visible: boolean;
  playerPositions: Array<{ x: number; y: number }>;
  dealerPosition?: { x: number; y: number };
  cardsPerPlayer?: number; // Number of cards to deal to each player (default: 2)
  onComplete?: () => void;
  theme?: CardTheme;
}

/**
 * Riffle Shuffle + Deal Animation
 * 1. Shows two deck halves fanning and interleaving (riffle shuffle)
 * 2. Combines into single deck at center
 * 3. Deals cards to each player in circular order (default 2, configurable)
 */
export const RiffleDealAnimation: React.FC<RiffleDealAnimationProps> = ({
  visible,
  playerPositions,
  dealerPosition,
  cardsPerPlayer = 2,
  onComplete,
  theme,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Center position for dealer
  const centerX = dealerPosition?.x ?? screenWidth / 2;
  const centerY = dealerPosition?.y ?? screenHeight * 0.35;

  // Use refs to persist animations across renders
  const animationsRef = useRef<{
    left: Array<any>;
    right: Array<any>;
    deal: Array<any>;
  } | null>(null);

  // Initialize animations once
  // Deal cards to each player (circular dealing pattern)
  if (!animationsRef.current) {
    // Create animations for dealing (cardsPerPlayer rounds of dealing)
    const dealingAnimations = [];
    for (let round = 0; round < cardsPerPlayer; round++) {
      for (let playerIdx = 0; playerIdx < playerPositions.length; playerIdx++) {
        dealingAnimations.push({
          translateX: new Animated.Value(0),
          translateY: new Animated.Value(0),
          rotateZ: new Animated.Value(0),
          opacity: new Animated.Value(0),
          playerIdx, // Track which player this card goes to
          round,     // Track which round (card number)
        });
      }
    }

    animationsRef.current = {
      left: Array.from({ length: 6 }).map(() => ({
        translateX: new Animated.Value(-40),
        translateY: new Animated.Value(0),
        rotateZ: new Animated.Value(-15),
        opacity: new Animated.Value(1),
      })),
      right: Array.from({ length: 6 }).map(() => ({
        translateX: new Animated.Value(40),
        translateY: new Animated.Value(0),
        rotateZ: new Animated.Value(15),
        opacity: new Animated.Value(1),
      })),
      deal: dealingAnimations,
    };
  }

  const leftDeckAnimations = animationsRef.current.left;
  const rightDeckAnimations = animationsRef.current.right;
  const dealCardAnimations = animationsRef.current.deal;

  useEffect(() => {
    if (visible && !isPlaying) {
      setIsPlaying(true);
      playRiffleDealAnimation();
    }
  }, [visible, isPlaying]);

  const playRiffleDealAnimation = () => {
    // Reset all values to initial state so every run starts clean
    leftDeckAnimations.forEach((anim) => {
      anim.translateX.setValue(-40);
      anim.translateY.setValue(0);
      anim.rotateZ.setValue(-15);
      anim.opacity.setValue(1);
    });
    rightDeckAnimations.forEach((anim) => {
      anim.translateX.setValue(40);
      anim.translateY.setValue(0);
      anim.rotateZ.setValue(15);
      anim.opacity.setValue(1);
    });
    dealCardAnimations.forEach((anim) => {
      anim.translateX.setValue(0);
      anim.translateY.setValue(0);
      anim.rotateZ.setValue(0);
      anim.opacity.setValue(0);
    });

    const animations: Animated.CompositeAnimation[] = [];

    // Phase 1: Riffle Shuffle (0-600ms)
    animations.push(
      Animated.parallel([
        // Left deck cards fan out then come in
        ...leftDeckAnimations.map((anim, idx) =>
          Animated.sequence([
            Animated.delay(idx * 30),
            Animated.parallel([
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

    // Phase 2: Combine (600-900ms)
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

    // Phase 3: Fade transition (900-1000ms)
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

    // Phase 4: Deal cards in circular order (1000ms+)
    // Each card dealt with 60ms delay between them
    animations.push(
      Animated.parallel(
        dealCardAnimations.map((anim, cardIdx) => {
          const targetPos = playerPositions[anim.playerIdx];
          return Animated.sequence([
            Animated.delay(cardIdx * 60), // Sequential dealing
            Animated.parallel([
              Animated.timing(anim.opacity, {
                toValue: 1,
                duration: 50,
                useNativeDriver: true,
              }),
              Animated.timing(anim.translateX, {
                toValue: targetPos?.x ?? 0,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(anim.translateY, {
                toValue: targetPos?.y ?? 0,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(anim.rotateZ, {
                toValue: anim.round * 5, // Slight offset for 2nd card
                duration: 300,
                useNativeDriver: true,
              }),
            ]),
          ]);
        })
      )
    );

    // Run sequence
    Animated.sequence(animations).start(({ finished }) => {
      setIsPlaying(false);
      if (finished) onComplete?.();
    });
  };

  if (!visible) {
    return null;
  }

  const dummyCard = {
    suit: 'hearts' as const,
    rank: 'A',
    value: 11,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.shuffleText}>Shuffling & Dealing…</Text>

      {/* Dealer center - riffle shuffle */}
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
                <CardBack size={100} />
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
              <CardBack size={100} />
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Dealing cards (2 per player in circular order) */}
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
          <CardBack size={100} />
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
    width: 110,
    height: 145,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckStack: {
    position: 'absolute',
    width: 100,
    height: 135,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    position: 'absolute',
    width: 100,
    height: 135,
  },
  dealingCard: {
    position: 'absolute',
    width: 100,
    height: 135,
  },
});

export default RiffleDealAnimation;
