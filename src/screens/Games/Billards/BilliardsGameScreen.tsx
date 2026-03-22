import React, {useState, useRef, useCallback, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Animated,
  Easing,
  ImageBackground,
  Alert,
} from 'react-native';
import { apiService } from '../../../services/api.service';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';
import RoomNameModal from '../../../components/RoomNameModal';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import {aiMoveLogService} from '../../../services/aiMoveLog.service';
import {v4 as uuidv4} from 'uuid';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import {socketService} from '../../../services/SocketService';
import {useAuth} from '../../../libs/hooks/useAuth';
import BisetkaAlert from '../../../utils/BisetkaAlert';
import InGameChat from '../../../components/InGameChat';
import {apiConfig} from '../../../libs/utils/api.utils';

type Props = NativeStackScreenProps<RootStackParamList, 'BilliardsGame'>;

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// Portrait table: fills the full screen width and available vertical space
const TABLE_PADDING = 0;
const RAIL_WIDTH = 0;
const TABLE_WIDTH = SCREEN_WIDTH;
// Reserve ~230px for toolbar + power bar + pocketed row + safe-area insets
const TABLE_HEIGHT = SCREEN_HEIGHT - 230;

// table.png is 1024x1536 with the brown wooden rail baked in.
// Scanning the image reveals the green felt starts at x=235, y=207.
// We scale the image up so the felt fills TABLE_WIDTH x TABLE_HEIGHT exactly,
// then offset it so the brown border is cropped off by overflow:hidden.
const IMG_W = 1024, IMG_H = 1536;
const IMG_RAIL_X = 235, IMG_RAIL_Y = 207;
const IMG_FELT_W = IMG_W - IMG_RAIL_X * 2; // 554px
const IMG_FELT_H = IMG_H - IMG_RAIL_Y * 2; // 1122px
const TABLE_IMG_W = TABLE_WIDTH  * (IMG_W / IMG_FELT_W);  // scaled image width
const TABLE_IMG_H = TABLE_HEIGHT * (IMG_H / IMG_FELT_H);  // scaled image height
const TABLE_IMG_LEFT = -TABLE_WIDTH  * (IMG_RAIL_X / IMG_FELT_W); // left offset
const TABLE_IMG_TOP  = -TABLE_HEIGHT * (IMG_RAIL_Y / IMG_FELT_H); // top offset
const BALL_RADIUS = TABLE_WIDTH * 0.042;
const POCKET_RADIUS = BALL_RADIUS * 1.6; // slightly forgiving for mobile touch controls, close to real proportions
const POCKET_PADDING = 20; // inset each pocket 20px away from the table edges
const CUE_LENGTH = TABLE_WIDTH * 0.65;
const CUE_THICK = 3;
const FRICTION = 0.984;
const MIN_SPEED = 0.12;
const MAX_FORCE = 55;

type Vec2 = {x: number; y: number};

type Ball = {
  id: number;
  number: number;
  pos: Vec2;
  vel: Vec2;
  color: string;
  stripe: boolean;
  pocketed: boolean;
  type: 'solid' | 'stripe' | 'cue' | 'eight';
  rotation: number; // accumulated rotation in degrees
};

type GameVariant = '8-ball' | '9-ball';

const BALL_COLORS: Record<number, string> = {
  0: '#FFFFFF', 1: '#FFD700', 2: '#1E40AF', 3: '#DC2626',
  4: '#7C3AED', 5: '#EA580C', 6: '#15803D', 7: '#7F1D1D',
  8: '#111111', 9: '#FFD700', 10: '#1E40AF', 11: '#DC2626',
  12: '#7C3AED', 13: '#EA580C', 14: '#15803D', 15: '#7F1D1D',
};

const POCKETS: Vec2[] = [
  {x: POCKET_RADIUS * 0.6 + POCKET_PADDING, y: POCKET_RADIUS * 0.6 + POCKET_PADDING},                                   // top-left
  {x: TABLE_WIDTH - POCKET_RADIUS * 0.6 - POCKET_PADDING, y: POCKET_RADIUS * 0.6 + POCKET_PADDING},                     // top-right
  {x: POCKET_RADIUS * 0.35 + POCKET_PADDING, y: TABLE_HEIGHT / 2},                                                       // center-left (side pocket)
  {x: TABLE_WIDTH - POCKET_RADIUS * 0.35 - POCKET_PADDING, y: TABLE_HEIGHT / 2},                                         // center-right (side pocket)
  {x: POCKET_RADIUS * 0.6 + POCKET_PADDING, y: TABLE_HEIGHT - POCKET_RADIUS * 0.6 - POCKET_PADDING},                    // bottom-left
  {x: TABLE_WIDTH - POCKET_RADIUS * 0.6 - POCKET_PADDING, y: TABLE_HEIGHT - POCKET_RADIUS * 0.6 - POCKET_PADDING},      // bottom-right
];

const makeBall = (num: number, x: number, y: number): Ball => ({
  id: num,
  number: num,
  pos: {x, y},
  vel: {x: 0, y: 0},
  color: BALL_COLORS[num] || '#fff',
  stripe: num >= 9 && num <= 15,
  pocketed: false,
  type: num === 0 ? 'cue' : num === 8 ? 'eight' : num <= 7 ? 'solid' : 'stripe',
  rotation: 0,
});

const createRack8Ball = (): Ball[] => {
  const balls: Ball[] = [];
  const cx = TABLE_WIDTH / 2;
  // Cue ball in bottom quarter
  balls.push(makeBall(0, cx, TABLE_HEIGHT * 0.78));
  // Rack in upper third
  const rackY = TABLE_HEIGHT * 0.3;
  const spacing = BALL_RADIUS * 2.15;
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  let idx = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      if (idx >= order.length) break;
      const num = order[idx++]!;
      const x = cx + (col - row / 2) * spacing;
      const y = rackY - row * spacing * 0.866;
      balls.push(makeBall(num, x, y));
    }
  }
  return balls;
};

const createRack9Ball = (): Ball[] => {
  const balls: Ball[] = [];
  const cx = TABLE_WIDTH / 2;
  balls.push(makeBall(0, cx, TABLE_HEIGHT * 0.78));
  const rackY = TABLE_HEIGHT * 0.3;
  const spacing = BALL_RADIUS * 2.15;
  const order = [1, 2, 3, 9, 4, 5, 6, 7, 8];
  const positions: Vec2[] = [
    {x: 0, y: 0},
    {x: -0.5, y: -1}, {x: 0.5, y: -1},
    {x: 0, y: -2},
    {x: -0.5, y: -3}, {x: 0.5, y: -3},
    {x: -1, y: -2}, {x: 1, y: -2},
    {x: 0, y: -4},
  ];
  for (let i = 0; i < order.length; i++) {
    const num = order[i]!;
    const p = positions[i]!;
    balls.push(makeBall(num, cx + p.x * spacing, rackY + p.y * spacing * 0.866));
  }
  return balls;
};

const dist = (a: Vec2, b: Vec2) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const len = (v: Vec2) => Math.sqrt(v.x * v.x + v.y * v.y);

// ── Pre-computed shot types ──────────────────────────────────────────────────
type FrameSnap = { x: number; y: number; p: boolean; r: number };

/** Pure deterministic physics step — modifies balls array in place. */
function physicsStep(balls: Ball[]): { anyMoving: boolean; pocketed: Ball[]; firstHit: Ball | null } {
  let anyMoving = false;
  let firstHit: Ball | null = null;

  for (const ball of balls) {
    if (ball.pocketed) continue;
    ball.pos.x += ball.vel.x;
    ball.pos.y += ball.vel.y;
    const speed = Math.sqrt(ball.vel.x * ball.vel.x + ball.vel.y * ball.vel.y);
    ball.rotation = (ball.rotation + (speed / (BALL_RADIUS * 2 * Math.PI)) * 360) % 360;
    ball.vel.x *= FRICTION;
    ball.vel.y *= FRICTION;
    if (Math.abs(ball.vel.x) < MIN_SPEED && Math.abs(ball.vel.y) < MIN_SPEED) {
      ball.vel.x = 0;
      ball.vel.y = 0;
      ball.rotation = 0;
    } else {
      anyMoving = true;
    }
    const r = BALL_RADIUS;
    if (ball.pos.x - r < 0) { ball.pos.x = r; ball.vel.x = Math.abs(ball.vel.x) * 0.75; }
    if (ball.pos.x + r > TABLE_WIDTH) { ball.pos.x = TABLE_WIDTH - r; ball.vel.x = -Math.abs(ball.vel.x) * 0.75; }
    if (ball.pos.y - r < 0) { ball.pos.y = r; ball.vel.y = Math.abs(ball.vel.y) * 0.75; }
    if (ball.pos.y + r > TABLE_HEIGHT) { ball.pos.y = TABLE_HEIGHT - r; ball.vel.y = -Math.abs(ball.vel.y) * 0.75; }
  }

  const active = balls.filter(b => !b.pocketed);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < BALL_RADIUS * 2 && d > 0.01) {
        const nx = dx / d;
        const ny = dy / d;
        const dvn = (a.vel.x - b.vel.x) * nx + (a.vel.y - b.vel.y) * ny;
        if (dvn > 0) {
          if ((a.type === 'cue' || b.type === 'cue') && !firstHit) {
            firstHit = a.type === 'cue' ? {...b} : {...a};
          }
          a.vel.x -= dvn * nx;
          a.vel.y -= dvn * ny;
          b.vel.x += dvn * nx;
          b.vel.y += dvn * ny;
        }
        const overlap = BALL_RADIUS * 2 - d;
        a.pos.x -= (overlap / 2) * nx;
        a.pos.y -= (overlap / 2) * ny;
        b.pos.x += (overlap / 2) * nx;
        b.pos.y += (overlap / 2) * ny;
      }
    }
  }

  const pocketed: Ball[] = [];
  for (const ball of balls) {
    if (ball.pocketed) continue;
    for (const pocket of POCKETS) {
      if (dist(ball.pos, pocket) < POCKET_RADIUS * 0.85) {
        ball.pocketed = true;
        ball.vel = {x: 0, y: 0};
        pocketed.push({...ball});
        break;
      }
    }
  }

  return { anyMoving, pocketed, firstHit };
}

/** Pre-compute entire shot to completion — returns frame snapshots + metadata. */
function precomputeShot(
  initialBalls: Ball[],
  cueVelocity: Vec2,
): { frames: FrameSnap[][]; shotPocketed: Ball[]; firstHit: Ball | null; cueScratch: boolean } {
  const balls = initialBalls.map(b => ({...b, pos: {...b.pos}, vel: {...b.vel}}));
  const cue = balls.find(b => b.type === 'cue' && !b.pocketed);
  if (cue) cue.vel = {x: cueVelocity.x, y: cueVelocity.y};

  const frames: FrameSnap[][] = [];
  const shotPocketed: Ball[] = [];
  let firstHit: Ball | null = null;
  let cueScratch = false;

  for (let step = 0; step < 6000; step++) {
    const res = physicsStep(balls);
    if (res.firstHit && !firstHit) firstHit = res.firstHit;
    if (res.pocketed.length > 0) {
      shotPocketed.push(...res.pocketed);
      if (res.pocketed.some(p => p.type === 'cue')) cueScratch = true;
    }
    frames.push(balls.map(b => ({x: b.pos.x, y: b.pos.y, p: b.pocketed, r: b.rotation})));
    if (!res.anyMoving) break;
  }

  return {frames, shotPocketed, firstHit, cueScratch};
}

/** Encode frames as a flat int array for compact socket transfer.
 *  Positions are normalized to 0-10000 range so different screen sizes produce
 *  identical results. Per ball per frame: [normX, normY, pocketed(0/1), rotation] */
function encodeFrames(frames: FrameSnap[][]): number[] {
  const flat: number[] = [];
  for (const frame of frames) {
    for (const snap of frame) {
      flat.push(Math.round((snap.x / TABLE_WIDTH) * 10000));
      flat.push(Math.round((snap.y / TABLE_HEIGHT) * 10000));
      flat.push(snap.p ? 1 : 0);
      flat.push(Math.round(snap.r));
    }
  }
  return flat;
}

function decodeFrames(flat: number[], numBalls: number): FrameSnap[][] {
  const stride = numBalls * 4;
  const frames: FrameSnap[][] = [];
  for (let i = 0; i < flat.length; i += stride) {
    const frame: FrameSnap[] = [];
    for (let j = 0; j < numBalls; j++) {
      const base = i + j * 4;
      frame.push({
        x: (flat[base] / 10000) * TABLE_WIDTH,
        y: (flat[base + 1] / 10000) * TABLE_HEIGHT,
        p: flat[base + 2] === 1,
        r: flat[base + 3],
      });
    }
    frames.push(frame);
  }
  return frames;
}

// --- Confetti particle ---
const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF69B4', '#87CEEB', '#DDA0DD', '#F0E68C', '#98FB98'];
const NUM_CONFETTI = 50;
const NUM_LOSS_PARTICLES = 20;

type Particle = {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  shape: 'square' | 'circle' | 'rect';
};

const GameOverOverlay: React.FC<{
  isWin: boolean;
  onNewGame: () => void;
  onGoBack: () => void;
  isMultiplayer?: boolean;
}> = ({isWin, onNewGame, onGoBack, isMultiplayer}) => {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scaleText = useRef(new Animated.Value(0.3)).current;
  const slideUp = useRef(new Animated.Value(50)).current;

  const particles = useMemo(() => {
    const count = isWin ? NUM_CONFETTI : NUM_LOSS_PARTICLES;
    return Array.from({length: count}, (): Particle => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(-20 - Math.random() * 80),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(isWin ? 1 : 0.6),
      color: isWin
        ? CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!
        : '#666',
      size: isWin ? 8 + Math.random() * 10 : 4 + Math.random() * 6,
      shape: isWin
        ? (['square', 'circle', 'rect'] as const)[Math.floor(Math.random() * 3)]!
        : 'circle',
    }));
  }, [isWin]);

  useEffect(() => {
    // Fade in overlay
    Animated.parallel([
      Animated.timing(fadeIn, {toValue: 1, duration: 400, useNativeDriver: true}),
      Animated.spring(scaleText, {toValue: 1, friction: 4, tension: 60, useNativeDriver: true}),
      Animated.timing(slideUp, {toValue: 0, duration: 500, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true}),
    ]).start();

    // Animate particles
    particles.forEach((p, i) => {
      const delay = Math.random() * 800;
      const duration = isWin ? 2000 + Math.random() * 1500 : 3000 + Math.random() * 1000;
      const swayAmount = isWin ? (Math.random() - 0.5) * 120 : (Math.random() - 0.5) * 30;

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          // Fall down with horizontal sway
          Animated.timing(p.y, {
            toValue: SCREEN_HEIGHT + 50,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(p.x, {
            toValue: (p.x as any)._value + swayAmount,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          // Spin
          Animated.timing(p.rotate, {
            toValue: isWin ? 4 + Math.random() * 8 : 1,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          // Fade out near bottom
          Animated.sequence([
            Animated.delay(duration * 0.7),
            Animated.timing(p.opacity, {
              toValue: 0,
              duration: duration * 0.3,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Particles */}
      {particles.map((p, i) => (
        <Animated.View
          key={`particle-${i}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: p.shape === 'rect' ? p.size * 0.5 : p.size,
            height: p.shape === 'rect' ? p.size * 1.5 : p.size,
            borderRadius: p.shape === 'circle' ? p.size / 2 : 2,
            backgroundColor: p.color,
            transform: [
              {translateX: p.x},
              {translateY: p.y},
              {rotate: p.rotate.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              })},
            ],
            opacity: p.opacity,
          }}
        />
      ))}

      {/* Overlay background */}
      <Animated.View style={[styles.gameOverOverlay, {opacity: fadeIn}]}>
        {/* Title */}
        <Animated.View style={{
          transform: [{scale: scaleText}, {translateY: slideUp}],
          alignItems: 'center',
        }}>
          <Text style={[styles.gameOverTitle, {
            color: isWin ? '#FFD700' : '#FF4444',
          }]}>
            {isWin ? '🏆 YOU WIN! 🏆' : (isMultiplayer ? '💀 YOU LOSE 💀' : '💀 AI WINS 💀')}
          </Text>
          <Text style={styles.gameOverSubtitle}>
            {isWin ? 'Great shooting!' : (isMultiplayer ? 'Opponent wins...' : 'Better luck next time...')}
          </Text>
        </Animated.View>

        {/* Buttons */}
        <Animated.View style={{
          transform: [{translateY: slideUp}],
          opacity: fadeIn,
          flexDirection: 'row',
          gap: 16,
          marginTop: 24,
        }}>
          <TouchableOpacity style={[styles.newGameBtn, {backgroundColor: isWin ? '#22C55E' : '#3B82F6'}]} onPress={onNewGame}>
            <Text style={styles.newGameText}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.newGameBtn, {backgroundColor: '#555'}]} onPress={onGoBack}>
            <Text style={styles.newGameText}>Exit</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const BilliardsGameScreen: React.FC<Props> = ({route, navigation}) => {
  const {session} = route.params;
  const variant: GameVariant = session?.gameType === '9-ball' ? '9-ball' : '8-ball';
  const difficulty = session?.difficulty || 'medium';
  const mode = session?.mode;
  const isMultiplayer = !!(mode && mode !== 'ai');

  // Auth / user ID
  const {user, refreshUser} = useAuth();
  const userId: string = (user as any)?.id || session?.user?.id || session?.id || 'guest';

  const [balls, setBalls] = useState<Ball[]>(
    variant === '9-ball' ? createRack9Ball() : createRack8Ball(),
  );
  const [isMoving, setIsMoving] = useState(false);
  const [playerTurn, setPlayerTurn] = useState(true); // true = human, false = AI
  const [roomName, setRoomName] = useState('Multiplayer Billiards');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);
  const roomNameRef = useRef(roomName);
  useEffect(() => { roomNameRef.current = roomName; }, [roomName]);

  const [playerType, setPlayerType] = useState<'solid' | 'stripe' | null>(null);
  const [aiType, setAiType] = useState<'solid' | 'stripe' | null>(null);
  const [pocketedSolids, setPocketedSolids] = useState<Ball[]>([]);
  const [pocketedStripes, setPocketedStripes] = useState<Ball[]>([]);
  const [dragStart, setDragStart] = useState<Vec2 | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Vec2 | null>(null);
  const [power, setPower] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null);
  const [ballInHand, setBallInHand] = useState(false); // player can place cue ball
  const [placingCue, setPlacingCue] = useState(false); // currently dragging cue ball placement
  const [shotMessage, setShotMessage] = useState<string | null>(null);
  const animRef = useRef<number | null>(null);
  const ballsRef = useRef(balls);
  ballsRef.current = balls;

  // Track what happened during this shot (reset each shot)
  const shotPocketedRef = useRef<Ball[]>([]);
  const firstHitRef = useRef<Ball | null>(null); // first ball cue ball contacted
  const cueScratchRef = useRef(false);

  // Refs for PanResponder (avoids stale closures)
  const isMovingRef = useRef(isMoving);
  isMovingRef.current = isMoving;
  const playerTurnRef = useRef(playerTurn);
  playerTurnRef.current = playerTurn;
  const gameOverRef = useRef(gameOver);
  gameOverRef.current = gameOver;
  const dragStartRef = useRef(dragStart);
  dragStartRef.current = dragStart;
  const ballInHandRef = useRef(ballInHand);
  ballInHandRef.current = ballInHand;
  const playerTypeRef = useRef(playerType);
  playerTypeRef.current = playerType;
  const aiTypeRef = useRef(aiType);
  aiTypeRef.current = aiType;
  const winnerRef = useRef(winner);
  winnerRef.current = winner;

  // ── Multiplayer state ────────────────────────────────────────────────────────
  const [mpStatus, setMpStatus] = useState<'idle'|'connecting'|'searching'|'waiting'|'playing'|'ended'>('idle');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);

  // Derived: is it my turn to shoot?
  // white = player1 (playerTurn=true), black = player2 (playerTurn=false)
  const isMyTurn = isMultiplayer
    ? (myColor === null ? false : myColor === 'white' ? playerTurn : !playerTurn)
    : playerTurn;

  const isMultiplayerRef = useRef(isMultiplayer);
  isMultiplayerRef.current = isMultiplayer;
  const roomIdRef = useRef<string | null>(null);
  roomIdRef.current = roomId;
  const myColorRef = useRef<'white' | 'black' | null>(null);
  myColorRef.current = myColor;
  const isMyTurnRef = useRef(isMyTurn);
  isMyTurnRef.current = isMyTurn;
  // Set to true when I fire the cue ball — cleared after move is sent
  const iAmShooterRef = useRef(false);
  // Holds the authoritative move_made data received while simulation is running
  const pendingMoveRef = useRef<any>(null);
  // Timestamp accumulator for fixed-timestep physics
  const lastTickRef = useRef(0);
  // Pre-computed frame buffer for multiplayer sync
  const frameBufferRef = useRef<FrameSnap[][]>([]);
  const frameIndexRef = useRef(0);

  // Helper: apply authoritative move data from the server (positions are normalized 0-1)
  const applyMoveData = useCallback((move: any) => {
    setBalls(move.balls.map((b: any) => ({
      ...b,
      pos: { x: b.pos.x * TABLE_WIDTH, y: b.pos.y * TABLE_HEIGHT },
      vel: { x: 0, y: 0 },
      rotation: b.rotation ?? 0,
    })));
    setPlayerTurn(move.playerTurn);
    playerTurnRef.current = move.playerTurn;
    if (move.playerType !== undefined) { setPlayerType(move.playerType); playerTypeRef.current = move.playerType; }
    if (move.aiType !== undefined) { setAiType(move.aiType); aiTypeRef.current = move.aiType; }
    const bih = move.ballInHand === true;
    setBallInHand(bih);
    ballInHandRef.current = bih;
    setPocketedSolids(move.balls.filter((b: any) => b.pocketed && b.type === 'solid'));
    setPocketedStripes(move.balls.filter((b: any) => b.pocketed && b.type === 'stripe'));
  }, []);

  // AI move logging refs
  const billiardsGameIdRef = useRef<string>(uuidv4());
  useGameEndRefresh(gameOver, variant);
  const shotCountRef = useRef(0);
  const lastPlayerShotRef = useRef<{
    cueBallVelocity: Vec2;
    targetBall?: { number: number; type: string };
  } | null>(null);

  // Entry fee and prize tracking
  const [entryDeducted, setEntryDeducted] = useState(false);
  const [prizeAwarded, setPrizeAwarded] = useState(false);

  // Entry fee deduction handler
  const handleGameStart = async () => {
    if (entryDeducted || !user?.id) return;

    try {
      console.log('💰 Deducting billiards entry fee...');
      const result = await apiService.deductEntry('billiards', billiardsGameIdRef.current);
      
      if (result.success) {
        console.log(`✅ Entry deducted: -50 points. Balance: ${result.newBalance}`);
        setEntryDeducted(true);
        refreshUser().catch(console.error);
      } else {
        console.error('❌ Insufficient points:', result.error);
        Alert.alert('Insufficient Points', result.error || 'You need 50 points to play billiards.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error: any) {
      console.error('❌ Entry deduction error:', error);
      Alert.alert('Error', 'Failed to deduct entry fee.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  };

  // Prize award handler
  const handleGameEnd = async (didWin: boolean) => {
    if (prizeAwarded || !user?.id) return;

    try {
      const result = didWin ? 'win' : 'loss';
      console.log(`🏆 Awarding prize for ${result}...`);
      const prizeResult = await apiService.awardPrize('billiards', result, billiardsGameIdRef.current);
      
      if (prizeResult.success) {
        console.log(`✅ Prize awarded: +${prizeResult.prize} points. Balance: ${prizeResult.newBalance}`);
        setPrizeAwarded(true);
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

  // Entry fee & prize logic
  // Deduct entry when game starts
  useEffect(() => {
    if (!entryDeducted) {
      handleGameStart();
    }
  }, [entryDeducted]);

  // Award prize when game ends
  useEffect(() => {
    if (gameOver && !prizeAwarded) {
      const didWin = winner === 'player';
      handleGameEnd(didWin);
    }
  }, [gameOver, prizeAwarded, winner]);

  const cueBall = balls.find(b => b.type === 'cue' && !b.pocketed);

  // Head string Y position (cue ball must be placed behind this on scratch)
  const HEAD_STRING_Y = TABLE_HEIGHT * 0.72;

  // ── Multiplayer socket setup ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer) return;
    let cancelled = false;
    setMpStatus('connecting');

    (async () => {
      try {
        await socketService.connect(userId, session?.access_token || 'temp-token');
        if (cancelled) return;
        const socket = socketService.getSocket();
        if (!socket) return;

        setMpStatus('searching');

        // Clean slate — remove any stale listeners
        ['match_found','room_joined','opponent_joined','game_started','move_made','game_ended','opponent_disconnected','room_name_updated','billiards_shot']
          .forEach(ev => socket.off(ev));

        let resolvedRoomId: string | null = null;

        // Listen for room name updates from other players
        socket.on('room_name_updated', (data: { roomId: string; dbSessionId?: string; roomName: string }) => {
          if (data.roomId === resolvedRoomId || data.roomId === roomIdRef.current ||
              data.dbSessionId === resolvedRoomId || data.dbSessionId === roomIdRef.current) {
            setRoomName(data.roomName);
          }
        });

        socket.on('match_found', (data: any) => {
          if (cancelled) return;
          resolvedRoomId = data.roomId;
          setRoomId(data.roomId);
          if (data.color) setMyColor(data.color as 'white' | 'black');
          setMpStatus('waiting');
          socket.emit('player_ready', { roomId: data.roomId, userId });
        });

        socket.on('room_joined', (data: any) => {
          if (cancelled) return;
          resolvedRoomId = data.roomId;
          setRoomId(data.roomId);
          setMpStatus('waiting');
        });

        socket.on('opponent_joined', () => {
          if (cancelled) return;
          if (resolvedRoomId) socket.emit('player_ready', { roomId: resolvedRoomId, userId });
        });

        socket.on('game_started', (data: any) => {
          if (cancelled) return;
          // Server sends a personalized event (myColor set) and a room-wide
          // fallback (myColor null). Resolve color so the fallback doesn't
          // overwrite the correct value.
          const color = data.myColor
            || (data.player1Id === userId ? 'white' : data.player2Id === userId ? 'black' : null);
          if (!color) return;
          setMyColor(color);
          // White shoots first — playerTurn=true means white's turn
          setPlayerTurn(true);
          playerTurnRef.current = true;
          setMpStatus('playing');
        });

        // Opponent: receive shooter's pre-computed frames for frame-perfect sync
        socket.on('billiards_shot', (data: any) => {
          if (cancelled) return;
          const { balls: shotBalls, frameData } = data;
          if (!shotBalls || !frameData || !frameData.length) return;
          // Decode the shooter's exact frames — no local physics computation
          const decoded = decodeFrames(frameData, shotBalls.length);
          frameBufferRef.current = decoded;
          frameIndexRef.current = 0;
          // Set balls to initial state — denormalize positions for local screen
          setBalls(shotBalls.map((b: any) => ({
            ...b,
            pos: { x: b.pos.x * TABLE_WIDTH, y: b.pos.y * TABLE_HEIGHT },
            vel: { x: 0, y: 0 },
            rotation: b.rotation ?? 0,
          })));
          setIsMoving(true);
        });

        socket.on('move_made', (data: any) => {
          if (cancelled) return;
          const move = data.move;
          if (!move || !move.balls) return;
          // Shooter receives their own move_made back — skip during animation
          if (isMovingRef.current || iAmShooterRef.current) {
            pendingMoveRef.current = move;
            return;
          }
          applyMoveData(move);
        });

        socket.on('game_ended', (data: any) => {
          if (cancelled) return;
          const iWon = data.winnerId === userId;
          setGameOver(true);
          gameOverRef.current = true;
          setWinner(iWon ? 'player' : 'ai');
          setMpStatus('ended');
        });

        socket.on('opponent_disconnected', () => {
          if (cancelled) return;
          BisetkaAlert.success('Opponent disconnected', 'You win by forfeit!');
          setGameOver(true);
          gameOverRef.current = true;
          setWinner('player');
          setMpStatus('ended');
        });

        // Start matchmaking
        if (mode === 'random') {
          const gameType = variant === '9-ball' ? '9-ball' : 'billiards';
          socket.emit('find_match', { gameType, userId });
        }
      } catch (err) {
        if (!cancelled) {
          setMpStatus('idle');
          console.warn('Billiards multiplayer connection failed:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
      const socket = socketService.getSocket();
      if (socket) {
        ['match_found','room_joined','opponent_joined','game_started','move_made','game_ended','opponent_disconnected','room_name_updated','billiards_shot']
          .forEach(ev => socket.off(ev));
        if (mode === 'random') socket.emit('cancel_matchmaking', { userId });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Physics ---

  const checkPockets = useCallback((currentBalls: Ball[]): Ball[] => {
    const newPocketed: Ball[] = [];
    for (const ball of currentBalls) {
      if (ball.pocketed) continue;
      for (const pocket of POCKETS) {
        if (dist(ball.pos, pocket) < POCKET_RADIUS * 0.85) {
          ball.pocketed = true;
          ball.vel = {x: 0, y: 0};
          newPocketed.push({...ball});
          break;
        }
      }
    }
    return newPocketed;
  }, []);

  const resolveBallCollisions = useCallback((currentBalls: Ball[]) => {
    const active = currentBalls.filter(b => !b.pocketed);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i]!;
        const b = active[j]!;
        const d = dist(a.pos, b.pos);
        if (d < BALL_RADIUS * 2 && d > 0.01) {
          const nx = (b.pos.x - a.pos.x) / d;
          const ny = (b.pos.y - a.pos.y) / d;
          const dvn = (a.vel.x - b.vel.x) * nx + (a.vel.y - b.vel.y) * ny;
          if (dvn > 0) {
            // Track first ball the cue ball hits
            if ((a.type === 'cue' || b.type === 'cue') && !firstHitRef.current) {
              firstHitRef.current = a.type === 'cue' ? {...b} : {...a};
            }
            a.vel.x -= dvn * nx;
            a.vel.y -= dvn * ny;
            b.vel.x += dvn * nx;
            b.vel.y += dvn * ny;
          }
          const overlap = BALL_RADIUS * 2 - d;
          a.pos.x -= (overlap / 2) * nx;
          a.pos.y -= (overlap / 2) * ny;
          b.pos.x += (overlap / 2) * nx;
          b.pos.y += (overlap / 2) * ny;
        }
      }
    }
  }, []);

  const resolveWalls = useCallback((ball: Ball) => {
    const r = BALL_RADIUS;
    if (ball.pos.x - r < 0) { ball.pos.x = r; ball.vel.x = Math.abs(ball.vel.x) * 0.75; }
    if (ball.pos.x + r > TABLE_WIDTH) { ball.pos.x = TABLE_WIDTH - r; ball.vel.x = -Math.abs(ball.vel.x) * 0.75; }
    if (ball.pos.y - r < 0) { ball.pos.y = r; ball.vel.y = Math.abs(ball.vel.y) * 0.75; }
    if (ball.pos.y + r > TABLE_HEIGHT) { ball.pos.y = TABLE_HEIGHT - r; ball.vel.y = -Math.abs(ball.vel.y) * 0.75; }
  }, []);

  const simulateStep = useCallback(() => {
    setBalls(prev => {
      const next = prev.map(b => ({...b, pos: {...b.pos}, vel: {...b.vel}}));
      let anyMoving = false;

      for (const ball of next) {
        if (ball.pocketed) continue;
        ball.pos.x += ball.vel.x;
        ball.pos.y += ball.vel.y;
        // Accumulate rotation based on speed (rolling effect)
        const speed = Math.sqrt(ball.vel.x * ball.vel.x + ball.vel.y * ball.vel.y);
        // Circumference = 2πr, so degrees per pixel = 360 / (2πr)
        ball.rotation = (ball.rotation + (speed / (BALL_RADIUS * 2 * Math.PI)) * 360) % 360;
        ball.vel.x *= FRICTION;
        ball.vel.y *= FRICTION;
        if (Math.abs(ball.vel.x) < MIN_SPEED && Math.abs(ball.vel.y) < MIN_SPEED) {
          ball.vel.x = 0;
          ball.vel.y = 0;
          // Snap rotation to 0 when stopped (number faces up)
          ball.rotation = 0;
        } else {
          anyMoving = true;
        }
        resolveWalls(ball);
      }

      resolveBallCollisions(next);
      const pocketed = checkPockets(next);

      if (pocketed.length > 0) {
        shotPocketedRef.current = [...shotPocketedRef.current, ...pocketed];
        for (const p of pocketed) {
          if (p.type === 'cue') {
            cueScratchRef.current = true;
          }
          if (p.type === 'solid') setPocketedSolids(o => [...o, p]);
          if (p.type === 'stripe') setPocketedStripes(o => [...o, p]);
        }
      }

      // --- Settlement when all balls stop ---
      if (!anyMoving) {
        setIsMoving(false);

        // In multiplayer, the opponent just watches the animation — skip game
        // logic adjudication. The authoritative state will arrive via move_made.
        if (isMultiplayerRef.current && !iAmShooterRef.current) {
          return next;
        }

        const wasPlayerTurn = playerTurnRef.current;
        const currentPlayerType = wasPlayerTurn ? playerTypeRef.current : aiTypeRef.current;
        const shotPocketed = shotPocketedRef.current;
        const firstHit = firstHitRef.current;
        const cueScratch = cueScratchRef.current;

        // Reset shot tracking
        shotPocketedRef.current = [];
        firstHitRef.current = null;
        cueScratchRef.current = false;

        // Handle cue ball pocketed (scratch)
        const cue = next.find(b => b.type === 'cue');
        if (cue?.pocketed) {
          cue.pocketed = false;
          // Don't place it yet — other player gets ball-in-hand
          cue.pos = {x: -100, y: -100}; // hide off screen until placed
          cue.vel = {x: 0, y: 0};
        }

        // Check if 8-ball was pocketed
        const eightPocketed = shotPocketed.some(b => b.number === 8);
        if (eightPocketed && variant === '8-ball') {
          // If shooter cleared all their balls first → win, otherwise → lose
          const shooterType = wasPlayerTurn ? playerTypeRef.current : aiTypeRef.current;
          const remainingOwn = next.filter(b => !b.pocketed && b.type === shooterType);
          if (shooterType && remainingOwn.length === 0 && !cueScratch) {
            setGameOver(true);
            setWinner(wasPlayerTurn ? 'player' : 'ai');
            setShotMessage(wasPlayerTurn ? '🏆 You sank the 8-ball!' : '💀 AI wins!');
          } else {
            // Sank 8-ball too early or scratched on it → lose
            setGameOver(true);
            setWinner(wasPlayerTurn ? 'ai' : 'player');
            setShotMessage(wasPlayerTurn ? '💀 Sank the 8-ball too early!' : '🏆 AI sank the 8 illegally!');
          }
          return next;
        }

        // 9-ball win check
        if (variant === '9-ball' && shotPocketed.some(b => b.number === 9)) {
          if (!cueScratch) {
            setGameOver(true);
            setWinner(wasPlayerTurn ? 'player' : 'ai');
          } else {
            // Scratch on 9-ball: respotted, other player gets ball-in-hand
            const nine = next.find(b => b.number === 9);
            if (nine) {
              nine.pocketed = false;
              nine.pos = {x: TABLE_WIDTH / 2, y: TABLE_HEIGHT * 0.28};
              nine.vel = {x: 0, y: 0};
            }
          }
        }

        // --- Type assignment (8-ball only: first non-cue, non-8 ball pocketed decides types) ---
        if (variant === '8-ball' && !playerTypeRef.current && !aiTypeRef.current) {
          const firstLegit = shotPocketed.find(b => b.type === 'solid' || b.type === 'stripe');
          if (firstLegit && !cueScratch) {
            const pocketedType = firstLegit.type as 'solid' | 'stripe';
            const otherType = pocketedType === 'solid' ? 'stripe' : 'solid';
            if (wasPlayerTurn) {
              setPlayerType(pocketedType);
              playerTypeRef.current = pocketedType;
              setAiType(otherType);
              aiTypeRef.current = otherType;
              setShotMessage(`You're ${pocketedType}s!`);
            } else {
              setAiType(pocketedType);
              aiTypeRef.current = pocketedType;
              setPlayerType(otherType);
              playerTypeRef.current = otherType;
              setShotMessage(`AI is ${pocketedType}s — you're ${otherType}s!`);
            }
          }
        }

        // --- Determine if it's a foul (scratch) ---
        let isFoul = false;

        // Foul 1: cue ball pocketed
        if (cueScratch) isFoul = true;

        // Foul 2: cue ball didn't hit any ball
        if (!firstHit && !cueScratch) isFoul = true;

        if (variant === '9-ball') {
          // 9-ball foul rule: must hit the lowest numbered ball first
          if (firstHit) {
            const activeBalls = next.filter(b => !b.pocketed && b.number > 0 && b.type !== 'cue');
            const lowestNum = Math.min(...activeBalls.map(b => b.number));
            if (firstHit.number !== lowestNum) {
              isFoul = true;
              setShotMessage(`Foul! Must hit the ${lowestNum} ball first`);
            }
          }
        } else {
          // 8-ball foul rule: first ball hit was not the shooter's type (if types assigned)
          const shooterType = wasPlayerTurn ? playerTypeRef.current : aiTypeRef.current;
          if (firstHit && shooterType) {
            // If all own balls are pocketed, must hit 8-ball
            const ownRemaining = next.filter(b => !b.pocketed && b.type === shooterType);
            if (ownRemaining.length === 0) {
              if (firstHit.number !== 8) isFoul = true;
            } else {
              if (firstHit.type !== shooterType) isFoul = true;
            }
          }
        }

        // --- Determine if shooter keeps their turn ---
        let keepTurn = false;
        if (variant === '8-ball') {
          // 8-ball: keep turn if you pocketed one of your own balls
          const shooterType = wasPlayerTurn ? playerTypeRef.current : aiTypeRef.current;
          const ownPocketed = shotPocketed.filter(b => b.type === shooterType);
          const madeOwnBall = shooterType ? ownPocketed.length > 0 : shotPocketed.some(b => b.type !== 'cue' && b.type !== 'eight');
          keepTurn = !isFoul && madeOwnBall;
        }
        // 9-ball: turns always alternate (no shoot-again)

        if (isFoul) {
          if (cueScratch) {
            setShotMessage(wasPlayerTurn ? 'Scratch! AI gets ball-in-hand' : 'AI scratched! Place the cue ball');
          } else if (!shotMessage) {
            // Only set generic foul message if we didn't already set a specific one
            setShotMessage(wasPlayerTurn ? 'Foul! AI gets ball-in-hand' : 'AI foul!');
          }
          // Other player gets ball-in-hand
          if (wasPlayerTurn) {
            // AI gets ball in hand — auto-place for AI
            if (cue) {
              if (variant === '9-ball') {
                // 9-ball: ball-in-hand anywhere
                cue.pos = {x: TABLE_WIDTH / 2, y: TABLE_HEIGHT * 0.5};
              } else {
                // 8-ball: ball-in-hand behind head string
                cue.pos = {x: TABLE_WIDTH / 2, y: HEAD_STRING_Y + BALL_RADIUS * 3};
              }
              cue.pocketed = false;
            }
            setPlayerTurn(false);
          } else {
            // Human gets ball-in-hand
            setBallInHand(true);
            ballInHandRef.current = true;
            setPlayerTurn(true);
          }
        } else if (keepTurn) {
          setShotMessage(wasPlayerTurn ? 'Nice! Shoot again' : 'AI shoots again...');
          // Same player goes again — if cue was scratched this won't trigger (handled above)
          if (cue && cue.pos.x < 0) {
            cue.pos = {x: TABLE_WIDTH / 2, y: HEAD_STRING_Y + BALL_RADIUS * 3};
            cue.pocketed = false;
          }
        } else {
          // Switch turns
          setShotMessage(null);
          setPlayerTurn(!wasPlayerTurn);
          if (cue && cue.pos.x < 0) {
            cue.pos = {x: TABLE_WIDTH / 2, y: HEAD_STRING_Y + BALL_RADIUS * 3};
            cue.pocketed = false;
          }
        }

        // Clear message after a delay
        setTimeout(() => setShotMessage(null), 2500);
      }

      return next;
    });
  }, [checkPockets, resolveBallCollisions, resolveWalls, variant]);

  // Physics / animation loop.
  // Multiplayer: play back pre-computed frames for identical ball positions.
  // Single-player: real-time fixed-timestep with simulateStep.
  const STEP_MS = 1000 / 60; // 16.67ms per physics step
  useEffect(() => {
    if (!isMoving) return;
    const frames = frameBufferRef.current;

    if (frames.length > 0) {
      // ── Multiplayer frame playback ──────────────────────────────────────
      lastTickRef.current = performance.now();
      let accumulator = 0;

      const tick = (now: number) => {
        const elapsed = now - lastTickRef.current;
        lastTickRef.current = now;
        accumulator += elapsed;
        if (accumulator > 200) accumulator = 200;

        let advanced = false;
        while (accumulator >= STEP_MS && frameIndexRef.current < frames.length) {
          frameIndexRef.current++;
          accumulator -= STEP_MS;
          advanced = true;
        }

        if (advanced) {
          const idx = Math.min(frameIndexRef.current, frames.length) - 1;
          const frame = frames[idx];
          setBalls(prev => {
            const next = prev.map((b, i) => ({
              ...b,
              pos: {x: frame[i].x, y: frame[i].y},
              pocketed: frame[i].p,
              rotation: frame[i].r,
              vel: {x: 0, y: 0},
            }));
            // Update pocketed-balls display when a ball is newly pocketed
            for (let i = 0; i < next.length; i++) {
              if (frame[i].p && !prev[i].pocketed) {
                if (prev[i].type === 'solid') setPocketedSolids(o => [...o, {...next[i]}]);
                if (prev[i].type === 'stripe') setPocketedStripes(o => [...o, {...next[i]}]);
              }
            }
            return next;
          });
        }

        if (frameIndexRef.current >= frames.length) {
          // Playback done — run one final simulateStep to trigger settlement logic
          frameBufferRef.current = [];
          frameIndexRef.current = 0;
          simulateStep();
          return;
        }

        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
      return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }

    // ── Single-player real-time physics ─────────────────────────────────────
    lastTickRef.current = performance.now();
    let accumulator = 0;
    const tick = (now: number) => {
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;
      accumulator += elapsed;
      if (accumulator > 200) accumulator = 200;
      while (accumulator >= STEP_MS) {
        simulateStep();
        accumulator -= STEP_MS;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isMoving, simulateStep]);

  // ── Multiplayer: send move after shot settles ──────────────────────────────
  // Fires whenever isMoving flips to false; sends ball state to server if I was the shooter
  useEffect(() => {
    if (isMoving) return;                   // only act when movement just stopped
    if (!isMultiplayer) return;

    // Shooter: send authoritative final state to server
    if (iAmShooterRef.current) {
      iAmShooterRef.current = false;
      if (roomIdRef.current) {
        socketService.makeMove(roomIdRef.current, userId, {
          balls: ballsRef.current.map(b => ({
            ...b,
            pos: { x: b.pos.x / TABLE_WIDTH, y: b.pos.y / TABLE_HEIGHT },
            vel: { x: 0, y: 0 },
          })),
          playerTurn: playerTurnRef.current,    // whose turn it is AFTER this shot
          playerType: playerTypeRef.current,
          aiType: aiTypeRef.current,
          ballInHand: ballInHandRef.current,
          gameOver: gameOverRef.current,
          winner: gameOverRef.current ? winnerRef.current : null,
        } as any);
      }
    }

    // Opponent: apply the authoritative move_made data that arrived during simulation
    if (pendingMoveRef.current) {
      const move = pendingMoveRef.current;
      pendingMoveRef.current = null;
      applyMoveData(move);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMoving]);

  // After balls stop, trigger AI turn
  useEffect(() => {
    // In multiplayer there is no AI — skip
    if (isMultiplayer) return;
    if (!isMoving && !playerTurn && !gameOver && !ballInHand) {
      const timer = setTimeout(() => {
        const cue = ballsRef.current.find(b => b.type === 'cue' && !b.pocketed);
        if (!cue) return;

        // AI targeting logic
        let targets = ballsRef.current.filter(b => !b.pocketed && b.type !== 'cue');
        if (targets.length === 0) return;

        if (variant === '9-ball') {
          // 9-ball: always target the lowest numbered ball
          const lowestNum = Math.min(...targets.map(b => b.number));
          const lowestBall = targets.find(b => b.number === lowestNum);
          targets = lowestBall ? [lowestBall] : targets;
        } else {
          // 8-ball: target own type if assigned
          const aiT = aiTypeRef.current;
          if (aiT) {
            const ownBalls = targets.filter(b => b.type === aiT);
            if (ownBalls.length > 0) {
              targets = ownBalls;
            } else {
              // All own balls pocketed — go for 8-ball
              const eight = targets.find(b => b.number === 8);
              if (eight) targets = [eight];
            }
          }
        }

        let best = targets[0]!;
        let bestD = Infinity;
        for (const t of targets) {
          const d = dist(cue.pos, t.pos);
          if (d < bestD) { bestD = d; best = t; }
        }

        const dx = best.pos.x - cue.pos.x;
        const dy = best.pos.y - cue.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const jitter = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.15 : 0.05;
        const speed = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 7 : 10;

        // Reset shot tracking for AI shot
        shotPocketedRef.current = [];
        firstHitRef.current = null;
        cueScratchRef.current = false;

        // Calculate AI shot velocity
        const aiVelX = (dx / d + (Math.random() - 0.5) * jitter) * speed;
        const aiVelY = (dy / d + (Math.random() - 0.5) * jitter) * speed;

        // Increment shot count and log AI shot
        shotCountRef.current += 1;
        const tableState = ballsRef.current.map(b => ({
          number: b.number,
          type: b.type,
          pocketed: b.pocketed,
          position: b.pos,
        }));
        
        aiMoveLogService.logBilliardsMove({
          gameId: billiardsGameIdRef.current,
          shotNumber: shotCountRef.current,
          variant: variant,
          aiDifficulty: difficulty,
          playerShot: lastPlayerShotRef.current || undefined,
          aiShot: {
            targetBall: { number: best.number, type: best.type },
            cueBallVelocity: { x: aiVelX, y: aiVelY },
            jitter: jitter,
            speed: speed,
          },
          tableState: tableState,
          playerType: playerType,
          aiType: aiType,
        }).catch(err => console.warn('Failed to log billiards move:', err));

        // Clear player shot ref after logging
        lastPlayerShotRef.current = null;

        setBalls(prev => {
          const next = prev.map(b => ({...b, pos: {...b.pos}, vel: {...b.vel}}));
          const c = next.find(b => b.type === 'cue' && !b.pocketed);
          if (c) {
            c.vel = {
              x: aiVelX,
              y: aiVelY,
            };
          }
          return next;
        });
        setIsMoving(true);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isMoving, playerTurn, gameOver, difficulty, ballInHand]);

  // --- Aiming ---

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (isMovingRef.current || !isMyTurnRef.current || gameOverRef.current) return;
        const {locationX, locationY} = evt.nativeEvent;

        // Ball-in-hand: tap to place cue ball
        if (ballInHandRef.current) {
          setPlacingCue(true);
          // 9-ball: anywhere on table; 8-ball: behind head string
          const placeY = variant === '9-ball'
            ? Math.max(BALL_RADIUS, Math.min(locationY, TABLE_HEIGHT - BALL_RADIUS))
            : Math.max(locationY, HEAD_STRING_Y);
          const placeX = Math.max(BALL_RADIUS, Math.min(locationX, TABLE_WIDTH - BALL_RADIUS));
          setBalls(prev => {
            const next = prev.map(b => ({...b, pos: {...b.pos}, vel: {...b.vel}}));
            const c = next.find(b => b.type === 'cue');
            if (c) {
              c.pocketed = false;
              c.pos = {x: placeX, y: placeY};
              c.vel = {x: 0, y: 0};
            }
            return next;
          });
          return;
        }

        const start = {x: locationX, y: locationY};
        setDragStart(start);
        dragStartRef.current = start;
        setDragCurrent(start);
      },
      onPanResponderMove: (evt) => {
        if (isMovingRef.current || !isMyTurnRef.current || gameOverRef.current) return;
        const {locationX, locationY} = evt.nativeEvent;

        // Ball-in-hand: drag to reposition
        if (ballInHandRef.current) {
          const placeY = variant === '9-ball'
            ? Math.max(BALL_RADIUS, Math.min(locationY, TABLE_HEIGHT - BALL_RADIUS))
            : Math.max(locationY, HEAD_STRING_Y);
          const placeX = Math.max(BALL_RADIUS, Math.min(locationX, TABLE_WIDTH - BALL_RADIUS));
          setBalls(prev => {
            const next = prev.map(b => ({...b, pos: {...b.pos}, vel: {...b.vel}}));
            const c = next.find(b => b.type === 'cue');
            if (c) {
              c.pos = {x: placeX, y: placeY};
            }
            return next;
          });
          return;
        }

        setDragCurrent({x: locationX, y: locationY});
        const ds = dragStartRef.current;
        if (ds) {
          const d = dist(ds, {x: locationX, y: locationY});
          setPower(Math.min(d / 120, 1));
        }
      },
      onPanResponderRelease: (evt) => {
        // Ball-in-hand: confirm placement
        if (ballInHandRef.current) {
          setBallInHand(false);
          ballInHandRef.current = false;
          setPlacingCue(false);
          setShotMessage('Cue ball placed — take your shot!');
          setTimeout(() => setShotMessage(null), 1500);
          return;
        }

        const ds = dragStartRef.current;
        if (isMovingRef.current || !isMyTurnRef.current || gameOverRef.current || !ds) {
          setDragStart(null);
          dragStartRef.current = null;
          setDragCurrent(null);
          setPower(0);
          return;
        }
        const {locationX, locationY} = evt.nativeEvent;
        const cue = ballsRef.current.find(b => b.type === 'cue' && !b.pocketed);
        if (!cue) { setDragStart(null); dragStartRef.current = null; setDragCurrent(null); setPower(0); return; }

        // Direction: drag back from cue ball = shoot forward
        const dx = ds.x - locationX;
        const dy = ds.y - locationY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 5) { setDragStart(null); dragStartRef.current = null; setDragCurrent(null); setPower(0); return; }

        const force = Math.min((d / 120) * MAX_FORCE, MAX_FORCE);
        const angle = Math.atan2(dy, dx);

        // Reset shot tracking for this shot
        shotPocketedRef.current = [];
        firstHitRef.current = null;
        cueScratchRef.current = false;

        // Capture player shot info for logging
        const cueBallVelocity = {x: Math.cos(angle) * force, y: Math.sin(angle) * force};
        lastPlayerShotRef.current = {
          cueBallVelocity,
          targetBall: undefined, // Player shot - no specific target tracked
        };

        iAmShooterRef.current = true;

        if (isMultiplayerRef.current && roomIdRef.current) {
          // Multiplayer: pre-compute entire shot for frame-perfect sync
          const result = precomputeShot(ballsRef.current, cueBallVelocity);
          shotPocketedRef.current = result.shotPocketed;
          firstHitRef.current = result.firstHit;
          cueScratchRef.current = result.cueScratch;
          frameBufferRef.current = result.frames;
          frameIndexRef.current = 0;

          // Encode and send pre-computed frames so opponent plays the EXACT same animation
          const encoded = encodeFrames(result.frames);
          const socket = socketService.getSocket();
          if (socket) {
            socket.emit('billiards_shot', {
              roomId: roomIdRef.current,
              velocity: cueBallVelocity,
              frameData: encoded,
              balls: ballsRef.current.map(b => ({
                id: b.id, number: b.number,
                pos: { x: b.pos.x / TABLE_WIDTH, y: b.pos.y / TABLE_HEIGHT },
                color: b.color, stripe: b.stripe, pocketed: b.pocketed,
                type: b.type, rotation: b.rotation,
              })),
            });
          }
        } else {
          // Single-player: apply velocity directly, real-time physics drives simulation
          setBalls(prev => {
            const next = prev.map(b => ({...b, pos: {...b.pos}, vel: {...b.vel}}));
            const c = next.find(b => b.type === 'cue' && !b.pocketed);
            if (c) c.vel = cueBallVelocity;
            return next;
          });
        }

        setIsMoving(true);
        setDragStart(null);
        dragStartRef.current = null;
        setDragCurrent(null);
        setPower(0);
      },
    }),
  ).current;

  // --- Cue stick geometry ---
  const getCueStick = () => {
    if (!cueBall || !dragStart || !dragCurrent || isMoving) return null;
    // Cue stick sits behind cue ball, opposite to shot direction
    const dx = dragStart.x - dragCurrent.x;
    const dy = dragStart.y - dragCurrent.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 3) return null;

    // Shot direction (where ball will go)
    const shotAngle = Math.atan2(dy, dx);
    // Cue stick extends BEHIND the cue ball (opposite direction)
    const pullback = Math.min(d * 0.3, 30); // pull-back distance based on drag
    const cueStartX = cueBall.pos.x - Math.cos(shotAngle) * (BALL_RADIUS + 4 + pullback);
    const cueStartY = cueBall.pos.y - Math.sin(shotAngle) * (BALL_RADIUS + 4 + pullback);
    const cueEndX = cueStartX - Math.cos(shotAngle) * CUE_LENGTH;
    const cueEndY = cueStartY - Math.sin(shotAngle) * CUE_LENGTH;

    // Aim dot (where the ball will head)
    const aimDotX = cueBall.pos.x + Math.cos(shotAngle) * TABLE_WIDTH * 0.4;
    const aimDotY = cueBall.pos.y + Math.sin(shotAngle) * TABLE_WIDTH * 0.4;

    return {cueStartX, cueStartY, cueEndX, cueEndY, shotAngle, aimDotX, aimDotY};
  };

  const cueGeo = getCueStick();

  const handleNewGame = () => {
    // Reset AI logging refs for new game
    billiardsGameIdRef.current = uuidv4();
    shotCountRef.current = 0;
    lastPlayerShotRef.current = null;
    setEntryDeducted(false);
    setPrizeAwarded(false);
    
    setBalls(variant === '9-ball' ? createRack9Ball() : createRack8Ball());
    setIsMoving(false);
    setPlayerTurn(true);
    setPlayerType(null);
    playerTypeRef.current = null;
    setAiType(null);
    aiTypeRef.current = null;
    setPocketedSolids([]);
    setPocketedStripes([]);
    setGameOver(false);
    setWinner(null);
    setBallInHand(false);
    ballInHandRef.current = false;
    setPlacingCue(false);
    setShotMessage(null);
    shotPocketedRef.current = [];
    firstHitRef.current = null;
    cueScratchRef.current = false;
    frameBufferRef.current = [];
    frameIndexRef.current = 0;
  };

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

  // Render the cue stick as a thin rotated View
  const renderCueStick = () => {
    if (!cueGeo) return null;
    const {cueStartX, cueStartY, cueEndX, cueEndY} = cueGeo;
    const dx = cueEndX - cueStartX;
    const dy = cueEndY - cueStartY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const midX = (cueStartX + cueEndX) / 2;
    const midY = (cueStartY + cueEndY) / 2;
    const deg = (angle * 180) / Math.PI;

    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: midX - length / 2,
          top: midY - CUE_THICK / 2,
          width: length,
          height: CUE_THICK,
          transform: [{rotate: `${deg}deg`}],
          zIndex: 50,
        }}>
        {/* Shaft (lighter wood) */}
        <View style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: length * 0.7,
          height: CUE_THICK,
          backgroundColor: '#F5DEB3',
          borderTopLeftRadius: 1,
          borderBottomLeftRadius: 1,
        }} />
        {/* Butt (darker wood) */}
        <View style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: length * 0.3,
          height: CUE_THICK,
          backgroundColor: '#8B4513',
          borderTopRightRadius: 2,
          borderBottomRightRadius: 2,
        }} />
        {/* Tip */}
        <View style={{
          position: 'absolute',
          left: -2,
          top: -0.5,
          width: 4,
          height: CUE_THICK + 1,
          backgroundColor: '#87CEEB',
          borderRadius: 1,
        }} />
      </View>
    );
  };

  // Helper: render a line as a rotated thin View (always returns array for consistency)
  const renderLine = (x1: number, y1: number, x2: number, y2: number, color: string, width: number, key: string, dashed?: boolean): React.ReactNode[] => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1) return [];
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    if (dashed) {
      // Render dashed line as series of short segments
      const dashLen = 6;
      const gapLen = 4;
      const segments: React.ReactNode[] = [];
      let d = 0;
      let segIdx = 0;
      const lineDirX = dx / length;
      const lineDirY = dy / length;
      while (d < length) {
        const segStart = d;
        const segEnd = Math.min(d + dashLen, length);
        const sx = x1 + lineDirX * segStart;
        const sy = y1 + lineDirY * segStart;
        const ex = x1 + lineDirX * segEnd;
        const ey = y1 + lineDirY * segEnd;
        const segLen = segEnd - segStart;
        const segMidX = (sx + ex) / 2;
        const segMidY = (sy + ey) / 2;
        segments.push(
          <View key={`${key}-dash-${segIdx++}`} pointerEvents="none" style={{
            position: 'absolute',
            left: segMidX - segLen / 2,
            top: segMidY - width / 2,
            width: segLen,
            height: width,
            backgroundColor: color,
            transform: [{rotate: `${angle}deg`}],
          }} />,
        );
        d += dashLen + gapLen;
      }
      return segments;
    }

    return [
      <View key={key} pointerEvents="none" style={{
        position: 'absolute',
        left: midX - length / 2,
        top: midY - width / 2,
        width: length,
        height: width,
        backgroundColor: color,
        transform: [{rotate: `${angle}deg`}],
      }} />,
    ];
  };

  // Improved raycast aim guide with accurate trajectory prediction
  const renderAimGuide = () => {
    if (!cueGeo || !cueBall) return null;
    const {shotAngle} = cueGeo;
    const dirX = Math.cos(shotAngle);
    const dirY = Math.sin(shotAngle);
    const elements: React.ReactNode[] = [];

    // Find first ball the cue ball will hit using precise ray-circle intersection
    const activeBalls = balls.filter(b => !b.pocketed && b.type !== 'cue');
    let hitBall: Ball | null = null;
    let hitDist = Infinity;
    let hitPoint: Vec2 = {x: 0, y: 0}; // Where cue ball CENTER will be at collision

    for (const target of activeBalls) {
      // Vector from cue ball center to target center
      const ocx = target.pos.x - cueBall.pos.x;
      const ocy = target.pos.y - cueBall.pos.y;

      // Project target center onto the aim ray
      const proj = ocx * dirX + ocy * dirY;
      if (proj < BALL_RADIUS * 2) continue; // Target is behind or overlapping

      // Closest point on ray to target center
      const closestX = cueBall.pos.x + dirX * proj;
      const closestY = cueBall.pos.y + dirY * proj;

      // Perpendicular distance from ray to target center
      const perpDist = Math.sqrt((closestX - target.pos.x) ** 2 + (closestY - target.pos.y) ** 2);

      // Collision occurs when perpendicular distance < 2 * BALL_RADIUS
      const collisionRadius = BALL_RADIUS * 2;
      if (perpDist < collisionRadius) {
        // Calculate exact collision distance using Pythagorean theorem
        // hitDist = proj - sqrt(collisionRadius^2 - perpDist^2)
        const offset = Math.sqrt(collisionRadius * collisionRadius - perpDist * perpDist);
        const hitD = proj - offset;

        if (hitD > BALL_RADIUS && hitD < hitDist) {
          hitDist = hitD;
          hitBall = target;
          hitPoint = {
            x: cueBall.pos.x + dirX * hitD,
            y: cueBall.pos.y + dirY * hitD,
          };
        }
      }
    }

    // Calculate wall collision if no ball hit or ball is further than wall
    const calcWallHit = (): {dist: number; point: Vec2} => {
      let minDist = Infinity;
      let wallPt: Vec2 = {x: 0, y: 0};

      // Right wall
      if (dirX > 0.001) {
        const d = (TABLE_WIDTH - BALL_RADIUS - cueBall.pos.x) / dirX;
        if (d > 0 && d < minDist) {
          minDist = d;
          wallPt = {x: TABLE_WIDTH - BALL_RADIUS, y: cueBall.pos.y + dirY * d};
        }
      }
      // Left wall
      if (dirX < -0.001) {
        const d = (BALL_RADIUS - cueBall.pos.x) / dirX;
        if (d > 0 && d < minDist) {
          minDist = d;
          wallPt = {x: BALL_RADIUS, y: cueBall.pos.y + dirY * d};
        }
      }
      // Bottom wall
      if (dirY > 0.001) {
        const d = (TABLE_HEIGHT - BALL_RADIUS - cueBall.pos.y) / dirY;
        if (d > 0 && d < minDist) {
          minDist = d;
          wallPt = {x: cueBall.pos.x + dirX * d, y: TABLE_HEIGHT - BALL_RADIUS};
        }
      }
      // Top wall
      if (dirY < -0.001) {
        const d = (BALL_RADIUS - cueBall.pos.y) / dirY;
        if (d > 0 && d < minDist) {
          minDist = d;
          wallPt = {x: cueBall.pos.x + dirX * d, y: BALL_RADIUS};
        }
      }
      return {dist: minDist, point: wallPt};
    };

    const wallHit = calcWallHit();
    const useWallHit = !hitBall || wallHit.dist < hitDist;
    const endPoint = hitBall && !useWallHit ? hitPoint : wallHit.point;
    const endDist = hitBall && !useWallHit ? hitDist : wallHit.dist;

    // === DRAW CUE BALL TRAJECTORY ===
    // Solid white line from cue ball to impact/wall
    elements.push(...renderLine(
      cueBall.pos.x, cueBall.pos.y,
      endPoint.x, endPoint.y,
      'rgba(255,255,255,0.7)', 2, 'aim-line',
    ));

    // Extended aim line (fainter, shows where you're pointing)
    const extendLen = TABLE_WIDTH * 0.6;
    const extEndX = cueBall.pos.x + dirX * extendLen;
    const extEndY = cueBall.pos.y + dirY * extendLen;
    elements.push(...renderLine(
      endPoint.x, endPoint.y,
      Math.max(0, Math.min(extEndX, TABLE_WIDTH)),
      Math.max(0, Math.min(extEndY, TABLE_HEIGHT)),
      'rgba(255,255,255,0.15)', 1, 'aim-ext', true,
    ));

    if (hitBall && !useWallHit) {
      // === GHOST CUE BALL AT IMPACT ===
      // Semi-transparent filled circle showing where cue ball will be
      elements.push(
        <View key="ghost-cue" pointerEvents="none" style={{
          position: 'absolute',
          left: hitPoint.x - BALL_RADIUS,
          top: hitPoint.y - BALL_RADIUS,
          width: BALL_RADIUS * 2,
          height: BALL_RADIUS * 2,
          borderRadius: BALL_RADIUS,
          backgroundColor: 'rgba(255,255,255,0.25)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.5)',
        }} />,
      );

      // === CONTACT POINT ===
      // The actual point where the balls touch
      const contactX = (hitPoint.x + hitBall.pos.x) / 2;
      const contactY = (hitPoint.y + hitBall.pos.y) / 2;
      elements.push(
        <View key="contact-point" pointerEvents="none" style={{
          position: 'absolute',
          left: contactX - 4,
          top: contactY - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#FF6B6B',
          borderWidth: 1,
          borderColor: '#fff',
        }} />,
      );

      // === TARGET BALL DEFLECTION ===
      // Direction: from cue ball center at impact → through target ball center
      const deflectDirX = hitBall.pos.x - hitPoint.x;
      const deflectDirY = hitBall.pos.y - hitPoint.y;
      const deflectLen = Math.sqrt(deflectDirX * deflectDirX + deflectDirY * deflectDirY) || 1;
      const dnx = deflectDirX / deflectLen;
      const dny = deflectDirY / deflectLen;

      // Calculate where target ball trajectory hits wall or pocket
      let targetEndDist = TABLE_WIDTH * 0.5;
      // Check walls for target ball
      if (dnx > 0.001) targetEndDist = Math.min(targetEndDist, (TABLE_WIDTH - BALL_RADIUS - hitBall.pos.x) / dnx);
      if (dnx < -0.001) targetEndDist = Math.min(targetEndDist, (BALL_RADIUS - hitBall.pos.x) / dnx);
      if (dny > 0.001) targetEndDist = Math.min(targetEndDist, (TABLE_HEIGHT - BALL_RADIUS - hitBall.pos.y) / dny);
      if (dny < -0.001) targetEndDist = Math.min(targetEndDist, (BALL_RADIUS - hitBall.pos.y) / dny);
      targetEndDist = Math.max(targetEndDist, BALL_RADIUS * 2);

      const targetEndX = hitBall.pos.x + dnx * targetEndDist;
      const targetEndY = hitBall.pos.y + dny * targetEndDist;

      // Draw target ball trajectory (yellow/gold line)
      elements.push(...renderLine(
        hitBall.pos.x, hitBall.pos.y,
        targetEndX, targetEndY,
        'rgba(255,200,0,0.8)', 2, 'target-line',
      ));

      // Ghost target ball at end position
      elements.push(
        <View key="ghost-target" pointerEvents="none" style={{
          position: 'absolute',
          left: targetEndX - BALL_RADIUS,
          top: targetEndY - BALL_RADIUS,
          width: BALL_RADIUS * 2,
          height: BALL_RADIUS * 2,
          borderRadius: BALL_RADIUS,
          backgroundColor: 'rgba(255,200,0,0.2)',
          borderWidth: 1,
          borderColor: 'rgba(255,200,0,0.5)',
        }} />,
      );

      // === CUE BALL DEFLECTION AFTER HIT ===
      // For equal mass elastic collision: cue ball travels perpendicular to the collision normal
      // v_cue_after = v_cue_before - (v_cue_before · n) * n
      const dotProduct = dirX * dnx + dirY * dny;
      const cueBounceX = dirX - dotProduct * dnx;
      const cueBounceY = dirY - dotProduct * dny;
      const cbLen = Math.sqrt(cueBounceX * cueBounceX + cueBounceY * cueBounceY);

      if (cbLen > 0.1) { // Only show if there's meaningful deflection
        const cbnx = cueBounceX / cbLen;
        const cbny = cueBounceY / cbLen;

        // Calculate cue ball bounce endpoint
        let cueEndDist = TABLE_WIDTH * 0.25;
        if (cbnx > 0.001) cueEndDist = Math.min(cueEndDist, (TABLE_WIDTH - BALL_RADIUS - hitPoint.x) / cbnx);
        if (cbnx < -0.001) cueEndDist = Math.min(cueEndDist, (BALL_RADIUS - hitPoint.x) / cbnx);
        if (cbny > 0.001) cueEndDist = Math.min(cueEndDist, (TABLE_HEIGHT - BALL_RADIUS - hitPoint.y) / cbny);
        if (cbny < -0.001) cueEndDist = Math.min(cueEndDist, (BALL_RADIUS - hitPoint.y) / cbny);
        cueEndDist = Math.max(cueEndDist, BALL_RADIUS);

        const cueEndX = hitPoint.x + cbnx * cueEndDist;
        const cueEndY = hitPoint.y + cbny * cueEndDist;

        // Draw cue ball bounce path (light blue dashed line)
        elements.push(...renderLine(
          hitPoint.x, hitPoint.y,
          cueEndX, cueEndY,
          'rgba(135,206,250,0.6)', 1.5, 'cue-bounce', true,
        ));
      }

      // === POCKET PROXIMITY INDICATOR ===
      // Highlight if target ball trajectory passes near a pocket
      for (let i = 0; i < POCKETS.length; i++) {
        const pocket = POCKETS[i]!;
        // Check if trajectory line passes within pocket radius
        // Vector from ball to pocket
        const toPocketX = pocket.x - hitBall.pos.x;
        const toPocketY = pocket.y - hitBall.pos.y;
        // Project onto deflection direction
        const projToPocket = toPocketX * dnx + toPocketY * dny;
        if (projToPocket > 0 && projToPocket < targetEndDist + POCKET_RADIUS) {
          // Closest point on trajectory to pocket
          const closestX = hitBall.pos.x + dnx * projToPocket;
          const closestY = hitBall.pos.y + dny * projToPocket;
          const distToPocket = Math.sqrt((closestX - pocket.x) ** 2 + (closestY - pocket.y) ** 2);
          if (distToPocket < POCKET_RADIUS * 1.5) {
            // Draw pocket highlight
            elements.push(
              <View key={`pocket-highlight-${i}`} pointerEvents="none" style={{
                position: 'absolute',
                left: pocket.x - POCKET_RADIUS * 1.2,
                top: pocket.y - POCKET_RADIUS * 1.2,
                width: POCKET_RADIUS * 2.4,
                height: POCKET_RADIUS * 2.4,
                borderRadius: POCKET_RADIUS * 1.2,
                borderWidth: 2,
                borderColor: distToPocket < POCKET_RADIUS ? '#22C55E' : '#FBBF24',
                backgroundColor: distToPocket < POCKET_RADIUS ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.1)',
              }} />,
            );
          }
        }
      }
    }

    return elements;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <GameToolbar
        title={variant === '9-ball' ? '9-Ball' : '8-Ball'}
        onBack={() => navigation.goBack()}
        backgroundColor="transparent"
        rightElement={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isMultiplayer && !gameOver && (
              <TouchableOpacity
                onPress={() => setShowRoomNameModal(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                <Text style={{ fontSize: 18 }}>✏️</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.turnText}>
              {gameOver
                ? winner === 'player' ? '🏆 You Win!' : (isMultiplayer ? '💀 You Lose' : '💀 AI Wins')
                : ballInHand ? '👆 Place cue ball'
                : isMoving ? '⏳'
                : isMultiplayer
                  ? (isMyTurn ? '🎯 Your Shot' : '⏳ Opponent...')
                  : (playerTurn ? '🎯 Your Shot' : '🤖 AI')}
            </Text>
          </View>
        }
      />

      {/* Power bar */}
      <View style={styles.powerRow}>
        <Text style={styles.powerLabel}>Power</Text>
        <View style={styles.powerTrack}>
          <View style={[
            styles.powerFill,
            {width: `${power * 100}%`, backgroundColor: power > 0.7 ? '#EF4444' : power > 0.4 ? '#F59E0B' : '#22C55E'},
          ]} />
        </View>
      </View>

      {/* Table */}
      <View style={styles.tableOuter}>
        <View style={styles.tableRail}>
          <ImageBackground
            source={require('../../../../assets/pool/table.png')}
            style={styles.tableFelt}
            imageStyle={{
              width: TABLE_IMG_W-150,
              height: TABLE_IMG_H-100,
              left: TABLE_IMG_LEFT+80,
              top: TABLE_IMG_TOP+50,
            }}
            resizeMode="stretch"
            {...panResponder.panHandlers}>
            {/* Pockets */}
            {POCKETS.map((p, i) => (
              <View key={`pocket-${i}`} style={[styles.pocket, {
                left: p.x - POCKET_RADIUS,
                top: p.y - POCKET_RADIUS,
              }]} />
            ))}

            {/* Head string line */}
            <View pointerEvents="none" style={[styles.headString, {
              top: TABLE_HEIGHT * 0.72,
              backgroundColor: ballInHand ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.12)',
              height: ballInHand ? 2 : 1,
            }]} />

            {/* Foot spot */}
            <View pointerEvents="none" style={[styles.footSpot, {
              left: TABLE_WIDTH / 2 - 3,
              top: TABLE_HEIGHT * 0.28 - 3,
            }]} />

            {/* Aim guide */}
            {renderAimGuide()}

            {/* Cue stick */}
            {renderCueStick()}

            {/* Balls */}
            {balls.filter(b => !b.pocketed).map(ball => {
              const isRolling = ball.rotation !== 0;
              // While rolling, simulate the look of the ball spinning:
              // - Solids: show color with a moving highlight
              // - Stripes: oscillate the stripe band position
              // When stopped: show number clearly on top
              const stripeOffset = isRolling
                ? BALL_RADIUS * 0.5 + Math.sin((ball.rotation * Math.PI) / 180) * BALL_RADIUS * 0.4
                : BALL_RADIUS * 0.5;
              const numberOpacity = isRolling ? Math.max(0, Math.cos((ball.rotation * Math.PI) / 90) * 0.8 + 0.2) : 1;

              return (
                <View key={ball.id} style={[styles.ball, {
                  left: ball.pos.x - BALL_RADIUS,
                  top: ball.pos.y - BALL_RADIUS,
                  width: BALL_RADIUS * 2,
                  height: BALL_RADIUS * 2,
                  backgroundColor: ball.stripe ? '#FFFFFF' : ball.color,
                  borderColor: ball.type === 'cue' ? '#bbb' : '#222',
                  overflow: 'hidden',
                }]}>
                  {/* Rolling highlight for solid balls */}
                  {!ball.stripe && ball.type !== 'cue' && isRolling && (
                    <View style={{
                      position: 'absolute',
                      top: -BALL_RADIUS * 0.3,
                      left: BALL_RADIUS * 0.2 + Math.sin((ball.rotation * Math.PI) / 180) * BALL_RADIUS * 0.5,
                      width: BALL_RADIUS * 0.8,
                      height: BALL_RADIUS * 0.8,
                      borderRadius: BALL_RADIUS * 0.4,
                      backgroundColor: 'rgba(255,255,255,0.25)',
                    }} />
                  )}
                  {/* Stripe band — oscillates while rolling */}
                  {ball.stripe && (
                    <View style={{
                      position: 'absolute',
                      top: stripeOffset,
                      left: -2,
                      right: -2,
                      height: BALL_RADIUS * 1.0,
                      backgroundColor: ball.color,
                    }} />
                  )}
                  {/* Number circle — fades in/out while rolling, fully visible when stopped */}
                  {ball.number > 0 && (
                    <View style={[styles.numberCircle, {
                      width: BALL_RADIUS * 1.0,
                      height: BALL_RADIUS * 1.0,
                      borderRadius: BALL_RADIUS * 0.5,
                      opacity: numberOpacity,
                      transform: isRolling ? [{rotate: `${ball.rotation * 2}deg`}] : [],
                    }]}>
                      <Text style={[styles.ballNumber, {
                        fontSize: BALL_RADIUS * 0.7,
                        color: '#111',
                        transform: isRolling ? [{rotate: `-${ball.rotation * 2}deg`}] : [],
                      }]}>
                        {ball.number}
                      </Text>
                    </View>
                  )}
                  {/* Cue ball dot while rolling */}
                  {ball.type === 'cue' && isRolling && (
                    <View style={{
                      width: BALL_RADIUS * 0.3,
                      height: BALL_RADIUS * 0.3,
                      borderRadius: BALL_RADIUS * 0.15,
                      backgroundColor: '#ddd',
                      position: 'absolute',
                      top: BALL_RADIUS * 0.4 + Math.sin((ball.rotation * Math.PI) / 180) * BALL_RADIUS * 0.3,
                      left: BALL_RADIUS * 0.6 + Math.cos((ball.rotation * Math.PI) / 180) * BALL_RADIUS * 0.3,
                    }} />
                  )}
                </View>
              );
            })}
          </ImageBackground>
        </View>
      </View>

      {/* Pocketed balls (8-ball only shows solids/stripes breakdown; 9-ball shows all) */}
      {variant === '8-ball' ? (
        <View style={styles.pocketedRow}>
          <View style={styles.pocketedGroup}>
            <Text style={styles.pocketedLabel}>Solids</Text>
            <View style={styles.miniRow}>
              {pocketedSolids.map((b, i) => (
                <View key={`s-${b.id}-${i}`} style={[styles.miniBall, {backgroundColor: b.color}]}>
                  <View style={styles.miniNumberCircle}>
                    <Text style={styles.miniNum}>{b.number}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.pocketedGroup}>
            <Text style={styles.pocketedLabel}>Stripes</Text>
            <View style={styles.miniRow}>
              {pocketedStripes.map((b, i) => (
                <View key={`st-${b.id}-${i}`} style={[styles.miniBall, {backgroundColor: '#fff', overflow: 'hidden'}]}>
                  {/* Stripe band */}
                  <View style={{
                    position: 'absolute',
                    top: 5,
                    left: -1,
                    right: -1,
                    height: 10,
                    backgroundColor: b.color,
                  }} />
                  <View style={styles.miniNumberCircle}>
                    <Text style={styles.miniNum}>{b.number}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.pocketedRow}>
          <View style={styles.pocketedGroup}>
            <Text style={styles.pocketedLabel}>Pocketed</Text>
            <View style={styles.miniRow}>
              {[...pocketedSolids, ...pocketedStripes]
                .sort((a, b) => a.number - b.number)
                .map((b, i) => (
                  <View key={`p-${b.id}-${i}`} style={[styles.miniBall, {
                    backgroundColor: b.stripe ? '#fff' : b.color,
                    overflow: 'hidden',
                  }]}>
                    {b.stripe && (
                      <View style={{
                        position: 'absolute', top: 5, left: -1, right: -1,
                        height: 10, backgroundColor: b.color,
                      }} />
                    )}
                    <View style={styles.miniNumberCircle}>
                      <Text style={styles.miniNum}>{b.number}</Text>
                    </View>
                  </View>
                ))}
            </View>
          </View>
        </View>
      )}

      {/* Type assignments (8-ball only) */}
      {variant === '8-ball' && playerType && (
        <View style={styles.typeRow}>
          <Text style={styles.typeLabel}>You: <Text style={{color: playerType === 'solid' ? '#FFD700' : '#87CEEB', fontWeight: '800'}}>{playerType}s</Text></Text>
          <Text style={styles.typeLabel}>AI: <Text style={{color: aiType === 'solid' ? '#FFD700' : '#87CEEB', fontWeight: '800'}}>{aiType}s</Text></Text>
        </View>
      )}

      {/* 9-ball target indicator */}
      {variant === '9-ball' && !gameOver && !isMoving && (
        <View style={styles.typeRow}>
          <Text style={styles.typeLabel}>
            Target: <Text style={{color: '#FFD700', fontWeight: '800'}}>
              {(() => {
                const active = balls.filter(b => !b.pocketed && b.number > 0);
                const lowest = Math.min(...active.map(b => b.number));
                return `${lowest} ball`;
              })()}
            </Text>
          </Text>
        </View>
      )}

      {/* Shot message */}
      {shotMessage && (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{shotMessage}</Text>
        </View>
      )}

      {/* Ball-in-hand indicator */}
      {ballInHand && (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            {variant === '9-ball'
              ? '👆 Tap anywhere to place the cue ball'
              : '👆 Tap behind the head string to place the cue ball'}
          </Text>
        </View>
      )}

      {/* Head string label when placing (8-ball only) */}
      {ballInHand && variant === '8-ball' && (
        <Text style={[styles.hint, {color: '#FFD700'}]}>↑ Must place behind the dashed line ↑</Text>
      )}

      {/* Drag hint */}
      {!isMoving && isMyTurn && !gameOver && !dragStart && !ballInHand && (
        <Text style={styles.hint}>Drag back from the cue ball to aim & shoot</Text>
      )}

      {/* Multiplayer matchmaking / waiting overlay */}
      {isMultiplayer && mpStatus !== 'playing' && mpStatus !== 'ended' && (
        <View style={styles.mpOverlay}>
          <Text style={styles.mpOverlayTitle}>
            {variant === '9-ball' ? '9-Ball Pool' : '8-Ball Pool'}
          </Text>
          <Text style={styles.mpOverlayStatus}>
            {mpStatus === 'connecting' ? 'Connecting to server...' :
             mpStatus === 'searching'  ? 'Finding an opponent...' :
             mpStatus === 'waiting'    ? 'Waiting for game to start...' : ''}
          </Text>
          <TouchableOpacity
            style={styles.mpCancelBtn}
            onPress={() => {
              socketService.cancelMatchmaking(userId);
              navigation.goBack();
            }}>
            <Text style={styles.mpCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Game over overlay with animation */}
      {gameOver && (
        <GameOverOverlay
          isWin={winner === 'player'}
          isMultiplayer={isMultiplayer}
          onNewGame={handleNewGame}
          onGoBack={() => navigation.goBack()}
        />
      )}

      {/* Difficulty badge / online badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {isMultiplayer ? '🌐 Online' : `AI: ${difficulty}`}
        </Text>
      </View>

      {/* In-game chat overlay (multiplayer only) */}
      <InGameChat
        roomId={roomId || ''}
        currentUserId={userId}
        gameType={variant}
        visible={isMultiplayer && !!roomId}
      />

      {/* Room Name Editor Modal */}
      <RoomNameModal
        visible={showRoomNameModal}
        onClose={() => setShowRoomNameModal(false)}
        currentName={roomName}
        onSave={handleSaveRoomName}
        gameType="Billiards"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#0C1F0C'},
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  backButton: {color: '#ccc', fontSize: 15},
  title: {color: '#FFD700', fontSize: 18, fontWeight: '800', letterSpacing: 1},
  turnText: {color: '#fff', fontSize: 13, fontWeight: '600'},
  powerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 6,
  },
  powerLabel: {color: '#aaa', fontSize: 11, marginRight: 8, width: 40},
  powerTrack: {flex: 1, height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden'},
  powerFill: {height: '100%', borderRadius: 3},
  tableOuter: {width: '100%'},
  tableRail: {
    width: TABLE_WIDTH,
    height: TABLE_HEIGHT,
    overflow: 'hidden',
  },
  railPocket: {
    position: 'absolute',
    width: POCKET_RADIUS * 1.6,
    height: POCKET_RADIUS * 1.6,
    borderRadius: POCKET_RADIUS * 0.8,
    backgroundColor: '#1a1a1a',
    zIndex: 5,
  },
  tableFelt: {
    width: TABLE_WIDTH,
    height: TABLE_HEIGHT,
    borderRadius: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  tableFeltImage: {
    borderRadius: 0,
  },
  pocket: {
    position: 'absolute',
    width: POCKET_RADIUS * 2,
    height: POCKET_RADIUS * 2,
    borderRadius: POCKET_RADIUS,
    backgroundColor: '#111',
    zIndex: 10,
  },
  headString: {
    position: 'absolute',
    left: TABLE_WIDTH * 0.1,
    width: TABLE_WIDTH * 0.8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  footSpot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  ball: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    // Gloss effect
    shadowColor: '#000', shadowOffset: {width: 1, height: 1},
    shadowOpacity: 0.4, shadowRadius: 2, elevation: 3,
  },
  // stripeBand now rendered inline for proper sizing
  numberCircle: {
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  ballNumber: {fontWeight: '800', textAlign: 'center'},
  pocketedRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  pocketedGroup: {alignItems: 'center'},
  pocketedLabel: {color: '#777', fontSize: 11, marginBottom: 4},
  miniRow: {flexDirection: 'row', gap: 4},
  miniBall: {
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#444',
  },
  miniNumberCircle: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    zIndex: 5,
  },
  miniNum: {color: '#111', fontSize: 8, fontWeight: '700'},
  typeRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 20, paddingTop: 6,
  },
  typeLabel: {color: '#ccc', fontSize: 13, fontWeight: '600'},
  messageBox: {
    alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginTop: 6,
  },
  messageText: {color: '#FFD700', fontSize: 13, fontWeight: '700', textAlign: 'center'},
  hint: {
    textAlign: 'center', color: 'rgba(255,255,255,0.35)',
    fontSize: 12, marginTop: 8,
  },
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  gameOverTitle: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 8,
  },
  gameOverSubtitle: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
  },
  gameOverWrap: {alignItems: 'center', marginTop: 12},
  newGameBtn: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10,
  },
  newGameText: {color: '#fff', fontSize: 15, fontWeight: '700'},
  badge: {
    position: 'absolute', bottom: 30, right: 16,
    backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  badgeText: {color: '#FFD700', fontSize: 11, fontWeight: '600', textTransform: 'capitalize'},
  // Multiplayer matchmaking overlay
  mpOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  mpOverlayTitle: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 14,
  },
  mpOverlayStatus: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  mpCancelBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: '#333',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#555',
  },
  mpCancelText: {color: '#fff', fontSize: 14, fontWeight: '600'},
});

export default BilliardsGameScreen;
