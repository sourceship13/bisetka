/**
 * Blot Game Adapter
 * 
 * Blot is a trick-taking card game (similar to Bridge/Whist)
 * Can be 2-player or 4-player team mode
 */

import type { GameAdapter, PlayerColor } from '../types';

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
}

export interface BlotGameState {
  // 2-player fields
  player1Hand?: Card[];
  player2Hand?: Card[];
  player1Score?: number;
  player2Score?: number;

  // 4-player team mode fields
  hands?: Card[][]; // indexed by position 0-3
  myHand?: Card[]; // server-filtered hand for this player
  whiteScore?: number; // team scores
  blackScore?: number;

  // Common fields
  currentTrick: Card[];
  trumpSuit: string | null;
  round: number;
  currentTurn: number | string; // position (0-3) in 4P, color in 2P
  deck?: Card[];
}

export interface BlotMove {
  card: Card;
  playerId: string;
}

export const blotAdapter: GameAdapter<BlotGameState, BlotMove> = {
  /**
   * Initialize Blot game from server data
   */
  initializeGame(serverData: any): BlotGameState {
    return {
      player1Hand: serverData.player1Hand || [],
      player2Hand: serverData.player2Hand || [],
      player1Score: serverData.player1Score || 0,
      player2Score: serverData.player2Score || 0,
      hands: serverData.hands || [],
      myHand: serverData.myHand || [],
      whiteScore: serverData.whiteScore || 0,
      blackScore: serverData.blackScore || 0,
      currentTrick: serverData.currentTrick || [],
      trumpSuit: serverData.trumpSuit || null,
      round: serverData.round || 1,
      currentTurn: serverData.currentTurn || 'white',
      deck: serverData.deck || [],
    };
  },

  /**
   * Apply a card play move
   * Server manages trick resolution, we just update state
   */
  applyMove(currentState: BlotGameState, move: BlotMove): BlotGameState {
    // Server sends full updated state via move_made
    return currentState;
  },

  /**
   * Get current turn
   */
  getCurrentTurn(gameState: BlotGameState): PlayerColor | number {
    // In 4-player mode, currentTurn is a position (0-3)
    if (typeof gameState.currentTurn === 'number') {
      return gameState.currentTurn;
    }
    // In 2-player mode, currentTurn is 'white' or 'black'
    return gameState.currentTurn as PlayerColor;
  },

  /**
   * Check if game is over
   * Game ends when one side reaches target score (usually 151 points)
   */
  isGameOver(gameState: BlotGameState): boolean {
    const TARGET_SCORE = 151;

    // 2-player
    if (gameState.player1Score !== undefined && gameState.player2Score !== undefined) {
      return gameState.player1Score >= TARGET_SCORE || gameState.player2Score >= TARGET_SCORE;
    }

    // 4-player teams
    if (gameState.whiteScore !== undefined && gameState.blackScore !== undefined) {
      return gameState.whiteScore >= TARGET_SCORE || gameState.blackScore >= TARGET_SCORE;
    }

    return false;
  },

  /**
   * Get winner
   */
  getWinner(gameState: BlotGameState): string | null {
    if (!this.isGameOver(gameState)) return null;

    // 2-player
    if (gameState.player1Score !== undefined && gameState.player2Score !== undefined) {
      return gameState.player1Score > gameState.player2Score ? 'white' : 'black';
    }

    // 4-player teams
    if (gameState.whiteScore !== undefined && gameState.blackScore !== undefined) {
      return gameState.whiteScore > gameState.blackScore ? 'white' : 'black';
    }

    return null;
  },
};
