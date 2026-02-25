/**
 * Blot AI Service - Local single-player game against computer
 * Implements Armenian Classic Blot rules:
 *   - 24-card deck (9 through Ace)
 *   - Trump: J(20pts) > 9(14pts) > A(11) > 10(10) > K(4) > Q(3)
 *   - Non-trump: A(11) > 10(10) > K(4) > Q(3) > J(2) > 9(0)
 *   - Must follow suit; if void, must trump; if trump led, must over-trump if possible
 *   - Taker must score ≥82 pts or falls (opponent gets 162)
 *   - Last trick = +10 bonus; Capot (all tricks) = 250 pts
 */

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;          // non-trump point value
  trumpValue: number;     // trump point value
}

interface LocalGameState {
  deck: Card[];
  playerHand: Card[];
  computerHand: Card[];
  playerTricks: Card[][];
  computerTricks: Card[][];
  currentTrick: Card[];
  trumpSuit: string | null;
  currentTurn: 'player' | 'computer';
  playerScore: number;
  computerScore: number;
  round: number;
  status: 'active' | 'won' | 'draw';
  winnerId?: 'player' | 'computer';
}

// Strength index: lower = stronger card
const TRUMP_ORDER  = ['J', '9', 'A', '10', 'K', 'Q'];
const NORMAL_ORDER = ['A', '10', 'K', 'Q', 'J', '9'];

const strength = (rank: string, isTrump: boolean): number => {
  const order = isTrump ? TRUMP_ORDER : NORMAL_ORDER;
  const i = order.indexOf(rank);
  return i === -1 ? 999 : i;
};

const cardPoints = (card: Card, trumpSuit: string | null): number => {
  return card.suit === trumpSuit ? card.trumpValue : card.value;
};

class BlotAIService {
  initializeGame(): LocalGameState {
    const deck = this.createDeck();
    const shuffled = this.shuffleDeck(deck);
    const playerHand = shuffled.slice(0, 8);
    const computerHand = shuffled.slice(8, 16);
    // Trump determined by the card at position 16 (face-up proposal card)
    const trumpSuit = shuffled[16].suit;
    return {
      deck: shuffled,
      playerHand,
      computerHand,
      playerTricks: [],
      computerTricks: [],
      currentTrick: [],
      trumpSuit,
      currentTurn: 'player',
      playerScore: 0,
      computerScore: 0,
      round: 1,
      status: 'active',
    };
  }

  /** 24-card Armenian Blot deck (9-Ace only) */
  private createDeck(): Card[] {
    const suits: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: { rank: string; value: number; trumpValue: number }[] = [
      { rank: '9',  value: 0,  trumpValue: 14 },
      { rank: '10', value: 10, trumpValue: 10 },
      { rank: 'J',  value: 2,  trumpValue: 20 },
      { rank: 'Q',  value: 3,  trumpValue: 3  },
      { rank: 'K',  value: 4,  trumpValue: 4  },
      { rank: 'A',  value: 11, trumpValue: 11 },
    ];
    const deck: Card[] = [];
    suits.forEach(suit => {
      ranks.forEach(({ rank, value, trumpValue }) => {
        deck.push({ suit, rank, value, trumpValue });
      });
    });
    return deck;
  }

  private shuffleDeck(deck: Card[]): Card[] {
    const d = [...deck];
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  /** Check whether a card is a legal play in the current trick */
  private canPlay(card: Card, hand: Card[], currentTrick: Card[], trumpSuit: string | null): boolean {
    if (currentTrick.length === 0) return true;
    const leadSuit = currentTrick[0].suit;
    const trumpIsLed = leadSuit === trumpSuit;
    const hasSuit = hand.some(c => c.suit === leadSuit);

    if (hasSuit) {
      if (!trumpIsLed) return card.suit === leadSuit;
      // Trump is led — must over-trump if possible
      const currentBest = Math.min(
        ...currentTrick.filter(c => c.suit === trumpSuit).map(c => strength(c.rank, true)),
      );
      const canBeat = hand.some(c => c.suit === trumpSuit && strength(c.rank, true) < currentBest);
      if (canBeat) return card.suit === trumpSuit && strength(card.rank, true) < currentBest;
      return card.suit === trumpSuit;
    }
    const hasTrump = hand.some(c => c.suit === trumpSuit);
    if (hasTrump) return card.suit === trumpSuit;
    return true;
  }

  playCard(gameState: LocalGameState, card: Card): LocalGameState {
    let s = { ...gameState };
    s.playerHand = s.playerHand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
    s.currentTrick = [...s.currentTrick, card];
    if (s.currentTrick.length === 2) s = this.resolveTrick(s);
    else s.currentTurn = 'computer';
    return s;
  }

  computerMove(gameState: LocalGameState): LocalGameState {
    let s = { ...gameState };
    const card = this.selectComputerCard(s);
    s.computerHand = s.computerHand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
    s.currentTrick = [...s.currentTrick, card];
    if (s.currentTrick.length === 2) s = this.resolveTrick(s);
    else s.currentTurn = 'player';
    return s;
  }

  /** AI selects a legal card following rules + heuristics */
  private selectComputerCard(gs: LocalGameState): Card {
    const { computerHand, currentTrick, trumpSuit } = gs;
    const legal = computerHand.filter(c => this.canPlay(c, computerHand, currentTrick, trumpSuit));
    if (legal.length === 0) return computerHand[0];
    if (legal.length === 1) return legal[0];

    // Leading — play strongest non-trump; save trump
    if (currentTrick.length === 0) {
      const nonTrump = legal.filter(c => c.suit !== trumpSuit);
      const pool = nonTrump.length > 0 ? nonTrump : legal;
      return pool.sort((a, b) => strength(a.rank, a.suit === trumpSuit) - strength(b.rank, b.suit === trumpSuit))[0];
    }

    const leadCard = currentTrick[0];
    const leadSuit = leadCard.suit;

    // Current best card in trick
    const bestInTrick = currentTrick.reduce((best, c) => {
      const bT = best.suit === trumpSuit;
      const cT = c.suit === trumpSuit;
      if (cT && !bT) return c;
      if (cT && bT) return strength(c.rank, true) < strength(best.rank, true) ? c : best;
      if (c.suit === leadSuit && best.suit === leadSuit)
        return strength(c.rank, false) < strength(best.rank, false) ? c : best;
      return best;
    }, currentTrick[0]);

    // Cards that beat the current best
    const winning = legal.filter(card => {
      const bT = bestInTrick.suit === trumpSuit;
      const cT = card.suit === trumpSuit;
      if (cT && !bT) return true;
      if (cT && bT) return strength(card.rank, true) < strength(bestInTrick.rank, true);
      if (card.suit === leadSuit && bestInTrick.suit === leadSuit)
        return strength(card.rank, false) < strength(bestInTrick.rank, false);
      return false;
    });

    if (winning.length > 0) {
      // Win with cheapest winning card
      return winning.sort((a, b) => cardPoints(a, trumpSuit) - cardPoints(b, trumpSuit))[0];
    }
    // Can't win — discard cheapest card
    return legal.sort((a, b) => cardPoints(a, trumpSuit) - cardPoints(b, trumpSuit))[0];
  }

  private resolveTrick(gs: LocalGameState): LocalGameState {
    let s = { ...gs };
    const trick = s.currentTrick;
    const trump = s.trumpSuit;

    // Determine winner using proper trump & suit ranking
    const [first, second] = trick;
    const firstTrump  = first.suit  === trump;
    const secondTrump = second.suit === trump;
    const leadSuit = first.suit;

    let playerWins: boolean;
    if (firstTrump && !secondTrump)   playerWins = true;
    else if (!firstTrump && secondTrump) playerWins = false;
    else if (firstTrump && secondTrump)
      playerWins = strength(first.rank, true) < strength(second.rank, true);
    else if (second.suit === leadSuit)
      playerWins = strength(first.rank, false) <= strength(second.rank, false);
    else
      playerWins = true; // second played off-suit non-trump — first card wins

    const trickPoints = trick.reduce((sum, c) => sum + cardPoints(c, trump), 0);
    const isLastTrick = s.playerHand.length === 0 && s.computerHand.length === 0;
    const totalPoints = trickPoints + (isLastTrick ? 10 : 0); // last trick +10

    if (playerWins) {
      s.playerTricks  = [...s.playerTricks, trick];
      s.playerScore  += totalPoints;
      s.currentTurn   = 'player';
    } else {
      s.computerTricks  = [...s.computerTricks, trick];
      s.computerScore  += totalPoints;
      s.currentTurn     = 'computer';
    }

    s.currentTrick = [];
    if (isLastTrick) s = this.checkGameEnd(s);
    return s;
  }

  private checkGameEnd(gs: LocalGameState): LocalGameState {
    let s = { ...gs };
    const total = s.playerTricks.length + s.computerTricks.length;

    // Capot: one side won all tricks → 250 pts flat
    if (s.computerTricks.length === total) {
      s.status = 'won';
      s.winnerId = 'computer';
      return s;
    }
    if (s.playerTricks.length === total) {
      s.status = 'won';
      s.winnerId = 'player';
      return s;
    }

    // Computer is always the "taker" (auto-accepted trump at deal).
    // Taker must score ≥82 raw card points.
    const computerRaw = s.computerTricks
      .flat()
      .reduce((sum, c) => sum + cardPoints(c, s.trumpSuit), 0);
    if (computerRaw < 82) {
      // Computer fell — player wins
      s.status   = 'won';
      s.winnerId = 'player';
      return s;
    }

    // Normal result
    if (s.playerScore > s.computerScore) {
      s.status   = 'won';
      s.winnerId = 'player';
    } else if (s.computerScore > s.playerScore) {
      s.status   = 'won';
      s.winnerId = 'computer';
    } else {
      s.status = 'draw';
    }
    return s;
  }
}

export const blotAIService = new BlotAIService();
export type { LocalGameState, Card };
