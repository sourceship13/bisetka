import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ImageBackground} from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GameToolbar from '../../../components/global/GameToolbar';
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
} from '../../../game/chessLogic';
import ChessPiece from '../../../components/ChessPiece';
import CardCustomizationModal from '../../../components/global/CardCustomizationModal';
import type { CardTheme } from '../../../components/global/CardCustomizationModal';
import { aiMoveLogService } from '../../../services/aiMoveLog.service';
import { v4 as uuidv4 } from 'uuid';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';

const ChessScreen = ({navigation}: any) => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [gameState, setGameState] = useState<ChessGameState | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const moveCountRef = useRef(0);
  const lastPlayerMoveRef = useRef<{ from: Position; to: Position; piece: string; captured?: string } | null>(null);
  useGameEndRefresh(!!(gameState?.isCheckmate || gameState?.isStalemate), 'chess');
  const [showCustomization, setShowCustomization] = useState(false);
  const [customTheme, setCustomTheme] = useState<CardTheme | undefined>(undefined);

  const handleSaveTheme = (theme: CardTheme) => {
    setCustomTheme(theme);
  };

  useEffect(() => {
    // Computer's turn
    if (gameState && gameState.currentPlayer === 'black' && !gameState.isCheckmate && !gameState.isStalemate) {
      const boardBefore = gameState.board;
      const timer = setTimeout(() => {
        // Get computer move using current gameState
        const computerMove = getComputerMove(gameState.board, gameState.difficulty, 'black');
        if (computerMove) {
          const aiPiece = gameState.board[computerMove.from.row][computerMove.from.col];
          const capturedPiece = gameState.board[computerMove.to.row][computerMove.to.col];
          
          // Execute move using functional update to avoid stale state
          setGameState(prevState => {
            if (!prevState) return prevState;
            
            const newBoard = makeMove(prevState.board, { from: computerMove.from, to: computerMove.to });
            const nextPlayer = 'white';

            const isCheck = isKingInCheck(newBoard, nextPlayer);
            const isCheckMate = isCheckmate(newBoard, nextPlayer);
            const isStaleMate = isStalemate(newBoard, nextPlayer);

            // Log AI move after state update
            if (gameIdRef.current && lastPlayerMoveRef.current) {
              moveCountRef.current++;
              aiMoveLogService.logChessMove({
                gameId: gameIdRef.current,
                moveNumber: moveCountRef.current,
                playerMove: lastPlayerMoveRef.current,
                aiMove: {
                  from: computerMove.from,
                  to: computerMove.to,
                  piece: aiPiece?.type || 'unknown',
                  captured: capturedPiece?.type,
                },
                boardStateBefore: boardBefore,
                boardStateAfter: newBoard,
                difficulty: prevState.difficulty,
                isCheck,
                isCheckmate: isCheckMate,
              });
              lastPlayerMoveRef.current = null;
            }

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
    gameIdRef.current = uuidv4();
    moveCountRef.current = 0;
    lastPlayerMoveRef.current = null;
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

    // Capture player move info for AI logging
    const playerPiece = gameState.board[from.row][from.col];
    const capturedPiece = gameState.board[to.row][to.col];
    lastPlayerMoveRef.current = {
      from,
      to,
      piece: playerPiece?.type || 'unknown',
      captured: capturedPiece?.type,
    };

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
      BisetkaAlert.success('Checkmate!', `${gameState.currentPlayer === 'white' ? 'White' : 'Black'} wins!`);
    } else if (isStaleMate) {
      BisetkaAlert.alert('Stalemate!', 'Game is a draw.');
    } else if (isCheck) {
      BisetkaAlert.warning('Check!', `${nextPlayer === 'white' ? 'White' : 'Black'} is in check.`);
    }
  };

  const resetGame = () => {
    setDifficulty(null);
    setGameState(null);
    gameIdRef.current = null;
    moveCountRef.current = 0;
    lastPlayerMoveRef.current = null;
  };

  // Difficulty selection screen
  if (!difficulty || !gameState) {
    return (
      <ImageBackground
        source={require('../../../../assets/blot/park-background.png')}
        style={styles.container}
        blurRadius={3}
      >
        <LinearGradient
          colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']}
          style={styles.overlay}
        >
          <SafeAreaView style={styles.safeArea}>
            <GameToolbar title="Chess" onBack={() => navigation.goBack()} backgroundColor="transparent" />

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
        </LinearGradient>
      </ImageBackground>
    );
  }

  // Game screen
  return (
    <ImageBackground
      source={require('../../../../assets/blot/park-background.png')}
      style={styles.container}
      blurRadius={3}
    >
      <LinearGradient
        colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']}
        style={styles.overlay}
      >
        <SafeAreaView style={styles.safeArea}>
          <GameToolbar
            title={`Chess - ${difficulty}`}
            onBack={resetGame}
            backgroundColor="transparent"
            rightElement={
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => setShowCustomization(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.customizeText}>🎨</Text>
                </TouchableOpacity>
              </View>
            }
          />

      <View style={styles.statusBar}>
        <Text style={styles.turnText}>
          {gameState.currentPlayer === 'white' ? "Your Turn (White)" : "Computer's Turn (Black)"}
        </Text>
        {gameState.isCheck && <Text style={styles.checkText}>CHECK!</Text>}
      </View>

      <View style={styles.boardContainer}>
        <ImageBackground
          source={require('../../../../assets/chess/board.png')}
          style={styles.board}
          resizeMode="stretch"
        >
          <View style={styles.gridContainer}>
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
        </ImageBackground>
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
      </LinearGradient>

      <CardCustomizationModal
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onSave={handleSaveTheme}
        currentTheme={customTheme}
      />
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  newGameText: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  customizeText: {
    fontSize: 20,
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
  },
  board: {
    aspectRatio: 1,
    width: '100%',
    maxWidth: 500,
  },
  gridContainer: {
    flex: 1,
    paddingTop: 40,
    paddingBottom: 55,
    paddingHorizontal: 52,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  square: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  lightSquare: {
    backgroundColor: 'transparent',
  },
  darkSquare: {
    backgroundColor: 'transparent',
  },
  selectedSquare: {
    backgroundColor: 'rgba(127, 166, 80, 0.6)',
  },
  possibleMoveSquare: {
    backgroundColor: 'rgba(127, 166, 80, 0.4)',
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
