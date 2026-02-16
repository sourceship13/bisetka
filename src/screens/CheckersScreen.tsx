import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PieceType = 'regular' | 'king';
type PieceColor = 'red' | 'black';

interface Piece {
  color: PieceColor;
  type: PieceType;
}

interface Position {
  row: number;
  col: number;
}

interface GameState {
  board: (Piece | null)[][];
  currentPlayer: PieceColor;
  selectedSquare: Position | null;
  possibleMoves: Position[];
  gameMode: 'ai' | 'random' | 'private';
  isGameOver: boolean;
  winner: PieceColor | null;
}

const CheckersScreen = ({navigation, route}: any) => {
  const {session, gameType, mode} = route.params;
  const [gameState, setGameState] = useState<GameState>(initializeGame(mode));

  useEffect(() => {
    // AI's turn
    if (gameState.gameMode === 'ai' && gameState.currentPlayer === 'black' && !gameState.isGameOver) {
      setTimeout(() => {
        makeAIMove();
      }, 500);
    }
  }, [gameState.currentPlayer]);

  function initializeGame(mode: string): GameState {
    const board: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Place black pieces (top)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          board[row][col] = { color: 'black', type: 'regular' };
        }
      }
    }
    
    // Place red pieces (bottom)
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          board[row][col] = { color: 'red', type: 'regular' };
        }
      }
    }

    return {
      board,
      currentPlayer: 'red',
      selectedSquare: null,
      possibleMoves: [],
      gameMode: mode === 'ai' ? 'ai' : mode === 'random' ? 'random' : 'private',
      isGameOver: false,
      winner: null,
    };
  }

  function getPossibleMoves(board: (Piece | null)[][], pos: Position): Position[] {
    const piece = board[pos.row][pos.col];
    if (!piece) return [];

    const moves: Position[] = [];
    const directions = piece.type === 'king' 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] 
      : piece.color === 'red' 
        ? [[-1, -1], [-1, 1]] 
        : [[1, -1], [1, 1]];

    for (const [dr, dc] of directions) {
      const newRow = pos.row + dr;
      const newCol = pos.col + dc;
      
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        if (!board[newRow][newCol]) {
          moves.push({ row: newRow, col: newCol });
        } else if (board[newRow][newCol]?.color !== piece.color) {
          // Check for jump
          const jumpRow = newRow + dr;
          const jumpCol = newCol + dc;
          if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8 && !board[jumpRow][jumpCol]) {
            moves.push({ row: jumpRow, col: jumpCol });
          }
        }
      }
    }

    return moves;
  }

  function makeMove(from: Position, to: Position) {
    const newBoard = gameState.board.map(row => [...row]);
    const piece = newBoard[from.row][from.col];
    if (!piece) return;

    // Check if it's a jump
    if (Math.abs(to.row - from.row) === 2) {
      const jumpedRow = (from.row + to.row) / 2;
      const jumpedCol = (from.col + to.col) / 2;
      newBoard[jumpedRow][jumpedCol] = null; // Remove jumped piece
    }

    // Move piece
    newBoard[to.row][to.col] = piece;
    newBoard[from.row][from.col] = null;

    // Check for king promotion
    if (piece.color === 'red' && to.row === 0) {
      newBoard[to.row][to.col] = { ...piece, type: 'king' };
    } else if (piece.color === 'black' && to.row === 7) {
      newBoard[to.row][to.col] = { ...piece, type: 'king' };
    }

    // Check for game over
    const nextPlayer = gameState.currentPlayer === 'red' ? 'black' : 'red';
    const hasMovesLeft = checkIfPlayerHasMoves(newBoard, nextPlayer);

    setGameState({
      ...gameState,
      board: newBoard,
      currentPlayer: nextPlayer,
      selectedSquare: null,
      possibleMoves: [],
      isGameOver: !hasMovesLeft,
      winner: !hasMovesLeft ? gameState.currentPlayer : null,
    });

    if (!hasMovesLeft) {
      Alert.alert('Game Over!', `${gameState.currentPlayer === 'red' ? 'Red' : 'Black'} wins!`);
    }
  }

  function checkIfPlayerHasMoves(board: (Piece | null)[][], player: PieceColor): boolean {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === player) {
          const moves = getPossibleMoves(board, { row, col });
          if (moves.length > 0) return true;
        }
      }
    }
    return false;
  }

  function makeAIMove() {
    const allMoves: Array<{ from: Position; to: Position }> = [];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col];
        if (piece && piece.color === 'black') {
          const moves = getPossibleMoves(gameState.board, { row, col });
          moves.forEach(move => {
            allMoves.push({ from: { row, col }, to: move });
          });
        }
      }
    }

    if (allMoves.length > 0) {
      const randomMove = allMoves[Math.floor(Math.random() * allMoves.length)];
      makeMove(randomMove.from, randomMove.to);
    }
  }

  function handleSquarePress(row: number, col: number) {
    if (gameState.isGameOver || (gameState.gameMode === 'ai' && gameState.currentPlayer === 'black')) {
      return;
    }

    const piece = gameState.board[row][col];
    
    // If no square selected and clicked on own piece
    if (!gameState.selectedSquare && piece && piece.color === gameState.currentPlayer) {
      const moves = getPossibleMoves(gameState.board, { row, col });
      setGameState({
        ...gameState,
        selectedSquare: { row, col },
        possibleMoves: moves,
      });
      return;
    }

    // If square already selected
    if (gameState.selectedSquare) {
      const isValidMove = gameState.possibleMoves.some(
        m => m.row === row && m.col === col
      );

      if (isValidMove) {
        makeMove(gameState.selectedSquare, { row, col });
      } else if (piece && piece.color === gameState.currentPlayer) {
        // Select different piece
        const moves = getPossibleMoves(gameState.board, { row, col });
        setGameState({
          ...gameState,
          selectedSquare: { row, col },
          possibleMoves: moves,
        });
      } else {
        // Deselect
        setGameState({
          ...gameState,
          selectedSquare: null,
          possibleMoves: [],
        });
      }
    }
  }

  function resetGame() {
    setGameState(initializeGame(gameState.gameMode));
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkers {gameState.gameMode === 'ai' ? '(vs AI)' : ''}</Text>
        <TouchableOpacity onPress={resetGame} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.newGameText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.turnText}>
          {gameState.currentPlayer === 'red' ? "Your Turn (Red)" : gameState.gameMode === 'ai' ? "AI's Turn (Black)" : "Black's Turn"}
        </Text>
      </View>

      <View style={styles.boardContainer}>
        <View style={styles.board}>
          {gameState.board.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((piece, colIndex) => {
                const isLight = (rowIndex + colIndex) % 2 === 0;
                const isSelected = gameState.selectedSquare?.row === rowIndex && 
                                  gameState.selectedSquare?.col === colIndex;
                const isPossibleMove = gameState.possibleMoves.some(
                  m => m.row === rowIndex && m.col === colIndex
                );

                return (
                  <TouchableOpacity
                    key={`${rowIndex}-${colIndex}`}
                    style={[
                      styles.square,
                      isLight ? styles.lightSquare : styles.darkSquare,
                      isSelected && styles.selectedSquare,
                      isPossibleMove && styles.possibleMoveSquare,
                    ]}
                    onPress={() => handleSquarePress(rowIndex, colIndex)}
                    hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}>
                    {piece && (
                      <View style={[
                        styles.piece,
                        piece.color === 'red' ? styles.redPiece : styles.blackPiece,
                        piece.type === 'king' && styles.kingPiece,
                      ]}>
                        {piece.type === 'king' && <Text style={styles.kingText}>♔</Text>}
                      </View>
                    )}
                    {isPossibleMove && <View style={styles.moveIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {gameState.isGameOver && (
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverBox}>
            <Text style={styles.gameOverTitle}>Game Over!</Text>
            <Text style={styles.gameOverText}>
              {gameState.winner === 'red' ? 'You Win!' : 'You Lose!'}
            </Text>
            <TouchableOpacity style={styles.playAgainButton} onPress={resetGame} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2C3E50',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  newGameText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  statusBar: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#34495e',
  },
  turnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ecf0f1',
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  board: {
    width: '100%',
    maxWidth: 400,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#1a252f',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  square: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightSquare: {
    backgroundColor: '#f0d9b5',
  },
  darkSquare: {
    backgroundColor: '#b58863',
  },
  selectedSquare: {
    backgroundColor: '#829769',
  },
  possibleMoveSquare: {
    backgroundColor: '#646f40',
  },
  piece: {
    width: '70%',
    height: '70%',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  redPiece: {
    backgroundColor: '#e74c3c',
  },
  blackPiece: {
    backgroundColor: '#2c3e50',
  },
  kingPiece: {
    borderColor: '#f39c12',
    borderWidth: 3,
  },
  kingText: {
    fontSize: 24,
    color: '#f39c12',
  },
  moveIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 250,
  },
  gameOverTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  gameOverText: {
    fontSize: 18,
    marginBottom: 20,
    color: '#34495e',
  },
  playAgainButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  playAgainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CheckersScreen;
