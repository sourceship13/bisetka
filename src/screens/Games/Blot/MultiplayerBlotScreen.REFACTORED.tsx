/**
 * REFACTORED: Multiplayer Blot Screen
 * 
 * **BEFORE:** 1678 lines (massive screen with AI + multiplayer + 4-player team mode)
 * **AFTER:** ~900 lines (AI logic local, multiplayer via hook, clean separation)
 * 
 * Supports:
 * - AI mode (local blotAIService, no socket)
 * - 2-player multiplayer (color-based turns)
 * - 4-player team mode (position-based turns, 0-3)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { blotAIService, LocalGameState, Card } from '../../../services/blotAI.service';
import { gameResultService } from '../../../services/gameResult.service';
import { aiMoveLogService } from '../../../services/aiMoveLog.service';
import { v4 as uuidv4 } from 'uuid';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import CardHandFan from '../../../components/CardHandFan';
import InGameChat from '../../../components/InGameChat';
import GameToolbar from '../../../components/global/GameToolbar';
import RoomNameModal from '../../../components/RoomNameModal';

// ─── Multiplayer imports ────────────────────────────────────────────────────
import { useMultiplayerGame, useMatchmakingUI } from '../../../multiplayer';
import {
  blotAdapter,
  type BlotGameState,
  type BlotMove,
} from '../../../multiplayer/adapters/BlotGameAdapter';

// ─── Component ──────────────────────────────────────────────────────────────

const MultiplayerBlotScreenRefactored = ({ navigation, route }: any) => {
  const userId = route.params?.userId || 'test-user-' + Math.random().toString(36).substr(2, 9);
  const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'blot');
  const initialMode = route.params?.mode;
  const initialDifficulty = route.params?.difficulty || 'medium';
  const initialJoinCode = route.params?.joinCode;
  const teamMode = route.params?.teamMode;
  const isAI = initialMode === 'ai';
  const isMultiplayer = !isAI && initialMode !== undefined;

  // ─── AI-mode local state ─────────────────────────────────────────────────
  const [localGameState, setLocalGameState] = useState<LocalGameState | null>(null);
  const [isLocalGame, setIsLocalGame] = useState(isAI);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(initialDifficulty);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const gameStartTime = useRef<Date | null>(null);
  const blotGameIdRef = useRef<string>(uuidv4());
  const trickCountRef = useRef(0);
  const lastPlayerCardRef = useRef<Card | null>(null);
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);

  // ─── 4-player team mode state ─────────────────────────────────────────────
  const [playerPosition, setPlayerPosition] = useState<number | null>(null);
  const playerPositionRef = useRef<number | null>(null);
  const moveInFlightRef = useRef(false);

  const updatePlayerPosition = (pos: number | null) => {
    playerPositionRef.current = pos;
    setPlayerPosition(pos);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AI MODE SETUP
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isAI) return;
    blotGameIdRef.current = uuidv4();
    trickCountRef.current = 0;
    lastPlayerCardRef.current = null;
    const newGame = blotAIService.initializeGame();
    setLocalGameState(newGame);
    gameStartTime.current = new Date();
  }, [isAI]);

  // AI computer turn when it leads a trick
  useEffect(() => {
    if (!isLocalGame || !localGameState || localGameState.status !== 'active') return;
    if (localGameState.currentTurn === 'computer' && localGameState.currentTrick.length === 0) {
      const timer = setTimeout(() => {
        setLocalGameState(prev => {
          if (!prev || prev.currentTurn !== 'computer' || prev.currentTrick.length !== 0) return prev;
          const stateAfterComputer = blotAIService.computerMove(prev);
          if (stateAfterComputer.status !== 'active') handleLocalGameEnd(stateAfterComputer);
          return stateAfterComputer;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [localGameState, isLocalGame]);

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTIPLAYER (only when isMultiplayer)
  // ═══════════════════════════════════════════════════════════════════════════

  const mpMode = initialMode === 'random' ? 'random'
    : initialMode === 'private-create' ? 'private-create'
    : initialMode === 'private-join' ? 'private-join'
    : 'random';

  const mp = isMultiplayer ? useMultiplayerGame<BlotGameState, BlotMove>({
    gameType: teamMode === 'full-multiplayer' ? 'blot-teams' : 'blot',
    userId,
    mode: mpMode as any,
    joinCode: initialJoinCode,
    adapter: blotAdapter,

    onGameStart: (data: any) => {
      if (data.gameType === 'blot-teams' && data.myPosition !== undefined) {
        updatePlayerPosition(data.myPosition);
      }
      moveInFlightRef.current = false;
    },

    onMoveMade: (data: any) => {
      moveInFlightRef.current = false;
      // In 4p mode the server may send myHand
      if (playerPositionRef.current !== null && data.myHand) {
        // myHand is merged into gameState by the controller
      }
      setSelectedCard(null);
    },

    onGameEnd: (data) => {
      refreshOnGameEnd().catch(console.error);
      const isWinner = data.winnerId === userId;
      if (isWinner) {
        BisetkaAlert.success('Game Over!', 'You won! 🎉', [
          { text: 'OK', onPress: () => navigation.replace('GameMode', { gameType: 'blot' }) },
        ]);
      } else {
        BisetkaAlert.error('Game Over!', 'You lost. Better luck next time!', [
          { text: 'OK', onPress: () => navigation.replace('GameMode', { gameType: 'blot' }) },
        ]);
      }
    },

    onOpponentDisconnected: () => {
      BisetkaAlert.warning('Opponent Disconnected', 'Your opponent has disconnected from the game.');
    },

    onError: (msg) => BisetkaAlert.error('Error', msg),
  }) : null;

  const mpStatus = isMultiplayer ? mp!.status : 'disconnected';
  const { showMatchmaking, showWaitingRoom, showGame } = useMatchmakingUI(mpStatus);

  const mpGameState = mp?.gameState;
  const mpIsMyTurn = mp?.isMyTurn ?? false;
  const playerColor = mp?.myPlayer?.color || 'white';
  const is4P = playerPosition !== null;
  const isGameStarted = isMultiplayer ? (mpStatus === 'playing') : !!localGameState;

  // ─── Card play handler ────────────────────────────────────────────────────
  const handlePlayCard = (card: Card) => {
    if (isLocalGame) {
      handleLocalPlayCard(card);
    } else {
      handleMultiplayerPlayCard(card);
    }
  };

  const handleLocalPlayCard = (card: Card) => {
    if (!localGameState || localGameState.currentTurn !== 'player') return;
    setSelectedCard(card);
    lastPlayerCardRef.current = card;
    const playerHandBefore = [...localGameState.playerHand];
    const aiHandBefore = [...localGameState.computerHand];
    const trumpSuit = localGameState.trumpSuit;

    let newState = blotAIService.playCard(localGameState, card);
    setLocalGameState(newState);

    if (newState.status !== 'active') { handleLocalGameEnd(newState); return; }

    if (newState.currentTurn === 'computer') {
      setTimeout(() => {
        const stateAfterComputer = blotAIService.computerMove(newState);
        const aiCard = stateAfterComputer.currentTrick.length > 0
          ? stateAfterComputer.currentTrick[stateAfterComputer.currentTrick.length - 1]
          : null;

        if (lastPlayerCardRef.current && aiCard) {
          trickCountRef.current++;
          aiMoveLogService.logBlotMove({
            gameId: blotGameIdRef.current,
            trickNumber: trickCountRef.current,
            playerCard: lastPlayerCardRef.current,
            aiCard,
            trumpSuit: trumpSuit || undefined,
            playerHandBefore,
            aiHandBefore,
            playerScoreAfter: stateAfterComputer.playerScore,
            aiScoreAfter: stateAfterComputer.computerScore,
            difficulty,
          });
          lastPlayerCardRef.current = null;
        }

        setLocalGameState(stateAfterComputer);
        if (stateAfterComputer.status !== 'active') handleLocalGameEnd(stateAfterComputer);
      }, 1000);
    }
  };

  const handleMultiplayerPlayCard = (card: Card) => {
    if (!mpIsMyTurn || !mp?.room?.id) return;
    if (moveInFlightRef.current) return;
    moveInFlightRef.current = true;
    setSelectedCard(card);
    mp.makeMove({ card, playerId: userId });
  };

  const handleLocalGameEnd = async (finalState: LocalGameState) => {
    const isWinner = finalState.winnerId === 'player';
    const isDraw = finalState.status === 'draw';
    const durationSeconds = gameStartTime.current
      ? Math.floor((new Date().getTime() - gameStartTime.current.getTime()) / 1000)
      : undefined;

    const result = isDraw ? 'draw' : (isWinner ? 'win' : 'loss');
    const gameResultResponse = await gameResultService.recordGameResult({
      gameType: 'blot', gameMode: 'ai', result, difficulty,
      playerScore: finalState.playerScore, opponentScore: finalState.computerScore,
      durationSeconds, startedAt: gameStartTime.current || undefined,
    });
    refreshOnGameEnd().catch(console.error);

    const pointsMessage = gameResultResponse?.pointsEarned ? `\n+${gameResultResponse.pointsEarned} points earned!` : '';
    const msg = (isDraw ? "It's a draw!" : isWinner ? 'You won! 🎉' : 'Computer won. Better luck next time!') + pointsMessage;

    const buttons = [
      { text: 'Play Again', onPress: () => { blotGameIdRef.current = uuidv4(); trickCountRef.current = 0; lastPlayerCardRef.current = null; setLocalGameState(blotAIService.initializeGame()); gameStartTime.current = new Date(); } },
      { text: 'Main Menu', onPress: () => { setIsLocalGame(false); setLocalGameState(null); navigation.replace('GameMode', { gameType: 'blot' }); } },
    ];

    if (isDraw) BisetkaAlert.alert('Game Over!', msg, buttons);
    else if (isWinner) BisetkaAlert.success('Game Over!', msg, buttons);
    else BisetkaAlert.error('Game Over!', msg, buttons);
  };

  const handleResign = () => {
    BisetkaAlert.warning('Resign', 'Are you sure you want to resign?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resign', style: 'destructive', onPress: async () => {
        if (isLocalGame) {
          const durationSeconds = gameStartTime.current ? Math.floor((new Date().getTime() - gameStartTime.current.getTime()) / 1000) : undefined;
          await gameResultService.recordGameResult({
            gameType: 'blot', gameMode: 'ai', result: 'resigned', difficulty,
            playerScore: localGameState?.playerScore || 0, opponentScore: localGameState?.computerScore || 0,
            durationSeconds, startedAt: gameStartTime.current || undefined,
          });
          refreshOnGameEnd().catch(console.error);
          setIsLocalGame(false); setLocalGameState(null);
          navigation.replace('GameMode', { gameType: 'blot' });
        } else {
          mp?.resign();
          navigation.replace('GameMode', { gameType: 'blot' });
        }
      }},
    ]);
  };

  // ─── Card renderer ────────────────────────────────────────────────────────
  const renderCard = (card: Card, index: number) => {
    const suitSymbol: Record<string, string> = { hearts: '♥️', diamonds: '♦️', clubs: '♣️', spades: '♠️' };
    const suitColor = card.suit === 'hearts' || card.suit === 'diamonds' ? '#ff0000' : '#000000';
    const canPlay = isLocalGame
      ? (localGameState?.currentTurn === 'player')
      : mpIsMyTurn && !moveInFlightRef.current;

    return (
      <TouchableOpacity
        key={index}
        style={[styles.card, selectedCard === card && styles.selectedCard, !canPlay && styles.disabledCard]}
        onPress={() => handlePlayCard(card)}
        disabled={!canPlay}>
        <Text style={[styles.cardRank, { color: suitColor }]}>{card.rank}</Text>
        <Text style={styles.cardSuit}>{suitSymbol[card.suit]}</Text>
        <Text style={styles.cardValue}>{card.value}</Text>
      </TouchableOpacity>
    );
  };

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const TABLE_SIZE = Math.min(screenWidth - 32, screenHeight * 0.4);

  // ─── Matchmaking ──────────────────────────────────────────────────────────
  if (isMultiplayer && (showMatchmaking || showWaitingRoom)) {
    return (
      <ImageBackground source={require('../../../../assets/blot/park-background.png')} style={styles.container} blurRadius={3}>
        <LinearGradient colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']} style={styles.overlay}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
            <GameToolbar title="Blot" onBack={() => navigation.goBack()} backgroundColor="transparent" />
            <View style={styles.menuContainer}>
              <Text style={styles.title}>Finding Match...</Text>
              <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
              {mp?.room?.code && (
                <>
                  <Text style={styles.roomCodeLabel}>Room Code:</Text>
                  <Text style={styles.roomCodeText}>{mp.room.code}</Text>
                </>
              )}
              <TouchableOpacity style={styles.cancelButton} onPress={() => { mp?.cancelMatchmaking(); navigation.goBack(); }}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    );
  }

  // ─── Game render (shared between AI and multiplayer) ──────────────────────
  const renderGameUI = () => {
    // Determine hand and scores based on mode
    let playerHand: Card[] = [];
    let myScore = 0;
    let oppScore = 0;
    let turnText = '';
    let trumpSuit: string | null = null;
    let currentTrick: Card[] = [];

    if (isLocalGame && localGameState) {
      playerHand = localGameState.playerHand;
      myScore = localGameState.playerScore;
      oppScore = localGameState.computerScore;
      trumpSuit = localGameState.trumpSuit;
      currentTrick = localGameState.currentTrick;
      turnText = localGameState.currentTurn === 'player' ? '★ Your Turn' : "Computer's Turn";
    } else if (isMultiplayer && mpGameState) {
      playerHand = is4P
        ? (mpGameState.myHand || mpGameState.hands?.[playerPosition!] || [])
        : (playerColor === 'white' ? mpGameState.player1Hand || [] : mpGameState.player2Hand || []);
      myScore = is4P
        ? (playerColor === 'white' ? mpGameState.whiteScore || 0 : mpGameState.blackScore || 0)
        : (playerColor === 'white' ? mpGameState.player1Score || 0 : mpGameState.player2Score || 0);
      oppScore = is4P
        ? (playerColor === 'white' ? mpGameState.blackScore || 0 : mpGameState.whiteScore || 0)
        : (playerColor === 'white' ? mpGameState.player2Score || 0 : mpGameState.player1Score || 0);
      trumpSuit = mpGameState.trumpSuit;
      currentTrick = mpGameState.currentTrick || [];
      if (mpIsMyTurn) turnText = '★ Your Turn';
      else if (is4P && mpGameState.currentTurn !== undefined) {
        const rel = ((mpGameState.currentTurn as number) - playerPosition! + 4) % 4;
        turnText = rel === 2 ? "Partner's Turn" : "Opponent's Turn";
      } else turnText = "Opponent's Turn";
    }

    if (!isGameStarted) {
      // Waiting for ready state
      return (
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingTitle}>Match Found!</Text>
          <Text style={styles.waitingText}>
            {is4P ? `Team: ${playerColor === 'white' ? '⚪ White' : '⚫ Black'} • Position ${playerPosition}` : `Playing as: ${playerColor === 'white' ? '⚪ White' : '⚫ Black'}`}
          </Text>
          <Text style={styles.waitingSubtext}>{is4P ? 'Waiting for all 4 players...' : 'Waiting for opponent...'}</Text>
          <TouchableOpacity style={[styles.cancelButton, { marginTop: 20 }]} onPress={() => { mp?.resign(); navigation.goBack(); }}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.gameContainer}>
        {/* Score board */}
        <View style={styles.scoreBoard}>
          <View style={styles.teamScore}>
            <Text style={styles.teamLabel}>{isLocalGame ? 'You' : 'Your Team'}</Text>
            <Text style={styles.score}>{myScore}</Text>
          </View>
          {trumpSuit && (
            <View style={styles.trumpDisplay}>
              <Text style={styles.trumpLabel}>Trump</Text>
              <Text style={styles.trumpSuit}>
                {trumpSuit === 'hearts' ? '♥' : trumpSuit === 'diamonds' ? '♦' : trumpSuit === 'clubs' ? '♣' : '♠'}
              </Text>
            </View>
          )}
          <View style={styles.teamScore}>
            <Text style={styles.teamLabel}>{isLocalGame ? 'Computer' : 'Opp. Team'}</Text>
            <Text style={styles.score}>{oppScore}</Text>
          </View>
        </View>

        {/* Play area */}
        <View style={styles.playArea}>
          <Text style={styles.currentPlayerText}>{turnText}</Text>
          {!isLocalGame && <Text style={styles.partnerLabel}>{is4P ? '👥 2v2 • 🤖 CPU-free' : '🤖 CPU Partner (same team)'}</Text>}

          <View style={[styles.tableContainer, { width: TABLE_SIZE, height: TABLE_SIZE }]}>
            <ImageBackground source={require('../../../../assets/blot/card-table.png')} style={styles.cardTable} imageStyle={{ borderRadius: 16 }}>
              {currentTrick.length > 0 && (
                <View style={styles.trickArea}>
                  {currentTrick.map((card: any, index: number) => {
                    let slotStyle;
                    if (isLocalGame) {
                      slotStyle = index === currentTrick.length - 1 ? styles.trickSlotBottom : styles.trickSlotTop;
                    } else if (is4P) {
                      const rel = ((card.position as number) - playerPosition! + 4) % 4;
                      if (rel === 0) slotStyle = styles.trickSlotBottom;
                      else if (rel === 2) slotStyle = styles.trickSlotTop;
                      else if (rel === 1) slotStyle = styles.trickSlotRight;
                      else slotStyle = styles.trickSlotLeft;
                    } else {
                      const isMyCard = card.color === playerColor;
                      const isHumanCard = card.isHuman !== false;
                      if (isMyCard && isHumanCard) slotStyle = styles.trickSlotBottom;
                      else if (!isMyCard && isHumanCard) slotStyle = styles.trickSlotTop;
                      else if (isMyCard && !isHumanCard) slotStyle = styles.trickSlotLeft;
                      else slotStyle = styles.trickSlotRight;
                    }
                    return (
                      <View key={index} style={[styles.trickSlot, slotStyle]}>
                        {isLocalGame && <Text style={styles.trickPlayerName}>{index === currentTrick.length - 1 ? 'You' : 'Computer'}</Text>}
                        {renderCard(card, index)}
                      </View>
                    );
                  })}
                </View>
              )}
            </ImageBackground>
          </View>
        </View>

        {/* Hand */}
        <View style={styles.handContainer}>
          <Text style={styles.handLabel}>Your Hand:</Text>
          <CardHandFan cards={playerHand} maxWidth={screenWidth - 32} renderCard={(card, index) => renderCard(card, index)} />
        </View>

        <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
          <Text style={styles.resignButtonText}>{isLocalGame ? 'Quit Game' : 'Resign'}</Text>
        </TouchableOpacity>

        {/* In-game chat (multiplayer only) */}
        {isMultiplayer && (
          <InGameChat roomId={mp?.room?.id || ''} currentUserId={userId} gameType={is4P ? 'blot-teams' : 'blot'} visible={isGameStarted && !!mp?.room?.id} />
        )}
      </View>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <ImageBackground source={require('../../../../assets/blot/park-background.png')} style={styles.container} blurRadius={3}>
      <LinearGradient colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']} style={styles.overlay}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          {(isGameStarted || isLocalGame) && (
            <GameToolbar
              title={mp?.room?.name || (isLocalGame ? 'Blot vs AI' : 'Blot')}
              onBack={() => navigation.goBack()}
              backgroundColor="transparent"
              rightElement={
                <TouchableOpacity onPress={() => setShowRoomNameModal(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.editRoomButton}>
                  <Text style={styles.editRoomIcon}>✏️</Text>
                </TouchableOpacity>
              }
            />
          )}
          {renderGameUI()}

          <RoomNameModal
            visible={showRoomNameModal}
            onClose={() => setShowRoomNameModal(false)}
            currentName={mp?.room?.name || 'Blot'}
            onSave={(name: string) => mp?.setRoomName(name)}
            gameType="Blot"
          />
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1 },
  menuContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  loader: { marginVertical: 30 },
  cancelButton: { backgroundColor: '#FF3B30', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  roomCodeLabel: { fontSize: 16, color: '#666', marginTop: 20 },
  roomCodeText: { fontSize: 36, fontWeight: 'bold', color: '#007AFF', marginVertical: 10, letterSpacing: 4 },
  waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  waitingTitle: { fontSize: 32, fontWeight: 'bold', marginBottom: 20, color: '#000' },
  waitingText: { fontSize: 16, color: '#666', marginBottom: 20 },
  waitingSubtext: { fontSize: 18, color: '#666', marginBottom: 40 },
  gameContainer: { flex: 1 },
  scoreBoard: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10, backgroundColor: 'transparent' },
  teamScore: { alignItems: 'center' },
  teamLabel: { fontSize: 14, color: '#fff', fontWeight: '600', marginBottom: 4 },
  score: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  trumpDisplay: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(26, 92, 63, 0.9)', padding: 12, borderRadius: 8, maxWidth: 70, maxHeight: 98 },
  trumpLabel: { fontSize: 12, color: '#fff', marginBottom: 4 },
  trumpSuit: { fontSize: 32 },
  playArea: { flex: 2, padding: 16, alignItems: 'center', justifyContent: 'center' },
  tableContainer: { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  cardTable: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  currentPlayerText: { fontSize: 18, fontWeight: 'bold', color: '#FFD700', textAlign: 'center', marginBottom: 4 },
  partnerLabel: { fontSize: 12, color: 'rgba(180,230,180,0.9)', textAlign: 'center', marginBottom: 10, fontStyle: 'italic' },
  trickArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  trickSlot: { position: 'absolute', alignItems: 'center' },
  trickSlotTop: { top: 14, left: 0, right: 0, alignItems: 'center' },
  trickSlotBottom: { bottom: 14, left: 0, right: 0, alignItems: 'center' },
  trickSlotLeft: { left: 14, top: '50%', marginTop: -75 },
  trickSlotRight: { right: 14, top: '50%', marginTop: -75 },
  trickPlayerName: { fontSize: 12, color: '#fff', marginBottom: 6, fontWeight: '600' },
  handContainer: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  handLabel: { fontSize: 16, color: '#fff', fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  card: { width: 80, height: 110, backgroundColor: '#fff', borderRadius: 8, borderWidth: 2, borderColor: '#ddd', justifyContent: 'space-between', alignItems: 'center', padding: 8, marginHorizontal: 5 },
  selectedCard: { borderColor: '#007AFF', backgroundColor: '#E3F2FD' },
  disabledCard: { opacity: 0.5 },
  cardRank: { fontSize: 24, fontWeight: 'bold' },
  cardSuit: { fontSize: 32 },
  cardValue: { fontSize: 12, color: '#666' },
  resignButton: { backgroundColor: '#FF3B30', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  resignButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  editRoomButton: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  editRoomIcon: { fontSize: 18 },
});

export default MultiplayerBlotScreenRefactored;
