/**
 * Billiards Game Adapter
 * 
 * 8-ball and 9-ball pool variants
 * Uses real-time physics simulation
 */

import type { GameAdapter, PlayerColor } from '../types';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ball {
  id: number;
  number: number;
  pos: Vec2;
  vel: Vec2;
  color: string;
  stripe: boolean;
  pocketed: boolean;
  type: 'solid' | 'stripe' | 'cue' | 'eight';
  rotation: number;
}

export interface BilliardsGameState {
  balls: Ball[];
  playerTurn: boolean; // true = white's turn, false = black's turn
  playerType: 'solid' | 'stripe' | null; // assigned after first legal pocket
  aiType: 'solid' | 'stripe' | null;
  pocketedSolids: Ball[];
  pocketedStripes: Ball[];
  ballInHand: boolean; // player can place cue ball (after foul)
  variant: '8-ball' | '9-ball';
  isMoving: boolean;
  gameOver: boolean;
  winner: 'player' | 'ai' | null;
}

export interface BilliardsMove {
  balls: Ball[]; // Full ball state after shot settles
  playerTurn: boolean;
  playerType?: 'solid' | 'stripe' | null;
  aiType?: 'solid' | 'stripe' | null;
  ballInHand?: boolean;
}

export const billiardsAdapter: GameAdapter<BilliardsGameState, BilliardsMove> = {
  /**
   * Initialize billiards game
   */
  initializeGame(serverData: any): BilliardsGameState {
    return {
      balls: serverData.balls || [],
      playerTurn: serverData.playerTurn !== undefined ? serverData.playerTurn : true,
      playerType: serverData.playerType || null,
      aiType: serverData.aiType || null,
      pocketedSolids: serverData.pocketedSolids || [],
      pocketedStripes: serverData.pocketedStripes || [],
      ballInHand: serverData.ballInHand || false,
      variant: serverData.variant || '8-ball',
      isMoving: false,
      gameOver: serverData.gameOver || false,
      winner: serverData.winner || null,
    };
  },

  /**
   * Apply billiards move (full state update)
   * Billiards sends complete ball positions after physics settle
   */
  applyMove(currentState: BilliardsGameState, move: BilliardsMove): BilliardsGameState {
    return {
      ...currentState,
      balls: move.balls,
      playerTurn: move.playerTurn,
      playerType: move.playerType !== undefined ? move.playerType : currentState.playerType,
      aiType: move.aiType !== undefined ? move.aiType : currentState.aiType,
      ballInHand: move.ballInHand !== undefined ? move.ballInHand : currentState.ballInHand,
      pocketedSolids: move.balls.filter(b => b.pocketed && b.type === 'solid'),
      pocketedStripes: move.balls.filter(b => b.pocketed && b.type === 'stripe'),
      isMoving: false,
    };
  },

  /**
   * Get current turn
   */
  getCurrentTurn(gameState: BilliardsGameState): PlayerColor {
    return gameState.playerTurn ? 'white' : 'black';
  },

  /**
   * Check if game is over
   */
  isGameOver(gameState: BilliardsGameState): boolean {
    return gameState.gameOver;
  },

  /**
   * Get winner
   */
  getWinner(gameState: BilliardsGameState): string | null {
    if (!gameState.winner) return null;
    return gameState.winner === 'player' ? 'white' : 'black';
  },
};
