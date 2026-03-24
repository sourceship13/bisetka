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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import RoomNameModal from '../../../components/RoomNameModal';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
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
import {BisetkaAlert} from '../../../utils/BisetkaAlert';
import {apiConfig} from '../../../libs/utils/api.utils';
import NardiDice from '../../../components/Games/NardiDice';
import { apiService } from '../../../services/api.service';
import { useAuth } from '../../../libs/hooks/useAuth';
import { useAchievements } from '../../../contexts/AchievementContext';
import { v4 as uuidv4 } from 'uuid';

const { width, height } = Dimensions.get('window');
const BOARD_SIZE = Math.min(width - 16, height * 0.75);

// Board layout — all values derived from BOARD_SIZE so they scale to any screen
// and the column centres align exactly with the triangles in the board image.
const BOARD_PADDING  = BOARD_SIZE * 0.04;                         // frame border on each side
const PLAYABLE_WIDTH = BOARD_SIZE - BOARD_PADDING * 2;
const BAR_WIDTH      = PLAYABLE_WIDTH * 0.05;                     // centre divider
const HALF_WIDTH     = (PLAYABLE_WIDTH - BAR_WIDTH) / 2;
const POINT_WIDTH    = (HALF_WIDTH / 6) * 1;                   // one triangle column (85% width)
const CHECKER_SIZE   = Math.round(POINT_WIDTH * 1.3);             // checker diameter
const TRIANGLE_HEIGHT = BOARD_SIZE * 0.40;                        // triangle region height

// Map point index (1-24) to screen coordinates
const getPointCoords = (pointNum: number): { x: number; y: number; isTop: boolean } => {
  const isTop = pointNum >= 13;
  
  // Determine which column (0-11) this point occupies
  // Bottom: 12,11,10,9,8,7 [BAR] 6,5,4,3,2,1
  // Top:    13,14,15,16,17,18 [BAR] 19,20,21,22,23,24
  let col = 0;
  if (pointNum >= 19) {
    col = 6 + (pointNum - 19);
  } else if (pointNum >= 13) {
    col = pointNum - 13;
  } else if (pointNum >= 7) {
    col = 5 - (pointNum - 7);
  } else {
    col = 11 - (pointNum - 1);
  }
  
  // x = frame border + column offset + half column width (= column centre)
  const leftHalf   = col < 6;
  const colInHalf  = leftHalf ? col : col - 6;
  const x = leftHalf
    ? BOARD_PADDING + colInHalf * POINT_WIDTH + POINT_WIDTH / 2
    : BOARD_PADDING + HALF_WIDTH + BAR_WIDTH + colInHalf * POINT_WIDTH + POINT_WIDTH / 2;
  
  // y = top of the column stack
  const y = isTop ? BOARD_PADDING : BOARD_SIZE - BOARD_PADDING;
  
  return { x, y, isTop };
};

type OpponentType = 'ai' | 'local';

const NardiScreen = ({ navigation, route }: any) => {
  const routeMode = route?.params?.mode;
  const session = route?.params?.session;
  const dbSessionId: string | undefined = route?.params?.dbSessionId;
  const isMultiplayer = routeMode === 'random' || routeMode === 'private-create' || routeMode === 'private-join' || routeMode === 'join-from-lobby' || routeMode === 'spectate';
  const userId: string = session?.user?.id || session?.id || session?.userId || route?.params?.userId || 'guest';
  const [isSpectating, setIsSpectating] = useState(false);
  const opponentType: OpponentType = isMultiplayer ? 'local' : (routeMode === 'ai' ? 'ai' : 'local');

  const [gameState, setGameState] = useState<NardiGameState | null>(null);
  const [showBlur, setShowBlur] = useState(true);
  const [showBackground, setShowBackground] = useState(true);
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
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
  }, []);

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
    if (gameState.currentPlayer !== 'black' || opponentType !== 'ai') return;
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
        if (!prev || prev.currentPlayer !== 'black') return prev;
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

  const renderPoint = (pointNum: number) => {
    if (!gameState) return null;
    
    // Convert 1-based point number to 0-based array index
    const pointIndex = pointNum - 1;
    const point = gameState.points[pointIndex];
    const checkers = point.checkers.length;
    const pos = getPointCoords(pointNum);
    
    // Get color from the top checker (last in array) if any
    const color = checkers > 0 ? point.checkers[point.checkers.length - 1] : null;
    const isSelected = selectedPoint === pointIndex;
    const myColorForRender = isMultiplayer ? myMpColorRef.current : 'white';

    // Check if this is a valid destination when a piece is selected (including bar entry when selectedPoint === -1)
    const isValidDestination = selectedPoint !== null && 
      gameState.possibleMoves.some(m => m.from === selectedPoint && m.to === pointIndex);
    
    // Also highlight as valid destination for bar entry even before bar is "selected"
    const isBarEntryDest = gameState.bar[gameState.currentPlayer] > 0 &&
      gameState.currentPlayer === myColorForRender &&
      gameState.possibleMoves.some(m => m.from === -1 && m.to === pointIndex);
    
    // Check if this piece can be moved (has any valid moves)
    const canMove = checkers > 0 &&
      gameState.phase === 'moving' &&
      gameState.currentPlayer === myColorForRender &&
      point.checkers[point.checkers.length - 1] === myColorForRender &&
      gameState.possibleMoves.some(m => m.from === pointIndex);

    const maxVisible = 5;
    const stackGap = CHECKER_SIZE * 0.35; // Slight overlap
    const visibleCheckers = Math.min(checkers, maxVisible);
    const stackHeight = checkers > 0 ? visibleCheckers * CHECKER_SIZE - (visibleCheckers - 1) * stackGap : CHECKER_SIZE;

    // Debug: Log first time we render pieces
    if (pointNum === 1 && checkers > 0) {
      console.log('🎨 Rendering point 1:', { checkers, color, pos, CHECKER_SIZE });
    }

    return (
      <TouchableOpacity
        key={pointNum}
        style={[
          styles.pointStack,
          {
            left: pos.x - CHECKER_SIZE / 2,
            width: CHECKER_SIZE,
            ...(pos.isTop
              ? { top: pos.y, minHeight: CHECKER_SIZE * 1.5 }
              : { top: pos.y - TRIANGLE_HEIGHT, height: TRIANGLE_HEIGHT, justifyContent: 'flex-end' as const }),
          },
          isSelected && styles.pointSelected,
          (isValidDestination || isBarEntryDest) && styles.validDestination,
          canMove && styles.canMove,
        ]}
        onPress={() => {
          console.log('🖱️ TouchableOpacity pressed for point:', pointNum, '(index:', pointIndex, ')');
          handlePointPress(pointIndex);
        }}
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
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: '#fff' }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const whiteTrayIsValidDestination =
    selectedPoint !== null &&
    gameState.currentPlayer === 'white' &&
    gameState.possibleMoves.some(m => m.from === selectedPoint && m.to === 24);
  const blackTrayIsValidDestination =
    selectedPoint !== null &&
    gameState.currentPlayer === 'black' &&
    gameState.possibleMoves.some(m => m.from === selectedPoint && m.to === -1);

  return (
    <ImageBackground
      source={require('../../../../assets/nardi/park-background.png')}
      style={styles.container}
      blurRadius={showBlur ? 3 : 0}>
      <LinearGradient
        colors={showBlur ? ['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)'] : ['transparent', 'transparent']}
        style={styles.overlay}>
        
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

          {/* Black player's borne-off tray (bottom left) */}
          <View style={{ 
            position: 'absolute',
            bottom: 120,
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
              style={[styles.board, { width: BOARD_SIZE, height: BOARD_SIZE, overflow: 'hidden' }]}
              imageStyle={{ borderRadius: 16 }}>
              
              {/* Render all points (1-24) */}
              {Array.from({ length: 24 }).map((_, i) => renderPoint(i + 1))}

              {/* Bar checkers — displayed in center bar area */}
              {(gameState.bar.white > 0 || gameState.bar.black > 0) && (
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    left: BOARD_PADDING + HALF_WIDTH,
                    width: BAR_WIDTH,
                    top: BOARD_PADDING,
                    bottom: BOARD_PADDING,
                    zIndex: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                  activeOpacity={0.7}
                  onPress={handleBarPress}>
                  {/* White bar checkers (bottom half of bar) */}
                  {gameState.bar.white > 0 && (
                    <View style={{
                      alignItems: 'center',
                      backgroundColor: selectedPoint === -1 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(255,255,255,0.15)',
                      borderRadius: CHECKER_SIZE / 2,
                      padding: 4,
                      borderWidth: selectedPoint === -1 ? 2 : 0,
                      borderColor: 'rgba(251, 191, 36, 1)',
                    }}>
                      <Image
                        source={require('../../../../assets/nardi/checker-white.png')}
                        style={{ width: CHECKER_SIZE * 0.8, height: CHECKER_SIZE * 0.8, resizeMode: 'contain' }}
                      />
                      {gameState.bar.white > 1 && (
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 8, paddingHorizontal: 4, marginTop: 2 }}>
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{gameState.bar.white}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {/* Black bar checkers (top half of bar) */}
                  {gameState.bar.black > 0 && (
                    <View style={{ alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: CHECKER_SIZE / 2, padding: 4 }}>
                      <Image
                        source={require('../../../../assets/nardi/checker-black.png')}
                        style={{ width: CHECKER_SIZE * 0.8, height: CHECKER_SIZE * 0.8, resizeMode: 'contain' }}
                      />
                      {gameState.bar.black > 1 && (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 8, paddingHorizontal: 4, marginTop: 2 }}>
                          <Text style={{ color: '#000', fontSize: 9, fontWeight: '700' }}>{gameState.bar.black}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              )}
              
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

          {/* White player's borne-off tray (top right) */}
          <View style={{ 
            position: 'absolute',
            top: 80,
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
            {!isMultiplayer && gameState.currentPlayer === 'black' && opponentType === 'ai' && (
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
              <LinearGradient
                colors={gameState.winner === myNardiColor ? ['#10b981', '#34d399'] : ['#ef4444', '#f87171']}
                style={styles.winCard}>
                <Text style={styles.winTitle}>
                  {gameState.winner === myNardiColor ? '🏆 You Win!' : (isMultiplayer ? '💀 Opponent Wins' : '💀 AI Wins')}
                </Text>
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
              </LinearGradient>
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
      </LinearGradient>

      {/* In-game chat overlay (multiplayer only) */}
      <InGameChat
        roomId={roomId || ''}
        currentUserId={userId}
        gameType="nardi"
        visible={isMultiplayer && mpStatus === 'playing' && !!roomId}
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
  winTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 24,
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
