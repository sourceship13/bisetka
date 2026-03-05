/**
 * REFACTORED: Nardi (Backgammon) Screen
 * 
 * **BEFORE:** 1116 lines (mixed AI + multiplayer with socket boilerplate)
 * **AFTER:** ~750 lines (AI logic preserved locally, multiplayer via hook)
 * 
 * Supports both AI mode and multiplayer mode.
 * Complex game: multiple move types (roll_dice, move_piece, end_turn),
 * 24 points, bar, home, dice management.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';
import RoomNameModal from '../../../components/RoomNameModal';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import LinearGradient from 'react-native-linear-gradient';
import {
  NardiGameState,
  PlayerColor,
  Dice,
  initializeNardiGame,
  rollDice,
  calculatePossibleMoves,
  executeMove,
  switchPlayer,
  Move,
} from '../../../game/nardiLogic';
import InGameChat from '../../../components/InGameChat';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';

// ─── Multiplayer imports ────────────────────────────────────────────────────
import { useMultiplayerGame, useMatchmakingUI } from '../../../multiplayer';
import { nardiAdapter, type NardiMoveMessage } from '../../../multiplayer/adapters/NardiGameAdapter';

// ─── Layout constants (unchanged) ───────────────────────────────────────────
const { width, height } = Dimensions.get('window');
const BOARD_SIZE = Math.min(width - 32, height * 0.65);
const BOARD_PADDING = BOARD_SIZE * 0.08;
const PLAYABLE_WIDTH = BOARD_SIZE - (BOARD_PADDING * 2);
const BAR_WIDTH = PLAYABLE_WIDTH * 0.05;
const HALF_WIDTH = (PLAYABLE_WIDTH - BAR_WIDTH) / 2;
const POINT_WIDTH = HALF_WIDTH / 6;
const CHECKER_SIZE = POINT_WIDTH * 0.90;
const PLAYABLE_HEIGHT = BOARD_SIZE - (BOARD_PADDING * 2);
const TRIANGLE_HEIGHT = PLAYABLE_HEIGHT * 0.45;

const getPointCoords = (pointNum: number): { x: number; y: number; isTop: boolean } => {
  const isTop = pointNum >= 13;
  let col = 0;
  if (pointNum >= 19) col = 6 + (pointNum - 19);
  else if (pointNum >= 13) col = pointNum - 13;
  else if (pointNum >= 7) col = 5 - (pointNum - 7);
  else col = 11 - (pointNum - 1);
  const leftHalf = col < 6;
  const colInHalf = leftHalf ? col : col - 6;
  const x = leftHalf
    ? BOARD_PADDING + (colInHalf * POINT_WIDTH) + (POINT_WIDTH / 2) + 2
    : BOARD_PADDING + HALF_WIDTH + BAR_WIDTH + (colInHalf * POINT_WIDTH) + (POINT_WIDTH / 2) + 2;
  const y = isTop ? BOARD_PADDING + (POINT_WIDTH * 0.00) : BOARD_SIZE - BOARD_PADDING - 12;
  return { x, y, isTop };
};

// ─── Helper ─────────────────────────────────────────────────────────────────
const getUsedDieValue = (move: Move, player: PlayerColor, dice: Dice): number => {
  if (move.from === -1) return player === 'white' ? move.to + 1 : 24 - move.to;
  if (move.to === 24 || move.to === -1) {
    const dist = player === 'white' ? (24 - move.from) : (move.from + 1);
    if (dice.die1 >= dist && dice.die1 > 0) return dice.die1;
    if (dice.die2 >= dist && dice.die2 > 0) return dice.die2;
    return dist;
  }
  return Math.abs(move.to - move.from);
};

const applyMoveLocal = (state: NardiGameState, move: Move): NardiGameState => {
  const newBoardState = executeMove(state, move);
  const usedDie = getUsedDieValue(move, state.currentPlayer, state.dice);
  const movesRemaining = Math.max(0, state.movesRemaining - 1);
  let newDice = { ...state.dice };
  if (newDice.die1 !== newDice.die2) {
    if (newDice.die1 === usedDie && newDice.die1 > 0) newDice.die1 = 0;
    else if (newDice.die2 === usedDie && newDice.die2 > 0) newDice.die2 = 0;
    else if (newDice.die1 > 0) newDice.die1 = 0;
    else if (newDice.die2 > 0) newDice.die2 = 0;
  }
  const updated: NardiGameState = { ...newBoardState, dice: newDice, movesRemaining, possibleMoves: [] };
  if (movesRemaining > 0) updated.possibleMoves = calculatePossibleMoves(updated);
  return updated;
};

// ─── Component ──────────────────────────────────────────────────────────────

const NardiScreenRefactored = ({ navigation, route }: any) => {
  const routeMode = route?.params?.mode;
  const session = route?.params?.session;
  const isMultiplayer = routeMode === 'random' || routeMode === 'private-create' || routeMode === 'private-join';
  const userId: string = session?.user?.id || session?.id || 'guest';
  const opponentType = isMultiplayer ? 'local' : (routeMode === 'ai' ? 'ai' : 'local');

  const [localGameState, setLocalGameState] = useState<NardiGameState | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const aiTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);

  useEffect(() => { setLocalGameState(initializeNardiGame('short')); }, []);
  useEffect(() => { setSelectedPoint(null); }, [localGameState]);
  useEffect(() => { return () => { aiTimeoutsRef.current.forEach(t => clearTimeout(t)); }; }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTIPLAYER (only when isMultiplayer)
  // ═══════════════════════════════════════════════════════════════════════════

  const mp = isMultiplayer ? useMultiplayerGame<NardiGameState, NardiMoveMessage>({
    gameType: 'nardi',
    userId,
    mode: routeMode as any,
    joinCode: (session as any)?.code,
    adapter: nardiAdapter,
    onGameStart: () => {
      setLocalGameState(initializeNardiGame('short'));
    },
    onMoveMade: (data: any) => {
      // The adapter handles state transitions via applyMove
    },
    onGameEnd: (data) => {
      const iWon = data.winnerId === userId;
      BisetkaAlert.success(
        iWon ? '🏆 You Win!' : '💀 You Lose',
        iWon ? 'Great game!' : 'Better luck next time',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    },
    onOpponentDisconnected: () => {
      BisetkaAlert.success('Opponent disconnected', 'You win by forfeit!');
    },
    onError: (msg) => BisetkaAlert.error('Error', msg),
  }) : null;

  const { showMatchmaking, showWaitingRoom } = useMatchmakingUI(
    isMultiplayer ? mp!.status : 'disconnected'
  );

  useGameEndRefresh(
    isMultiplayer ? (mp?.gameState?.winner != null) : (localGameState?.winner != null),
    'nardi'
  );

  // Unified state
  const gameState = isMultiplayer ? (mp?.gameState || localGameState) : localGameState;
  const myNardiColor: PlayerColor = isMultiplayer ? (mp?.myPlayer?.color || 'white') : 'white';
  const isMyTurn = isMultiplayer ? mp!.isMyTurn : (gameState?.currentPlayer === 'white');
  const roomId = mp?.room?.id || null;

  // ─── Nardi game actions ───────────────────────────────────────────────────

  const handleRollDice = () => {
    if (!gameState || gameState.phase !== 'rolling') return;
    if (gameState.currentPlayer !== myNardiColor) return;

    const dice = rollDice();
    const movesRemaining = dice.die1 === dice.die2 ? 4 : 2;
    const newState: NardiGameState = { ...gameState, dice, phase: 'moving', movesRemaining, possibleMoves: [] };
    newState.possibleMoves = calculatePossibleMoves(newState);

    if (isMultiplayer) {
      mp!.makeMove({ type: 'roll_dice', dice: { die1: dice.die1, die2: dice.die2 } });
    }

    if (newState.possibleMoves.length === 0) {
      if (isMultiplayer) mp!.makeMove({ type: 'end_turn' });
      setLocalGameState(switchPlayer(newState));
    } else {
      setLocalGameState(newState);
    }
  };

  const handleMove = (move: Move) => {
    if (!gameState) return;
    if (gameState.currentPlayer !== myNardiColor) return;

    const updated = applyMoveLocal(gameState, move);

    if (isMultiplayer) {
      mp!.makeMove({ type: 'move_piece', from: move.from, to: move.to });
    }

    if (updated.movesRemaining === 0 || updated.possibleMoves.length === 0) {
      if (isMultiplayer) mp!.makeMove({ type: 'end_turn' });
      setLocalGameState(switchPlayer(updated));
    } else {
      setLocalGameState(updated);
    }
  };

  // ─── AI turn logic (unchanged) ───────────────────────────────────────────
  useEffect(() => {
    if (!gameState || isMultiplayer) return;
    if (gameState.currentPlayer !== 'black' || opponentType !== 'ai') return;
    if (gameState.phase !== 'rolling') return;

    aiTimeoutsRef.current.forEach(t => clearTimeout(t));
    aiTimeoutsRef.current = [];

    const dice = rollDice();
    const movesRemaining = dice.die1 === dice.die2 ? 4 : 2;
    let currentState: NardiGameState = { ...gameState, dice, phase: 'moving', movesRemaining, possibleMoves: [] };
    currentState.possibleMoves = calculatePossibleMoves(currentState);

    if (currentState.possibleMoves.length === 0) {
      const t = setTimeout(() => setLocalGameState(switchPlayer(currentState)), 800);
      aiTimeoutsRef.current.push(t);
      return;
    }

    const statesSequence: NardiGameState[] = [currentState];
    let workingState = currentState;
    while (workingState.possibleMoves.length > 0 && workingState.movesRemaining > 0) {
      const move = workingState.possibleMoves[Math.floor(Math.random() * workingState.possibleMoves.length)]!;
      workingState = applyMoveLocal(workingState, move);
      statesSequence.push(workingState);
    }

    let delay = 800;
    statesSequence.forEach((s) => {
      const t = setTimeout(() => setLocalGameState(s), delay);
      aiTimeoutsRef.current.push(t);
      delay += 700;
    });

    const switchT = setTimeout(() => {
      setLocalGameState(prev => prev && prev.currentPlayer === 'black' ? switchPlayer(prev) : prev);
    }, delay);
    aiTimeoutsRef.current.push(switchT);
  }, [gameState?.currentPlayer, gameState?.phase, opponentType]);

  // Auto-skip when no valid moves
  useEffect(() => {
    if (!gameState || gameState.phase !== 'moving') return;
    if (gameState.currentPlayer !== myNardiColor) return;
    if (gameState.possibleMoves.length > 0 || gameState.movesRemaining <= 0) return;
    const t = setTimeout(() => {
      setLocalGameState(prev => {
        if (!prev || prev.currentPlayer !== myNardiColor || prev.phase !== 'moving') return prev;
        if (prev.possibleMoves.length > 0) return prev;
        return switchPlayer(prev);
      });
      if (isMultiplayer) mp?.makeMove({ type: 'end_turn' });
    }, 1500);
    return () => clearTimeout(t);
  }, [gameState?.currentPlayer, gameState?.phase, gameState?.possibleMoves?.length, gameState?.movesRemaining]);

  // ─── Point/bar tap handlers ───────────────────────────────────────────────
  const handleBarPress = () => {
    if (!gameState || gameState.currentPlayer !== myNardiColor || gameState.phase !== 'moving') return;
    if (gameState.bar[myNardiColor] <= 0) return;
    const barMoves = gameState.possibleMoves.filter(m => m.from === -1);
    if (barMoves.length === 1) { handleMove(barMoves[0]); setSelectedPoint(null); }
    else if (barMoves.length > 1) setSelectedPoint(-1);
  };

  const handlePointPress = (pointIndex: number) => {
    if (!gameState || gameState.currentPlayer !== myNardiColor || gameState.phase !== 'moving') return;

    if (gameState.bar[myNardiColor] > 0) {
      if (selectedPoint === -1) {
        const move = gameState.possibleMoves.find(m => m.from === -1 && m.to === pointIndex);
        if (move) { handleMove(move); setSelectedPoint(null); }
        else setSelectedPoint(null);
      } else {
        handleBarPress();
      }
      return;
    }

    if (selectedPoint === null) {
      const point = gameState.points[pointIndex];
      const hasOwnChecker = point.checkers.length > 0 && point.checkers[point.checkers.length - 1] === myNardiColor;
      if (hasOwnChecker && gameState.possibleMoves.some(m => m.from === pointIndex)) {
        setSelectedPoint(pointIndex);
      }
    } else {
      const move = gameState.possibleMoves.find(m => m.from === selectedPoint && m.to === pointIndex);
      if (move) { handleMove(move); setSelectedPoint(null); }
      else setSelectedPoint(null);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────
  const renderChecker = (color: 'white' | 'black', index: number) => (
    <Image
      key={index}
      source={color === 'white'
        ? require('../../../../assets/nardi/checker-white.png')
        : require('../../../../assets/nardi/checker-black.png')}
      style={styles.checker}
    />
  );

  const renderPoint = (pointNum: number) => {
    if (!gameState) return null;
    const pointIndex = pointNum - 1;
    const point = gameState.points[pointIndex];
    const checkers = point.checkers.length;
    const pos = getPointCoords(pointNum);
    const color = checkers > 0 ? point.checkers[point.checkers.length - 1] : null;
    const isSelected = selectedPoint === pointIndex;
    const isValidDestination = selectedPoint !== null && gameState.possibleMoves.some(m => m.from === selectedPoint && m.to === pointIndex);
    const isBarEntryDest = gameState.bar[gameState.currentPlayer] > 0 &&
      gameState.currentPlayer === myNardiColor &&
      gameState.possibleMoves.some(m => m.from === -1 && m.to === pointIndex);
    const canMove = checkers > 0 && gameState.phase === 'moving' && gameState.currentPlayer === myNardiColor &&
      point.checkers[point.checkers.length - 1] === myNardiColor && gameState.possibleMoves.some(m => m.from === pointIndex);

    const maxVisible = 5;
    const stackGap = CHECKER_SIZE * 0.35;
    const visibleCheckers = Math.min(checkers, maxVisible);

    return (
      <TouchableOpacity
        key={pointNum}
        style={[
          styles.pointStack,
          {
            left: pos.x - CHECKER_SIZE / 2,
            width: CHECKER_SIZE,
            backgroundColor: pos.isTop
              ? (pointNum % 2 === 0 ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 0, 255, 0.3)')
              : (pointNum % 2 === 0 ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 255, 0, 0.3)'),
            ...(pos.isTop
              ? { top: pos.y, minHeight: CHECKER_SIZE * 1.5 }
              : { top: pos.y - TRIANGLE_HEIGHT, height: TRIANGLE_HEIGHT, justifyContent: 'flex-end' as const }),
          },
          isSelected && styles.pointSelected,
          (isValidDestination || isBarEntryDest) && styles.validDestination,
          canMove && styles.canMove,
        ]}
        onPress={() => handlePointPress(pointIndex)}
        activeOpacity={0.8}>
        {checkers > 0 && Array.from({ length: visibleCheckers }).map((_, i) => (
          <View key={i} style={{ marginTop: i > 0 ? -stackGap : 0 }}>
            {renderChecker(color!, i)}
          </View>
        ))}
        {checkers > maxVisible && (
          <View style={styles.checkerCount}>
            <Text style={styles.checkerCountText}>{checkers}</Text>
          </View>
        )}
        {checkers === 0 && (isValidDestination || isBarEntryDest) && (
          <View style={styles.emptyDestinationMarker}>
            <Text style={styles.emptyDestinationText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!gameState) {
    return <SafeAreaView style={styles.container}><Text style={{ color: '#fff' }}>Loading...</Text></SafeAreaView>;
  }

  // ─── Matchmaking overlay ──────────────────────────────────────────────────
  const showMpOverlay = isMultiplayer && (showMatchmaking || showWaitingRoom);

  return (
    <ImageBackground source={require('../../../../assets/nardi/park-background.png')} style={styles.container} blurRadius={3}>
      <LinearGradient colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']} style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <GameToolbar
            title={isMultiplayer ? '🎲 Nardi (Online)' : '🎲 Nardi'}
            onBack={() => { if (isMultiplayer) mp?.resign(); navigation.goBack(); }}
            backgroundColor="transparent"
            rightElement={
              isMultiplayer && mp?.status === 'playing' ? (
                <TouchableOpacity onPress={() => setShowRoomNameModal(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                  <Text style={{ fontSize: 18 }}>✏️</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />

          {/* Matchmaking overlay */}
          {showMpOverlay && (
            <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', zIndex: 100, gap: 20 }}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={{ color: '#fff', fontSize: 18, textAlign: 'center', paddingHorizontal: 32 }}>
                {showMatchmaking ? 'Finding opponent...' : 'Waiting for game to start...'}
              </Text>
              {mp?.room?.code && <Text style={{ color: '#fbbf24', fontSize: 32, fontWeight: 'bold', letterSpacing: 6 }}>{mp.room.code}</Text>}
              <TouchableOpacity style={{ paddingHorizontal: 28, paddingVertical: 12, backgroundColor: '#ef4444', borderRadius: 10 }} onPress={() => { mp?.cancelMatchmaking(); navigation.goBack(); }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Home counts */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc' }} />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Home: {gameState.home.white}/15</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Home: {gameState.home.black}/15</Text>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#555' }} />
            </View>
          </View>

          <View style={styles.boardContainer}>
            <ImageBackground source={require('../../../../assets/nardi/board.png')} style={[styles.board, { width: BOARD_SIZE, height: BOARD_SIZE }]} imageStyle={{ borderRadius: 16 }}>
              {Array.from({ length: 24 }).map((_, i) => renderPoint(i + 1))}

              {/* Bar */}
              {(gameState.bar.white > 0 || gameState.bar.black > 0) && (
                <TouchableOpacity
                  style={{ position: 'absolute', left: BOARD_PADDING + HALF_WIDTH, width: BAR_WIDTH, top: BOARD_PADDING, bottom: BOARD_PADDING, zIndex: 20, alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  activeOpacity={0.7}
                  onPress={handleBarPress}>
                  {gameState.bar.white > 0 && (
                    <View style={{ alignItems: 'center', backgroundColor: selectedPoint === -1 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(255,255,255,0.15)', borderRadius: CHECKER_SIZE / 2, padding: 4, borderWidth: selectedPoint === -1 ? 2 : 0, borderColor: 'rgba(251, 191, 36, 1)' }}>
                      <Image source={require('../../../../assets/nardi/checker-white.png')} style={{ width: CHECKER_SIZE * 0.8, height: CHECKER_SIZE * 0.8, resizeMode: 'contain' }} />
                      {gameState.bar.white > 1 && <View style={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 8, paddingHorizontal: 4, marginTop: 2 }}><Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{gameState.bar.white}</Text></View>}
                    </View>
                  )}
                  {gameState.bar.black > 0 && (
                    <View style={{ alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: CHECKER_SIZE / 2, padding: 4 }}>
                      <Image source={require('../../../../assets/nardi/checker-black.png')} style={{ width: CHECKER_SIZE * 0.8, height: CHECKER_SIZE * 0.8, resizeMode: 'contain' }} />
                      {gameState.bar.black > 1 && <View style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 8, paddingHorizontal: 4, marginTop: 2 }}><Text style={{ color: '#000', fontSize: 9, fontWeight: '700' }}>{gameState.bar.black}</Text></View>}
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Dice */}
              <View style={[styles.centerDice, { top: BOARD_SIZE / 2 - 30, left: BOARD_SIZE / 2 - 60 }]}>
                {gameState.phase === 'moving' && gameState.dice.rolled && (
                  <View style={styles.diceContainer}>
                    {gameState.dice.die1 > 0 ? <View style={styles.die}><Text style={styles.dieText}>{gameState.dice.die1}</Text></View> : <View style={[styles.die, styles.dieUsed]}><Text style={styles.dieTextUsed}>-</Text></View>}
                    {gameState.dice.die2 > 0 ? <View style={styles.die}><Text style={styles.dieText}>{gameState.dice.die2}</Text></View> : <View style={[styles.die, styles.dieUsed]}><Text style={styles.dieTextUsed}>-</Text></View>}
                  </View>
                )}
              </View>
            </ImageBackground>
          </View>

          {/* Controls */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            {gameState.phase === 'rolling' && gameState.currentPlayer === myNardiColor && (
              <TouchableOpacity style={{ borderRadius: 16, overflow: 'hidden', elevation: 6 }} onPress={handleRollDice}>
                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>🎲 Roll Dice</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {gameState.phase === 'moving' && gameState.currentPlayer === myNardiColor && gameState.possibleMoves.length === 0 && gameState.movesRemaining > 0 && (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '600' }}>No valid moves — turn ending automatically...</Text>
              </View>
            )}
            {!isMultiplayer && gameState.currentPlayer === 'black' && opponentType === 'ai' && (
              <View style={styles.aiTurn}><Text style={styles.aiText}>🤖 AI is thinking...</Text></View>
            )}
            {isMultiplayer && gameState.currentPlayer !== myNardiColor && (
              <View style={styles.aiTurn}><Text style={styles.aiText}>⏳ Opponent's turn...</Text></View>
            )}
          </View>

          {/* Status */}
          <View style={styles.status}>
            <Text style={styles.statusText}>
              {gameState.currentPlayer === myNardiColor
                ? (myNardiColor === 'white' ? '⚪ Your Turn' : '⚫ Your Turn')
                : (isMultiplayer ? "⏳ Opponent's Turn" : '⚫ AI Turn')}
              {gameState.phase === 'rolling' && gameState.currentPlayer === myNardiColor && ' - Roll Dice'}
              {gameState.phase === 'moving' && gameState.currentPlayer === myNardiColor && gameState.possibleMoves.length > 0 &&
                ` - ${gameState.movesRemaining} move${gameState.movesRemaining !== 1 ? 's' : ''} left`}
            </Text>
            {gameState.bar[myNardiColor] > 0 && gameState.currentPlayer === myNardiColor && gameState.phase === 'moving' && (
              <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '600', marginTop: 2 }}>⚠️ Tap the bar to re-enter your checker!</Text>
            )}
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>First to bear off all 15 checkers wins!</Text>
          </View>

          {/* Winner overlay */}
          {gameState.winner && (
            <View style={styles.winOverlay}>
              <LinearGradient colors={gameState.winner === myNardiColor ? ['#10b981', '#34d399'] : ['#ef4444', '#f87171']} style={styles.winCard}>
                <Text style={styles.winTitle}>
                  {gameState.winner === myNardiColor ? '🏆 You Win!' : (isMultiplayer ? '💀 Opponent Wins' : '💀 AI Wins')}
                </Text>
                <TouchableOpacity style={styles.newGameBtn} onPress={() => setLocalGameState(initializeNardiGame('short'))}>
                  <Text style={styles.newGameText}>Play Again</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}
        </SafeAreaView>

        <RoomNameModal
          visible={showRoomNameModal}
          onClose={() => setShowRoomNameModal(false)}
          currentName={mp?.room?.name || 'Nardi'}
          onSave={(name: string) => mp?.setRoomName(name)}
          gameType="Nardi"
        />
      </LinearGradient>

      <InGameChat roomId={roomId || ''} currentUserId={userId} gameType="nardi" visible={isMultiplayer && mp?.status === 'playing' && !!roomId} />
    </ImageBackground>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1 },
  safeArea: { flex: 1 },
  boardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  board: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12, position: 'relative' },
  pointStack: { position: 'absolute', alignItems: 'center', zIndex: 10 },
  pointSelected: { backgroundColor: 'rgba(251, 191, 36, 0.6)', borderRadius: CHECKER_SIZE / 2, padding: 4, borderWidth: 2, borderColor: 'rgba(251, 191, 36, 1)' },
  validDestination: { backgroundColor: 'rgba(34, 197, 94, 0.4)', borderRadius: CHECKER_SIZE / 2, padding: 4, borderWidth: 2, borderColor: 'rgba(34, 197, 94, 1)' },
  canMove: { shadowColor: '#22c55e', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8 },
  checker: { width: CHECKER_SIZE, height: CHECKER_SIZE, resizeMode: 'contain' },
  checkerCount: { backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  checkerCountText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  emptyDestinationMarker: { width: CHECKER_SIZE, height: CHECKER_SIZE, borderRadius: CHECKER_SIZE / 2, backgroundColor: 'rgba(34, 197, 94, 0.3)', alignItems: 'center', justifyContent: 'center' },
  emptyDestinationText: { fontSize: 24, color: '#22c55e', fontWeight: 'bold' },
  centerDice: { position: 'absolute', zIndex: 10 },
  diceContainer: { flexDirection: 'row', gap: 10 },
  die: { width: 48, height: 48, backgroundColor: '#fff', borderRadius: 8, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  dieText: { fontSize: 26, fontWeight: '800', color: '#000' },
  dieUsed: { backgroundColor: '#e5e5e5', opacity: 0.5 },
  dieTextUsed: { fontSize: 26, fontWeight: '800', color: '#999' },
  aiTurn: { paddingVertical: 16, alignItems: 'center' },
  aiText: { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' },
  status: { paddingHorizontal: 16, paddingBottom: 12, alignItems: 'center' },
  statusText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  winOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  winCard: { borderRadius: 20, padding: 32, alignItems: 'center', minWidth: 280 },
  winTitle: { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 24 },
  newGameBtn: { backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  newGameText: { fontSize: 16, fontWeight: '700', color: '#000' },
});

export default NardiScreenRefactored;
