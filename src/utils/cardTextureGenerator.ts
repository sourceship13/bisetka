/**
 * Card Texture Generator
 * Creates dynamic card textures for 3D GLB cards
 */

import { Suit, Rank, CardType } from '../components/DynamicCard';

const CARD_WIDTH = 2.5; // inches
const CARD_HEIGHT = 3.5; // inches
const ROUNDED_CORNER_RADIUS = 0.2;

export interface CardTextureConfig {
  suit: Suit;
  rank: Rank;
  isFaceDown: boolean;
}

/**
 * Get the 2D card asset path for a given card
 */
export function getCardAssetPath(card: CardType, faceDown: boolean = false): string {
  if (faceDown) {
    return require('../../assets/cards/default-card-back.png');
  }
  return require(`../../assets/cards/${card.rank}-${card.suit}.png`);
}

/**
 * Get suit symbol
 */
export function getSuitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };
  return symbols[suit];
}

/**
 * Get suit color
 */
export function getSuitColor(suit: Suit): string {
  return suit === 'hearts' || suit === 'diamonds' ? '#DC143C' : '#1a1a1a';
}

/**
 * Get display rank (J, Q, K, A, 2-10)
 */
export function getDisplayRank(rank: Rank): string {
  const faceCards: Record<Rank, string> = {
    J: 'J',
    Q: 'Q',
    K: 'K',
    A: 'A',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
  };
  return faceCards[rank];
}

/**
 * Generate card value text (for corner values)
 */
export function getCardValueText(card: CardType): string {
  return card.value.toString();
}

/**
 * Create a card texture URL from a 2D asset
 * This can be used with Three.js TextureLoader
 */
export function createCardTextureURL(card: CardType, faceDown: boolean = false): string {
  const assetPath = getCardAssetPath(card, faceDown);
  // For dev mode, use Metro asset server
  if (__DEV__) {
    return `http://localhost:8081/assets/${assetPath}`;
  }
  // For production, use file system
  return assetPath;
}

/**
 * Get card dimensions for 3D model scaling
 */
export function getCardDimensions(): { width: number; height: number; depth: number } {
  // Standard playing card size in meters (approx)
  // 2.5" x 3.5" = 6.35cm x 8.89cm
  const width = 0.0635;  // meters
  const height = 0.0889; // meters
  const depth = 0.002;   // 2mm thickness
  return { width, height, depth };
}

/**
 * Generate a card data structure for AR rendering
 */
export function generateCardData(card: CardType, faceDown: boolean = false): {
  suit: Suit;
  rank: Rank;
  suitSymbol: string;
  suitColor: string;
  displayRank: string;
  cardValue: string;
  texturePath: string;
} {
  return {
    suit: card.suit,
    rank: card.rank,
    suitSymbol: getSuitSymbol(card.suit),
    suitColor: getSuitColor(card.suit),
    displayRank: getDisplayRank(card.rank),
    cardValue: card.value.toString(),
    texturePath: getCardAssetPath(card, faceDown),
  };
}

export default {
  getCardAssetPath,
  getSuitSymbol,
  getSuitColor,
  getDisplayRank,
  getCardValueText,
  createCardTextureURL,
  getCardDimensions,
  generateCardData,
};
