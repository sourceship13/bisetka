import React, {useState, useRef, useCallback, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  PanResponder,
  Animated,
  Easing,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'BilliardsGame'>;

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// Portrait table: fills most of the screen width, taller than wide
const TABLE_PADDING = 24;
const RAIL_WIDTH = 14;
const TABLE_WIDTH = SCREEN_WIDTH - TABLE_PADDING * 2 - RAIL_WIDTH * 2;
const TABLE_HEIGHT = TABLE_WIDTH * 1.85; // standard pool ratio ~1:2
const BALL_RADIUS = TABLE_WIDTH * 0.042;
const POCKET_RADIUS = BALL_RADIUS * 1.6; // slightly forgiving for mobile touch controls, close to real proportions
const CUE_LENGTH = TABLE_WIDTH * 0.65;
const CUE_THICK = 3;
const FRICTION = 0.984;
const MIN_SPEED = 0.12;
const MAX_FORCE = 14;

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
  {x: POCKET_RADIUS * 0.6, y: POCKET_RADIUS * 0.6},                          // top-left
  {x: TABLE_WIDTH - POCKET_RADIUS * 0.6, y: POCKET_RADIUS * 0.6},            // top-right
  {x: POCKET_RADIUS * 0.35, y: TABLE_HEIGHT / 2},                             // center-left (side pocket)
  {x: TABLE_WIDTH - POCKET_RADIUS * 0.35, y: TABLE_HEIGHT / 2},               // center-right (side pocket)
  {x: POCKET_RADIUS * 0.6, y: TABLE_HEIGHT - POCKET_RADIUS * 0.6},           // bottom-left
  {x: TABLE_WIDTH - POCKET_RADIUS * 0.6, y: TABLE_HEIGHT - POCKET_RADIUS * 0.6}, // bottom-right
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
}> = ({isWin, onNewGame, onGoBack}) => {
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
            {isWin ? '🏆 YOU WIN! 🏆' : '💀 AI WINS 💀'}
          </Text>
          <Text style={styles.gameOverSubtitle}>
            {isWin ? 'Great shooting!' : 'Better luck next time...'}
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

  const [balls, setBalls] = useState<Ball[]>(
    variant === '9-ball' ? createRack9Ball() : createRack8Ball(),
  );
  const [isMoving, setIsMoving] = useState(false);
  const [playerTurn, setPlayerTurn] = useState(true); // true = human, false = AI
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

  const cueBall = balls.find(b => b.type === 'cue' && !b.pocketed);

  // Head string Y position (cue ball must be placed behind this on scratch)
  const HEAD_STRING_Y = TABLE_HEIGHT * 0.72;

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

        // --- Type assignment (first non-cue, non-8 ball pocketed decides types) ---
        if (!playerTypeRef.current && !aiTypeRef.current) {
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

        // Foul 3: first ball hit was not the shooter's type (if types assigned)
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

        // --- Determine if shooter keeps their turn ---
        const ownPocketed = shotPocketed.filter(b => b.type === shooterType);
        const madeOwnBall = shooterType ? ownPocketed.length > 0 : shotPocketed.some(b => b.type !== 'cue' && b.type !== 'eight');
        const keepTurn = !isFoul && madeOwnBall;

        if (isFoul) {
          if (cueScratch) {
            setShotMessage(wasPlayerTurn ? 'Scratch! AI gets ball-in-hand' : 'AI scratched! Place the cue ball');
          } else {
            setShotMessage(wasPlayerTurn ? 'Foul! Hit opponent\'s ball first' : 'AI foul!');
          }
          // Other player gets ball-in-hand behind head string
          if (wasPlayerTurn) {
            // AI gets ball in hand — auto-place for AI
            if (cue) {
              cue.pos = {x: TABLE_WIDTH / 2, y: HEAD_STRING_Y + BALL_RADIUS * 3};
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

  useEffect(() => {
    if (!isMoving) return;
    const tick = () => {
      simulateStep();
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isMoving, simulateStep]);

  // After balls stop, trigger AI turn
  useEffect(() => {
    if (!isMoving && !playerTurn && !gameOver && !ballInHand) {
      const timer = setTimeout(() => {
        const cue = ballsRef.current.find(b => b.type === 'cue' && !b.pocketed);
        if (!cue) return;

        // AI targets its own type if assigned, otherwise closest
        const aiT = aiTypeRef.current;
        let targets = ballsRef.current.filter(b => !b.pocketed && b.type !== 'cue');
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
        if (targets.length === 0) return;

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

        setBalls(prev => {
          const next = prev.map(b => ({...b, pos: {...b.pos}, vel: {...b.vel}}));
          const c = next.find(b => b.type === 'cue' && !b.pocketed);
          if (c) {
            c.vel = {
              x: (dx / d + (Math.random() - 0.5) * jitter) * speed,
              y: (dy / d + (Math.random() - 0.5) * jitter) * speed,
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
        if (isMovingRef.current || !playerTurnRef.current || gameOverRef.current) return;
        const {locationX, locationY} = evt.nativeEvent;

        // Ball-in-hand: tap to place cue ball behind head string
        if (ballInHandRef.current) {
          setPlacingCue(true);
          const placeY = Math.max(locationY, HEAD_STRING_Y);
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
        if (isMovingRef.current || !playerTurnRef.current || gameOverRef.current) return;
        const {locationX, locationY} = evt.nativeEvent;

        // Ball-in-hand: drag to reposition
        if (ballInHandRef.current) {
          const placeY = Math.max(locationY, HEAD_STRING_Y);
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
        if (isMovingRef.current || !playerTurnRef.current || gameOverRef.current || !ds) {
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

        const force = Math.min(d / 10, MAX_FORCE);
        const angle = Math.atan2(dy, dx);

        // Reset shot tracking for this shot
        shotPocketedRef.current = [];
        firstHitRef.current = null;
        cueScratchRef.current = false;

        setBalls(prev => {
          const next = prev.map(b => ({...b, pos: {...b.pos}, vel: {...b.vel}}));
          const c = next.find(b => b.type === 'cue' && !b.pocketed);
          if (c) {
            c.vel = {x: Math.cos(angle) * force, y: Math.sin(angle) * force};
          }
          return next;
        });
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

  // Raycast aim guide: shows cue ball path, hit point, and target ball deflection
  const renderAimGuide = () => {
    if (!cueGeo || !cueBall) return null;
    const {shotAngle} = cueGeo;
    const dirX = Math.cos(shotAngle);
    const dirY = Math.sin(shotAngle);
    const elements: React.ReactNode[] = [];

    // Find first ball the cue ball will hit along the aim line (ray-circle intersection)
    const activeBalls = balls.filter(b => !b.pocketed && b.type !== 'cue');
    let hitBall: Ball | null = null;
    let hitDist = Infinity;
    let hitPoint: Vec2 = {x: 0, y: 0};

    for (const target of activeBalls) {
      // Vector from cue ball to target
      const ocx = target.pos.x - cueBall.pos.x;
      const ocy = target.pos.y - cueBall.pos.y;
      // Project onto ray direction
      const proj = ocx * dirX + ocy * dirY;
      if (proj < BALL_RADIUS) continue; // behind us or too close
      // Perpendicular distance from ray to target center
      const perpX = cueBall.pos.x + dirX * proj - target.pos.x;
      const perpY = cueBall.pos.y + dirY * proj - target.pos.y;
      const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
      const collisionRadius = BALL_RADIUS * 2;
      if (perpDist < collisionRadius) {
        // Exact hit distance: back up from projection point
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

    // Also check wall hit if no ball hit
    let wallHitDist = Infinity;
    let wallHitPoint: Vec2 = {x: 0, y: 0};
    // Check all 4 walls
    if (dirX > 0) {
      const d = (TABLE_WIDTH - BALL_RADIUS - cueBall.pos.x) / dirX;
      if (d > 0 && d < wallHitDist) { wallHitDist = d; wallHitPoint = {x: cueBall.pos.x + dirX * d, y: cueBall.pos.y + dirY * d}; }
    } else if (dirX < 0) {
      const d = (BALL_RADIUS - cueBall.pos.x) / dirX;
      if (d > 0 && d < wallHitDist) { wallHitDist = d; wallHitPoint = {x: cueBall.pos.x + dirX * d, y: cueBall.pos.y + dirY * d}; }
    }
    if (dirY > 0) {
      const d = (TABLE_HEIGHT - BALL_RADIUS - cueBall.pos.y) / dirY;
      if (d > 0 && d < wallHitDist) { wallHitDist = d; wallHitPoint = {x: cueBall.pos.x + dirX * d, y: cueBall.pos.y + dirY * d}; }
    } else if (dirY < 0) {
      const d = (BALL_RADIUS - cueBall.pos.y) / dirY;
      if (d > 0 && d < wallHitDist) { wallHitDist = d; wallHitPoint = {x: cueBall.pos.x + dirX * d, y: cueBall.pos.y + dirY * d}; }
    }

    // End point of cue ball path
    const endDist = hitBall ? hitDist : Math.min(wallHitDist, TABLE_WIDTH * 1.5);
    const endX = hitBall ? hitPoint.x : wallHitPoint.x;
    const endY = hitBall ? hitPoint.y : wallHitPoint.y;

    // Draw cue ball path dots
    const pathLen = Math.sqrt((endX - cueBall.pos.x) ** 2 + (endY - cueBall.pos.y) ** 2);
    const dotSpacing = 10;
    const numDots = Math.min(Math.floor(pathLen / dotSpacing), 40);
    for (let i = 1; i <= numDots; i++) {
      const t = i / (numDots + 1);
      const x = cueBall.pos.x + (endX - cueBall.pos.x) * t;
      const y = cueBall.pos.y + (endY - cueBall.pos.y) * t;
      elements.push(
        <View key={`aim-${i}`} pointerEvents="none" style={{
          position: 'absolute', left: x - 1.5, top: y - 1.5,
          width: 3, height: 3, borderRadius: 1.5,
          backgroundColor: `rgba(255,255,255,${0.55 - t * 0.3})`,
        }} />,
      );
    }

    // Ghost cue ball at impact point
    if (hitBall) {
      elements.push(
        <View key="ghost-cue" pointerEvents="none" style={{
          position: 'absolute',
          left: hitPoint.x - BALL_RADIUS,
          top: hitPoint.y - BALL_RADIUS,
          width: BALL_RADIUS * 2,
          height: BALL_RADIUS * 2,
          borderRadius: BALL_RADIUS,
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.4)',
          borderStyle: 'dashed',
        }} />,
      );

      // Calculate deflection: target ball goes along the line from cue-hit-point to target center
      const deflectDirX = hitBall.pos.x - hitPoint.x;
      const deflectDirY = hitBall.pos.y - hitPoint.y;
      const deflectLen = Math.sqrt(deflectDirX * deflectDirX + deflectDirY * deflectDirY) || 1;
      const dnx = deflectDirX / deflectLen;
      const dny = deflectDirY / deflectLen;

      // Draw target ball deflection path
      const deflectPathLen = TABLE_WIDTH * 0.35;
      const deflectDots = 12;
      for (let i = 1; i <= deflectDots; i++) {
        const d = i * (deflectPathLen / deflectDots);
        const x = hitBall.pos.x + dnx * d;
        const y = hitBall.pos.y + dny * d;
        if (x < 0 || x > TABLE_WIDTH || y < 0 || y > TABLE_HEIGHT) break;
        elements.push(
          <View key={`deflect-${i}`} pointerEvents="none" style={{
            position: 'absolute', left: x - 1.5, top: y - 1.5,
            width: 3, height: 3, borderRadius: 1.5,
            backgroundColor: `rgba(255,200,0,${0.6 - i * 0.04})`,
          }} />,
        );
      }

      // Cue ball deflection after hit (90° from target deflection in 2D elastic collision)
      const cueBounceX = dirX - (dnx * (dirX * dnx + dirY * dny));
      const cueBounceY = dirY - (dny * (dirX * dnx + dirY * dny));
      const cbLen = Math.sqrt(cueBounceX * cueBounceX + cueBounceY * cueBounceY) || 1;
      const cbnx = cueBounceX / cbLen;
      const cbny = cueBounceY / cbLen;
      const cueBouncePathLen = TABLE_WIDTH * 0.2;
      const cueBDots = 6;
      for (let i = 1; i <= cueBDots; i++) {
        const d = i * (cueBouncePathLen / cueBDots);
        const x = hitPoint.x + cbnx * d;
        const y = hitPoint.y + cbny * d;
        if (x < 0 || x > TABLE_WIDTH || y < 0 || y > TABLE_HEIGHT) break;
        elements.push(
          <View key={`cue-bounce-${i}`} pointerEvents="none" style={{
            position: 'absolute', left: x - 1.5, top: y - 1.5,
            width: 3, height: 3, borderRadius: 1.5,
            backgroundColor: `rgba(180,180,255,${0.4 - i * 0.05})`,
          }} />,
        );
      }
    }

    return elements;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {variant === '9-ball' ? '9-Ball' : '8-Ball'}
        </Text>
        <Text style={styles.turnText}>
          {gameOver
            ? winner === 'player' ? '🏆 You Win!' : '💀 AI Wins'
            : ballInHand ? '👆 Place cue ball'
            : isMoving ? '⏳' : playerTurn ? '🎯 Your Shot' : '🤖 AI'}
        </Text>
      </View>

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
          {/* Corner diamonds */}
          {POCKETS.map((p, i) => (
            <View key={`rail-pocket-${i}`} style={[styles.railPocket, {
              left: p.x + RAIL_WIDTH - POCKET_RADIUS * 0.8,
              top: p.y + RAIL_WIDTH - POCKET_RADIUS * 0.8,
            }]} />
          ))}
          <View style={styles.tableFelt} {...panResponder.panHandlers}>
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
          </View>
        </View>
      </View>

      {/* Pocketed balls */}
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

      {/* Type assignments */}
      {playerType && (
        <View style={styles.typeRow}>
          <Text style={styles.typeLabel}>You: <Text style={{color: playerType === 'solid' ? '#FFD700' : '#87CEEB', fontWeight: '800'}}>{playerType}s</Text></Text>
          <Text style={styles.typeLabel}>AI: <Text style={{color: aiType === 'solid' ? '#FFD700' : '#87CEEB', fontWeight: '800'}}>{aiType}s</Text></Text>
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
          <Text style={styles.messageText}>👆 Tap behind the head string to place the cue ball</Text>
        </View>
      )}

      {/* Head string label when placing */}
      {ballInHand && (
        <Text style={[styles.hint, {color: '#FFD700'}]}>↑ Must place behind the dashed line ↑</Text>
      )}

      {/* Drag hint */}
      {!isMoving && playerTurn && !gameOver && !dragStart && !ballInHand && (
        <Text style={styles.hint}>Drag back from the cue ball to aim & shoot</Text>
      )}

      {/* Game over overlay with animation */}
      {gameOver && (
        <GameOverOverlay
          isWin={winner === 'player'}
          onNewGame={handleNewGame}
          onGoBack={() => navigation.goBack()}
        />
      )}

      {/* Difficulty badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>AI: {difficulty}</Text>
      </View>
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
  tableOuter: {alignItems: 'center'},
  tableRail: {
    backgroundColor: '#6B3410',
    borderRadius: 10,
    padding: RAIL_WIDTH,
    // Shadow
    shadowColor: '#000', shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 10,
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
    backgroundColor: '#0D7A0D',
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
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
});

export default BilliardsGameScreen;
