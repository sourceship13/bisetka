/**
 * Mrotsi Game Adapter
 * 
 * Mrotsi is a simultaneous dice-rolling game (5 rounds)
 * Each player rolls 5 dice per round, highest score wins the round
 */

import type { GameAdapter, PlayerColor } from '../types';

export interface MrotsiGameState {
  player1Score: number;
  player2Score: number;
  currentRound: number;
  totalRounds: number;
  player1Dice: number[] | null;
  player2Dice: number[] | null;
  player1RoundScore: number | null;
  player2RoundScore: number | null;
  player1Combination: string | null;
  player2Combination: string | null;
}

export interface MrotsiMove {
  type: 'roll_dice';
  dice: number[];
  score: number;
  combination: string;
}

export const mrotsiAdapter: GameAdapter<MrotsiGameState, MrotsiMove> = {
  /**
   * Initialize Mrotsi game from server data
   */
  initializeGame(serverData: any): MrotsiGameState {
    return {
      player1Score: serverData.player1Score || 0,
      player2Score: serverData.player2Score || 0,
      currentRound: serverData.currentRound || 1,
      totalRounds: serverData.totalRounds || 5,
      player1Dice: serverData.player1Dice || null,
      player2Dice: serverData.player2Dice || null,
      player1RoundScore: serverData.player1RoundScore || null,
      player2RoundScore: serverData.player2RoundScore || null,
      player1Combination: serverData.player1Combination || null,
      player2Combination: serverData.player2Combination || null,
    };
  },

  /**
   * Apply a dice roll move
   * Note: Mrotsi uses server-side state management for round completion
   */
  applyMove(currentState: MrotsiGameState, move: MrotsiMove): MrotsiGameState {
    // The server tells us the full updated state via move_made event
    // This adapter just returns the state as-is since moves are reconciled server-side
    return currentState;
  },

  /**
   * Get current turn
   * Mrotsi is simultaneous, so we return white as default
   * (actual turn logic is managed by whether each player has rolled)
   */
  getCurrentTurn(gameState: MrotsiGameState): PlayerColor {
    return 'white';
  },

  /**
   * Check if game is over (all rounds complete)
   */
  isGameOver(gameState: MrotsiGameState): boolean {
    return gameState.currentRound > gameState.totalRounds;
  },

  /**
   * Get winner based on total score
   */
  getWinner(gameState: MrotsiGameState): string | null {
    if (!this.isGameOver(gameState)) return null;

    if (gameState.player1Score > gameState.player2Score) return 'white';
    if (gameState.player2Score > gameState.player1Score) return 'black';
    return null; // Draw
  },
};
