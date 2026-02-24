import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert, Animated} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameToolbar from '../components/GameToolbar';
import { aiMoveLogService } from '../services/aiMoveLog.service';
import { v4 as uuidv4 } from 'uuid';

interface GameState {
  playerDice: number[];
  opponentDice: number[];
  playerScore: number;
  opponentScore: number;
  currentRound: number;
  totalRounds: number;
  playerRolled: boolean;
  opponentRolled: boolean;
  gameMode: 'ai' | 'random' | 'private';
  isGameOver: boolean;
  winner: string | null;
}

const MrotsiScreen = ({navigation, route}: any) => {
  const {session, gameType, mode} = route.params || {};
  const [gameState, setGameState] = useState<GameState>(initializeGame(mode));
  const [diceAnimations] = useState(
    Array(5).fill(0).map(() => new Animated.Value(0))
  );
  const gameIdRef = useRef<string>(uuidv4());
  const lastPlayerDiceRef = useRef<{ dice: number[]; score: number } | null>(null);

  useEffect(() => {
    // AI opponent's turn - use full gameState to avoid stale closures in production builds
    if (gameState.gameMode === 'ai' && gameState.playerRolled && !gameState.opponentRolled && !gameState.isGameOver) {
      const currentRound = gameState.currentRound;
      const timer = setTimeout(() => {
        // Calculate AI dice roll inline to avoid stale closure
        const newDice = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ];
        
        // Calculate score for the dice
        const counts: {[key: number]: number} = {};
        newDice.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
        let aiScore = 0;
        const values = Object.entries(counts);
        for (const [value, count] of values) {
          if (count >= 3) {
            aiScore += parseInt(value) * count;
          }
        }
        if (aiScore === 0) {
          aiScore = Math.max(...newDice);
        }
        
        setGameState(prevState => {
          // Double-check we should still make this move
          if (prevState.opponentRolled || prevState.isGameOver) {
            return prevState;
          }
          
          const newOpponentScore = prevState.opponentScore + aiScore;
          const newPlayerScore = prevState.playerScore;
          
          // Log AI move
          if (lastPlayerDiceRef.current) {
            const playerDiceData = lastPlayerDiceRef.current;
            const roundWinner = playerDiceData.score > aiScore ? 'player' : 
                               playerDiceData.score < aiScore ? 'opponent' : 'tie';
            
            aiMoveLogService.logMrotsiMove({
              gameId: gameIdRef.current,
              roundNumber: currentRound,
              playerDice: playerDiceData.dice,
              playerScore: playerDiceData.score,
              aiDice: newDice,
              aiScore: aiScore,
              roundWinner,
              playerTotalScore: newPlayerScore,
              aiTotalScore: newOpponentScore,
            });
            lastPlayerDiceRef.current = null;
          }
          
          return {
            ...prevState,
            opponentDice: newDice,
            opponentScore: newOpponentScore,
            opponentRolled: true,
          };
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  useEffect(() => {
    // Check if round is complete (both players rolled)
    if (gameState.playerRolled && gameState.opponentRolled && !gameState.isGameOver) {
      if (gameState.currentRound >= gameState.totalRounds) {
        // Game over
        const winner = gameState.playerScore > gameState.opponentScore 
          ? 'player' 
          : gameState.playerScore < gameState.opponentScore 
            ? 'opponent' 
            : 'tie';
        
        setGameState(prev => ({
          ...prev,
          isGameOver: true,
          winner: winner,
        }));
        
        setTimeout(() => {
          Alert.alert(
            'Game Over!',
            winner === 'player' 
              ? `You Win! ${gameState.playerScore} - ${gameState.opponentScore}` 
              : winner === 'opponent'
                ? `You Lose! ${gameState.playerScore} - ${gameState.opponentScore}`
                : `It's a Tie! ${gameState.playerScore} - ${gameState.opponentScore}`
          );
        }, 500);
      } else {
        // Next round
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            currentRound: prev.currentRound + 1,
            playerRolled: false,
            opponentRolled: false,
          }));
        }, 2000);
      }
    }
  }, [gameState.playerRolled, gameState.opponentRolled]);

  function initializeGame(mode: string): GameState {
    return {
      playerDice: [1, 1, 1, 1, 1],
      opponentDice: [1, 1, 1, 1, 1],
      playerScore: 0,
      opponentScore: 0,
      currentRound: 1,
      totalRounds: 5,
      playerRolled: false,
      opponentRolled: false,
      gameMode: mode === 'ai' ? 'ai' : mode === 'random' ? 'random' : 'private',
      isGameOver: false,
      winner: null,
    };
  }

  function rollDice(): number[] {
    return Array(5).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
  }

  function calculateScore(dice: number[]): number {
    const counts = new Map<number, number>();
    dice.forEach(d => counts.set(d, (counts.get(d) || 0) + 1));
    
    // Five of a kind: 100 points
    if (Array.from(counts.values()).some(c => c === 5)) return 100;
    
    // Four of a kind: 50 points
    if (Array.from(counts.values()).some(c => c === 4)) return 50;
    
    // Full house (3 + 2): 40 points
    const values = Array.from(counts.values()).sort();
    if (values.length === 2 && values[0] === 2 && values[1] === 3) return 40;
    
    // Three of a kind: 30 points
    if (Array.from(counts.values()).some(c => c === 3)) return 30;
    
    // Two pairs: 20 points
    if (values.filter(v => v === 2).length === 2) return 20;
    
    // One pair: 10 points
    if (Array.from(counts.values()).some(c => c === 2)) return 10;
    
    // High dice (sum of all): sum / 10
    return Math.floor(dice.reduce((a, b) => a + b, 0) / 10);
  }

  function animateDice() {
    const animations = diceAnimations.map(anim => {
      return Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.stagger(50, animations).start();
  }

  function rollPlayerDice() {
    if (gameState.playerRolled || gameState.isGameOver) return;

    animateDice();
    
    setTimeout(() => {
      const newDice = rollDice();
      const score = calculateScore(newDice);
      
      // Capture player dice for AI logging
      if (gameState.gameMode === 'ai') {
        lastPlayerDiceRef.current = { dice: newDice, score };
      }
      
      setGameState(prev => ({
        ...prev,
        playerDice: newDice,
        playerScore: prev.playerScore + score,
        playerRolled: true,
      }));
    }, 600);
  }

  function rollOpponentDice() {
    if (gameState.opponentRolled || gameState.isGameOver) return;

    const newDice = rollDice();
    const score = calculateScore(newDice);
    
    setGameState(prev => ({
      ...prev,
      opponentDice: newDice,
      opponentScore: prev.opponentScore + score,
      opponentRolled: true,
    }));
  }

  function resetGame() {
    setGameState(initializeGame(gameState.gameMode));
    gameIdRef.current = uuidv4();
    lastPlayerDiceRef.current = null;
  }

  function getDiceEmoji(value: number): string {
    const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return diceEmojis[value - 1] || '⚀';
  }

  function getScoreName(dice: number[]): string {
    const counts = new Map<number, number>();
    dice.forEach(d => counts.set(d, (counts.get(d) || 0) + 1));
    
    if (Array.from(counts.values()).some(c => c === 5)) return 'Five of a Kind!';
    if (Array.from(counts.values()).some(c => c === 4)) return 'Four of a Kind!';
    
    const values = Array.from(counts.values()).sort();
    if (values.length === 2 && values[0] === 2 && values[1] === 3) return 'Full House!';
    if (Array.from(counts.values()).some(c => c === 3)) return 'Three of a Kind';
    if (values.filter(v => v === 2).length === 2) return 'Two Pairs';
    if (Array.from(counts.values()).some(c => c === 2)) return 'One Pair';
    
    return 'High Dice';
  }

  return (
    <SafeAreaView style={styles.container}>
      <GameToolbar
        title={`Mrotsi${gameState.gameMode === 'ai' ? ' (vs AI)' : ''}`}
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity onPress={resetGame} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.newGameText}>New</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.scoreContainer}>
        <Text style={styles.roundText}>Round {gameState.currentRound} of {gameState.totalRounds}</Text>
        <View style={styles.scoresRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>You</Text>
            <Text style={styles.scoreValue}>{gameState.playerScore}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>Opponent</Text>
            <Text style={styles.scoreValue}>{gameState.opponentScore}</Text>
          </View>
        </View>
      </View>

      {/* Opponent's Dice */}
      <View style={styles.diceSection}>
        <Text style={styles.sectionTitle}>Opponent's Dice</Text>
        <View style={styles.diceContainer}>
          {gameState.opponentDice.map((die, index) => (
            <View 
              key={`opp-${index}`} 
              style={[
                styles.die,
                gameState.opponentRolled && styles.dieRevealed
              ]}
            >
              <Text style={styles.dieText}>
                {gameState.opponentRolled ? getDiceEmoji(die) : '?'}
              </Text>
            </View>
          ))}
        </View>
        {gameState.opponentRolled && (
          <Text style={styles.combinationText}>{getScoreName(gameState.opponentDice)}</Text>
        )}
      </View>

      {/* Player's Dice */}
      <View style={styles.diceSection}>
        <Text style={styles.sectionTitle}>Your Dice</Text>
        <View style={styles.diceContainer}>
          {gameState.playerDice.map((die, index) => (
            <Animated.View 
              key={`player-${index}`}
              style={[
                styles.die,
                styles.playerDie,
                {
                  transform: [{
                    scale: diceAnimations[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.2],
                    }),
                  }],
                },
              ]}
            >
              <Text style={styles.dieText}>{getDiceEmoji(die)}</Text>
            </Animated.View>
          ))}
        </View>
        {gameState.playerRolled && (
          <Text style={styles.combinationText}>{getScoreName(gameState.playerDice)}</Text>
        )}
      </View>

      <View style={styles.actionContainer}>
        {!gameState.isGameOver ? (
          <TouchableOpacity
            style={[
              styles.rollButton,
              (gameState.playerRolled || gameState.isGameOver) && styles.rollButtonDisabled
            ]}
            onPress={rollPlayerDice}
            disabled={gameState.playerRolled || gameState.isGameOver}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.rollButtonText}>
              {gameState.playerRolled ? 'Waiting for next round...' : 'Roll Dice!'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.playAgainButton}
            onPress={resetGame}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.playAgainText}>Play Again</Text>
          </TouchableOpacity>
        )}
      </View>

      {gameState.isGameOver && (
        <View style={styles.gameOverBanner}>
          <Text style={styles.gameOverText}>
            {gameState.winner === 'player' ? '🎉 You Win!' : gameState.winner === 'opponent' ? '😔 You Lose!' : '🤝 Tie Game!'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    color: '#4a90e2',
    fontWeight: '600',
  },
  newGameText: {
    fontSize: 16,
    color: '#4a90e2',
    fontWeight: '600',
  },
  scoreContainer: {
    padding: 20,
    backgroundColor: '#16213e',
  },
  roundText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scoreBox: {
    alignItems: 'center',
    backgroundColor: '#0f3460',
    padding: 16,
    borderRadius: 12,
    minWidth: 120,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4a90e2',
  },
  diceSection: {
    padding: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 12,
  },
  diceContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  die: {
    width: 50,
    height: 50,
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4a4a6e',
  },
  playerDie: {
    backgroundColor: '#0f3460',
    borderColor: '#4a90e2',
  },
  dieRevealed: {
    backgroundColor: '#2d3748',
    borderColor: '#e53e3e',
  },
  dieText: {
    fontSize: 32,
    color: '#fff',
  },
  combinationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a90e2',
    marginTop: 8,
  },
  actionContainer: {
    padding: 20,
    alignItems: 'center',
  },
  rollButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  rollButtonDisabled: {
    backgroundColor: '#2a3f5f',
  },
  rollButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  playAgainButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  playAgainText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gameOverBanner: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  gameOverText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default MrotsiScreen;
