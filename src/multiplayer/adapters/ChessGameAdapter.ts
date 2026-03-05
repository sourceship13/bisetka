/**
 * Chess Game Adapter
 * 
 * Connects chess game logic to the multiplayer system
 */

import type { GameAdapter, PlayerColor } from '../types';
import {
  ChessGameState,
  initializeChessGame,
  makeMove as makeChessMove,
  type Position,
} from '../../game/chessLogic';

export interface ChessMove {
  from: Position;
  to: Position;
}

export const chessAdapter: GameAdapter<ChessGameState, ChessMove> = {
  /**
   * Initialize chess game from server data
   */
  initializeGame(serverData: any): ChessGameState {
    // Server may send full gameState or just metadata
    if (serverData.board) {
      return serverData as ChessGameState;
    }
    
    // If server doesn't send board, initialize fresh game
    return initializeChessGame('medium');
  },
  
  /**
   * Apply a chess move to current state
   */
  applyMove(currentState: ChessGameState, move: ChessMove): ChessGameState {
    const newBoard = makeChessMove(currentState.board, move);
    
    // Update game state (check/checkmate logic handled by makeChessMove)
    return {
      ...currentState,
      board: newBoard,
      currentPlayer: currentState.currentPlayer === 'white' ? 'black' : 'white',
      selectedSquare: null,
      possibleMoves: [],
    };
  },
  
  /**
   * Get current player turn
   */
  getCurrentTurn(gameState: ChessGameState): PlayerColor {
    return gameState.currentPlayer;
  },
  
  /**
   * Check if game is over
   */
  isGameOver(gameState: ChessGameState): boolean {
    return gameState.isCheckmate || gameState.isStalemate;
  },
  
  /**
   * Get winner (returns player color or null for draw)
   */
  getWinner(gameState: ChessGameState): string | null {
    if (gameState.isCheckmate) {
      // Winner is the opposite of current player (who is in checkmate)
      return gameState.currentPlayer === 'white' ? 'black' : 'white';
    }
    
    if (gameState.isStalemate) {
      return null; // Draw
    }
    
    return null;
  },
};
