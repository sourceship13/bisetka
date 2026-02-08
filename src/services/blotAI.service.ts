/**
 * Blot AI Service - Local single-player game against computer
 * Implements simple AI for card game blot
 */

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
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

class BlotAIService {
  /**
   * Initialize a new local Blot game
   */
  initializeGame(): LocalGameState {
    const deck = this.createDeck();
    const shuffledDeck = this.shuffleDeck(deck);
    
    // Deal 8 cards to each player (32-card Blot deck)
    const playerHand = shuffledDeck.slice(0, 8);
    const computerHand = shuffledDeck.slice(8, 16);
    
    // Determine trump suit from first card of remaining deck
    const trumpCard = shuffledDeck[16];
    const trumpSuit = trumpCard.suit;
    
    return {
      deck: shuffledDeck,
      playerHand,
      computerHand,
      playerTricks: [],
      computerTricks: [],
      currentTrick: [],
      trumpSuit,
      currentTurn: 'player', // Player always starts
      playerScore: 0,
      computerScore: 0,
      round: 1,
      status: 'active',
    };
  }

  /**
   * Create a 32-card Blot deck
   */
  private createDeck(): Card[] {
    const suits: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = [
      { rank: '7', value: 0 },
      { rank: '8', value: 0 },
      { rank: '9', value: 0 },
      { rank: 'J', value: 2 },
      { rank: 'Q', value: 3 },
      { rank: 'K', value: 4 },
      { rank: '10', value: 10 },
      { rank: 'A', value: 11 },
    ];

    const deck: Card[] = [];
    suits.forEach(suit => {
      ranks.forEach(({ rank, value }) => {
        deck.push({ suit, rank, value });
      });
    });

    return deck;
  }

  /**
   * Shuffle deck using Fisher-Yates algorithm
   */
  private shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Player plays a card
   */
  playCard(gameState: LocalGameState, card: Card): LocalGameState {
    let newState = { ...gameState };
    
    // Remove card from player's hand
    newState.playerHand = newState.playerHand.filter(c => 
      !(c.suit === card.suit && c.rank === card.rank)
    );
    
    // Add to current trick
    newState.currentTrick = [...newState.currentTrick, card];
    
    // Check if trick is complete (both players played)
    if (newState.currentTrick.length === 2) {
      newState = this.resolveTrick(newState);
    } else {
      // Switch turn to computer
      newState.currentTurn = 'computer';
    }
    
    return newState;
  }

  /**
   * Computer AI makes a move
   */
  computerMove(gameState: LocalGameState): LocalGameState {
    let newState = { ...gameState };
    
    // Simple AI: Pick a random card (can be improved with strategy)
    const card = this.selectComputerCard(newState);
    
    // Remove card from computer's hand
    newState.computerHand = newState.computerHand.filter(c => 
      !(c.suit === card.suit && c.rank === card.rank)
    );
    
    // Add to current trick
    newState.currentTrick = [...newState.currentTrick, card];
    
    // Check if trick is complete
    if (newState.currentTrick.length === 2) {
      newState = this.resolveTrick(newState);
    } else {
      newState.currentTurn = 'player';
    }
    
    return newState;
  }

  /**
   * AI card selection logic (simple strategy)
   */
  private selectComputerCard(gameState: LocalGameState): Card {
    const { computerHand, currentTrick, trumpSuit } = gameState;
    
    // If computer plays first, play a mid-value card
    if (currentTrick.length === 0) {
      // Try to play a non-trump card first
      const nonTrumpCards = computerHand.filter(c => c.suit !== trumpSuit);
      if (nonTrumpCards.length > 0) {
        return nonTrumpCards[0];
      }
      return computerHand[0];
    }
    
    // If responding to player's card
    const playerCard = currentTrick[0];
    
    // Try to play same suit
    const sameSuitCards = computerHand.filter(c => c.suit === playerCard.suit);
    if (sameSuitCards.length > 0) {
      // Play lowest card of same suit
      return sameSuitCards.sort((a, b) => a.value - b.value)[0];
    }
    
    // If no same suit, try to use trump
    const trumpCards = computerHand.filter(c => c.suit === trumpSuit);
    if (trumpCards.length > 0) {
      return trumpCards[0];
    }
    
    // Otherwise play any card (lowest value)
    return computerHand.sort((a, b) => a.value - b.value)[0];
  }

  /**
   * Resolve a completed trick and determine winner
   */
  private resolveTrick(gameState: LocalGameState): LocalGameState {
    let newState = { ...gameState };
    const trick = newState.currentTrick;
    
    // Determine winner (simple logic - can be enhanced with trump)
    const playerCard = trick[0];
    const computerCard = trick[1];
    
    let winner: 'player' | 'computer';
    
    if (playerCard.suit === computerCard.suit) {
      // Same suit - higher value wins
      winner = playerCard.value > computerCard.value ? 'player' : 'computer';
    } else if (newState.trumpSuit && computerCard.suit === newState.trumpSuit) {
      // Computer has trump
      winner = 'computer';
    } else if (newState.trumpSuit && playerCard.suit === newState.trumpSuit) {
      // Player has trump
      winner = 'player';
    } else {
      // First card wins
      winner = 'player';
    }
    
    // Add trick to winner's tricks
    if (winner === 'player') {
      newState.playerTricks = [...newState.playerTricks, trick];
      newState.playerScore += this.calculateTrickValue(trick);
      newState.currentTurn = 'player';
    } else {
      newState.computerTricks = [...newState.computerTricks, trick];
      newState.computerScore += this.calculateTrickValue(trick);
      newState.currentTurn = 'computer';
    }
    
    // Clear current trick
    newState.currentTrick = [];
    
    // Check if round is over (both hands empty)
    if (newState.playerHand.length === 0 && newState.computerHand.length === 0) {
      newState = this.checkGameEnd(newState);
    }
    
    return newState;
  }

  /**
   * Calculate the point value of a trick
   */
  private calculateTrickValue(trick: Card[]): number {
    return trick.reduce((sum, card) => sum + card.value, 0);
  }

  /**
   * Check if the game has ended and determine winner
   */
  private checkGameEnd(gameState: LocalGameState): LocalGameState {
    let newState = { ...gameState };
    
    // Game ends when all cards are played
    if (newState.playerScore > newState.computerScore) {
      newState.status = 'won';
      newState.winnerId = 'player';
    } else if (newState.computerScore > newState.playerScore) {
      newState.status = 'won';
      newState.winnerId = 'computer';
    } else {
      newState.status = 'draw';
    }
    
    return newState;
  }
}

export const blotAIService = new BlotAIService();
export type { LocalGameState, Card };
