import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  GameMode,
  NardiGameState,
  initializeNardiGame,
  rollDice,
  calculatePossibleMoves,
  executeMove,
  switchPlayer,
  Move,
} from '../game/nardiLogic';
import Checker from '../components/Checker';

type OpponentType = 'ai' | 'random' | 'private' | 'local';

const NardiScreen = ({navigation, route}: any) => {
  // Extract session mode from route params (if coming from GameModeScreen)
  const routeMode = route?.params?.mode;
  const opponentType: OpponentType = routeMode === 'ai' ? 'ai' : 'local';
  
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [gameState, setGameState] = useState<NardiGameState | null>(null);

  const startGame = (mode: GameMode) => {
    setSelectedMode(mode);
    setGameState(initializeNardiGame(mode));
  };

  // AI turn handler - executes AI moves when it's black's turn in AI mode
  const executeAITurn = useCallback(() => {
    if (!gameState || gameState.phase === 'gameOver' || gameState.winner) return;
    if (opponentType !== 'ai' || gameState.currentPlayer !== 'black') return;

    if (gameState.phase === 'rolling') {
      // AI rolls dice
      const dice = rollDice();
      const newState = {
        ...gameState,
        dice,
        phase: 'moving' as const,
      };
      
      const moves = calculatePossibleMoves(newState);
      
      if (moves.length === 0) {
        // No moves available, switch player
        setTimeout(() => {
          setGameState(switchPlayer(newState));
        }, 1000);
      } else {
        setGameState({
          ...newState,
          possibleMoves: moves,
        });
      }
    } else if (gameState.phase === 'moving') {
      // AI makes a move
      const moves = gameState.possibleMoves;
      if (moves.length === 0) {
        setGameState(switchPlayer(gameState));
        return;
      }

      // Pick a random move (simple AI)
      const move = moves[Math.floor(Math.random() * moves.length)];
      const newState = executeMove(gameState, move);
      
      // Remove used die
      const usedDieValue = move.to >= 24 || move.to < 0 
        ? (gameState.currentPlayer === 'white' ? 24 - move.from : move.from + 1)
        : Math.abs(move.to - move.from);
      let newDice = { ...newState.dice };
      
      if (newDice.die1 === usedDieValue) {
        newDice.die1 = 0;
      } else if (newDice.die2 === usedDieValue) {
        newDice.die2 = 0;
      } else {
        // For doubles or bearing off with higher die, consume first available
        if (newDice.die1 > 0) {
          newDice.die1 = 0;
        } else if (newDice.die2 > 0) {
          newDice.die2 = 0;
        }
      }

      const updatedState = { ...newState, dice: newDice };
      
      // Check if any dice left
      if (newDice.die1 === 0 && newDice.die2 === 0) {
        // Turn complete
        setTimeout(() => {
          setGameState(switchPlayer(updatedState));
        }, 500);
      } else {
        // Continue making moves
        const remainingMoves = calculatePossibleMoves(updatedState);
        if (remainingMoves.length === 0) {
          setTimeout(() => {
            setGameState(switchPlayer(updatedState));
          }, 500);
        } else {
          setGameState({
            ...updatedState,
            possibleMoves: remainingMoves,
            selectedPoint: null,
          });
        }
      }
    }
  }, [gameState, opponentType]);

  // UseEffect to trigger AI turns
  useEffect(() => {
    if (opponentType === 'ai' && gameState?.currentPlayer === 'black' && !gameState?.winner) {
      const timer = setTimeout(() => {
        executeAITurn();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [gameState, opponentType, executeAITurn]);

  const handleRollDice = () => {
    if (!gameState || gameState.phase !== 'rolling') return;
    // Don't allow rolling during AI's turn
    if (opponentType === 'ai' && gameState.currentPlayer === 'black') return;

    const dice = rollDice();
    const newState = {
      ...gameState,
      dice,
      phase: 'moving' as const,
    };
    
    const moves = calculatePossibleMoves(newState);
    
    if (moves.length === 0) {
      // No moves available, switch player
      Alert.alert('No Moves', 'No valid moves available. Turn passes.');
      setTimeout(() => {
        setGameState(switchPlayer(newState));
      }, 1500);
    } else {
      setGameState({
        ...newState,
        possibleMoves: moves,
      });
    }
  };

  const handlePointPress = (pointIndex: number) => {
    if (!gameState || gameState.phase !== 'moving') return;
    // Don't allow moves during AI's turn
    if (opponentType === 'ai' && gameState.currentPlayer === 'black') return;

    const point = gameState.points[pointIndex];
    const hasCurrentPlayerChecker = point.checkers.length > 0 && 
      point.checkers[point.checkers.length - 1] === gameState.currentPlayer;

    if (gameState.selectedPoint === null && hasCurrentPlayerChecker) {
      // Select this point
      setGameState({ ...gameState, selectedPoint: pointIndex });
    } else if (gameState.selectedPoint !== null) {
      // Try to move to this point
      const move = gameState.possibleMoves.find(
        m => m.from === gameState.selectedPoint && m.to === pointIndex
      );

      if (move) {
        executePlayerMove(move);
      } else {
        // Deselect or select new point
        if (hasCurrentPlayerChecker) {
          setGameState({ ...gameState, selectedPoint: pointIndex });
        } else {
          setGameState({ ...gameState, selectedPoint: null });
        }
      }
    }
  };

  const executePlayerMove = (move: Move) => {
    if (!gameState) return;

    const newState = executeMove(gameState, move);
    
    // Calculate used die value - handle bearing off specially
    const isBearingOff = move.to >= 24 || move.to < 0;
    const usedDieValue = isBearingOff
      ? (gameState.currentPlayer === 'white' ? 24 - move.from : move.from + 1)
      : Math.abs(move.to - move.from);
    
    let newDice = { ...newState.dice };
    
    if (newDice.die1 === usedDieValue) {
      newDice.die1 = 0;
    } else if (newDice.die2 === usedDieValue) {
      newDice.die2 = 0;
    } else {
      // For doubles or bearing off with higher die, consume first available
      if (newDice.die1 > 0) {
        newDice.die1 = 0;
      } else if (newDice.die2 > 0) {
        newDice.die2 = 0;
      }
    }

    const updatedState = { ...newState, dice: newDice };
    
    // Check if any moves left
    if (newDice.die1 === 0 && newDice.die2 === 0) {
      // Turn complete
      setTimeout(() => {
        setGameState(switchPlayer(updatedState));
      }, 500);
    } else {
      // Recalculate possible moves
      const moves = calculatePossibleMoves(updatedState);
      setGameState({
        ...updatedState,
        possibleMoves: moves,
        selectedPoint: null,
      });
    }
  };

  const resetGame = () => {
    setSelectedMode(null);
    setGameState(null);
  };

  // Mode selection screen
  if (!selectedMode || !gameState) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nardi</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.modeSelection}>
          <Text style={styles.modeTitle}>Select Game Mode</Text>
          
          <TouchableOpacity
            style={styles.modeButton}
            onPress={() => startGame('long')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.modeButtonTitle}>Long Nardi</Text>
            <Text style={styles.modeButtonDescription}>
              Traditional Armenian game. All pieces start at home. No hitting opponent pieces.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeButton}
            onPress={() => startGame('short')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.modeButtonTitle}>Short Nardi</Text>
            <Text style={styles.modeButtonDescription}>
              Similar to Western backgammon. Standard setup. Can hit opponent pieces.
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
        <Text style={styles.headerTitle}>Nardi - {selectedMode === 'long' ? 'Long' : 'Short'}</Text>
        <TouchableOpacity onPress={resetGame} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.newGameText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gameInfo}>
        <Text style={styles.playerText}>
          {gameState.currentPlayer === 'white' ? 'White' : 'Black'}'s Turn
        </Text>
        {gameState.dice.rolled && (
          <View style={styles.diceDisplay}>
            <View style={styles.die}>
              <Text style={styles.dieText}>{gameState.dice.die1 || '-'}</Text>
            </View>
            <View style={styles.die}>
              <Text style={styles.dieText}>{gameState.dice.die2 || '-'}</Text>
            </View>
          </View>
        )}
        {gameState.phase === 'rolling' && !(opponentType === 'ai' && gameState.currentPlayer === 'black') && (
          <TouchableOpacity style={styles.rollButton} onPress={handleRollDice} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.rollButtonText}>Roll Dice</Text>
          </TouchableOpacity>
        )}
        {opponentType === 'ai' && gameState.currentPlayer === 'black' && (
          <Text style={styles.aiThinkingText}>AI is thinking...</Text>
        )}
      </View>

      <ScrollView style={styles.boardContainer}>
        <View style={styles.board}>
          {/* Top half - points 12-23 */}
          <View style={styles.boardHalf}>
            <View style={styles.pointsRow}>
              {gameState.points.slice(12, 18).reverse().map((point, idx) => {
                const pointIndex = 17 - idx;
                return (
                  <TouchableOpacity
                    key={pointIndex}
                    style={[
                      styles.point,
                      pointIndex % 2 === 0 ? styles.pointDark : styles.pointLight,
                      gameState.selectedPoint === pointIndex && styles.pointSelected,
                    ]}
                    onPress={() => handlePointPress(pointIndex)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Text style={styles.pointNumber}>{pointIndex + 1}</Text>
                    {point.checkers.length > 0 && (
                      <Checker
                        color={point.checkers[0]}
                        count={point.checkers.length}
                        size="small"
                        highlighted={gameState.selectedPoint === pointIndex}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.pointsRow}>
              {gameState.points.slice(18, 24).reverse().map((point, idx) => {
                const pointIndex = 23 - idx;
                return (
                  <TouchableOpacity
                    key={pointIndex}
                    style={[
                      styles.point,
                      pointIndex % 2 === 0 ? styles.pointDark : styles.pointLight,
                      gameState.selectedPoint === pointIndex && styles.pointSelected,
                    ]}
                    onPress={() => handlePointPress(pointIndex)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Text style={styles.pointNumber}>{pointIndex + 1}</Text>
                    {point.checkers.length > 0 && (
                      <Checker
                        color={point.checkers[0]}
                        count={point.checkers.length}
                        size="small"
                        highlighted={gameState.selectedPoint === pointIndex}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Middle bar */}
          <View style={styles.bar}>
            <Text style={styles.barLabel}>Bar</Text>
          </View>

          {/* Bottom half - points 0-11 */}
          <View style={styles.boardHalf}>
            <View style={styles.pointsRow}>
              {gameState.points.slice(6, 12).map((point, idx) => {
                const pointIndex = 6 + idx;
                return (
                  <TouchableOpacity
                    key={pointIndex}
                    style={[
                      styles.point,
                      styles.pointBottom,
                      pointIndex % 2 === 0 ? styles.pointDark : styles.pointLight,
                      gameState.selectedPoint === pointIndex && styles.pointSelected,
                    ]}
                    onPress={() => handlePointPress(pointIndex)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    {point.checkers.length > 0 && (
                      <Checker
                        color={point.checkers[0]}
                        count={point.checkers.length}
                        size="small"
                        highlighted={gameState.selectedPoint === pointIndex}
                      />
                    )}
                    <Text style={styles.pointNumber}>{pointIndex + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.pointsRow}>
              {gameState.points.slice(0, 6).map((point, idx) => {
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.point,
                      styles.pointBottom,
                      idx % 2 === 0 ? styles.pointDark : styles.pointLight,
                      gameState.selectedPoint === idx && styles.pointSelected,
                    ]}
                    onPress={() => handlePointPress(idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    {point.checkers.length > 0 && (
                      <Checker
                        color={point.checkers[0]}
                        count={point.checkers.length}
                        size="small"
                        highlighted={gameState.selectedPoint === idx}
                      />
                    )}
                    <Text style={styles.pointNumber}>{idx + 1}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {gameState.winner && (
        <View style={styles.winnerOverlay}>
          <View style={styles.winnerBox}>
            <Text style={styles.winnerText}>{gameState.winner === 'white' ? 'White' : 'Black'} Wins!</Text>
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
    backgroundColor: '#8B4513',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#654321',
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
  modeSelection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 32,
  },
  modeButton: {
    backgroundColor: '#D2691E',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modeButtonTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  modeButtonDescription: {
    fontSize: 14,
    color: '#F5DEB3',
    lineHeight: 20,
  },
  gameInfo: {
    backgroundColor: '#654321',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  playerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
  },
  diceDisplay: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  die: {
    width: 50,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  dieText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  rollButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 32,
    marginTop: 12,
  },
  rollButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#654321',
  },
  aiThinkingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 12,
    fontStyle: 'italic',
  },
  boardContainer: {
    flex: 1,
  },
  board: {
    padding: 8,
  },
  boardHalf: {
    gap: 4,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  point: {
    width: 50,
    height: 140,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  pointBottom: {
    justifyContent: 'flex-end',
  },
  pointDark: {
    backgroundColor: '#654321',
  },
  pointLight: {
    backgroundColor: '#D2691E',
  },
  pointSelected: {
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  pointNumber: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  bar: {
    height: 40,
    backgroundColor: '#654321',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    borderWidth: 2,
    borderColor: '#333',
  },
  barLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  winnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  winnerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#654321',
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
    color: '#654321',
  },
});

export default NardiScreen;
