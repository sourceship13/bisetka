/**
 * Texas Hold'em Poker Logic
 * Implements hand evaluation and comparison for poker games
 */

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
}

export enum HandRank {
  HIGH_CARD = 0,
  PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
}

export interface HandEvaluation {
  rank: HandRank;
  rankName: string;
  value: number[];
  cards: Card[];
}

/**
 * Evaluate the best 5-card hand from 7 cards (2 hole cards + 5 community cards)
 */
export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandEvaluation {
  const allCards = [...holeCards, ...communityCards];
  
  // Generate all possible 5-card combinations
  const combinations = getCombinations(allCards, 5);
  
  // Evaluate each combination and return the best
  let bestHand: HandEvaluation | null = null;
  
  for (const combo of combinations) {
    const evaluation = evaluateFiveCards(combo);
    
    if (!bestHand || compareHands(evaluation, bestHand) > 0) {
      bestHand = evaluation;
    }
  }
  
  return bestHand!;
}

/**
 * Generate all combinations of size k from array
 */
function getCombinations(arr: Card[], k: number): Card[][] {
  const result: Card[][] = [];
  
  function combine(start: number, combo: Card[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  
  combine(0, []);
  return result;
}

/**
 * Evaluate exactly 5 cards
 */
function evaluateFiveCards(cards: Card[]): HandEvaluation {
  const sortedCards = [...cards].sort((a, b) => b.value - a.value);
  
  const isFlush = checkFlush(sortedCards);
  const isStraight = checkStraight(sortedCards);
  const counts = getValueCounts(sortedCards);
  
  // Royal Flush: A-K-Q-J-10 of same suit
  if (isFlush && isStraight && sortedCards[0].value === 14) {
    return {
      rank: HandRank.ROYAL_FLUSH,
      rankName: 'Royal Flush',
      value: [HandRank.ROYAL_FLUSH],
      cards: sortedCards,
    };
  }
  
  // Straight Flush: Five consecutive cards of same suit
  if (isFlush && isStraight) {
    return {
      rank: HandRank.STRAIGHT_FLUSH,
      rankName: 'Straight Flush',
      value: [HandRank.STRAIGHT_FLUSH, sortedCards[0].value],
      cards: sortedCards,
    };
  }
  
  // Four of a Kind
  if (counts.some(c => c.count === 4)) {
    const fourKind = counts.find(c => c.count === 4)!;
    const kicker = counts.find(c => c.count === 1)!;
    return {
      rank: HandRank.FOUR_OF_A_KIND,
      rankName: 'Four of a Kind',
      value: [HandRank.FOUR_OF_A_KIND, fourKind.value, kicker.value],
      cards: sortedCards,
    };
  }
  
  // Full House: Three of a kind + Pair
  if (counts.some(c => c.count === 3) && counts.some(c => c.count === 2)) {
    const threeKind = counts.find(c => c.count === 3)!;
    const pair = counts.find(c => c.count === 2)!;
    return {
      rank: HandRank.FULL_HOUSE,
      rankName: 'Full House',
      value: [HandRank.FULL_HOUSE, threeKind.value, pair.value],
      cards: sortedCards,
    };
  }
  
  // Flush: Five cards of same suit
  if (isFlush) {
    return {
      rank: HandRank.FLUSH,
      rankName: 'Flush',
      value: [HandRank.FLUSH, ...sortedCards.map(c => c.value)],
      cards: sortedCards,
    };
  }
  
  // Straight: Five consecutive cards
  if (isStraight) {
    return {
      rank: HandRank.STRAIGHT,
      rankName: 'Straight',
      value: [HandRank.STRAIGHT, sortedCards[0].value],
      cards: sortedCards,
    };
  }
  
  // Three of a Kind
  if (counts.some(c => c.count === 3)) {
    const threeKind = counts.find(c => c.count === 3)!;
    const kickers = counts.filter(c => c.count === 1).map(c => c.value);
    return {
      rank: HandRank.THREE_OF_A_KIND,
      rankName: 'Three of a Kind',
      value: [HandRank.THREE_OF_A_KIND, threeKind.value, ...kickers],
      cards: sortedCards,
    };
  }
  
  // Two Pair
  const pairs = counts.filter(c => c.count === 2);
  if (pairs.length === 2) {
    const sortedPairs = pairs.sort((a, b) => b.value - a.value);
    const kicker = counts.find(c => c.count === 1)!;
    return {
      rank: HandRank.TWO_PAIR,
      rankName: 'Two Pair',
      value: [HandRank.TWO_PAIR, sortedPairs[0].value, sortedPairs[1].value, kicker.value],
      cards: sortedCards,
    };
  }
  
  // One Pair
  if (pairs.length === 1) {
    const pair = pairs[0];
    const kickers = counts.filter(c => c.count === 1).map(c => c.value);
    return {
      rank: HandRank.PAIR,
      rankName: 'Pair',
      value: [HandRank.PAIR, pair.value, ...kickers],
      cards: sortedCards,
    };
  }
  
  // High Card
  return {
    rank: HandRank.HIGH_CARD,
    rankName: 'High Card',
    value: [HandRank.HIGH_CARD, ...sortedCards.map(c => c.value)],
    cards: sortedCards,
  };
}

/**
 * Check if all cards are of the same suit
 */
function checkFlush(cards: Card[]): boolean {
  return cards.every(card => card.suit === cards[0].suit);
}

/**
 * Check if cards form a straight (including A-2-3-4-5 wheel)
 */
function checkStraight(cards: Card[]): boolean {
  const values = cards.map(c => c.value).sort((a, b) => b - a);
  
  // Check regular straight
  let isStraight = true;
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) {
      isStraight = false;
      break;
    }
  }
  
  if (isStraight) return true;
  
  // Check for wheel (A-2-3-4-5)
  if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    return true;
  }
  
  return false;
}

/**
 * Count occurrences of each card value
 */
function getValueCounts(cards: Card[]): { value: number; count: number }[] {
  const countMap = new Map<number, number>();
  
  for (const card of cards) {
    countMap.set(card.value, (countMap.get(card.value) || 0) + 1);
  }
  
  return Array.from(countMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      // Sort by count first, then by value
      if (b.count !== a.count) return b.count - a.count;
      return b.value - a.value;
    });
}

/**
 * Compare two hands
 * Returns: 1 if hand1 wins, -1 if hand2 wins, 0 if tie
 */
export function compareHands(hand1: HandEvaluation, hand2: HandEvaluation): number {
  // Compare by rank first
  if (hand1.rank !== hand2.rank) {
    return hand1.rank > hand2.rank ? 1 : -1;
  }
  
  // Same rank, compare values
  for (let i = 0; i < Math.max(hand1.value.length, hand2.value.length); i++) {
    const val1 = hand1.value[i] || 0;
    const val2 = hand2.value[i] || 0;
    
    if (val1 !== val2) {
      return val1 > val2 ? 1 : -1;
    }
  }
  
  return 0; // Exact tie
}

/**
 * Determine winners from multiple hands
 */
export function determineWinners(
  players: { id: string; holeCards: Card[]; folded: boolean }[],
  communityCards: Card[]
): string[] {
  const activePlayers = players.filter(p => !p.folded);
  
  if (activePlayers.length === 0) return [];
  if (activePlayers.length === 1) return [activePlayers[0].id];
  
  // Evaluate all hands
  const evaluations = activePlayers.map(player => ({
    playerId: player.id,
    hand: evaluateHand(player.holeCards, communityCards),
  }));
  
  // Find best hand
  let bestHand = evaluations[0].hand;
  for (let i = 1; i < evaluations.length; i++) {
    if (compareHands(evaluations[i].hand, bestHand) > 0) {
      bestHand = evaluations[i].hand;
    }
  }
  
  // Find all players with the best hand (handles ties)
  const winners = evaluations
    .filter(e => compareHands(e.hand, bestHand) === 0)
    .map(e => e.playerId);
  
  return winners;
}

/**
 * Create a shuffled deck of 52 cards
 */
export function createDeck(): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (let i = 0; i < ranks.length; i++) {
      deck.push({
        suit,
        rank: ranks[i],
        value: i + 2, // 2-14 (Ace is 14)
      });
    }
  }

  return shuffleDeck(deck);
}

/**
 * Shuffle a deck using Fisher-Yates algorithm
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
