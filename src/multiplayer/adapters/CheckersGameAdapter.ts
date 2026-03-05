/**
 * Checkers Game Adapter
 * 
 * Connects checkers game logic to the multiplayer system
 */

import type { GameAdapter, PlayerColor } from '../types';

export interface Position {
  row: number;
  col: number;
}

export interface CheckersPiece {
  color: 'red' | 'black';
  type: 'regular' | 'king';
}

export interface CheckersGameState {
  board: (CheckersPiece | null)[][];
  currentPlayer: 'red' | 'black';
  selectedSquare: Position | null;
  possibleMoves: Position[];
  isGameOver: boolean;
  winner: 'red' | 'black' | null;
}

export interface CheckersMove {
  from: Position;
  to: Position;
}

/**
 * Deserialize board from server format
 */
function deserializeBoard(raw: any[][]): (CheckersPiece | null)[][] {
  return raw.map(row =>
    row.map(cell =>
      cell ? { color: cell.color as 'red' | 'black', type: cell.type as 'regular' | 'king' } : null
    )
  );
}

/**
 * Initialize fresh checkers board
 */
function initializeBoard(): (CheckersPiece | null)[][] {
  const board: (CheckersPiece | null)[][] = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  // Black pieces (top 3 rows)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        board[r][c] = { color: 'black', type: 'regular' };
      }
    }
  }

  // Red pieces (bottom 3 rows)
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        board[r][c] = { color: 'red', type: 'regular' };
      }
    }
  }

  return board;
}

/**
 * Apply a move to the board
 */
function applyMove(
  board: (CheckersPiece | null)[][],
  from: Position,
  to: Position
): (CheckersPiece | null)[][] {
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[from.row][from.col];
  if (!piece) return newBoard;

  // Move piece
  newBoard[to.row][to.col] = piece;
  newBoard[from.row][from.col] = null;

  // Remove jumped piece (if any)
  if (Math.abs(to.row - from.row) === 2) {
    const midRow = (from.row + to.row) / 2;
    const midCol = (from.col + to.col) / 2;
    newBoard[midRow][midCol] = null;
  }

  // Promote to king
  if (piece.color === 'red' && to.row === 0) {
    newBoard[to.row][to.col] = { color: 'red', type: 'king' };
  }
  if (piece.color === 'black' && to.row === 7) {
    newBoard[to.row][to.col] = { color: 'black', type: 'king' };
  }

  return newBoard;
}

/**
 * Check if a player has any valid moves left
 */
function hasAnyMoves(board: (CheckersPiece | null)[][], color: 'red' | 'black'): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        // Simplified move check — in real game would use getPossibleMoves
        const dirs =
          piece.type === 'king'
            ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
            : piece.color === 'red'
            ? [[-1, -1], [-1, 1]]
            : [[1, -1], [1, 1]];

        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !board[nr][nc]) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export const checkersAdapter: GameAdapter<CheckersGameState, CheckersMove> = {
  /**
   * Initialize checkers game from server data
   */
  initializeGame(serverData: any): CheckersGameState {
    // Server may send full gameState or just board
    if (serverData.board) {
      return {
        board: Array.isArray(serverData.board[0])
          ? deserializeBoard(serverData.board)
          : serverData.board,
        currentPlayer: serverData.currentPlayer || 'red',
        selectedSquare: null,
        possibleMoves: [],
        isGameOver: serverData.isGameOver || false,
        winner: serverData.winner || null,
      };
    }

    // Initialize fresh game
    return {
      board: initializeBoard(),
      currentPlayer: 'red',
      selectedSquare: null,
      possibleMoves: [],
      isGameOver: false,
      winner: null,
    };
  },

  /**
   * Apply a checkers move to current state
   */
  applyMove(currentState: CheckersGameState, move: CheckersMove): CheckersGameState {
    const newBoard = applyMove(currentState.board, move.from, move.to);
    const nextPlayer: 'red' | 'black' = currentState.currentPlayer === 'red' ? 'black' : 'red';
    const hasMovesLeft = hasAnyMoves(newBoard, nextPlayer);

    return {
      ...currentState,
      board: newBoard,
      currentPlayer: nextPlayer,
      selectedSquare: null,
      possibleMoves: [],
      isGameOver: !hasMovesLeft,
      winner: !hasMovesLeft ? currentState.currentPlayer : null,
    };
  },

  /**
   * Get current player turn
   */
  getCurrentTurn(gameState: CheckersGameState): PlayerColor {
    // Map checkers colors to PlayerColor (red → white, black → black)
    return gameState.currentPlayer === 'red' ? 'white' : 'black';
  },

  /**
   * Check if game is over
   */
  isGameOver(gameState: CheckersGameState): boolean {
    return gameState.isGameOver;
  },

  /**
   * Get winner (returns color or null for draw)
   */
  getWinner(gameState: CheckersGameState): string | null {
    if (!gameState.winner) return null;
    // Map checkers winner to PlayerColor
    return gameState.winner === 'red' ? 'white' : 'black';
  },
};
