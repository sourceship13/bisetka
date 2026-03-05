/**
 * Nardi (Backgammon variant) Game Adapter
 * 
 * Nardi is a complex backgammon-style game with dice rolls and piece movement
 */

import type { GameAdapter, PlayerColor } from '../types';

export interface NardiMove {
  type: 'roll_dice' | 'move_piece' | 'end_turn';
  dice?: { die1: number; die2: number };
  from?: number;
  to?: number;
}

export interface NardiGameState {
  points: Array<{ checkers: ('white' | 'black')[] }>;
  bar: { white: number; black: number };
  home: { white: number; black: number };
  currentPlayer: 'white' | 'black';
  dice: { die1: number; die2: number; rolled: boolean };
  phase: 'rolling' | 'moving';
  movesRemaining: number;
  possibleMoves: Array<{ from: number; to: number }>;
  winner: 'white' | 'black' | null;
}

export const nardiAdapter: GameAdapter<NardiGameState, NardiMove> = {
  /**
   * Initialize Nardi game from server data
   */
  initializeGame(serverData: any): NardiGameState {
    // Server sends full game state
    if (serverData.points) {
      return serverData as NardiGameState;
    }

    // Fallback: initialize empty state (shouldn't happen with proper server)
    return {
      points: Array(24)
        .fill(null)
        .map(() => ({ checkers: [] })),
      bar: { white: 0, black: 0 },
      home: { white: 0, black: 0 },
      currentPlayer: 'white',
      dice: { die1: 0, die2: 0, rolled: false },
      phase: 'rolling',
      movesRemaining: 0,
      possibleMoves: [],
      winner: null,
    };
  },

  /**
   * Apply a Nardi move
   * Server handles all game logic, we just reflect state updates
   */
  applyMove(currentState: NardiGameState, move: NardiMove): NardiGameState {
    // Server sends full updated state via move_made event
    // This is just for type safety
    return currentState;
  },

  /**
   * Get current turn
   */
  getCurrentTurn(gameState: NardiGameState): PlayerColor {
    return gameState.currentPlayer;
  },

  /**
   * Check if game is over (one player moved all 15 checkers home)
   */
  isGameOver(gameState: NardiGameState): boolean {
    return gameState.winner !== null;
  },

  /**
   * Get winner
   */
  getWinner(gameState: NardiGameState): string | null {
    return gameState.winner;
  },
};
