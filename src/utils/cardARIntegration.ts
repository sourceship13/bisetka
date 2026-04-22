/**
 * Card AR Integration Example
 * Shows how to use the 3D card system in AR space
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { CardData } from '../components/DynamicCard';
import { createCardScene } from '../utils/cardGLBModifier';
import { 
  CardState, 
  shuffleCardsFan, 
  dealCards, 
  fanOutCards 
} from '../utils/cardAnimations';

// Card positions in AR space (meters from scene origin)
const CARD_TABLE_Y = 0.5; // Height above table
const CARD_SPACING = 0.05; // Distance between cards

// Example: Create a deck of cards for a game
export function createDeck(): CardData[] {
  const suits: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = 
    ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: ('2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A')[] = 
    ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  
  const deck: CardData[] = [];
  let value = 2;
  
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        key: `${rank}-${suit}`,
        suit,
        rank,
        value: value++,
        trumpValue: value,
      });
      
      if (rank === '10') value = 2;
    }
  }
  
  return deck;
}

// Example: Shuffle deck
export function shuffleDeck(deck: CardData[]): CardData[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Example: Deal cards to players
export function dealCardsToPlayers(deck: CardData[], numPlayers: number = 2, cardsPerPlayer: number = 5): CardData[][] {
  const hands: CardData[][] = [];
  
  for (let i = 0; i < numPlayers; i++) {
    hands.push(deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer));
  }
  
  return hands;
}

// Example: Position cards in AR space
export function positionCardsInAR(
  cards: CardData[],
  centerX: number = 0,
  centerY: number = CARD_TABLE_Y,
  centerZ: number = -1,
  spread: number = 60
): { card: CardData; position: { x: number; y: number; z: number }; rotation: { y: number } }[] {
  const totalCards = cards.length;
  const angleStep = spread / (totalCards - 1);
  
  return cards.map((card, i) => {
    const angle = -spread / 2 + i * angleStep;
    const radius = 0.15; // distance from center
    
    const x = centerX + Math.sin(angle * (Math.PI / 180)) * radius;
    const z = centerZ + Math.cos(angle * (Math.PI / 180)) * radius;
    
    return {
      card,
      position: { x, y: centerY, z },
      rotation: { y: -angle * (Math.PI / 180) },
    };
  });
}

// Example: Use in CheckersScreen
/*
// In CheckersScreen.tsx:
import { 
  createDeck, 
  shuffleDeck, 
  dealCardsToPlayers, 
  positionCardsInAR 
} from '../utils/cardARIntegration';

// State
const [cardDeck, setCardDeck] = useState<CardData[]>([]);
const [playerHands, setPlayerHands] = useState<CardData[][]>([]);
const [cardMeshes, setCardMeshes] = useState<any[]>([]);

// Initialize deck
useEffect(() => {
  const deck = createDeck();
  setCardDeck(deck);
}, []);

// Shuffle button
const handleShuffle = () => {
  const shuffled = shuffleDeck(cardDeck);
  setCardDeck(shuffled);
  
  // Animate shuffling
  // (requires card mesh references from AR3DOverlay)
};

// Deal cards
const handleDeal = () => {
  const hands = dealCardsToPlayers(cardDeck, 2, 5);
  setPlayerHands(hands);
  
  // Position cards in AR space
  const cardPositions = positionCardsInAR(hands[0]);
  
  // Send to AR3DOverlay via cards prop
  const arCards = cardPositions.map(pos => ({
    key: pos.card.key,
    position: pos.position,
    rotation: { y: pos.rotation.y },
    scale: 1,
    cardData: {
      suit: pos.card.suit,
      rank: pos.card.rank,
      value: pos.card.value,
      faceDown: false,
    },
  }));
  
  setARCards(arCards);
};
*/

export default {
  createDeck,
  shuffleDeck,
  dealCardsToPlayers,
  positionCardsInAR,
};
