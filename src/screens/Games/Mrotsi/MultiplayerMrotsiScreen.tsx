import React, {useState, useEffect, useRef, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  ImageBackground,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import GamePlayerOverlay from '../../../components/GamePlayerOverlay';
import RoomNameModal from '../../../components/RoomNameModal';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Photosphere360Background from '../../../components/Photosphere360Background';
import AR3DOverlay, {type AR3DOverlayHandle} from '../../../components/AR3DOverlay';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';
import ExpandableView from '../../../components/global/ExpandableView';
import {socketService} from '../../../services/SocketService';
import tokenService from '../../../services/token.service';
import InGameChat from '../../../components/InGameChat';
import {BisetkaAlert} from '../../../utils/BisetkaAlert';
import { useI18n } from '../../../hooks/useI18n';
import {useGameEndRefresh} from '../../../libs/hooks/useGameEndRefresh';
import {apiConfig} from '../../../libs/utils/api.utils';
import Dice3DSimple from '../../../components/Games/Dice3DSimple';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// ─── Score helpers (same logic as MrotsiScreen) ──────────────────────────────
function calculateScore(dice: number[]): number {
  const counts = new Map<number, number>();
  dice.forEach(d => counts.set(d, (counts.get(d) || 0) + 1));
  if (Array.from(counts.values()).some(c => c === 5)) return 100;
  if (Array.from(counts.values()).some(c => c === 4)) return 50;
  const values = Array.from(counts.values()).sort();
  if (values.length === 2 && values[0] === 2 && values[1] === 3) return 40;
  if (Array.from(counts.values()).some(c => c === 3)) return 30;
  if (values.filter(v => v === 2).length === 2) return 20;
  if (Array.from(counts.values()).some(c => c === 2)) return 10;
  return Math.floor(dice.reduce((a, b) => a + b, 0) / 10);
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

function rollDice(): number[] {
  return Array.from({length: 5}, () => Math.ceil(Math.random() * 6));
}

function getDiceEmoji(value: number): string {
  return ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][value - 1] ?? '⚀';
}

// ── Dice physics animation (deterministic, pre-computed) ──────────────────────
// Each frame: 5 dice × [normX (0-10000), normY (0-10000), face (1-6), rotation (0-359)]
const DICE_AREA_W = 1.0; // normalized width
const DICE_AREA_H = 0.35; // normalized height
const NUM_ROLL_FRAMES = 18;
const FRAME_MS = 60; // ms per frame

/** Seed-based deterministic RNG (mulberry32) */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function precomputeDiceRoll(finalDice: number[], seed: number): number[] {
  const rng = mulberry32(seed);
  const flat: number[] = [];
  // Generate 5 initial positions + velocities
  const dice = finalDice.map(() => ({
    x: 0.1 + rng() * 0.6,  // normalized 0-1 within area
    y: 0.1 + rng() * 0.15,
    vx: (rng() - 0.5) * 0.12,
    vy: (rng() - 0.5) * 0.08,
    rot: rng() * 360,
    vr: (rng() - 0.5) * 80,
  }));

  for (let frame = 0; frame < NUM_ROLL_FRAMES; frame++) {
    const isLast = frame >= NUM_ROLL_FRAMES - 2;
    for (let i = 0; i < 5; i++) {
      const d = dice[i];
      if (!isLast) {
        // Physics: move + bounce
        d.x += d.vx;
        d.y += d.vy;
        d.rot = (d.rot + d.vr) % 360;
        d.vx *= 0.88;
        d.vy *= 0.88;
        d.vr *= 0.85;
        // Bounce off walls (dice are ~0.14 wide normalized)
        if (d.x < 0.07) { d.x = 0.07; d.vx = Math.abs(d.vx); }
        if (d.x > 0.93) { d.x = 0.93; d.vx = -Math.abs(d.vx); }
        if (d.y < 0.07) { d.y = 0.07; d.vy = Math.abs(d.vy); }
        if (d.y > 0.93) { d.y = 0.93; d.vy = -Math.abs(d.vy); }
      } else {
        // Settle into final grid positions
        const spacing = 0.18;
        const startX = 0.5 - (4 * spacing) / 2;
        d.x = startX + i * spacing;
        d.y = 0.5;
        d.rot = 0;
      }
      const face = isLast ? finalDice[i] : Math.floor(rng() * 6) + 1;
      flat.push(Math.round(d.x * 10000));
      flat.push(Math.round(d.y * 10000));
      flat.push(face);
      flat.push(Math.round(((d.rot % 360) + 360) % 360));
    }
  }
  return flat;
}

type DiceFrame = { x: number; y: number; face: number; rot: number }[];

function decodeDiceFrames(flat: number[]): DiceFrame[] {
  const frames: DiceFrame[] = [];
  const stride = 5 * 4;
  for (let i = 0; i < flat.length; i += stride) {
    const frame: DiceFrame[number][] = [];
    for (let j = 0; j < 5; j++) {
      const b = i + j * 4;
      frame.push({
        x: flat[b] / 10000,
        y: flat[b + 1] / 10000,
        face: flat[b + 2],
        rot: flat[b + 3],
      });
    }
    frames.push(frame);
  }
  return frames;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface MrotsiGameState {
  player1Score: number;
  player2Score: number;
  currentRound: number;
  totalRounds: number;
  player1Dice: number[] | null;
  player2Dice: number[] | null;
  player1RoundScore: number | null;
  player2RoundScore: number | null;
  player1Combination: string | null;
  player2Combination: string | null;
}

interface RoundResult {
  roundWinner: 'player1' | 'player2' | 'tie';
  roundNumber: number;
  player1Dice: number[];
  player2Dice: number[];
  player1RoundScore: number;
  player2RoundScore: number;
  player1Combination?: string | null;
  player2Combination?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────
const MultiplayerMrotsiScreen = ({navigation, route}: any) => {
  const { translate } = useI18n();
  const {userId, mode: routeMode, joinCode, preMatch} = route.params ?? {};
  const {refreshOnGameEnd} = useGameEndRefresh(undefined, 'mrotsi');

  // UI state machine — initialize from the route param so the matchmaking modal
  // renders immediately on mount instead of flashing the menu first.
  const initialScreenState: 'menu' | 'matchmaking' | 'game' =
    routeMode === 'random' ||
    routeMode === 'private-create' ||
    routeMode === 'private-join'
      ? 'matchmaking'
      : 'menu';
  const [screen, setScreen] = useState<'menu' | 'matchmaking' | 'game'>(initialScreenState);
  const [showBlur, setShowBlur] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [arEnabled, setArEnabled] = useState(true);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const arOverlayRef = useRef<AR3DOverlayHandle>(null);
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const [gameStatus, setGameStatus] = useState(
    routeMode === 'random' ? 'Finding opponent...' : 'Waiting for opponent...',
  );
  const [roomId, setRoomId] = useState('');
  const roomIdRef = useRef('');
  const [roomCode, setRoomCode] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Player identity
  const [mySlot, setMySlot] = useState<'player1' | 'player2'>('player1');
  const mySlotRef = useRef<'player1' | 'player2'>('player1');

  // Game state
  const [gameState, setGameState] = useState<MrotsiGameState | null>(null);
  const [myDice, setMyDice] = useState<number[]>([]);
  const [hasRolled, setHasRolled] = useState(false);
  const [opponentHasRolled, setOpponentHasRolled] = useState(false);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundResult[]>([]);
  const [roomName, setRoomName] = useState('Multiplayer Mrotsi');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);
  const roomNameRef = useRef(roomName);
  useEffect(() => { roomNameRef.current = roomName; }, [roomName]);

  // Dice animation state
  const [myRolling, setMyRolling] = useState(false);
  const [opponentRolling, setOpponentRolling] = useState(false);
  const myFramesRef = useRef<DiceFrame[]>([]);
  const oppFramesRef = useRef<DiceFrame[]>([]);
  const myFrameIdxRef = useRef(0);
  const oppFrameIdxRef = useRef(0);
  const [myAnimFrame, setMyAnimFrame] = useState<DiceFrame | null>(null);
  const [oppAnimFrame, setOppAnimFrame] = useState<DiceFrame | null>(null);
  const myAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oppAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dice area width relative to screen
  const DICE_DISPLAY_W = SCREEN_WIDTH - 64;
  const DICE_DISPLAY_H = 80;

  const startPlayback = (
    framesRef: React.MutableRefObject<DiceFrame[]>,
    idxRef: React.MutableRefObject<number>,
    animTimerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
    setFrame: (f: DiceFrame | null) => void,
    setRolling: (v: boolean) => void,
    onDone?: () => void,
  ) => {
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    idxRef.current = 0;
    setRolling(true);
    animTimerRef.current = setInterval(() => {
      if (idxRef.current >= framesRef.current.length) {
        if (animTimerRef.current) clearInterval(animTimerRef.current);
        animTimerRef.current = null;
        setRolling(false);
        setFrame(null);
        onDone?.();
        return;
      }
      setFrame(framesRef.current[idxRef.current]);
      idxRef.current++;
    }, FRAME_MS);
  };

  // ─── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Connect socket first — ALL listeners must be registered AFTER the socket
    // exists, otherwise this.socket?.on(...) is a no-op and P1 never receives
    // game_started / opponent_joined.
    const initialize = async () => {
      try {
        await connectToServer();
      } catch {
        BisetkaAlert.error('Connection Error', 'Failed to connect to server');
        return;
      }

      // Register all listeners now that this.socket is valid
      // Room name updates from other players
      const socket = socketService.getSocket();
      if (socket) {
        socket.on('room_name_updated', (data: { roomId: string; dbSessionId?: string; roomName: string }) => {
          if (data.roomId === roomIdRef.current || data.dbSessionId === roomIdRef.current) {
            setRoomName(data.roomName);
          }
        });
      }

      socketService.onMatchmakingStatus(data => {
        if (data.status === 'searching') setGameStatus('Searching for opponent...');
      });

      socketService.onOpponentJoined(data => {
        setGameStatus(`Opponent found! Get ready...`);
      });

      socketService.onGameStarted(data => {
        setGameStatus('Game started!');
        setScreen('game');
        setGameState({
          player1Score: 0, player2Score: 0,
          currentRound: 1, totalRounds: 5,
          player1Dice: null, player2Dice: null,
          player1RoundScore: null, player2RoundScore: null,
          player1Combination: null, player2Combination: null,
        });
        setHasRolled(false);
        setOpponentHasRolled(false);
        setLastRoundResult(null);
        setRoundHistory([]);
      });

      socketService.onMoveMade((data: any) => {
        const gs: MrotsiGameState = data.gameState;
        const rolledBy: 'player1' | 'player2' = data.rolledBy;

        const liveSlot = mySlotRef.current;
        const opponentSlot = liveSlot === 'player1' ? 'player2' : 'player1';

        if (rolledBy === opponentSlot) {
          setOpponentHasRolled(true);
          // Play opponent dice animation if frames were included
          const moveData = data.move;
          if (moveData?.diceFrames?.length) {
            oppFramesRef.current = decodeDiceFrames(moveData.diceFrames);
            startPlayback(oppFramesRef, oppFrameIdxRef, oppAnimRef, setOppAnimFrame, setOpponentRolling);
          }
        }

        setGameState(gs);

        if (data.roundComplete && data.roundResult) {
          const result: RoundResult = data.roundResult;
          setLastRoundResult(result);
          setRoundHistory(prev => [...prev, result]);
          // Reset per-round roll flags
          setHasRolled(false);
          setOpponentHasRolled(false);
          setMyDice([]);
        }
      });

      socketService.onGameEnded((data: any) => {
        refreshOnGameEnd().catch(console.error);
        const {winnerId, finalScore} = data;
        const didIWin = winnerId === userId;
        const isDraw = !winnerId;

        const title = isDraw ? 'Draw!' : didIWin ? 'You Won! 🎉' : 'You Lost';
        const message = isDraw
          ? `Final score: ${finalScore?.player1 ?? 0} – ${finalScore?.player2 ?? 0}`
          : didIWin
          ? `You won! ${finalScore?.player1 ?? 0} – ${finalScore?.player2 ?? 0}`
          : `Opponent won! ${finalScore?.player1 ?? 0} – ${finalScore?.player2 ?? 0}`;

        BisetkaAlert.alert(title, message, [
          {text: 'Play Again', onPress: () => navigation.replace('GameMode', {gameType: 'mrotsi'})},
          {text: 'Exit', onPress: () => navigation.navigate('Home' as never)},
        ]);
      });

      socketService.onOpponentDisconnected(() => {
        refreshOnGameEnd().catch(console.error);
        BisetkaAlert.warning('Opponent Disconnected', 'Your opponent has left the game.', [
          {text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'mrotsi'})},
        ]);
      });

      socketService.onError((error: any) => {
        BisetkaAlert.error('Error', error.message);
      });

      // Auto-start
      if (routeMode === 'random') {
        if (preMatch) {
          roomIdRef.current = preMatch.roomId;
          const slot: 'player1' | 'player2' =
            preMatch.color === 'white' ? 'player1' : 'player2';
          mySlotRef.current = slot;
          setMySlot(slot);
          setRoomId(preMatch.roomId);
          setGameStatus('Opponent found! Get ready...');
          socketService.playerReady(preMatch.roomId, userId);
        } else {
          handleFindMatch();
        }
      } else if (routeMode === 'private-create') {
        handleCreatePrivateRoom();
      } else if (routeMode === 'private-join' && joinCode) {
        setJoinRoomCode(joinCode);
      }
    };
    initialize();

    return () => {
      socketService.removeAllListeners();
      socketService.disconnect();
    };
  }, []);

  // Auto-join when code is ready
  useEffect(() => {
    if (routeMode === 'private-join' && joinRoomCode) {
      handleJoinPrivateRoom();
    }
  }, [joinRoomCode, routeMode]);

  const connectToServer = async () => {
    const token = await tokenService.getAccessToken() ?? 'guest';
    await socketService.connect(userId, token);
  };

  const handleFindMatch = async () => {
    setScreen('matchmaking');
    setGameStatus('Finding opponent...');
    try {
      const matchData = await socketService.findMatch('mrotsi', userId);
      roomIdRef.current = matchData.roomId;
      // Slot is determined by color: white → player1, black → player2
      const slot: 'player1' | 'player2' = matchData.color === 'white' ? 'player1' : 'player2';
      mySlotRef.current = slot;
      setMySlot(slot);
      setRoomId(matchData.roomId);
      socketService.playerReady(matchData.roomId, userId);
    } catch (err: any) {
      BisetkaAlert.error('Matchmaking Error', err.message);
      setScreen('menu');
    }
  };

  const handleCreatePrivateRoom = async () => {
    try {
      const roomData = await socketService.createPrivateRoom('mrotsi', userId, joinCode);
      roomIdRef.current = roomData.roomId;
      mySlotRef.current = 'player1';
      setMySlot('player1');
      setRoomId(roomData.roomId);
      setRoomCode(roomData.roomCode);
      setScreen('matchmaking');
      setGameStatus(`Room created! Share code: ${roomData.roomCode}`);
      socketService.playerReady(roomData.roomId, userId);
    } catch (err: any) {
      BisetkaAlert.error('Error', err?.message || String(err) || 'Failed to create room');
    }
  };

  const handleJoinPrivateRoom = async () => {
    try {
      const roomData = await socketService.joinPrivateRoom(joinRoomCode || joinCode, userId);
      roomIdRef.current = roomData.roomId;
      mySlotRef.current = 'player2';
      setMySlot('player2');
      setRoomId(roomData.roomId);
      setScreen('matchmaking');
      setGameStatus('Joined room! Waiting for game to start...');
      socketService.playerReady(roomData.roomId, userId);
    } catch (err: any) {
      BisetkaAlert.error('Error', err?.message || String(err) || 'Failed to join room');
    }
  };

  const handleRollDice = () => {
    if (hasRolled || !gameState || myRolling) return;
    const dice = rollDice();
    const score = calculateScore(dice);
    const combination = getScoreName(dice);

    // Pre-compute deterministic animation using a random seed
    const seed = Math.floor(Math.random() * 2147483647);
    const encoded = precomputeDiceRoll(dice, seed);

    // Play own animation
    myFramesRef.current = decodeDiceFrames(encoded);
    startPlayback(myFramesRef, myFrameIdxRef, myAnimRef, setMyAnimFrame, setMyRolling, () => {
      setMyDice(dice);
    });

    setHasRolled(true);
    socketService.makeMove(roomIdRef.current, userId, {
      type: 'roll_dice', dice, score, combination,
      diceFrames: encoded,
    });
  };

  // Clean up animation timers
  useEffect(() => {
    return () => {
      if (myAnimRef.current) clearInterval(myAnimRef.current);
      if (oppAnimRef.current) clearInterval(oppAnimRef.current);
    };
  }, []);

  // ─── Render helpers ─────────────────────────────────────────────────────────
  const myScore = mySlot === 'player1' ? gameState?.player1Score ?? 0 : gameState?.player2Score ?? 0;
  const opponentScore = mySlot === 'player1' ? gameState?.player2Score ?? 0 : gameState?.player1Score ?? 0;
  const opponentDice = mySlot === 'player1' ? gameState?.player2Dice : gameState?.player1Dice;

  // ─── Screens ────────────────────────────────────────────────────────────────
  if (screen === 'menu') {
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

  // Room name listener — registered after socket connects (inside mp setup)

    return (
      <View style={styles.backgroundImage}>
      <Photosphere360Background overlayOpacity={0.4} />
      <SafeAreaView style={styles.container}>
          <Text style={styles.subtitle}>5 rounds · simultaneous dice rolling</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleFindMatch}>
            <Text style={styles.primaryBtnText}>Find Random Match</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleCreatePrivateRoom}>
            <Text style={styles.secondaryBtnText}>Create Private Room</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowJoinModal(true)}>
            <Text style={styles.secondaryBtnText}>Join with Code</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Join modal */}
        <Modal visible={showJoinModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Enter Room Code</Text>
              <TextInput
                style={styles.codeInput}
                value={joinRoomCode}
                onChangeText={setJoinRoomCode}
                placeholder="Room code"
                placeholderTextColor="#888"
                autoCapitalize="characters"
                maxLength={6}
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={() => {
                setShowJoinModal(false);
                handleJoinPrivateRoom();
              }}>
                <Text style={styles.primaryBtnText}>Join</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        {/* Room Name Editor Modal */}
        <RoomNameModal
          visible={showRoomNameModal}
          onClose={() => setShowRoomNameModal(false)}
          currentName={roomName}
          onSave={handleSaveRoomName}
          gameType="Mrotsi"
        />
      </View>
    );
  }

  if (screen === 'matchmaking') {
    return (
      <View style={styles.backgroundImage}>
      <Photosphere360Background overlayOpacity={0.4} />
      <SafeAreaView style={styles.container}>
        <GameToolbar title="Mrotsi Multiplayer" onBack={() => navigation.goBack()} backgroundColor="transparent" />
        <View style={styles.menuContainer}>
          <ActivityIndicator size="large" color="#F5A623" />
          <Text style={styles.statusText}>{gameStatus}</Text>
          {roomCode ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Room Code</Text>
              <Text style={styles.codeValue}>{roomCode}</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
      </View>
    );
  }

  // ─── Game screen ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.backgroundImage}>
    <Photosphere360Background overlayOpacity={showBlur ? 0.5 : 0.3}>
      <AR3DOverlay ref={arOverlayRef} visible={arEnabled} boardGlbPath="glb/game_boards/rounded_table_panel_v4.glb" />
    </Photosphere360Background>
    <View style={styles.overlay} pointerEvents="box-none">
    <GamePlayerOverlay opponent={null} />
    <SafeAreaView style={styles.container}>
      <View>
        <GameToolbar
          title={`Mrotsi — Round ${gameState?.currentRound ?? 1}/${gameState?.totalRounds ?? 5}`}
          onBack={() =>
            BisetkaAlert.alert('Resign?', 'Leave the game?', [
              {text: 'Stay', style: 'cancel'},
              {text: 'Leave', style: 'destructive', onPress: () => {
                socketService.resignGame?.(roomIdRef.current, userId);
                navigation.replace('GameMode', {gameType: 'mrotsi'});
              }},
            ])
          }
          backgroundColor="transparent"
        />
        <View>
          <GameToolbarControls
            buttons={[
              { icon: showBackground ? '🖼️' : '🔲', onPress: () => setShowBackground(!showBackground) },
              { icon: '✏️', onPress: () => setShowRoomNameModal(true) },
              { icon: arEnabled ? '🥽' : '🎮', onPress: () => setArEnabled(!arEnabled) },
              { icon: showMusicPlayer ? '🎵' : '🎶', onPress: () => setShowMusicPlayer(s => !s) },
            ]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
        {/* Score bar */}
        <View style={styles.scoreBar}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>You</Text>
            <Text style={styles.scoreValue}>{myScore}</Text>
          </View>
          <Text style={styles.scoreSep}>vs</Text>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Opponent</Text>
            <Text style={styles.scoreValue}>{opponentScore}</Text>
          </View>
        </View>

        {/* Last round result */}
        {lastRoundResult && (
          <View style={styles.roundResultBox}>
            <Text style={styles.roundResultTitle}>Round {lastRoundResult.roundNumber} result</Text>
            <Text style={styles.roundResultText}>
              {lastRoundResult.roundWinner === 'tie'
                ? "It's a tie!"
                : lastRoundResult.roundWinner === mySlot
                ? 'You won this round! 🎉'
                : 'Opponent won this round'}
            </Text>
          </View>
        )}

        {/* Opponent section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opponent</Text>
          <View style={styles.diceRow}>
            {(opponentDice && opponentDice.length === 5 ? opponentDice : [1, 1, 1, 1, 1]).map((d, i) => (
              <Dice3DSimple key={i} value={d} isRolling={opponentRolling} index={i} />
            ))}
          </View>
          {opponentHasRolled && opponentDice && !opponentRolling ? (
            <Text style={styles.combinationText}>
              {getScoreName(opponentDice)} ({mySlot === 'player1' ? gameState?.player2RoundScore : gameState?.player1RoundScore} pts)
            </Text>
          ) : (
            <Text style={styles.waitingText}>
              {opponentRolling ? 'Rolling...' : opponentHasRolled ? 'Rolled!' : 'Waiting to roll...'}
            </Text>
          )}
        </View>

        {/* Player section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>You</Text>
          <View style={styles.diceRow}>
            {(myDice.length === 5 ? myDice : [1, 1, 1, 1, 1]).map((d, i) => (
              <Dice3DSimple key={i} value={d} isRolling={myRolling} index={i} />
            ))}
          </View>
          {myDice.length > 0 && !myRolling && (
            <Text style={styles.combinationText}>
              {getScoreName(myDice)} ({calculateScore(myDice)} pts)
            </Text>
          )}

          <TouchableOpacity
            style={[styles.rollBtn, (hasRolled || myRolling) && styles.rollBtnDisabled]}
            onPress={handleRollDice}
            disabled={hasRolled || myRolling}>
            <Text style={styles.rollBtnText}>{myRolling ? '🎲 Rolling...' : hasRolled ? 'Rolled ✓' : '🎲 Roll Dice'}</Text>
          </TouchableOpacity>

          {hasRolled && !opponentHasRolled && (
            <Text style={styles.waitingText}>Waiting for opponent...</Text>
          )}
        </View>

        {/* Round history */}
        {roundHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Round History</Text>
            {roundHistory.map(r => (
              <View key={r.roundNumber} style={styles.historyRow}>
                <Text style={styles.historyRound}>R{r.roundNumber}</Text>
                <Text style={styles.historyDice}>
                  {r[`${mySlot}Dice` as 'player1Dice'].map(getDiceEmoji).join('')}
                </Text>
                <Text style={styles.historyScore}>
                  {r[`${mySlot}RoundScore` as 'player1RoundScore']} pts
                </Text>
                <Text style={[
                  styles.historyWinner,
                  r.roundWinner === mySlot ? styles.winText :
                  r.roundWinner === 'tie' ? styles.tieText : styles.loseText,
                ]}>
                  {r.roundWinner === 'tie' ? 'Tie' : r.roundWinner === mySlot ? 'Win' : 'Loss'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* In-game chat overlay */}
      <InGameChat
        roomId={roomIdRef.current}
        currentUserId={userId}
        gameType="mrotsi"
        visible={screen === 'game' && !!roomIdRef.current}
      />
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
    </SafeAreaView>
    </View>
    <SyncedYouTubePlayer
      roomId={screen === 'game' && roomIdRef.current ? roomIdRef.current : null}
      visible={true}
    />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backgroundImage: {flex: 1, width: '100%', height: '100%'},
  container: {flex: 1, backgroundColor: 'transparent'},
  overlay: {flex: 1},
  menuContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16},
  title: {fontSize: 36, fontWeight: 'bold', color: '#F5A623'},
  subtitle: {fontSize: 14, color: '#aaa', marginBottom: 8},
  statusText: {fontSize: 18, color: '#eee', textAlign: 'center', marginTop: 16},
  primaryBtn: {
    backgroundColor: '#F5A623', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32, width: '80%', alignItems: 'center',
  },
  primaryBtnText: {color: '#1A1A2E', fontSize: 16, fontWeight: 'bold'},
  secondaryBtn: {
    backgroundColor: 'transparent', borderRadius: 12, borderWidth: 1.5, borderColor: '#F5A623',
    paddingVertical: 12, paddingHorizontal: 32, width: '80%', alignItems: 'center',
  },
  secondaryBtnText: {color: '#F5A623', fontSize: 16},
  cancelText: {color: '#aaa', marginTop: 12},
  // Modal
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center'},
  modalBox: {backgroundColor: '#16213E', borderRadius: 16, padding: 24, width: '80%', alignItems: 'center', gap: 12},
  modalTitle: {fontSize: 20, fontWeight: 'bold', color: '#eee'},
  codeInput: {
    width: '100%', backgroundColor: '#0F3460', color: '#fff', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 18, textAlign: 'center', letterSpacing: 4,
  },
  // Code
  codeBox: {marginTop: 20, alignItems: 'center'},
  codeLabel: {color: '#aaa', fontSize: 13},
  codeValue: {color: '#F5A623', fontSize: 32, fontWeight: 'bold', letterSpacing: 6, marginTop: 4},
  // Score bar
  gameContent: {padding: 16, gap: 16},
  scoreBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: 'rgba(22,33,62,0.85)', borderRadius: 12, padding: 12,
  },
  scoreItem: {alignItems: 'center'},
  scoreLabel: {color: '#aaa', fontSize: 12},
  scoreValue: {color: '#F5A623', fontSize: 28, fontWeight: 'bold'},
  scoreSep: {color: '#555', fontSize: 16},
  // Round result
  roundResultBox: {
    backgroundColor: 'rgba(15,52,96,0.85)', borderRadius: 12, padding: 12, alignItems: 'center',
  },
  roundResultTitle: {color: '#aaa', fontSize: 12, marginBottom: 4},
  roundResultText: {color: '#eee', fontSize: 16, fontWeight: '600'},
  // Sections
  section: {
    backgroundColor: 'rgba(22,33,62,0.85)', borderRadius: 12, padding: 16, gap: 10, alignItems: 'center',
  },
  sectionTitle: {color: '#aaa', fontSize: 13, alignSelf: 'flex-start'},
  // Dice
  diceRow: {flexDirection: 'row', gap: 8, justifyContent: 'center'},
  dice3DContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    minHeight: 120,
  },
  diceEmoji: {fontSize: 36},
  diceHidden: {opacity: 0.3},
  combinationText: {color: '#F5A623', fontSize: 14, fontWeight: '600'},
  waitingText: {color: '#888', fontSize: 13, fontStyle: 'italic'},
  // Roll button
  rollBtn: {
    backgroundColor: '#F5A623', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center', marginTop: 4,
  },
  rollBtnDisabled: {backgroundColor: '#555'},
  rollBtnText: {color: '#1A1A2E', fontSize: 18, fontWeight: 'bold'},
  // History
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', paddingVertical: 4,
  },
  historyRound: {color: '#aaa', fontSize: 13, width: 24},
  historyDice: {fontSize: 16, flex: 1, textAlign: 'center'},
  historyScore: {color: '#eee', fontSize: 13, width: 50, textAlign: 'right'},
  historyWinner: {fontSize: 13, fontWeight: 'bold', width: 36, textAlign: 'right'},
  winText: {color: '#4CAF50'},
  tieText: {color: '#FFC107'},
  loseText: {color: '#F44336'},
  // Dice animation
  diceAnimArea: {
    width: SCREEN_WIDTH - 64, height: 80 + 56,
    position: 'relative', alignSelf: 'center',
  },
  animDiceBox: {
    position: 'absolute', width: 56, height: 56, borderRadius: 12,
    backgroundColor: 'rgba(22,33,62,0.9)', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.4, shadowRadius: 4,
    elevation: 4,
  },
  animDiceText: {fontSize: 32},
  recenterBtn: { position:'absolute', bottom:200, alignSelf:'center', left:'50%', transform:[{translateX:-54}], flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(0,0,0,0.35)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)', borderRadius:24, paddingHorizontal:18, paddingVertical:10 },
  recenterIcon: { fontSize:20, color:'#fff' },
  recenterLabel: { fontSize:13, color:'#fff', fontWeight:'600', letterSpacing:0.3 },
});

export default MultiplayerMrotsiScreen;
