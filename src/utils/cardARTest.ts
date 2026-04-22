/**
 * Card AR Test Utilities
 * Test functions for card rendering in AR space
 */

import { ARCard } from '../components/AR3DOverlay';

/**
 * Create a test card at a specific position
 */
export function createTestCard(
  key: string,
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades',
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A',
  position: { x: number; y: number; z: number },
  faceDown: boolean = false
): ARCard {
  return {
    key,
    position,
    rotation: { y: 0 },
    scale: 1,
    cardData: {
      suit,
      rank,
      value: getCardValue(rank),
      faceDown,
    },
  };
}

/**
 * Create a full deck of test cards
 */
export function createTestDeck(): ARCard[] {
  const suits: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = 
    ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: ('2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A')[] = 
    ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  
  const deck: ARCard[] = [];
  let value = 2;
  
  for (const suit of suits) {
    for (const rank of ranks) {
      const cardKey = `${rank}-${suit}`;
      const position = {
        x: -0.4 + (suits.indexOf(suit) * 0.08),
        y: 0.5,
        z: -1 + (ranks.indexOf(rank) * 0.03),
      };
      
      deck.push({
        key: cardKey,
        position,
        rotation: { y: 0 },
        scale: 1,
        cardData: {
          suit,
          rank,
          value: value++,
          faceDown: false,
        },
      });
      
      if (rank === '10') value = 2;
    }
  }
  
  return deck;
}

/**
 * Fan out cards in a semi-circle
 */
export function fanOutCards(
  cards: ARCard[],
  centerX: number = 0,
  centerY: number = 0.5,
  centerZ: number = -1,
  spread: number = 60,
  radius: number = 0.15
): ARCard[] {
  const totalCards = cards.length;
  const angleStep = spread / (totalCards - 1);
  
  return cards.map((card, i) => {
    const angle = -spread / 2 + i * angleStep;
    
    const x = centerX + Math.sin(angle * (Math.PI / 180)) * radius;
    const z = centerZ + Math.cos(angle * (Math.PI / 180)) * radius;
    
    return {
      ...card,
      position: { x, y: centerY, z },
      rotation: { y: -angle * (Math.PI / 180) },
    };
  });
}

/**
 * Get card value for ranking
 */
export function getCardValue(rank: string): number {
  const faceValues: Record<string, number> = {
    'J': 11,
    'Q': 12,
    'K': 13,
    'A': 14,
  };
  
  const numValue = parseInt(rank);
  return !isNaN(numValue) ? numValue : faceValues[rank] || 2;
}

export default {
  createTestCard,
  createTestDeck,
  fanOutCards,
  getCardValue,
};
