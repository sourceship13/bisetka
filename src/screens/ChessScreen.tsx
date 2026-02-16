import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Difficulty,
  ChessGameState,
  initializeChessGame,
  getPossibleMoves,
  makeMove,
  isKingInCheck,
  isCheckmate,
  isStalemate,
  getComputerMove,
  Position,
} from '../game/chessLogic';
import ChessPiece from '../components/ChessPiece';

const ChessScreen = ({navigation}: any) => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [gameState, setGameState] = useState<ChessGameState | null>(null);

  useEffect(() => {
    // Computer's turn
    if (gameState && gameState.currentPlayer === 'black' && !gameState.isCheckmate && !gameState.isStalemate) {
      const timer = setTimeout(() => {
        // Get computer move using current gameState
        const computerMove = getComputerMove(gameState.board, gameState.difficulty, 'black');
        if (computerMove) {
          // Execute move using functional update to avoid stale state
          setGameState(prevState => {
            if (!prevState) return prevState;
            
            const newBoard = makeMove(prevState.board, { from: computerMove.from, to: computerMove.to });
            const nextPlayer = 'white';

            const isCheck = isKingInCheck(newBoard, nextPlayer);
            const isCheckMate = isCheckmate(newBoard, nextPlayer);
            const isStaleMate = isStalemate(newBoard, nextPlayer);

            return {
              ...prevState,
              board: newBoard,
              currentPlayer: nextPlayer,
              selectedSquare: null,
              possibleMoves: [],
              isCheck,
              isCheckmate: isCheckMate,
              isStalemate: isStaleMate,
            };
          });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const startGame = (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty);
    setGameState(initializeChessGame(selectedDifficulty));
  };

  const handleSquarePress = (row: number, col: number) => {
    if (!gameState || gameState.currentPlayer !== 'white' || gameState.isCheckmate || gameState.isStalemate) return;

    const position: Position = { row, col };
    const piece = gameState.board[row][col];

    // If no square selected and clicked on own piece
    if (!gameState.selectedSquare && piece && piece.color === 'white') {
      const moves = getPossibleMoves(gameState.board, position);
      setGameState({
        ...gameState,
        selectedSquare: position,
        possibleMoves: moves,
      });
      return;
    }

    // If square already selected
    if (gameState.selectedSquare) {
      // Check if this is a valid move
      const isValidMove = gameState.possibleMoves.some(
        m => m.row === row && m.col === col
      );

      if (isValidMove) {
        executeMove(gameState.selectedSquare, position);
      } else if (piece && piece.color === 'white') {
        // Select different piece
        const moves = getPossibleMoves(gameState.board, position);
        setGameState({
          ...gameState,
          selectedSquare: position,
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
  };

  const executeMove = (from: Position, to: Position) => {
    if (!gameState) return;

    const newBoard = makeMove(gameState.board, { from, to });
    const nextPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';

    const isCheck = isKingInCheck(newBoard, nextPlayer);
    const isCheckMate = isCheckmate(newBoard, nextPlayer);
    const isStaleMate = isStalemate(newBoard, nextPlayer);

    setGameState({
      ...gameState,
      board: newBoard,
      currentPlayer: nextPlayer,
      selectedSquare: null,
      possibleMoves: [],
      isCheck,
      isCheckmate: isCheckMate,
      isStalemate: isStaleMate,
      moveHistory: [...gameState.moveHistory, { from, to }],
    });

    if (isCheckMate) {
      Alert.alert('Checkmate!', `${gameState.currentPlayer === 'white' ? 'White' : 'Black'} wins!`);
    } else if (isStaleMate) {
      Alert.alert('Stalemate!', 'Game is a draw.');
    } else if (isCheck) {
      Alert.alert('Check!', `${nextPlayer === 'white' ? 'White' : 'Black'} is in check.`);
    }
  };

  const resetGame = () => {
    setDifficulty(null);
    setGameState(null);
  };

  // Difficulty selection screen
  if (!difficulty || !gameState) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chess</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.difficultySelection}>
          <Text style={styles.difficultyTitle}>Select Difficulty</Text>

          <TouchableOpacity
            style={[styles.difficultyButton, styles.easyButton]}
            onPress={() => startGame('easy')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.difficultyButtonTitle}>Easy</Text>
            <Text style={styles.difficultyButtonDescription}>
              Computer makes random moves
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.difficultyButton, styles.mediumButton]}
            onPress={() => startGame('medium')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.difficultyButtonTitle}>Medium</Text>
            <Text style={styles.difficultyButtonDescription}>
              Computer prefers captures
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.difficultyButton, styles.hardButton]}
            onPress={() => startGame('hard')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.difficultyButtonTitle}>Hard</Text>
            <Text style={styles.difficultyButtonDescription}>
              Computer evaluates best moves
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Game screen
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={resetGame} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chess - {difficulty}</Text>
        <TouchableOpacity onPress={resetGame} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.newGameText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.turnText}>
          {gameState.currentPlayer === 'white' ? "Your Turn (White)" : "Computer's Turn (Black)"}
        </Text>
        {gameState.isCheck && <Text style={styles.checkText}>CHECK!</Text>}
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
                    {piece && <ChessPiece type={piece.type} color={piece.color} />}
                    {isPossibleMove && <View style={styles.moveIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {(gameState.isCheckmate || gameState.isStalemate) && (
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverBox}>
            <Text style={styles.gameOverTitle}>
              {gameState.isCheckmate ? 'Checkmate!' : 'Stalemate!'}
            </Text>
            <Text style={styles.gameOverText}>
              {gameState.isCheckmate
                ? gameState.currentPlayer === 'black' ? 'You Win!' : 'Computer Wins!'
                : "It's a Draw!"}
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
    backgroundColor: '#312E2B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1C1917',
  },
  backButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  newGameText: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  difficultySelection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  difficultyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 32,
  },
  difficultyButton: {
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  easyButton: {
    backgroundColor: '#22C55E',
  },
  mediumButton: {
    backgroundColor: '#F59E0B',
  },
  hardButton: {
    backgroundColor: '#EF4444',
  },
  difficultyButtonTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  difficultyButtonDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  statusBar: {
    backgroundColor: '#1C1917',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  turnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  checkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 4,
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  board: {
    aspectRatio: 1,
    width: '100%',
    maxWidth: 500,
    borderWidth: 3,
    borderColor: '#1C1917',
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
    backgroundColor: '#F0D9B5',
  },
  darkSquare: {
    backgroundColor: '#B58863',
  },
  selectedSquare: {
    backgroundColor: '#7FA650',
  },
  possibleMoveSquare: {
    backgroundColor: 'rgba(127, 166, 80, 0.5)',
  },
  moveIndicator: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  gameOverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C1917',
    marginBottom: 16,
  },
  gameOverText: {
    fontSize: 20,
    color: '#312E2B',
    marginBottom: 24,
  },
  playAgainButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 32,
  },
  playAgainText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1917',
  },
});

export default ChessScreen;
