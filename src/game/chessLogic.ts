export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type PieceColor = 'white' | 'black';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ChessDrawReason = 'stalemate' | 'insufficient-material' | 'perpetual-check';

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  hasMoved: boolean;
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  capturedPiece?: ChessPiece;
  promotion?: PieceType;
  isEnPassant?: boolean;
  isCastling?: boolean;
}

export interface ChessGameState {
  board: (ChessPiece | null)[][];
  currentPlayer: PieceColor;
  selectedSquare: Position | null;
  possibleMoves: Position[];
  moveHistory: Move[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  drawReason: ChessDrawReason | null;
  difficulty: Difficulty;
}

// Initialize chess board
export const initializeBoard = (): (ChessPiece | null)[][] => {
  const board: (ChessPiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Black pieces (top)
  board[0] = [
    { type: 'rook', color: 'black', hasMoved: false },
    { type: 'knight', color: 'black', hasMoved: false },
    { type: 'bishop', color: 'black', hasMoved: false },
    { type: 'queen', color: 'black', hasMoved: false },
    { type: 'king', color: 'black', hasMoved: false },
    { type: 'bishop', color: 'black', hasMoved: false },
    { type: 'knight', color: 'black', hasMoved: false },
    { type: 'rook', color: 'black', hasMoved: false },
  ];
  board[1] = Array(8).fill(null).map(() => ({ type: 'pawn' as PieceType, color: 'black' as PieceColor, hasMoved: false }));
  
  // White pieces (bottom)
  board[6] = Array(8).fill(null).map(() => ({ type: 'pawn' as PieceType, color: 'white' as PieceColor, hasMoved: false }));
  board[7] = [
    { type: 'rook', color: 'white', hasMoved: false },
    { type: 'knight', color: 'white', hasMoved: false },
    { type: 'bishop', color: 'white', hasMoved: false },
    { type: 'queen', color: 'white', hasMoved: false },
    { type: 'king', color: 'white', hasMoved: false },
    { type: 'bishop', color: 'white', hasMoved: false },
    { type: 'knight', color: 'white', hasMoved: false },
    { type: 'rook', color: 'white', hasMoved: false },
  ];
  
  return board;
};

// Get possible moves for a piece
export const getPossibleMoves = (
  board: (ChessPiece | null)[][],
  position: Position,
  includeChecks = true
): Position[] => {
  const piece = board[position.row][position.col];
  if (!piece) return [];
  
  let moves: Position[] = [];
  
  switch (piece.type) {
    case 'pawn':
      moves = getPawnMoves(board, position, piece);
      break;
    case 'knight':
      moves = getKnightMoves(board, position, piece);
      break;
    case 'bishop':
      moves = getBishopMoves(board, position, piece);
      break;
    case 'rook':
      moves = getRookMoves(board, position, piece);
      break;
    case 'queen':
      moves = getQueenMoves(board, position, piece);
      break;
    case 'king':
      moves = getKingMoves(board, position, piece);
      break;
  }
  
  // Filter out moves that would put own king in check
  if (includeChecks) {
    moves = moves.filter(move => {
      const testBoard = makeMove(board, { from: position, to: move });
      return !isKingInCheck(testBoard, piece.color);
    });
  }
  
  return moves;
};

const getPawnMoves = (board: (ChessPiece | null)[][], pos: Position, piece: ChessPiece): Position[] => {
  const moves: Position[] = [];
  const direction = piece.color === 'white' ? -1 : 1;
  const startRow = piece.color === 'white' ? 6 : 1;
  
  // Forward one
  const forward = { row: pos.row + direction, col: pos.col };
  if (isValidPosition(forward) && !board[forward.row][forward.col]) {
    moves.push(forward);
    
    // Forward two (from start)
    if (pos.row === startRow) {
      const forwardTwo = { row: pos.row + direction * 2, col: pos.col };
      if (!board[forwardTwo.row][forwardTwo.col]) {
        moves.push(forwardTwo);
      }
    }
  }
  
  // Captures
  [-1, 1].forEach(colOffset => {
    const capturePos = { row: pos.row + direction, col: pos.col + colOffset };
    if (isValidPosition(capturePos)) {
      const target = board[capturePos.row][capturePos.col];
      if (target && target.color !== piece.color) {
        moves.push(capturePos);
      }
    }
  });
  
  return moves;
};

const getKnightMoves = (board: (ChessPiece | null)[][], pos: Position, piece: ChessPiece): Position[] => {
  const moves: Position[] = [];
  const offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  
  offsets.forEach(([rowOff, colOff]) => {
    const newPos = { row: pos.row + rowOff, col: pos.col + colOff };
    if (isValidPosition(newPos)) {
      const target = board[newPos.row][newPos.col];
      if (!target || target.color !== piece.color) {
        moves.push(newPos);
      }
    }
  });
  
  return moves;
};

const getBishopMoves = (board: (ChessPiece | null)[][], pos: Position, piece: ChessPiece): Position[] => {
  return getSlidingMoves(board, pos, piece, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
};

const getRookMoves = (board: (ChessPiece | null)[][], pos: Position, piece: ChessPiece): Position[] => {
  return getSlidingMoves(board, pos, piece, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
};

const getQueenMoves = (board: (ChessPiece | null)[][], pos: Position, piece: ChessPiece): Position[] => {
  return getSlidingMoves(board, pos, piece, [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ]);
};

const getKingMoves = (board: (ChessPiece | null)[][], pos: Position, piece: ChessPiece): Position[] => {
  const moves: Position[] = [];
  const offsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  
  offsets.forEach(([rowOff, colOff]) => {
    const newPos = { row: pos.row + rowOff, col: pos.col + colOff };
    if (isValidPosition(newPos)) {
      const target = board[newPos.row][newPos.col];
      if (!target || target.color !== piece.color) {
        moves.push(newPos);
      }
    }
  });
  
  return moves;
};

const getSlidingMoves = (
  board: (ChessPiece | null)[][],
  pos: Position,
  piece: ChessPiece,
  directions: number[][]
): Position[] => {
  const moves: Position[] = [];
  
  directions.forEach(([rowDir, colDir]) => {
    let row = pos.row + rowDir;
    let col = pos.col + colDir;
    
    while (row >= 0 && row < 8 && col >= 0 && col < 8) {
      const target = board[row][col];
      if (!target) {
        moves.push({ row, col });
      } else {
        if (target.color !== piece.color) {
          moves.push({ row, col });
        }
        break;
      }
      row += rowDir;
      col += colDir;
    }
  });
  
  return moves;
};

const isValidPosition = (pos: Position): boolean => {
  return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
};

// Make a move on the board
export const makeMove = (
  board: (ChessPiece | null)[][],
  move: Move
): (ChessPiece | null)[][] => {
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[move.from.row][move.from.col];
  
  if (piece) {
    newBoard[move.to.row][move.to.col] = { ...piece, hasMoved: true };
    newBoard[move.from.row][move.from.col] = null;
    
    // Handle pawn promotion
    if (piece.type === 'pawn' && (move.to.row === 0 || move.to.row === 7)) {
      newBoard[move.to.row][move.to.col] = { 
        ...piece, 
        type: move.promotion || 'queen',
        hasMoved: true 
      };
    }
  }
  
  return newBoard;
};

// Check if king is in check
export const isKingInCheck = (board: (ChessPiece | null)[][], color: PieceColor): boolean => {
  // Find king position
  let kingPos: Position | null = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'king' && piece.color === color) {
        kingPos = { row, col };
        break;
      }
    }
    if (kingPos) break;
  }
  
  if (!kingPos) return false;
  
  // Check if any opponent piece can attack king
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color !== color) {
        const moves = getPossibleMoves(board, { row, col }, false);
        if (moves.some(m => m.row === kingPos!.row && m.col === kingPos!.col)) {
          return true;
        }
      }
    }
  }
  
  return false;
};

// Check if checkmate or stalemate
export const isCheckmate = (board: (ChessPiece | null)[][], color: PieceColor): boolean => {
  if (!isKingInCheck(board, color)) return false;
  return !hasLegalMoves(board, color);
};

export const isStalemate = (board: (ChessPiece | null)[][], color: PieceColor): boolean => {
  return getDrawReason(board, color) !== null;
};

export const getDrawReason = (
  board: (ChessPiece | null)[][],
  color: PieceColor
): ChessDrawReason | null => {
  if (hasOnlyKingsRemaining(board)) {
    return 'insufficient-material';
  }

  if (isKingInCheck(board, color)) {
    return null;
  }

  return !hasLegalMoves(board, color) ? 'stalemate' : null;
};

const hasLegalMoves = (board: (ChessPiece | null)[][], color: PieceColor): boolean => {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const moves = getPossibleMoves(board, { row, col });
        if (moves.length > 0) return true;
      }
    }
  }
  return false;
};

const hasOnlyKingsRemaining = (board: (ChessPiece | null)[][]): boolean => {
  const remainingPieces = board.flat().filter((piece): piece is ChessPiece => piece !== null);
  return remainingPieces.length === 2 && remainingPieces.every(piece => piece.type === 'king');
};

// AI move generation
export const getComputerMove = (
  board: (ChessPiece | null)[][],
  difficulty: Difficulty,
  color: PieceColor
): Move | null => {
  const allMoves: Move[] = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const moves = getPossibleMoves(board, { row, col });
        moves.forEach(to => {
          allMoves.push({ from: { row, col }, to, capturedPiece: board[to.row][to.col] || undefined });
        });
      }
    }
  }
  
  if (allMoves.length === 0) return null;
  
  if (difficulty === 'easy') {
    // Random move
    return allMoves[Math.floor(Math.random() * allMoves.length)];
  }
  
  // Medium/Hard: Prioritize captures and threatening moves
  const captureMoves = allMoves.filter(m => m.capturedPiece);
  
  if (difficulty === 'medium') {
    if (captureMoves.length > 0 && Math.random() > 0.3) {
      return captureMoves[Math.floor(Math.random() * captureMoves.length)];
    }
    return allMoves[Math.floor(Math.random() * allMoves.length)];
  }
  
  // Hard: Better evaluation
  const evaluatedMoves = allMoves.map(move => {
    let score = 0;
    if (move.capturedPiece) {
      score += getPieceValue(move.capturedPiece.type);
    }
    // Add some randomness
    score += Math.random() * 2;
    return { move, score };
  });
  
  evaluatedMoves.sort((a, b) => b.score - a.score);
  return evaluatedMoves[0].move;
};

const getPieceValue = (type: PieceType): number => {
  const values = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
  return values[type];
};

// Initialize game
export const initializeChessGame = (difficulty: Difficulty): ChessGameState => {
  return {
    board: initializeBoard(),
    currentPlayer: 'white',
    selectedSquare: null,
    possibleMoves: [],
    moveHistory: [],
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    drawReason: null,
    difficulty,
  };
};
