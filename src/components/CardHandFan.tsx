import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { CardType } from './Card';

interface CardHandFanProps {
  cards: CardType[];
  renderCard: (card: CardType, index: number, style: any) => React.ReactNode;
  maxWidth?: number;
}

/**
 * CardHandFan - Renders cards in a realistic fan layout (like holding cards)
 * 
 * Features:
 * - Cards overlap and arc like a real hand
 * - Rotation applied to create fan effect
 * - All cards fit on screen without scrolling
 * - Center card is flat, edges rotate more
 */
const CardHandFan: React.FC<CardHandFanProps> = ({
  cards,
  renderCard,
  maxWidth = Dimensions.get('window').width - 32,
}) => {
  if (cards.length === 0) return null;

  const cardCount = cards.length;
  
  // Card dimensions (adjust these based on your card size)
  const CARD_WIDTH = 75;
  const CARD_HEIGHT = 107;
  
  // Calculate spacing and rotation
  const totalCardsWidth = cardCount * CARD_WIDTH;
  const needsOverlap = totalCardsWidth > maxWidth;
  
  // Overlap calculation: more cards = more overlap
  const baseOverlap = needsOverlap ? (totalCardsWidth - maxWidth) / (cardCount - 1 || 1) : 0;
  const overlap = Math.min(baseOverlap, CARD_WIDTH * 0.7); // Max 70% overlap
  
  // Horizontal spacing between card centers
  const spacing = CARD_WIDTH - overlap;
  
  // Total width of the hand
  const handWidth = cardCount === 1 ? CARD_WIDTH : (cardCount - 1) * spacing + CARD_WIDTH;
  
  // Rotation arc: more cards = tighter arc
  const MAX_ROTATION = cardCount > 10 ? 6 : cardCount > 7 ? 8 : 10; // degrees
  
  // Vertical lift for arc effect (cards at edges lift slightly)
  const MAX_LIFT = 12;

  return (
    <View style={[styles.container, { width: handWidth, height: CARD_HEIGHT + MAX_LIFT * 2 }]}>
      {cards.map((card, index) => {
        // Position calculation
        const centerIndex = (cardCount - 1) / 2;
        const offset = index - centerIndex;
        
        // Rotation: center card = 0°, edges rotate more
        const rotation = (offset / centerIndex) * MAX_ROTATION;
        
        // Vertical lift: center card is lowest, edges lift up
        const lift = Math.abs(offset / centerIndex) * MAX_LIFT;
        
        // Horizontal position
        const left = index * spacing;
        
        // Z-index: center cards on top
        const zIndex = cardCount - Math.abs(offset);

        const cardStyle = {
          position: 'absolute' as const,
          left,
          bottom: MAX_LIFT - lift, // Subtract lift so arc goes downward
          transform: [{ rotate: `${rotation}deg` }],
          zIndex,
        };

        return (
          <View key={card.id || index} style={cardStyle}>
            {renderCard(card, index, cardStyle)}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
  },
});

export default CardHandFan;
