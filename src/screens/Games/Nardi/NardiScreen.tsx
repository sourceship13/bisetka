import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import RoomNameModal from '../../../components/RoomNameModal';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import Photosphere360Background from '../../../components/Photosphere360Background';
import LinearGradient from 'react-native-linear-gradient';
import {
  GameMode,
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
import {socketService} from '../../../services/SocketService';
import InGameChat from '../../../components/InGameChat';
import useDeviceType from '../../../hooks/useDeviceType';
import { getGameBoardSize } from '../../../utils/gameBoardSize';
import {BisetkaAlert} from '../../../utils/BisetkaAlert';
import {apiConfig} from '../../../libs/utils/api.utils';
import NardiDice from '../../../components/Games/NardiDice';
import { apiService } from '../../../services/api.service';
import { useAuth } from '../../../libs/hooks/useAuth';
import { useAchievements } from '../../../contexts/AchievementContext';
import { v4 as uuidv4 } from 'uuid';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';

const { width, height } = Dimensions.get('window');
// Must match getGameBoardSize(false, false, 600, 32) so piece coordinates
// stay in sync with the actual rendered ImageBackground size.
const BOARD_SIZE = Math.min(width - 32, 600);

// ── Base board geometry ─────────────────────────────────────────────────────
const BOARD_PADDING   = BOARD_SIZE * 0.04;   // frame border each side
const PLAYABLE_WIDTH  = BOARD_SIZE - BOARD_PADDING * 2;
const BAR_WIDTH       = PLAYABLE_WIDTH * 0.10;
const HALF_WIDTH      = (PLAYABLE_WIDTH - BAR_WIDTH) / 2;
const POINT_WIDTH     = HALF_WIDTH / 6;      // base column step (= column centre spacing)
const CHECKER_SIZE    = Math.round(POINT_WIDTH * 1.3);
const TRIANGLE_HEIGHT = BOARD_SIZE * 0.40;

// ── Per-quadrant fine-tuning ─────────────────────────────────────────────────
// xOffset  – shift all column centres in this quadrant left (−) or right (+)
// yOffset  – shift rows up (−) or down (+)
// colWidth – multiply the step between column centres (1.0 = default spacing,
//            0.9 = tighter, 1.1 = wider). Does NOT affect CHECKER_SIZE.
//
//  Quadrant layout (board viewed normally):
//    topLeft:     points 13-18   topRight:    points 19-24
//    bottomLeft:  points 7-12    bottomRight: points 1-6
const QUADRANT_LAYOUT = {
  //  xOffset: shift left (−) or right (+) in pixels
  //  yOffset: shift up (−) or down (+) in pixels
  //  colWidth: column-centre step multiplier (1.0 = 1 column-width apart, 0.9 = tighter, 1.1 = wider)
  topLeft:     { xOffset:  6, yOffset: 0, colWidth: 1.0 },  // ← tune to match triangle centres
  topRight:    { xOffset:  0, yOffset: 0, colWidth: 1.0 },
  bottomLeft:  { xOffset:  6, yOffset: 0, colWidth: 1.0 },  // ← tune to match triangle centres
  bottomRight: { xOffset:  0, yOffset: 0, colWidth: 1.0 },
};

// Map point index (1-24) → screen coordinates inside the ImageBackground
const getPointCoords = (pointNum: number): { x: number; y: number; isTop: boolean } => {
  const isTop    = pointNum >= 13;
  const leftHalf = pointNum >= 13 ? pointNum < 19 : pointNum >= 7;

  // Column index within its half (0 = leftmost triangle of that half)
  let colInHalf = 0;
  if (pointNum >= 19)      colInHalf = pointNum - 19;        // top-right:  0-5
  else if (pointNum >= 13) colInHalf = pointNum - 13;        // top-left:   0-5
  else if (pointNum >= 7)  colInHalf = 5 - (pointNum - 7);  // bottom-left:  0-5 (mirrored)
  else                     colInHalf = 11 - (pointNum - 1) - 6; // bottom-right: 0-5 (mirrored)

  const q = isTop && leftHalf  ? QUADRANT_LAYOUT.topLeft
          : isTop && !leftHalf ? QUADRANT_LAYOUT.topRight
          : !isTop && leftHalf ? QUADRANT_LAYOUT.bottomLeft
          :                      QUADRANT_LAYOUT.bottomRight;

  const step = POINT_WIDTH * q.colWidth;

  const baseX = leftHalf
    ? BOARD_PADDING + colInHalf * step + step / 2
    : BOARD_PADDING + HALF_WIDTH + BAR_WIDTH + colInHalf * step + step / 2;

  const baseY = isTop ? BOARD_PADDING : BOARD_SIZE - BOARD_PADDING;

  return { x: baseX + q.xOffset, y: baseY + q.yOffset, isTop };
};

type OpponentType = 'ai' | 'local';

const NardiScreen = ({ navigation, route }: any) => {
  const { isTablet, isLandscape } = useDeviceType();
  const boardSize = getGameBoardSize(isTablet, isLandscape, 600, 32);
  
  const routeMode = route?.params?.mode;
  const session = route?.params?.session;
  const dbSessionId: string | undefined = route?.params?.dbSessionId;
  const isMultiplayer = routeMode === 'random' || routeMode === 'private-create' || routeMode === 'private-join' || routeMode === 'join-from-lobby' || routeMode === 'spectate';
  const userId: string = session?.user?.id || session?.id || session?.userId || route?.params?.userId || 'guest';
  const [isSpectating, setIsSpectating] = useState(false);
  const opponentType: OpponentType = isMultiplayer ? 'local' : (routeMode === 'ai' ? 'ai' : 'local');

  const [gameState, setGameState] = useState<NardiGameState | null>(null);
  const [showBlur, setShowBlur] = useState(true);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [easyMode, setEasyMode] = useState(false); // Easy Mode: tap-to-move, Normal Mode: drag-to-move
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  // Ref so the PanResponder can read the in-progress drag source without stale closure
  const draggedFromRef = useRef<number | null>(null);
  const aiTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useGameEndRefresh(gameState?.winner != null, 'nardi');

  // ── multiplayer state ────────────────────────────────────────────
  const [mpStatus, setMpStatus] = useState<'idle'|'connecting'|'searching'|'waiting'|'playing'|'ended'>('idle');
  const [roomId, setRoomId] = useState<string|null>(null);
  const roomIdRef = useRef<string|null>(null);
  const [myMpColor, setMyMpColor] = useState<'white'|'black'>('white');
  const [roomName, setRoomName] = useState('Multiplayer Nardi');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);
  const roomNameRef = useRef(roomName);
  useEffect(() => { roomNameRef.current = roomName; }, [roomName]);

  const myMpColorRef = useRef<'white'|'black'>('white');
  const myNardiColor: 'white'|'black' = isMultiplayer ? myMpColor : 'white';

  // Entry fee and prize tracking
  const { user, refreshUser } = useAuth();
  const { showAchievements } = useAchievements();
  const [entryDeducted, setEntryDeducted] = useState(false);
  const [prizeAwarded, setPrizeAwarded] = useState(false);
  const gameIdRef = useRef<string>(dbSessionId || uuidv4());
  const [gameEntryInfo, setGameEntryInfo] = useState<{ winPrize: number; entryCost: number } | null>(null);

  useEffect(() => {
    apiService.getEntryInfo('nardi')
      .then(info => setGameEntryInfo({ winPrize: info.prizes.win, entryCost: info.entryCost }))
      .catch(() => {});
  }, []);

  // Entry fee deduction handler
  const handleGameStart = async () => {
    if (entryDeducted || !user?.id || isSpectating) return;

    try {
      console.log('💰 Deducting nardi entry fee...');
      const result = await apiService.deductEntry('nardi', gameIdRef.current);
      
      if (result.success) {
        console.log(`✅ Entry deducted: -50 points. Balance: ${result.newBalance}`);
        setEntryDeducted(true);
        refreshUser().catch(console.error);
      } else {
        console.error('❌ Insufficient points:', result.error);
        Alert.alert('Insufficient Points', result.error || 'You need 50 points to play nardi.', [
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
    if (prizeAwarded || !user?.id || isSpectating) return;

    try {
      const result = didWin ? 'win' : 'loss';
      console.log(`🏆 Awarding prize and logging game for ${result}...`);
      
      const prizeResult = await apiService.awardPrizeAndLog(
        'nardi',
        result,
        'ai', // Nardi is AI mode
        {
          gameId: gameIdRef.current,
          playerScore: didWin ? 1 : 0,
        }
      );
      
      if (prizeResult.success) {
        console.log(`✅ ${prizeResult.message}`);
        setPrizeAwarded(true);
        if (prizeResult.unlockedAchievements?.length > 0) {
          showAchievements(prizeResult.unlockedAchievements);
        }
        refreshUser().catch(console.error);
        
        if (didWin) {
          setTimeout(() => {
            Alert.alert('🏆 Victory!', `You won ${prizeResult.prize} points!\n\nNew balance: ${prizeResult.newBalance} points`);
          }, 2000);
        }
      }
    } catch (error: any) {
      console.error('❌ Prize award error:', error);
    }
  };

  // Clear selection whenever state changes
  useEffect(() => {
    if (gameState) {
      setSelectedPoint(null);
    }
  }, [gameState]);

  // Entry fee & prize logic
  // Deduct entry when game starts (AI mode starts when gameState is initialized, multiplayer waits for game_started)
  useEffect(() => {
    const shouldDeduct = (opponentType === 'ai' && gameState) || (isMultiplayer && mpStatus === 'playing' && gameState);
    if (shouldDeduct && !entryDeducted) {
      handleGameStart();
    }
  }, [opponentType, gameState, isMultiplayer, mpStatus, entryDeducted]);

  // Award prize when game ends
  useEffect(() => {
    if (gameState?.winner && !prizeAwarded) {
      const didWin = gameState.winner === myNardiColor;
      handleGameEnd(didWin);
    }
  }, [gameState?.winner, prizeAwarded, myNardiColor]);

  // Cleanup all AI timeouts on unmount
  useEffect(() => {
    return () => {
      aiTimeoutsRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    const initialState = initializeNardiGame('short');
    setGameState(initialState);
    
    // Perform opening roll in single-player after a brief delay
    if (opponentType === 'ai') {
      setTimeout(() => {
        performOpeningRoll();
      }, 500);
    }
  }, []);

  // Opening roll: both players roll, highest goes first
  const performOpeningRoll = () => {
    const playerRoll = Math.floor(Math.random() * 6) + 1;
    const aiRoll = Math.floor(Math.random() * 6) + 1;
    
    console.log('🎲 Opening roll - Player (white):', playerRoll, 'AI (black):', aiRoll);
    
    if (playerRoll === aiRoll) {
      // Tie, roll again
      setTimeout(() => performOpeningRoll(), 1000);
      return;
    }
    
    // Determine starting player and set dice
    const firstPlayer: PlayerColor = playerRoll > aiRoll ? 'white' : 'black';
    
    setGameState(prev => prev ? {
      ...prev,
      currentPlayer: firstPlayer,
      phase: 'rolling',
      dice: { die1: playerRoll, die2: aiRoll, rolled: true },
      movesRemaining: playerRoll !== aiRoll ? 2 : 0,
    } : prev);
    
    console.log('✅ Opening roll complete:', firstPlayer, 'goes first with dice', playerRoll, aiRoll);
  };

  // ── Multiplayer socket setup ────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer) return;
    let cancelled = false;
    setMpStatus('connecting');
    (async () => {
      try {
        await socketService.connect(userId, (session as any)?.access_token || 'temp-token');
        if (cancelled) return;
        const socket = socketService.getSocket();
        if (!socket) return;
        setMpStatus('searching');
        ['match_found','room_joined','opponent_joined','game_started','move_made','game_ended','opponent_disconnected','room_name_updated']
          .forEach(ev => socket.off(ev));
        let resolvedRoomId: string | null = null;

        // Listen for room name updates from other players
        socket.on('room_name_updated', (data: { roomId: string; dbSessionId?: string; roomName: string }) => {
          if (data.roomId === resolvedRoomId || data.roomId === roomIdRef.current ||
              data.dbSessionId === resolvedRoomId || data.dbSessionId === roomIdRef.current) {
            setRoomName(data.roomName);
          }
        });
        const onRoomAssigned = (data: any) => {
          if (cancelled) return;
          resolvedRoomId = data.roomId;
          roomIdRef.current = data.roomId;
          setRoomId(data.roomId);
          const color: 'white'|'black' = data.color === 'white' ? 'white' : 'black';
          myMpColorRef.current = color;
          setMyMpColor(color);
          setMpStatus('waiting');
        };
        socket.on('match_found', (data: any) => {
          onRoomAssigned(data);
          socket.emit('player_ready', {roomId: data.roomId, userId});
        });
        socket.on('room_joined', (data: any) => { onRoomAssigned(data); });
        socket.on('opponent_joined', () => {
          if (cancelled || !resolvedRoomId) return;
          socket.emit('player_ready', {roomId: resolvedRoomId, userId});
        });
        socket.on('game_started', () => {
          if (cancelled) return;
          setGameState(initializeNardiGame('short'));
          setMpStatus('playing');
        });
        socket.on('move_made', (data: any) => {
          if (cancelled) return;
          const mv = data.move;
          if (mv?.type === 'roll_dice') {
            setGameState(prev => {
              if (!prev || prev.phase !== 'rolling') return prev;
              // Skip if this is our own roll (already applied locally by handleRollDice)
              if (prev.currentPlayer === myMpColorRef.current) return prev;
              const {die1, die2} = mv.dice;
              const movesRemaining = die1 === die2 ? 4 : 2;
              const ns: NardiGameState = {
                ...prev,
                dice: {die1, die2, rolled: true},
                phase: 'moving',
                movesRemaining,
                possibleMoves: [],
              };
              ns.possibleMoves = calculatePossibleMoves(ns);
              return ns.possibleMoves.length === 0 ? switchPlayer(ns) : ns;
            });
          } else if (mv?.type === 'move_piece') {
            setGameState(prev => {
              if (!prev) return prev;
              // Skip if this is our own move (already applied locally by handleMove)
              if (prev.currentPlayer === myMpColorRef.current) return prev;
              return applyMove(prev, {
                from: mv.from,
                to: mv.to,
                checker: prev.currentPlayer,
              });
            });
          } else if (mv?.type === 'end_turn') {
            setGameState(prev => {
              if (!prev) return prev;
              // Skip if this is our own end_turn (already applied locally by handleMove)
              if (prev.currentPlayer === myMpColorRef.current) return prev;
              return switchPlayer(prev);
            });
          }
        });
        socket.on('game_ended', (data: any) => {
          if (cancelled) return;
          setMpStatus('ended');
          const iWon = data.winnerId === userId;
          setGameState(prev => prev ? {
            ...prev,
            winner: iWon ? myMpColorRef.current : (myMpColorRef.current === 'white' ? 'black' : 'white'),
          } : prev);
        });
        socket.on('opponent_disconnected', () => {
          if (cancelled) return;
          setMpStatus('ended');
          BisetkaAlert.success('Opponent disconnected', 'You win by forfeit!');
          setGameState(prev => prev ? {...prev, winner: myMpColorRef.current} : prev);
        });
        if (routeMode === 'random') {
          socket.emit('find_match', {gameType: 'nardi', userId});
        } else if (routeMode === 'private-create') {
          const roomData = await socketService.createPrivateRoom('nardi', userId, (session as any)?.code);
          if (!cancelled) { onRoomAssigned(roomData); socket.emit('player_ready', {roomId: roomData.roomId, userId}); }
        } else if (routeMode === 'private-join') {
          const joinCode = (session as any)?.code;
          if (joinCode) {
            const roomData = await socketService.joinPrivateRoom(joinCode, userId);
            if (!cancelled) onRoomAssigned(roomData);
          }
        } else if (routeMode === 'join-from-lobby' && dbSessionId) {
          socket.once('room_joined', (data: any) => {
            socket.off('spectate_started');
            if (!cancelled) {
              onRoomAssigned(data);
              socket.emit('player_ready', {roomId: data.roomId, userId});
            }
          });
          // Fallback: server may send spectate_started if game already in progress
          socket.once('spectate_started', (data: any) => {
            socket.off('room_joined');
            if (!cancelled) {
              setIsSpectating(true);
              roomIdRef.current = data.roomId;
              setRoomId(data.roomId);
              if (data.gameState) setGameState(data.gameState);
              setMpStatus('playing');
            }
          });
          socketService.joinRoomBySession(dbSessionId, userId);
        } else if (routeMode === 'spectate' && dbSessionId) {
          try {
            const data = await socketService.spectateRoom(dbSessionId, userId);
            if (!cancelled) {
              setIsSpectating(true);
              roomIdRef.current = data.roomId;
              setRoomId(data.roomId);
              if (data.gameState) setGameState(data.gameState);
              setMpStatus('playing');
            }
          } catch (err: any) {
            if (!cancelled) {
              BisetkaAlert.error('Error', err.message || 'Could not connect to this game.');
              navigation.goBack();
            }
          }
        }
      } catch {
        if (!cancelled) setMpStatus('idle');
      }
    })();
    return () => {
      cancelled = true;
      const socket = socketService.getSocket();
      if (socket) {
        ['match_found','room_joined','opponent_joined','game_started','move_made','game_ended','opponent_disconnected','room_name_updated']
          .forEach(ev => socket.off(ev));
        if (routeMode === 'random') socket.emit('cancel_matchmaking', {userId});
      }
    };
  }, []);

  // Helper: figure out which die value a move consumed.
  // For a bear-off (to === 24 or to === -1) we must pick the die whose value
  // is >= the actual distance so that high-roll bear-offs are handled correctly.
  const getUsedDieValue = (move: Move, player: PlayerColor, dice: Dice): number => {
    if (move.from === -1) {
      // Re-entering from bar: die equals the destination point number
      return player === 'white' ? move.to + 1 : 24 - move.to;
    }
    if (move.to === 24 || move.to === -1) {
      // Bearing off: find the die that is >= the distance (handles high-roll bear-offs)
      const dist = player === 'white' ? (24 - move.from) : (move.from + 1);
      // Prefer exact match first
      if (dice.die1 === dist && dice.die1 > 0) return dice.die1;
      if (dice.die2 === dist && dice.die2 > 0) return dice.die2;
      // Then take the smallest die that is still >= distance
      const candidates = [dice.die1, dice.die2].filter(d => d >= dist && d > 0);
      if (candidates.length > 0) return Math.min(...candidates);
      // Fallback: any remaining die
      if (dice.die1 > 0) return dice.die1;
      if (dice.die2 > 0) return dice.die2;
      return dist;
    }
    return Math.abs(move.to - move.from);
  };

  // Helper: apply a move to a state and return the updated state
  const applyMove = (state: NardiGameState, move: Move): NardiGameState => {
    const newBoardState = executeMove(state, move);
    const usedDie = getUsedDieValue(move, state.currentPlayer, state.dice);
    const movesRemaining = Math.max(0, state.movesRemaining - 1);

    let newDice = { ...state.dice };
    if (state.dice.die1 === state.dice.die2 && state.dice.die1 > 0) {
      // Doubles: keep the face value in both dice so calculatePossibleMoves
      // can still detect the doubles case. movesRemaining is the counter.
      // (no zeroing needed — movesRemaining reaching 0 ends the turn)
    } else {
      // Non-doubles: zero out whichever die matches the used value
      if (newDice.die1 === usedDie && newDice.die1 > 0) {
        newDice.die1 = 0;
      } else if (newDice.die2 === usedDie && newDice.die2 > 0) {
        newDice.die2 = 0;
      } else {
        // Fallback: consume any remaining die (e.g. high-roll bear-off)
        if (newDice.die1 > 0) newDice.die1 = 0;
        else if (newDice.die2 > 0) newDice.die2 = 0;
      }
    }

    const updated: NardiGameState = {
      ...newBoardState,
      dice: newDice,
      movesRemaining,
      possibleMoves: [],
    };

    if (movesRemaining > 0) {
      updated.possibleMoves = calculatePossibleMoves(updated);
    }

    return updated;
  };

  // Check if player can bear off (all checkers in home board)
  const canPlayerBearOff = (player: PlayerColor): boolean => {
    if (!gameState) return false;
    if (gameState.bar[player] > 0) return false;
    
    // White moves 0→23, bears off from home board 18-23
    // Black moves 23→0, bears off from home board 0-5
    const homeStart = player === 'white' ? 18 : 0;
    const homeEnd = player === 'white' ? 24 : 6;
    
    for (let i = 0; i < 24; i++) {
      if (i >= homeStart && i < homeEnd) continue;
      const point = gameState.points[i];
      if (point.checkers.some(c => c === player)) {
        return false;
      }
    }
    return true;
  };

  const handleRollDice = () => {
    if (!gameState || gameState.phase !== 'rolling') return;
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (gameState.currentPlayer !== myColor) return;

    const dice = rollDice();
    const movesRemaining = dice.die1 === dice.die2 ? 4 : 2;
    const newState: NardiGameState = {
      ...gameState,
      dice,
      phase: 'moving',
      movesRemaining,
      possibleMoves: [],
    };
    newState.possibleMoves = calculatePossibleMoves(newState);
    console.log('🎲 Rolled:', dice.die1, dice.die2, 'possible moves:', newState.possibleMoves.length);

    if (isMultiplayer && roomIdRef.current) {
      socketService.makeMove(roomIdRef.current, userId, {type: 'roll_dice', dice: {die1: dice.die1, die2: dice.die2}});
    }
    if (newState.possibleMoves.length === 0) {
      if (isMultiplayer && roomIdRef.current) {
        socketService.makeMove(roomIdRef.current, userId, {type: 'end_turn'});
      }
      setGameState(switchPlayer(newState));
    } else {
      setGameState(newState);
    }
  };

  const handleMove = (move: Move) => {
    if (!gameState) return;
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (gameState.currentPlayer !== myColor) return;

    const updated = applyMove(gameState, move);
    console.log('📍 Move:', move.from, '->', move.to, 'movesLeft:', updated.movesRemaining);

    if (isMultiplayer && roomIdRef.current) {
      socketService.makeMove(roomIdRef.current, userId, {type: 'move_piece', from: move.from, to: move.to});
    }
    if (updated.movesRemaining === 0 || updated.possibleMoves.length === 0) {
      if (isMultiplayer && roomIdRef.current) {
        socketService.makeMove(roomIdRef.current, userId, {type: 'end_turn'});
      }
      setGameState(switchPlayer(updated));
    } else {
      setGameState(updated);
    }
  };

  // === AI TURN LOGIC ===
  // When it becomes AI's turn (black + rolling), run the entire AI turn as a scheduled sequence.
  useEffect(() => {
    if (!gameState) return;
    if (isMultiplayer) return; // no AI in multiplayer mode
    if (gameState.currentPlayer !== 'black' || opponentType !== 'ai') return; // AI is black
    if (gameState.phase !== 'rolling') return;

    // Clear any previous AI timeouts
    aiTimeoutsRef.current.forEach(t => clearTimeout(t));
    aiTimeoutsRef.current = [];

    // Roll dice for AI
    const dice = rollDice();
    const movesRemaining = dice.die1 === dice.die2 ? 4 : 2;
    let currentState: NardiGameState = {
      ...gameState,
      dice,
      phase: 'moving',
      movesRemaining,
      possibleMoves: [],
    };
    currentState.possibleMoves = calculatePossibleMoves(currentState);

    console.log('🤖 AI Rolled:', dice.die1, dice.die2, 'possible moves:', currentState.possibleMoves.length);

    if (currentState.possibleMoves.length === 0) {
      // No moves - switch after brief delay
      const t = setTimeout(() => {
        setGameState(switchPlayer(currentState));
      }, 800);
      aiTimeoutsRef.current.push(t);
      return;
    }

    // Pre-calculate all AI moves
    const statesSequence: NardiGameState[] = [currentState];
    let workingState = currentState;

    while (workingState.possibleMoves.length > 0 && workingState.movesRemaining > 0) {
      const move = workingState.possibleMoves[Math.floor(Math.random() * workingState.possibleMoves.length)]!;
      console.log('🤖 AI planned move:', move.from, '->', move.to);
      workingState = applyMove(workingState, move);
      statesSequence.push(workingState);
    }

    // Schedule showing each state with delays
    let delay = 800; // Initial delay before first move shows
    statesSequence.forEach((s, i) => {
      const t = setTimeout(() => {
        setGameState(s);
      }, delay);
      aiTimeoutsRef.current.push(t);
      delay += 700;
    });

    // After all moves, switch to white
    const switchT = setTimeout(() => {
      setGameState(prev => {
        if (!prev || prev.currentPlayer !== 'black') return prev; // AI is black
        console.log('🤖 AI turn complete, switching to white');
        return switchPlayer(prev);
      });
    }, delay);
    aiTimeoutsRef.current.push(switchT);

  }, [gameState?.currentPlayer, gameState?.phase, opponentType]);

  // === AUTO-SKIP: If it's the player's turn with moves remaining but no possible moves, auto-end ===
  // Guard with a ref so that a stale timeout never fires after a new move has been made.
  const autoSkipGameStateRef = useRef<NardiGameState | null>(null);
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase !== 'moving') return;
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (gameState.currentPlayer !== myColor) return;
    if (gameState.possibleMoves.length > 0) return;
    if (gameState.movesRemaining <= 0) return;

    // Capture the exact state we're acting on
    autoSkipGameStateRef.current = gameState;
    console.log('⏭️ No valid moves with', gameState.movesRemaining, 'remaining — auto-ending turn');

    const t = setTimeout(() => {
      const mc = isMultiplayer ? myMpColorRef.current : 'white';
      setGameState(prev => {
        if (!prev) return prev;
        // Only switch if state hasn't changed (same player, same phase, still no moves)
        if (prev !== autoSkipGameStateRef.current) return prev;
        if (prev.currentPlayer !== mc || prev.phase !== 'moving') return prev;
        if (prev.possibleMoves.length > 0) return prev;
        return switchPlayer(prev);
      });
      if (isMultiplayer && roomIdRef.current) {
        socketService.makeMove(roomIdRef.current, userId, {type: 'end_turn'});
      }
    }, 1500);
    return () => {
      clearTimeout(t);
      autoSkipGameStateRef.current = null;
    };
  // Only re-run when we enter a genuinely new stuck state (player + phase + movesRemaining combo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.currentPlayer, gameState?.phase, gameState?.movesRemaining, gameState?.possibleMoves?.length]);

  // Handle tapping the bar (to enter checkers from bar)
  const handleBarPress = () => {
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (!gameState || gameState.currentPlayer !== myColor || gameState.phase !== 'moving') return;
    if (gameState.bar[myColor] <= 0) return;

    const barMoves = gameState.possibleMoves.filter(m => m.from === -1);
    console.log('🔴 Bar pressed, moves:', barMoves.length);

    if (barMoves.length === 1) {
      // Only one option — auto-execute
      console.log('✅ Auto-entering from bar to point', barMoves[0].to);
      handleMove(barMoves[0]);
      setSelectedPoint(null);
    } else if (barMoves.length > 1) {
      // Multiple entry points — select bar, let player pick destination
      setSelectedPoint(-1);
    }
  };

  const handleBearOffTrayPress = (player: PlayerColor) => {
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (!gameState || gameState.currentPlayer !== myColor || gameState.phase !== 'moving') return;
    if (player !== myColor) return;

    const bearOffTarget = player === 'white' ? 24 : -1;

    if (selectedPoint !== null) {
      const selectedBearOffMove = gameState.possibleMoves.find(
        m => m.from === selectedPoint && m.to === bearOffTarget,
      );

      if (selectedBearOffMove) {
        console.log('✅ Bearing off from selected point to tray:', selectedBearOffMove);
        handleMove(selectedBearOffMove);
      } else {
        console.log('❌ Selected point cannot bear off with current dice');
      }

      setSelectedPoint(null);
      return;
    }

    const bearOffMoves = gameState.possibleMoves.filter(m => m.to === bearOffTarget);
    if (bearOffMoves.length === 1) {
      console.log('✅ Auto-bearing off only available checker:', bearOffMoves[0]);
      handleMove(bearOffMoves[0]);
    }
  };

  const handlePointPress = (pointIndex: number) => {
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (!gameState || gameState.currentPlayer !== myColor || gameState.phase !== 'moving') {
      console.log('❌ Cannot press point:', {
        hasGame: !!gameState,
        player: gameState?.currentPlayer,
        phase: gameState?.phase,
      });
      return;
    }

    // If player has checkers on bar, they MUST enter from bar first
    if (gameState.bar[myColor] > 0) {
      // Only allow tapping destinations for bar entry
      if (selectedPoint === -1) {
        const move = gameState.possibleMoves.find(m => m.from === -1 && m.to === pointIndex);
        if (move) {
          console.log('✅ Entering from bar to point', pointIndex);
          handleMove(move);
          setSelectedPoint(null);
        } else {
          console.log('❌ Not a valid bar entry destination');
          setSelectedPoint(null);
        }
      } else {
        // Auto-select bar when they tap anything
        handleBarPress();
      }
      return;
    }
    
    console.log('👆 Point pressed:', pointIndex, 'selected:', selectedPoint);
    console.log('🎲 Current dice:', gameState.dice, 'movesRemaining:', gameState.movesRemaining);
    console.log('📋 Total possible moves:', gameState.possibleMoves.length);
    
    if (selectedPoint === null) {
      const point = gameState.points[pointIndex];
      const hasOwnChecker = point.checkers.length > 0 && 
        point.checkers[point.checkers.length - 1] === gameState.currentPlayer;
      console.log('🔍 Checking point:', { pointIndex, checkers: point.checkers.length, isOwn: hasOwnChecker });
      
      // Show which moves are available from this point
      const movesFromThisPoint = gameState.possibleMoves.filter(m => m.from === pointIndex);
      console.log('🎯 Moves from point', pointIndex + 1, ':', movesFromThisPoint.length, movesFromThisPoint);
      
      if (hasOwnChecker) {
        if (movesFromThisPoint.length > 0) {
          const bearOffMove = movesFromThisPoint.find(m => m.to >= 24 || m.to < 0);
          if (movesFromThisPoint.length === 1 && bearOffMove) {
            console.log('✅ Auto-bearing off from point:', pointIndex + 1);
            handleMove(bearOffMove);
            setSelectedPoint(null);
          } else {
            setSelectedPoint(pointIndex);
            console.log('✅ Selected point:', pointIndex + 1, 'with', movesFromThisPoint.length, 'possible moves');
          }
        } else {
          console.log('⚠️ No valid moves from point', pointIndex + 1);
        }
      }
    } else {
      const move = gameState.possibleMoves.find(m => m.from === selectedPoint && m.to === pointIndex);
      console.log('🎯 Looking for move:', { from: selectedPoint + 1, to: pointIndex + 1, found: !!move });
      console.log('📋 Available moves from selected point:', gameState.possibleMoves.filter(m => m.from === selectedPoint));
      if (move) {
        console.log('✅ Executing move:', move);
        handleMove(move);
        setSelectedPoint(null);
      } else {
        console.log('❌ No valid move, deselecting');
        setSelectedPoint(null);
      }
    }
  };

  const renderChecker = (color: 'white' | 'black', index: number) => (
    <Image
      key={index}
      source={color === 'white' 
        ? require('../../../../assets/nardi/checker-white.png')
        : require('../../../../assets/nardi/checker-black.png')}
      style={styles.checker}
    />
  );

  const handleSaveRoomName = async (newName: string) => {
    try {
      setRoomName(newName);
      if (roomIdRef.current) {
        socketService.setRoomName(roomIdRef.current, newName);
      }
      BisetkaAlert.success('Success', 'Room name updated!');
    } catch (error) {
      console.error('Failed to update room name:', error);
      BisetkaAlert.error('Error', 'Failed to update room name');
    }
  };

  // ── Board-level PanResponder for drag-to-move (default mode) ──────────────────
  // Created with useMemo so the object is stable across drag re-renders.
  // We use evt.nativeEvent.locationX/Y which are already in the board's local
  // coordinate space (relative to the ImageBackground), so no offset math needed.
  const boardPanResponder = useMemo(() => {
    if (easyMode) return null;
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    const gs = gameState; // capture snapshot for this closure

    const findDragSource = (tx: number, ty: number): number | null => {
      if (!gs || gs.phase !== 'moving' || gs.currentPlayer !== myColor) return null;
      for (let i = 0; i < 24; i++) {
        const pt = gs.points[i];
        if (!pt || pt.checkers.length === 0) continue;
        if (pt.checkers[pt.checkers.length - 1] !== myColor) continue;
        if (!gs.possibleMoves.some(m => m.from === i)) continue;
        const pos = getPointCoords(i + 1);
        if (Math.abs(tx - pos.x) < POINT_WIDTH * 0.8) return i;
      }
      // Bar: just check the player has pieces there — valid-move check happens at drop time
      if (gs.bar[myColor] > 0) {
        const barX = BOARD_PADDING + HALF_WIDTH + BAR_WIDTH / 2;
        if (Math.abs(tx - barX) < BAR_WIDTH + 6) return -1;
      }
      return null;
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const src = findDragSource(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        if (src !== null) { draggedFromRef.current = src; return true; }
        return false;
      },
      onMoveShouldSetPanResponder: (evt) => {
        // Fallback: claim mid-gesture if onStart was missed (e.g. pointerEvents pass-through timing)
        if (draggedFromRef.current !== null) return true;
        const src = findDragSource(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        if (src !== null) { draggedFromRef.current = src; return true; }
        return false;
      },
      onPanResponderGrant: (evt) => {
        const src = draggedFromRef.current;
        if (src === null) return;
        setDraggedFrom(src);
        setDragPosition({ x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY });
      },
      onPanResponderMove: (evt) => {
        setDragPosition({ x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY });
      },
      onPanResponderRelease: (evt) => {
        const from = draggedFromRef.current;
        const dropX = evt.nativeEvent.locationX;
        const dropY = evt.nativeEvent.locationY;
        if (from !== null && gs) {
          const validMoves = gs.possibleMoves.filter(m => m.from === from);
          let bestMove: Move | null = null;
          let bestDist = Infinity;
          for (const move of validMoves) {
            let destX: number;
            if (move.to >= 24)     { destX = BOARD_SIZE - BOARD_PADDING; }
            else if (move.to < 0) { destX = BOARD_PADDING; }
            else                  { destX = getPointCoords(move.to + 1).x; }
            // Use X-only distance — getPointCoords Y is edge-anchored (not center),
            // so Euclidean distance would fail for bar-entry drops mid-board.
            // Each point column has a unique X, so X-only is unambiguous.
            const dist = Math.abs(dropX - destX);
            if (dist < bestDist) { bestDist = dist; bestMove = move; }
          }
          if (bestMove && bestDist < POINT_WIDTH * 1.5) handleMove(bestMove);
        }
        draggedFromRef.current = null;
        setDraggedFrom(null);
        setDragPosition(null);
      },
      onPanResponderTerminate: () => {
        draggedFromRef.current = null;
        setDraggedFrom(null);
        setDragPosition(null);
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [easyMode, gameState]);

  const renderPoint = (pointNum: number) => {
    if (!gameState) return null;

    const pointIndex = pointNum - 1;
    const point = gameState.points[pointIndex];
    const checkers = point.checkers.length;
    const pos = getPointCoords(pointNum);
    const color = checkers > 0 ? point.checkers[point.checkers.length - 1] : null;
    const isSelected = selectedPoint === pointIndex;
    const myColorForRender = isMultiplayer ? myMpColorRef.current : 'white';

    const isValidDestination = easyMode && selectedPoint !== null &&
      gameState.possibleMoves.some(m => m.from === selectedPoint && m.to === pointIndex);
    const isBarEntryDest = easyMode &&
      gameState.bar[gameState.currentPlayer] > 0 &&
      gameState.currentPlayer === myColorForRender &&
      gameState.possibleMoves.some(m => m.from === -1 && m.to === pointIndex);
    const canMove = easyMode && checkers > 0 &&
      gameState.phase === 'moving' &&
      gameState.currentPlayer === myColorForRender &&
      point.checkers[point.checkers.length - 1] === myColorForRender &&
      gameState.possibleMoves.some(m => m.from === pointIndex);

    const maxVisible = 5;
    const stackGap = CHECKER_SIZE * 0.35;
    const visibleCheckers = Math.min(checkers, maxVisible);
    const isDragging = !easyMode && draggedFrom === pointIndex;

    const positionStyle = {
      left: pos.x - CHECKER_SIZE / 2,
      width: CHECKER_SIZE,
      ...(pos.isTop
        ? { top: pos.y, minHeight: CHECKER_SIZE * 1.5 }
        : { top: pos.y - TRIANGLE_HEIGHT, height: TRIANGLE_HEIGHT, justifyContent: 'flex-end' as const }),
    };

    const stackedCheckers = checkers > 0 && Array.from({ length: visibleCheckers }).map((_, i) => {
      const checkerIndex = checkers > maxVisible ? (checkers - visibleCheckers) + i : i;
      const individualColor = (point.checkers[checkerIndex] ?? color) as 'white' | 'black';
      return (
        <View key={i} style={{ marginTop: i > 0 ? -stackGap : 0, opacity: isDragging ? 0.25 : 1 }}>
          {renderChecker(individualColor, i)}
        </View>
      );
    });

    // Drag mode: plain non-interactive Views — board PanResponder handles all gestures
    if (!easyMode) {
      return (
        <View key={pointNum} style={[styles.pointStack, positionStyle]} pointerEvents="none">
          {stackedCheckers}
          {checkers > maxVisible && !isDragging && (
            <View style={styles.checkerCount}><Text style={styles.checkerCountText}>{checkers}</Text></View>
          )}
        </View>
      );
    }

    // Easy mode: tap-to-move with highlights
    return (
      <TouchableOpacity
        key={pointNum}
        style={[
          styles.pointStack,
          positionStyle,
          isSelected && styles.pointSelected,
          (isValidDestination || isBarEntryDest) && styles.validDestination,
          canMove && styles.canMove,
        ]}
        onPress={() => handlePointPress(pointIndex)}
        activeOpacity={0.8}>
        {stackedCheckers}
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
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: '#fff' }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // Tray highlights only shown in easy mode
  const whiteTrayIsValidDestination = easyMode &&
    selectedPoint !== null &&
    gameState.currentPlayer === 'white' &&
    gameState.possibleMoves.some(m => m.from === selectedPoint && m.to === 24);
  const blackTrayIsValidDestination = easyMode &&
    selectedPoint !== null &&
    gameState.currentPlayer === 'black' &&
    gameState.possibleMoves.some(m => m.from === selectedPoint && m.to === -1);

  return (
    <View style={styles.container}>
      <Photosphere360Background overlayOpacity={showBlur ? 0.5 : 0.3} />
        
        <SafeAreaView style={styles.safeArea}>
          <View>
            <GameToolbar
              title={isMultiplayer ? '🎲 Nardi (Online)' : '🎲 Nardi'}
              onBack={() => {
                if (isMultiplayer && roomIdRef.current) {
                  (socketService as any).resign?.(roomIdRef.current, userId);
                }
                navigation.goBack();
              }}
              backgroundColor="transparent"
              rightElement={
                <TouchableOpacity
                  onPress={() => { toolbarExpanded.value = !toolbarExpanded.value; }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ padding: 6, borderRadius: 8 }}>
                  <ReAnimated.Text style={[{ fontSize: 22, color: '#FFD700' }, chevronStyle]}>⌄</ReAnimated.Text>
                </TouchableOpacity>
              }
            />
            <ExpandableView isExpanded={toolbarExpanded} viewKey="nardiToolbarControls" duration={300}>
              <GameToolbarControls
                buttons={[
                  { icon: showBlur ? '🌫️' : '✨', onPress: () => setShowBlur(!showBlur) },
                  { icon: showBackground ? '🖼️' : '🔲', onPress: () => setShowBackground(!showBackground) },
                  { icon: easyMode ? '🎮' : '🎯', onPress: () => setEasyMode(!easyMode), label: easyMode ? 'Easy Mode' : 'Normal Mode' },
                  { icon: showMusicPlayer ? '🎵' : '🎶', onPress: () => setShowMusicPlayer(s => !s) },
                  ...(isMultiplayer && mpStatus === 'playing' ? [{ icon: '✏️', onPress: () => setShowRoomNameModal(true) }] : []),
                ]}
              />
            </ExpandableView>
          </View>

          {/* Matchmaking overlay */}
          {isMultiplayer && mpStatus !== 'playing' && mpStatus !== 'ended' && (
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(0,0,0,0.85)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              gap: 20,
            }}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={{ color: '#fff', fontSize: 18, textAlign: 'center', paddingHorizontal: 32 }}>
                {mpStatus === 'connecting' ? 'Connecting...' :
                 mpStatus === 'searching'  ? 'Finding opponent...' :
                 'Waiting for game to start...'}
              </Text>
              <TouchableOpacity
                style={{ paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 }}
                onPress={() => {
                  (socketService as any).cancelMatchmaking?.(userId);
                  navigation.goBack();
                }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Black player's borne-off tray (top left, below toolbar) */}
          <View style={{ 
            position: 'absolute',
            top: 140,
            left: 16,
            zIndex: 50,
          }}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={gameState.currentPlayer !== 'black'}
              onPress={() => handleBearOffTrayPress('black')}
              style={{
              backgroundColor: 'rgba(26, 26, 46, 0.95)',
              borderRadius: 12,
              borderWidth: blackTrayIsValidDestination ? 3 : 2,
              borderColor: blackTrayIsValidDestination ? '#fbbf24' : '#555',
              padding: 8,
              minWidth: 100,
              maxWidth: 130,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 5,
              elevation: 8,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#fff' }} />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {gameState.home.black}/15
                </Text>
              </View>
              <View style={{ 
                flexDirection: 'row', 
                flexWrap: 'wrap', 
                gap: 2,
                minHeight: 30,
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}>
                {Array.from({ length: gameState.home.black }).map((_, i) => (
                  <Image
                    key={i}
                    source={require('../../../../assets/nardi/checker-black.png')}
                    style={{ width: 14, height: 14, resizeMode: 'contain' }}
                  />
                ))}
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.boardContainer}>
            <ImageBackground
              source={require('../../../../assets/nardi/board-futuristic.png')}
              style={[styles.board, { width: boardSize, height: boardSize }]}
              imageStyle={{ borderRadius: 16 }}
              {...(boardPanResponder ? boardPanResponder.panHandlers : {})}>
              
              {/* Render all points (1-24) */}
              {Array.from({ length: 24 }).map((_, i) => renderPoint(i + 1))}

              {/* Floating drag piece — follows finger during drag */}
              {draggedFrom !== null && dragPosition !== null && (() => {
                const srcCheckers = draggedFrom >= 0
                  ? gameState.points[draggedFrom]?.checkers
                  : null;
                const dragColor = (srcCheckers && srcCheckers.length > 0
                  ? srcCheckers[srcCheckers.length - 1]
                  : (isMultiplayer ? myMpColorRef.current : 'white')) as 'white' | 'black';
                return (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: dragPosition.x - CHECKER_SIZE / 2,
                      top: dragPosition.y - CHECKER_SIZE / 2,
                      zIndex: 100,
                      opacity: 0.92,
                    }}>
                    <Image
                      source={dragColor === 'white'
                        ? require('../../../../assets/nardi/checker-white.png')
                        : require('../../../../assets/nardi/checker-black.png')}
                      style={{ width: CHECKER_SIZE, height: CHECKER_SIZE, resizeMode: 'contain' }}
                    />
                  </View>
                );
              })()}

              {/* Bar checkers — displayed in center bar area */}
              {(gameState.bar.white > 0 || gameState.bar.black > 0) && (() => {
                const myColor = isMultiplayer ? myMpColorRef.current : 'white';
                const whiteIsDragging = !easyMode && draggedFrom === -1 && myColor === 'white';
                const blackIsDragging = !easyMode && draggedFrom === -1 && myColor === 'black';

                const barContainerStyle = {
                  position: 'absolute' as const,
                  left: BOARD_PADDING + HALF_WIDTH,
                  width: BAR_WIDTH,
                  top: BOARD_PADDING,
                  bottom: BOARD_PADDING,
                  zIndex: 20,
                  alignItems: 'center' as const,
                  justifyContent: 'center' as const,
                  gap: 8,
                };

                // In drag mode: plain Views, board PanResponder handles touch
                if (!easyMode) {
                  return (
                    <View style={barContainerStyle} pointerEvents="none">
                      {gameState.bar.white > 0 && (
                        <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: CHECKER_SIZE / 2, padding: 4, opacity: whiteIsDragging ? 0.25 : 1 }}>
                          <Image source={require('../../../../assets/nardi/checker-white.png')} style={{ width: CHECKER_SIZE * 0.8, height: CHECKER_SIZE * 0.8, resizeMode: 'contain' }} />
                          {gameState.bar.white > 1 && (
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 8, paddingHorizontal: 4, marginTop: 2 }}>
                              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{gameState.bar.white}</Text>
                            </View>
                          )}
                        </View>
                      )}
                      {gameState.bar.black > 0 && (
                        <View style={{ alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: CHECKER_SIZE / 2, padding: 4, opacity: blackIsDragging ? 0.25 : 1 }}>
                          <Image source={require('../../../../assets/nardi/checker-black.png')} style={{ width: CHECKER_SIZE * 0.8, height: CHECKER_SIZE * 0.8, resizeMode: 'contain' }} />
                          {gameState.bar.black > 1 && (
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 8, paddingHorizontal: 4, marginTop: 2 }}>
                              <Text style={{ color: '#000', fontSize: 9, fontWeight: '700' }}>{gameState.bar.black}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                }

                // Easy mode: tap to select bar
                return (
                  <TouchableOpacity style={barContainerStyle} activeOpacity={0.7} onPress={handleBarPress}>
                    {gameState.bar.white > 0 && (
                      <View style={{
                        alignItems: 'center',
                        backgroundColor: selectedPoint === -1 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(255,255,255,0.15)',
                        borderRadius: CHECKER_SIZE / 2,
                        padding: 4,
                        borderWidth: selectedPoint === -1 ? 2 : 0,
                        borderColor: 'rgba(251, 191, 36, 1)',
                      }}>
                        <Image source={require('../../../../assets/nardi/checker-white.png')} style={{ width: CHECKER_SIZE * 0.8, height: CHECKER_SIZE * 0.8, resizeMode: 'contain' }} />
                        {gameState.bar.white > 1 && (
                          <View style={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 8, paddingHorizontal: 4, marginTop: 2 }}>
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{gameState.bar.white}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {gameState.bar.black > 0 && (
                      <View style={{ alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: CHECKER_SIZE / 2, padding: 4 }}>
                        <Image source={require('../../../../assets/nardi/checker-black.png')} style={{ width: CHECKER_SIZE * 0.8, height: CHECKER_SIZE * 0.8, resizeMode: 'contain' }} />
                        {gameState.bar.black > 1 && (
                          <View style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 8, paddingHorizontal: 4, marginTop: 2 }}>
                            <Text style={{ color: '#000', fontSize: 9, fontWeight: '700' }}>{gameState.bar.black}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })()}
              
              {/* Dice in center */}
              <View style={[styles.centerDice, { 
                top: BOARD_SIZE / 2 - 30,
                left: BOARD_SIZE / 2 - 60,
              }]}>
                {gameState.phase === 'moving' && gameState.dice.rolled && (
                  <View style={styles.diceContainer}>
                    {gameState.dice.die1 > 0 && (
                      <View style={styles.die}>
                        <Text style={styles.dieText}>{gameState.dice.die1}</Text>
                      </View>
                    )}
                    {gameState.dice.die1 === 0 && (
                      <View style={[styles.die, styles.dieUsed]}>
                        <Text style={styles.dieTextUsed}>-</Text>
                      </View>
                    )}
                    {gameState.dice.die2 > 0 && (
                      <View style={styles.die}>
                        <Text style={styles.dieText}>{gameState.dice.die2}</Text>
                      </View>
                    )}
                    {gameState.dice.die2 === 0 && (
                      <View style={[styles.die, styles.dieUsed]}>
                        <Text style={styles.dieTextUsed}>-</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ImageBackground>
          </View>

          {/* White player's borne-off tray (bottom right) */}
          <View style={{ 
            position: 'absolute',
            bottom: 120,
            right: 16,
            zIndex: 50,
          }}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={gameState.currentPlayer !== 'white'}
              onPress={() => handleBearOffTrayPress('white')}
              style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: 12,
              borderWidth: whiteTrayIsValidDestination ? 3 : 2,
              borderColor: whiteTrayIsValidDestination ? '#fbbf24' : '#ccc',
              padding: 8,
              minWidth: 100,
              maxWidth: 130,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 5,
              elevation: 8,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: '#333' }} />
                <Text style={{ color: '#1a1a2e', fontSize: 11, fontWeight: '700' }}>
                  {gameState.home.white}/15
                </Text>
              </View>
              <View style={{ 
                flexDirection: 'row', 
                flexWrap: 'wrap', 
                gap: 2,
                minHeight: 30,
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}>
                {Array.from({ length: gameState.home.white }).map((_, i) => (
                  <Image
                    key={i}
                    source={require('../../../../assets/nardi/checker-white.png')}
                    style={{ width: 14, height: 14, resizeMode: 'contain' }}
                  />
                ))}
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            {/* Opening Roll Display */}
            {gameState.phase === 'setup' && (
              <View style={{ alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                  🎲 Rolling to decide who goes first...
                </Text>
              </View>
            )}
            
            {gameState.phase === 'rolling' && gameState.dice.rolled && gameState.movesRemaining > 0 && !opponentType && (
              <View style={{ alignItems: 'center', padding: 12, backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: 12, marginBottom: 12 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                  Opening Roll: You rolled {gameState.currentPlayer === 'white' ? gameState.dice.die1 : gameState.dice.die2}, 
                  AI rolled {gameState.currentPlayer === 'black' ? gameState.dice.die1 : gameState.dice.die2}
                </Text>
                <Text style={{ color: '#fbbf24', fontSize: 13, marginTop: 4 }}>
                  {gameState.currentPlayer === 'white' ? 'You go first!' : 'AI goes first!'}
                </Text>
              </View>
            )}
            
            {gameState.phase === 'rolling' && gameState.currentPlayer === myNardiColor && (
              <NardiDice
                onRollComplete={(die1, die2) => {
                  console.log('🎲 Rolled:', die1, die2);
                  handleRollDice();
                }}
                enabled={true}
              />
            )}
            {/* No valid moves — End Turn button + auto-skip message */}
            {gameState.phase === 'moving' && gameState.currentPlayer === myNardiColor &&
             gameState.possibleMoves.length === 0 && gameState.movesRemaining > 0 && (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '600' }}>
                  No valid moves — turn ending automatically...
                </Text>
                <TouchableOpacity
                  style={{ borderRadius: 12, overflow: 'hidden' }}
                  onPress={() => {
                    setGameState(prev => prev ? switchPlayer(prev) : prev);
                  }}>
                  <LinearGradient
                    colors={['#ef4444', '#dc2626']}
                    style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>End Turn Now</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            {!isMultiplayer && gameState.currentPlayer === 'black' && opponentType === 'ai' && ( // AI is black
              <View style={styles.aiTurn}>
                <Text style={styles.aiText}>🤖 AI is thinking...</Text>
              </View>
            )}
            {isMultiplayer && gameState.currentPlayer !== myNardiColor && (
              <View style={styles.aiTurn}>
                <Text style={styles.aiText}>⏳ Opponent's turn...</Text>
              </View>
            )}
          </View>

          <View style={styles.status}>
            <Text style={styles.statusText}>
              {gameState.currentPlayer === myNardiColor
                ? (myNardiColor === 'white' ? '⚪ Your Turn' : '⚫ Your Turn')
                : (isMultiplayer ? "⏳ Opponent's Turn" : '⚫ AI Turn')}
              {gameState.phase === 'rolling' && gameState.currentPlayer === myNardiColor && ' - Roll Dice'}
              {gameState.phase === 'moving' && gameState.currentPlayer === myNardiColor &&
                gameState.possibleMoves.length > 0 &&
                ` - ${gameState.movesRemaining} move${gameState.movesRemaining !== 1 ? 's' : ''} left`}
            </Text>
            {gameState.bar[myNardiColor] > 0 && gameState.currentPlayer === myNardiColor && gameState.phase === 'moving' && (
              <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                ⚠️ Tap the bar to re-enter your checker!
              </Text>
            )}
            {canPlayerBearOff(myNardiColor) && gameState.currentPlayer === myNardiColor && gameState.phase === 'moving' && (
              <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                🎯 You can bear off! Tap a checker, then tap your tray.
              </Text>
            )}
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
              First to bear off all 15 checkers wins!
            </Text>
            {selectedPoint !== null && (
              <Text style={styles.statusText}>
                Point {selectedPoint + 1} selected - Tap destination or your tray
              </Text>
            )}
          </View>

          {gameState.winner && (
            <View style={styles.winOverlay}>
              <View style={[styles.winCard, gameState.winner === myNardiColor ? styles.winCardWin : styles.winCardLose]}>
                <Text style={styles.winTitle}>
                  {gameState.winner === myNardiColor ? '🏆 You Win!' : (isMultiplayer ? '💀 Opponent Wins' : '💀 AI Wins')}
                </Text>
                {gameEntryInfo && (
                  <Text style={[
                    styles.winPoints,
                    gameState.winner === myNardiColor ? styles.winPointsPositive : styles.winPointsNegative,
                  ]}>
                    {gameState.winner === myNardiColor
                      ? `+${gameEntryInfo.winPrize} points`
                      : `-${gameEntryInfo.entryCost} points`}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.newGameBtn}
                  onPress={() => {
                    setGameState(initializeNardiGame('short'));
                    setEntryDeducted(false);
                    setPrizeAwarded(false);
                    gameIdRef.current = uuidv4();
                  }}>
                  <Text style={styles.newGameText}>Play Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>

          {/* Room Name Editor Modal */}
          <RoomNameModal
            visible={showRoomNameModal}
            onClose={() => setShowRoomNameModal(false)}
            currentName={roomName}
            onSave={handleSaveRoomName}
            gameType="Nardi"
          />

      {/* In-game chat overlay (multiplayer only) */}
      <InGameChat
        roomId={roomId || ''}
        currentUserId={userId}
        gameType="nardi"
        visible={isMultiplayer && mpStatus === 'playing' && !!roomId}
      />
      <SyncedYouTubePlayer roomId={null} visible={showMusicPlayer} />
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  boardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    position: 'relative',
  },
  pointStack: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  pointSelected: {
    backgroundColor: 'rgba(251, 191, 36, 0.6)',
    borderRadius: CHECKER_SIZE / 2,
    padding: 4,
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 1)',
  },
  validDestination: {
    backgroundColor: 'rgba(34, 197, 94, 0.4)',
    borderRadius: CHECKER_SIZE / 2,
    padding: 4,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 1)',
  },
  canMove: {
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  checker: {
    width: CHECKER_SIZE,
    height: CHECKER_SIZE,
    resizeMode: 'contain',
  },
  checkerCount: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  checkerCountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  emptyDestinationMarker: {
    width: CHECKER_SIZE,
    height: CHECKER_SIZE,
    borderRadius: CHECKER_SIZE / 2,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDestinationText: {
    fontSize: 24,
    color: '#22c55e',
    fontWeight: 'bold',
  },
  centerDice: {
    position: 'absolute',
    zIndex: 10,
  },
  diceContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  die: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  dieText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000',
  },
  dieUsed: {
    backgroundColor: '#e5e5e5',
    opacity: 0.5,
  },
  dieTextUsed: {
    fontSize: 26,
    fontWeight: '800',
    color: '#999',
  },
  controls: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center', 


  },
  rollBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    flex:1,
  },
  rollGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rollText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  aiTurn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  aiText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
  },
  status: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  winOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  winCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
  },
  winCardWin: {
    backgroundColor: '#10b981',
  },
  winCardLose: {
    backgroundColor: '#ef4444',
  },
  winTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
  },
  winPoints: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
  },
  winPointsPositive: {
    color: '#d1fae5',
  },
  winPointsNegative: {
    color: '#fee2e2',
  },
  newGameBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  newGameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});

export default NardiScreen;
