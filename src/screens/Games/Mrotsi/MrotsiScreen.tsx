import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Animated, ImageBackground, Dimensions, Alert} from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import { aiMoveLogService } from '../../../services/aiMoveLog.service';
import Photosphere360Background from '../../../components/Photosphere360Background';
import AR3DOverlay, {type AR3DOverlayHandle} from '../../../components/AR3DOverlay';
import { v4 as uuidv4 } from 'uuid';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import Dice3DSimple from '../../../components/Games/Dice3DSimple';
import { apiService } from '../../../services/api.service';
import { useAuth } from '../../../libs/hooks/useAuth';
import { useAchievements } from '../../../contexts/AchievementContext';
import useDeviceType from '../../../hooks/useDeviceType';
import { getSpacing, getFontSize } from '../../../theme/responsive';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const { isTablet } = useDeviceType();
  const {session, gameType, mode: routeMode} = route.params || {};
  const mode = routeMode ?? session?.mode ?? 'ai'; // fall back to session.mode; default to 'ai' so AI always works
  const [gameState, setGameState] = useState<GameState>(initializeGame(mode));
  const [showBlur, setShowBlur] = useState(true);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [arEnabled, setArEnabled] = useState(true);
  const arOverlayRef = useRef<AR3DOverlayHandle>(null);
  const [showBackground, setShowBackground] = useState(true);
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const [diceAnimations] = useState(
    Array(5).fill(0).map(() => new Animated.Value(0))
  );
  const [rollingDice, setRollingDice] = useState<number[]>([1, 1, 1, 1, 1]);
  const [isRolling, setIsRolling] = useState(false);
  const [opponentRollingDice, setOpponentRollingDice] = useState<number[]>([1, 1, 1, 1, 1]);
  const [isOpponentRolling, setIsOpponentRolling] = useState(false);
  const gameIdRef = useRef<string>(uuidv4());
  const lastPlayerDiceRef = useRef<{ dice: number[]; score: number } | null>(null);
  const rollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const opponentRollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { refreshOnGameEnd, isRefreshing: isRefreshingGameEnd } = useGameEndRefresh(undefined, 'mrotsi');

  // Entry fee and prize tracking
  const { user, setUser, refreshUser } = useAuth();
  const { showAchievements } = useAchievements();
  const [entryDeducted, setEntryDeducted] = useState(false);
  const [prizeAwarded, setPrizeAwarded] = useState(false);
  const [isFinalizingGame, setIsFinalizingGame] = useState(false);

  const isPostGameSyncing = isFinalizingGame || isRefreshingGameEnd;

  const syncUserBalance = (newBalance: number) => {
    setUser(currentUser => {
      if (!currentUser) {
        return currentUser;
      }

      return {
        ...currentUser,
        balance: newBalance,
        playerStats: currentUser.playerStats
          ? {
              ...currentUser.playerStats,
              available_points: newBalance,
            }
          : currentUser.playerStats,
      };
    });
  };

  const handleBackPress = () => {
    if (gameState.isGameOver && isPostGameSyncing) {
      BisetkaAlert.alert(
        'Updating Profile',
        'Finishing your points sync before returning home.'
      );
      return;
    }

    navigation.goBack();
  };

  // Entry fee deduction handler
  const handleGameStart = async () => {
    if (entryDeducted) return;

    if (!user?.id) {
      console.log('⏳ Waiting for authenticated user before deducting Mrotsi entry fee');
      return;
    }

    try {
      console.log('💰 Deducting mrotsi entry fee...');
      console.log('   User ID:', user.id);
      console.log('   Game ID:', gameIdRef.current);
      const result = await apiService.deductEntry('mrotsi', gameIdRef.current);
      
      if (result.success) {
        console.log(`✅ Entry deducted: -50 points. Balance: ${result.newBalance}`);
        setEntryDeducted(true);
        syncUserBalance(result.newBalance);
        refreshUser().catch(console.error);
      } else {
        console.error('❌ Insufficient points:', result.error);
        Alert.alert('Insufficient Points', result.error || 'You need 50 points to play mrotsi.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error: any) {
      console.error('❌ Entry deduction error:', error);
      console.error('   Error message:', error?.message);
      console.error('   Error status:', error?.status);
      console.error('   Full error:', JSON.stringify(error, null, 2));
      Alert.alert('Error', `Failed to deduct entry fee: ${error?.message || 'Unknown error'}`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  };

  // Prize award handler
  const handleGameEnd = async (didWin: boolean) => {
    if (prizeAwarded || !user?.id) return;

    try {
      setIsFinalizingGame(true);
      const result = didWin ? 'win' : 'loss';
      console.log(`🏆 Awarding prize and logging game for ${result}...`);
      
      const prizeResult = await apiService.awardPrizeAndLog(
        'mrotsi',
        result,
        'ai',
        {
          gameId: gameIdRef.current,
          playerScore: didWin ? 1 : 0,
        }
      );
      
      if (prizeResult.success) {
        console.log(`✅ ${prizeResult.message}`);
        setPrizeAwarded(true);
        syncUserBalance(prizeResult.newBalance);
        const unlockedAchievements = prizeResult.unlockedAchievements ?? [];
        if (unlockedAchievements.length > 0) {
          showAchievements(unlockedAchievements);
        }
        await refreshOnGameEnd();
        
        if (didWin) {
          setTimeout(() => {
            Alert.alert('🏆 Victory!', `You won ${prizeResult.prize} points!\n\nNew balance: ${prizeResult.newBalance} points`);
          }, 2000);
        }
      }
    } catch (error: any) {
      console.error('❌ Prize award error:', error);
    } finally {
      setIsFinalizingGame(false);
    }
  };

  // Entry fee & prize logic
  // Deduct entry when game starts
  useEffect(() => {
    if (!entryDeducted && user?.id) {
      handleGameStart();
    }
  }, [entryDeducted, user?.id]);

  // Award prize when game ends
  useEffect(() => {
    if (gameState.isGameOver && !prizeAwarded) {
      const didWin = gameState.winner === 'player';
      handleGameEnd(didWin);
    }
  }, [gameState.isGameOver, prizeAwarded, gameState.winner]);

  // Cleanup rolling animation on unmount
  useEffect(() => {
    return () => {
      if (rollingIntervalRef.current) {
        clearInterval(rollingIntervalRef.current);
      }
      if (opponentRollingIntervalRef.current) {
        clearInterval(opponentRollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // AI opponent's turn - use full gameState to avoid stale closures in production builds
    if (gameState.gameMode === 'ai' && gameState.playerRolled && !gameState.opponentRolled && !gameState.isGameOver) {
      const currentRound = gameState.currentRound;
      animateOpponentDice();
      const timer = setTimeout(() => {
        // Calculate AI dice roll inline to avoid stale closure
        const newDice = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ];

        if (opponentRollingIntervalRef.current) {
          clearInterval(opponentRollingIntervalRef.current);
          opponentRollingIntervalRef.current = null;
        }
        setOpponentRollingDice(newDice);
        setIsOpponentRolling(false);

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
      return () => {
        clearTimeout(timer);
        if (opponentRollingIntervalRef.current) {
          clearInterval(opponentRollingIntervalRef.current);
          opponentRollingIntervalRef.current = null;
        }
        setIsOpponentRolling(false);
      };
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
          if (winner === 'player') {
            BisetkaAlert.success(
              'Game Over!',
              `You Win! ${gameState.playerScore} - ${gameState.opponentScore}`
            );
          } else if (winner === 'opponent') {
            BisetkaAlert.error(
              'Game Over!',
              `You Lose! ${gameState.playerScore} - ${gameState.opponentScore}`
            );
          } else {
            BisetkaAlert.alert(
              'Game Over!',
              `It's a Tie! ${gameState.playerScore} - ${gameState.opponentScore}`
            );
          }
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
    setIsRolling(true);
    
    // Show random dice faces during roll
    rollingIntervalRef.current = setInterval(() => {
      setRollingDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 80);

    // Animate dice rotation and scale
    const animations = diceAnimations.map(anim => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 }
      );
    });

    Animated.stagger(30, animations).start();
  }

  function animateOpponentDice() {
    setIsOpponentRolling(true);

    opponentRollingIntervalRef.current = setInterval(() => {
      setOpponentRollingDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 80);
  }

  function rollPlayerDice() {
    if (gameState.playerRolled || gameState.isGameOver) return;

    animateDice();
    
    setTimeout(() => {
      // Stop rolling animation
      if (rollingIntervalRef.current) {
        clearInterval(rollingIntervalRef.current);
        rollingIntervalRef.current = null;
      }
      setIsRolling(false);

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
    }, 800);
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
    setEntryDeducted(false);
    setPrizeAwarded(false);
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
    <View style={styles.backgroundImage}>
      <Photosphere360Background overlayOpacity={showBlur ? 0.5 : 0.3}>
        <AR3DOverlay
          ref={arOverlayRef}
          visible={arEnabled}
          boardGlbPath="glb/game_boards/rounded_table_panel.glb"
        />
      </Photosphere360Background>
      <View style={styles.overlay} pointerEvents="box-none">
      <SafeAreaView style={styles.container} pointerEvents="box-none">
        <View>
          <GameToolbar
            title={`Mrotsi${gameState.gameMode === 'ai' ? ' (vs AI)' : ''}`}
            onBack={handleBackPress}
            backgroundColor="transparent"
          />
          <View>
            <GameToolbarControls
              buttons={[
                { icon: showBlur ? '🌫️' : '✨', onPress: () => setShowBlur(!showBlur) },
                { icon: showBackground ? '🖼️' : '🔲', onPress: () => setShowBackground(!showBackground) },
                { icon: arEnabled ? '🥽' : '🎮', onPress: () => setArEnabled(!arEnabled) },
                { icon: showMusicPlayer ? '🎵' : '🎶', onPress: () => setShowMusicPlayer(s => !s) },
                { icon: '🔄', onPress: resetGame },
              ]}
            />
          </View>
        </View>

        {/* Score Display */}
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

        {/* Wooden Table with Dice */}
        <View style={styles.tableContainer} pointerEvents="box-none">
          {arEnabled ? (
            // AR mode: transparent container so GLB board shows through from AR3DOverlay
            <View style={[styles.woodenTable, styles.woodenTableAR]} pointerEvents="box-none">
              {/* Opponent's Dice Area */}
              <View style={styles.opponentDiceArea} pointerEvents="box-none">
                <Text style={styles.areaLabel}>Opponent</Text>
                <View style={styles.diceRow}>
                  {((isOpponentRolling ? opponentRollingDice : gameState.opponentDice).length === 5
                    ? (isOpponentRolling ? opponentRollingDice : gameState.opponentDice)
                    : [1, 1, 1, 1, 1]).map((d, i) => (
                    <Dice3DSimple key={i} value={d} isRolling={isOpponentRolling} index={i} size={Math.floor(SCREEN_WIDTH / 5)} />
                  ))}
                </View>
                {gameState.opponentRolled && !isOpponentRolling && (
                  <Text style={styles.handNameText}>{getScoreName(gameState.opponentDice)}</Text>
                )}
              </View>

              {/* Center Divider */}
              <View style={styles.centerDivider} pointerEvents="none" />

              {/* Player's Dice Area */}
              <View style={styles.playerDiceArea} pointerEvents="box-none">
                <Text style={styles.areaLabel}>You</Text>
                <View style={styles.diceRow}>
                  {((isRolling ? rollingDice : gameState.playerDice).length === 5
                    ? (isRolling ? rollingDice : gameState.playerDice)
                    : [1, 1, 1, 1, 1]).map((d, i) => (
                    <Dice3DSimple key={i} value={d} isRolling={isRolling} index={i} size={Math.floor(SCREEN_WIDTH / 5)} />
                  ))}
                </View>
                {gameState.playerRolled && !isRolling && (
                  <Text style={styles.handNameText}>{getScoreName(gameState.playerDice)}</Text>
                )}
              </View>
            </View>
          ) : (
            <ImageBackground
              source={require('../../../../assets/blot/card-table.png')}
              style={styles.woodenTable}
              imageStyle={styles.woodenTableImage}
              resizeMode="cover"
            >
              {/* Opponent's Dice Area */}
              <View style={styles.opponentDiceArea}>
                <Text style={styles.areaLabel}>Opponent</Text>
                <View style={styles.diceRow}>
                  {((isOpponentRolling ? opponentRollingDice : gameState.opponentDice).length === 5
                    ? (isOpponentRolling ? opponentRollingDice : gameState.opponentDice)
                    : [1, 1, 1, 1, 1]).map((d, i) => (
                    <Dice3DSimple key={i} value={d} isRolling={isOpponentRolling} index={i} size={Math.floor(SCREEN_WIDTH / 5)} />
                  ))}
                </View>
                {gameState.opponentRolled && !isOpponentRolling && (
                  <Text style={styles.handNameText}>{getScoreName(gameState.opponentDice)}</Text>
                )}
              </View>

              {/* Center Divider */}
              <View style={styles.centerDivider} />

              {/* Player's Dice Area */}
              <View style={styles.playerDiceArea}>
                <Text style={styles.areaLabel}>You</Text>
                <View style={styles.diceRow}>
                  {((isRolling ? rollingDice : gameState.playerDice).length === 5
                    ? (isRolling ? rollingDice : gameState.playerDice)
                    : [1, 1, 1, 1, 1]).map((d, i) => (
                    <Dice3DSimple key={i} value={d} isRolling={isRolling} index={i} size={Math.floor(SCREEN_WIDTH / 5)} />
                  ))}
                </View>
                {gameState.playerRolled && !isRolling && (
                  <Text style={styles.handNameText}>{getScoreName(gameState.playerDice)}</Text>
                )}
              </View>
            </ImageBackground>
          )}
        </View>

        {/* Action Button */}
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
                {gameState.playerRolled ? 'Waiting for next round...' : '🎲 Roll Dice!'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.playAgainButton}
              onPress={resetGame}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.playAgainText}>🎮 Play Again</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Game Over Overlay */}
        {gameState.isGameOver && (
          <View style={styles.gameOverOverlay}>
            <View style={styles.gameOverBanner}>
              <Text style={styles.gameOverText}>
                {gameState.winner === 'player' ? '🎉 Victory!' : gameState.winner === 'opponent' ? '😔 Defeat' : '🤝 Tie Game!'}
              </Text>
              <Text style={styles.gameOverScore}>
                {gameState.playerScore} - {gameState.opponentScore}
              </Text>
              
              <View style={styles.gameOverButtons}>
                <TouchableOpacity
                  style={styles.playAgainButtonModal}
                  onPress={resetGame}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.playAgainModalText}>🎮 Play Again</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.closeButtonModal}
                  onPress={handleBackPress}
                  disabled={isPostGameSyncing}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.closeModalText}>
                    {isPostGameSyncing ? 'Syncing...' : '✕ Close'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
      </View>
      <SyncedYouTubePlayer roomId={null} visible={showMusicPlayer} />
      {arEnabled && (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={() => arOverlayRef.current?.recenter()}
          hitSlop={{top:12,bottom:12,left:12,right:12}}
          activeOpacity={0.7}>
          <Text style={styles.recenterIcon}>⊕</Text>
          <Text style={styles.recenterLabel}>Re-center</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {flex: 1},
  newGameText: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  scoreContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
  },
  roundText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  scoreBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(139, 69, 19, 0.8)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8B4513',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#FFD700',
    marginBottom: 4,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  tableContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 20,
  },
  woodenTable: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  woodenTableAR: {
    backgroundColor: 'transparent',
    borderRadius: 24,
  },
  woodenTableImage: {
    borderRadius: 24,
  },
  opponentDiceArea: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  playerDiceArea: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  centerDivider: {
    height: 2,
    backgroundColor: 'rgba(139, 69, 19, 0.6)',
    marginVertical: 8,
  },
  areaLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  diceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    flexWrap: 'wrap',
  },
  dice3DContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    minHeight: 120,
  },
  diceBox: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#555',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  diceBoxRevealed: {
    backgroundColor: 'rgba(139, 0, 0, 0.85)',
    borderColor: '#DC143C',
  },
  playerDiceBox: {
    backgroundColor: 'rgba(0, 100, 0, 0.85)',
    borderColor: '#228B22',
  },
  diceValue: {
    fontSize: 36,
    color: '#FFF',
  },
  handNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
    marginTop: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  rollButton: {
    backgroundColor: 'rgba(34, 139, 34, 0.95)',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 16,
    minWidth: 240,
    borderWidth: 3,
    borderColor: '#228B22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  rollButtonDisabled: {
    backgroundColor: 'rgba(80, 80, 80, 0.8)',
    borderColor: '#555',
  },
  rollButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  playAgainButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.95)',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 16,
    minWidth: 240,
    borderWidth: 3,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  playAgainText: {
    color: '#8B4513',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverBanner: {
    backgroundColor: 'rgba(139, 69, 19, 0.95)',
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 16,
    minWidth: SCREEN_WIDTH * 0.7,
  },
  gameOverText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  gameOverScore: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 20,
  },
  gameOverButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  playAgainButtonModal: {
    backgroundColor: 'rgba(34, 139, 34, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#228B22',
    flex: 1,
  },
  playAgainModalText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  closeButtonModal: {
    backgroundColor: 'rgba(220, 20, 60, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DC143C',
    flex: 1,
  },
  closeModalText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  recenterBtn: { position:'absolute', bottom:90, alignSelf:'center', left:'50%', transform:[{translateX:-54}], flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(0,0,0,0.35)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)', borderRadius:24, paddingHorizontal:18, paddingVertical:10 },
  recenterIcon: { fontSize:20, color:'#fff' },
  recenterLabel: { fontSize:13, color:'#fff', fontWeight:'600', letterSpacing:0.3 },
});

export default MrotsiScreen;
