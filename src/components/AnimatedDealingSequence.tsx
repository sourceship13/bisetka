/**
 * AnimatedDealingSequence - Reusable component for card dealing animations
 * Use this in PokerRoomScreen, BlotScreen, and BaazarBlotScreen
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, View } from 'react-native';
import Card3D from './Card3D';
import type { CardType } from './Card';
import type { CardTheme } from './global/GameCustomizationModal';
import CardAnimations from '../utils/CardAnimations';

interface AnimatedDealingSequenceProps {
  cards: CardType[];
  startPosition: { x: number; y: number }; // Deck position
  endPositions: { x: number; y: number }[]; // Target card positions
  onDealComplete?: () => void;
  theme?: CardTheme;
  delayPerCard?: number; // Delay between each card deal (ms)
  animationDuration?: number; // Duration of each card animation (ms)
}

const AnimatedDealingSequence: React.FC<AnimatedDealingSequenceProps> = ({
  cards,
  startPosition,
  endPositions,
  onDealComplete,
  theme,
  delayPerCard = 150,
  animationDuration = 500,
}) => {
  const animationsRef = useRef<Array<ReturnType<typeof CardAnimations.createDealAnimation>>>([]);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  useEffect(() => {
    // Create animations for each card
    const allAnimations = cards.map((card, idx) => {
      const endPos = endPositions[idx] || { x: 0, y: 0 };
      return CardAnimations.createDealAnimation(
        startPosition.x,
        startPosition.y,
        endPos.x,
        endPos.y,
        animationDuration,
      );
    });

    animationsRef.current = allAnimations;

    // Trigger animations sequentially
    allAnimations.forEach((anim, idx) => {
      setTimeout(() => {
        anim.animate();
        // Call completion callback after last card
        if (idx === allAnimations.length - 1) {
          setTimeout(() => {
            onDealComplete?.();
          }, animationDuration);
        }
      }, idx * delayPerCard);
    });

    return () => {
      // Cleanup
      animationsRef.current = [];
    };
  }, [cards, startPosition, endPositions, animationDuration, delayPerCard, onDealComplete]);

  return (
    <View style={{ position: 'absolute', width: screenWidth, height: screenHeight }}>
      {cards.map((card, idx) => {
        const anim = animationsRef.current[idx];
        if (!anim) return null;

        return (
          <Animated.View
            key={card.id}
            style={[
              {
                position: 'absolute',
                opacity: anim.opacity,
                transform: [
                  { translateX: anim.posX },
                  { translateY: anim.posY },
                  { scale: anim.scale },
                ],
              },
            ]}>
            <Card3D suit={(card as any).suit} rank={(card as any).rank} faceDown={true} size={60} />
          </Animated.View>
        );
      })}
    </View>
  );
};

export default AnimatedDealingSequence;
