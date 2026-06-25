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
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../../hooks/useI18n';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import GamePlayerOverlay from '../../../components/GamePlayerOverlay';
import RoomNameModal from '../../../components/RoomNameModal';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import AraratBackground from '../../../components/AraratBackground';
import AR3DOverlay, {type AR3DOverlayHandle, type ARPiece} from '../../../components/AR3DOverlay';

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
// useI18n already imported above
import NardiDice from '../../../components/Games/NardiDice';
import Dice3DSimple from '../../../components/Games/Dice3DSimple';
import { apiService } from '../../../services/api.service';
import { useAuth } from '../../../libs/hooks/useAuth';
import { useAchievements } from '../../../contexts/AchievementContext';
import { v4 as uuidv4 } from 'uuid';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';
import { playPieceMoveSound, playDiceRollSound } from '../../../utils/nardiSound';
import { chooseBestAiSequence } from '../../../game/nardiAI';
import tokenService from '../../../services/token.service';

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
  topLeft:     { xOffset:  40, yOffset: 40, colWidth: 1.0 },  // ← tune to match triangle centres
  topRight:    { xOffset:  0, yOffset: 100, colWidth: 1.0 },
  bottomLeft:  { xOffset:  6, yOffset: 22, colWidth: 1.0 },  // ← tune to match triangle centres
  bottomRight: { xOffset:  0, yOffset: 22, colWidth: 1.0 },
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
  const { translate } = useI18n();
  const { isTablet, isLandscape } = useDeviceType();
  const boardSize = getGameBoardSize(isTablet, isLandscape, 600, 32);
  
  const routeMode = route?.params?.mode;
  const session = route?.params?.session;
  const dbSessionId: string | undefined = route?.params?.dbSessionId;
  const isMultiplayer = routeMode === 'random' || routeMode === 'private-create' || routeMode === 'private-join' || routeMode === 'join-from-lobby' || routeMode === 'spectate';
  const userId: string = session?.user?.id || session?.id || session?.userId || route?.params?.userId || 'guest';
  const [isSpectating, setIsSpectating] = useState(false);
  const opponentType: OpponentType = isMultiplayer ? 'local' : (routeMode === 'ai' ? 'ai' : 'local');

  const [gameState, setGameState] = useState<NardiGameState | null>(() => initializeNardiGame('short'));
  const [showBlur, setShowBlur] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [arEnabled, setArEnabled] = useState(true);
  const arOverlayRef = useRef<AR3DOverlayHandle>(null);
  // selectedPoint declared here (before arPieces) so the useMemo can reference it
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  // Must be declared before arPieces useMemo; it reads myMpColorRef.current during render.
  const myMpColorRef = useRef<'white'|'black'>('white');
  // Red flash overlay — triggered when player taps an invalid destination
  const invalidFlashOpacity = useSharedValue(0);
  const invalidFlashStyle = useAnimatedStyle(() => ({ opacity: invalidFlashOpacity.value }));
  const flashInvalid = () => {
    invalidFlashOpacity.value = withSequence(
      withTiming(0.45, { duration: 80 }),
      withDelay(120, withTiming(0, { duration: 250 })),
    );
  };

  // Backgammon piece positions in AR board-local space
  const arPieces = useMemo((): ARPiece[] => {
    if (!gameState) return [];
    const pieces: ARPiece[] = [];
    // Board-local coordinate constants (must match AR3DOverlay FIELD_HALF_W=0.305)
    const BHW = 0.305;           // board half-width in metres
    const BAR = BHW * 2 * 0.085 / 2; // half of bar width = 0.026m
    const PLAY = BHW - BAR;      // playable half-width = 0.279m
    const PTW  = PLAY / 7;       // 7-slot span for 6 columns → 1-column gap at outer edges
    const CD   = PTW * 0.88;     // checker diameter
    const CT   = CD * 0.28;      // checker thickness (Z stacking)

    function pointX(ptNum: number): number {
      let col: number;
      if      (ptNum >= 19) col = ptNum - 19;
      else if (ptNum >= 13) col = ptNum - 13;
      else if (ptNum >= 7)  col = 5 - (ptNum - 7);
      else                  col = 6 - ptNum;
      const isLeft = ptNum >= 7 && ptNum <= 18;
      // Right half: natural 1-col gap at outer edge from PTW/7 sizing
      // Left half:  +1 offset explicitly creates the same 1-col gap at left edge
      return isLeft ? (-BHW + (col + 1.5) * PTW + 0.01) : (BAR + (col + 0.5) * PTW - 0.01);
    }

    gameState.points.forEach((pt, idx) => {
      const ptNum = idx + 1;
      const pointIdx = idx; // 0-based
      const isTop = ptNum >= 13;
      const isPointSelected = selectedPoint === pointIdx;
      // Align with triangle bases — start pieces at the inner edge of the board rail
      const edgeY = BHW * 0.95 - CD * 0.5;
      // Uniform screen-down shift: subtracting from posY moves both rows down in perspective
      const PIECE_Y_SHIFT = 0.02;
      const MAX_VIS_AR = 5;
      const totalCheckers = pt.checkers.length;
      const showCount = Math.min(totalCheckers, MAX_VIS_AR);
      for (let si = 0; si < showCount; si++) {
        const y = isTop ? (edgeY - si * CD - PIECE_Y_SHIFT) : -(edgeY - si * CD) - PIECE_Y_SHIFT;
        // Only lift the top checker of the selected point (and only when stack is fully visible)
        const isTopChecker = totalCheckers <= MAX_VIS_AR && si === totalCheckers - 1;
        pieces.push({
          key: `bg-${ptNum}-${si}`,
          row: 0, col: 0,
          color: pt.checkers[si] === 'white' ? 'red' : 'black',
          isKing: false,
          isSelected: isPointSelected && isTopChecker,
          side: pt.checkers[si],
          pieceType: 'bg_checker',
          posX: pointX(ptNum),
          posY: y,
          posZ: 0.006 + si * CT,
          pieceScale: CD,
        });
      }
      if (totalCheckers > MAX_VIS_AR) {
        // Float a count badge above the 5th (top visible) piece
        const lastSi = MAX_VIS_AR - 1;
        const badgeY = isTop ? (edgeY - lastSi * CD - PIECE_Y_SHIFT) : -(edgeY - lastSi * CD) - PIECE_Y_SHIFT;
        pieces.push({
          key: `bg-badge-${ptNum}`,
          row: 0, col: 0,
          color: 'red',
          isKing: false,
          isSelected: false,
          side: pt.checkers[0] as 'white' | 'black',
          pieceType: 'stack_badge',
          posX: pointX(ptNum),
          posY: badgeY,
          posZ: 0.006 + lastSi * CT + 0.028,
          pieceScale: CD,
          stackCount: totalCheckers,
        });
      }
    });

    // Bar pieces — placed along the center spine (posX=0)
    // White bar pieces stack upward from board center; black stack downward
    const BAR_START_Y = CD * 0.6; // offset from center so first piece clears the middle
    const barSelected = selectedPoint === -1;
    for (let si = 0; si < gameState.bar.white; si++) {
      const isTopBarPiece = si === gameState.bar.white - 1;
      pieces.push({
        key: `bar-white-${si}`,
        row: 0, col: 0,
        color: 'red',
        isKing: false,
        isSelected: barSelected && isTopBarPiece,
        side: 'white',
        pieceType: 'bg_checker',
        posX: 0,
        posY: BAR_START_Y + si * CD,
        posZ: 0.006 + si * CT,
        pieceScale: CD,
      });
    }
    for (let si = 0; si < gameState.bar.black; si++) {
      const isTopBarPiece = si === gameState.bar.black - 1;
      pieces.push({
        key: `bar-black-${si}`,
        row: 0, col: 0,
        color: 'black',
        isKing: false,
        isSelected: barSelected && isTopBarPiece,
        side: 'black',
        pieceType: 'bg_checker',
        posX: 0,
        posY: -(BAR_START_Y + si * CD),
        posZ: 0.006 + si * CT,
        pieceScale: CD,
      });
    }

    // ── Green destination markers (easy mode) ────────────────────────────────
    // Render a translucent green rectangle on each legal destination column
    // so the player sees exactly where the selected piece (or a bar checker)
    // can move. Mirrors the non-AR overlay rendered by renderPoint().
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    const isMyTurn = gameState.currentPlayer === myColor && gameState.phase === 'moving';
    if (isMyTurn) {
      const destSet = new Set<number>();
      const barCount = gameState.bar[myColor] || 0;
      if (barCount > 0) {
        // Bar entry: always show entry destinations regardless of selection
        gameState.possibleMoves.forEach(m => {
          if (m.from === -1 && m.to >= 0 && m.to < 24) destSet.add(m.to);
        });
      } else if (selectedPoint !== null && selectedPoint >= 0) {
        gameState.possibleMoves.forEach(m => {
          if (m.from === selectedPoint && m.to >= 0 && m.to < 24) destSet.add(m.to);
        });
      }
      destSet.forEach(destIdx => {
        const ptNum = destIdx + 1;
        const isTop = ptNum >= 13;
        // Marker height matches the destination_marker geometry: sz * 7.6 with sz=CD.
        // Center it so one edge sits at the board rail (BHW*0.95) and it extends
        // inward toward the triangle tip.
        const markerHalfH = (CD * 7.6) / 2;
        const edge = BHW * 0.95;
        const y = isTop ? (edge - markerHalfH) : -(edge - markerHalfH);
        pieces.push({
          key: `dest-${ptNum}`,
          row: 0, col: 0,
          color: 'red',
          isKing: false,
          isSelected: false,
          pieceType: 'destination_marker',
          posX: pointX(ptNum),
          posY: y,
          posZ: 0.004,
          pieceScale: CD,
        });
      });
    }

    return pieces;
  }, [gameState, selectedPoint, isMultiplayer]);
  const [showBackground, setShowBackground] = useState(true);
  const [easyMode, setEasyMode] = useState(true); // Easy Mode: tap-to-move (default on for AR); drag-to-move when off
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const [draggedFrom, setDraggedFrom] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  // Ref so the PanResponder can read the in-progress drag source without stale closure
  const draggedFromRef = useRef<number | null>(null);
  const aiTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useGameEndRefresh(gameState?.winner != null, 'nardi');

  // ── multiplayer state ────────────────────────────────────────────
  const [mpStatus, setMpStatus] = useState<'idle'|'connecting'|'searching'|'waiting'|'playing'|'ended'>(isMultiplayer ? 'connecting' : 'idle');
  const [roomId, setRoomId] = useState<string|null>(null);
  const roomIdRef = useRef<string|null>(null);
  const [myMpColor, setMyMpColor] = useState<'white'|'black'>('white');
  const [roomName, setRoomName] = useState('Multiplayer Nardi');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);
  const roomNameRef = useRef(roomName);
  useEffect(() => { roomNameRef.current = roomName; }, [roomName]);

  const myNardiColor: 'white'|'black' = isMultiplayer ? myMpColor : 'white';
  // Opening roll ceremony (multiplayer only)
  const [mpOpeningPhase, setMpOpeningPhase] = useState<'idle'|'rolling'|'done'>('idle');
  const [myOpeningRoll, setMyOpeningRoll] = useState<number|null>(null);
  const [opponentOpeningRoll, setOpponentOpeningRoll] = useState<number|null>(null);
  const [openingTieMsg, setOpeningTieMsg] = useState<string|null>(null);
  // Opening roll ceremony (singleplayer)
  const [spOpeningPhase, setSpOpeningPhase] = useState<'rolling'|'done'>(!isMultiplayer ? 'rolling' : 'done');
  const [spPlayerRoll, setSpPlayerRoll] = useState<number|null>(null);
  const [spAiRoll, setSpAiRoll] = useState<number|null>(null);
  const [spTieMsg, setSpTieMsg] = useState<string|null>(null);
  const [spDiceEnabled, setSpDiceEnabled] = useState(true);
  const [spRollKey, setSpRollKey] = useState(0);
  // Opening roll key for multiplayer (incremented on each tie to remount NardiDice fresh)
  const [mpRollKey, setMpRollKey] = useState(0);
  // Prevent our own socket echoes from being applied twice
  const justEndedTurnRef = useRef(false);
  // Stores the playerId that was embedded in the most recent opening_roll we emitted.
  // Compared against mv.playerId on receipt to skip our own echo reliably, even when
  // both players re-roll after a tie and messages arrive out of order.
  // Using a ref (not a closure-captured variable) avoids the stale-closure problem
  // that arises because the socket useEffect has an empty dependency array.
  const pendingOpeningRollPlayerIdRef = useRef<string | null>(null);
  // Counts how many move_piece echoes we should skip (one per emitted move)
  const pendingMyMoveEchoesRef = useRef(0);
  const handleRollDiceRef = useRef<() => void>(() => {});
  const swipeStartY = useRef(0);
  const [pendingDice, setPendingDice] = useState<{ die1: number; die2: number } | null>(null);
  const [diceAnimating, setDiceAnimating] = useState(false);
  const [settledDice, setSettledDice] = useState<{ die1: number; die2: number } | null>(null);
  const diceCompleteCount = useRef(0);
  // AR-mode physics dice: track rolling state and swipe handler
  const arDiceRollingRef = useRef(false);
  const arDiceSwipeRef = useRef<(vx: number, vy: number) => void>(() => {});
  // Tracks the maximum simultaneous touch count for the current gesture so we
  // can distinguish a single-finger swipe (roll dice) from a two-finger pinch
  // (zoom board).  Reset on grant and terminate.
  const arDiceTouchCountRef = useRef(0);
  const arDicePanResponder = useRef(
    PanResponder.create({
      // Only claim single-finger touches — 2-finger pinch passes through to the WebView
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 1,
      onMoveShouldSetPanResponder:  (evt) => evt.nativeEvent.touches.length === 1,
      onPanResponderGrant: (evt) => {
        arDiceTouchCountRef.current = evt.nativeEvent.touches.length;
      },
      onPanResponderMove: (evt) => {
        // If a second finger joins mid-gesture, record it so we can ignore the release
        if (evt.nativeEvent.touches.length > arDiceTouchCountRef.current) {
          arDiceTouchCountRef.current = evt.nativeEvent.touches.length;
        }
      },
      onPanResponderRelease: (_, gs) => {
        const wasPinch = arDiceTouchCountRef.current > 1;
        arDiceTouchCountRef.current = 0;
        if (wasPinch) return;
        const { vx, vy, dx, dy } = gs;
        const speed = Math.sqrt(vx * vx + vy * vy);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (speed >= 0.15 || dist >= 20) arDiceSwipeRef.current(vx, vy);
      },
      onPanResponderTerminate: () => {
        arDiceTouchCountRef.current = 0;
      },
    })
  ).current;
  // Tray slide/fade animation values — reset at start of each rolling turn
  const arTraySlideY = useRef(new Animated.Value(0)).current;
  const arTrayOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (arEnabled && gameState?.phase === 'rolling' && gameState.currentPlayer === myNardiColor) {
      arTraySlideY.setValue(0);
      arTrayOpacity.setValue(1);
      arDiceRollingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arEnabled, gameState?.phase, gameState?.currentPlayer]);

  // Sync borne-off piece counts to AR pocket visualization
  // Disabled: the 2D HUD trays ("You • N/15" / "AI • N/15") are the single
  // source of borne-off display. The 3D pocket pieces were duplicating that
  // same information on the board, so we keep the AR pockets empty.
  useEffect(() => {
    if (!arEnabled) return;
    arOverlayRef.current?.updateBorneOff(0, 0);
  }, [arEnabled]);

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

  // Clear settled dice display when the turn ends (phase returns to rolling)
  useEffect(() => {
    if (gameState?.phase === 'rolling') {
      setSettledDice(null);
    }
  }, [gameState?.phase]);

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

  // Opening roll ceremony handler (singleplayer) — called by NardiDice onRollComplete
  // die1 = player's roll (left die), die2 = AI's roll (right die)
  const performOpeningRoll = (die1: number, die2: number) => {
    setSpPlayerRoll(die1);
    setSpAiRoll(die2);
    setSpDiceEnabled(false);

    if (die1 === die2) {
      setSpTieMsg(`Tie! Both rolled ${die1}. Swipe again...`);
      setTimeout(() => {
        setSpPlayerRoll(null);
        setSpAiRoll(null);
        setSpTieMsg(null);
        setSpDiceEnabled(true);
        setSpRollKey(k => k + 1); // force NardiDice remount so PanResponder is fresh
      }, 1800);
      return;
    }

    const firstPlayer: PlayerColor = die1 > die2 ? 'white' : 'black';
    setTimeout(() => {
      setGameState(prev => prev ? {
        ...prev,
        currentPlayer: firstPlayer,
        phase: 'rolling',
        dice: { die1, die2, rolled: true },
        movesRemaining: 2,
      } : prev);
      setSpOpeningPhase('done');
    }, 1400);
  };

  // ── Multiplayer socket setup ────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer) return;
    let cancelled = false;
    setMpStatus('connecting');
    (async () => {
      try {
        const accessToken = await tokenService.getAccessToken();
        const fallbackToken = (session as any)?.access_token;
        const token = accessToken || fallbackToken;
        if (!token) {
          if (!cancelled) {
            setMpStatus('idle');
            BisetkaAlert.error('Authentication Error', 'Please log in to play multiplayer games.');
            navigation.goBack();
          }
          return;
        }
        await socketService.connect(userId, token);
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
          if (resolvedRoomId) return;
          resolvedRoomId = data.roomId;
          roomIdRef.current = data.roomId;
          setRoomId(data.roomId);
          const color: 'white'|'black' = data.color === 'white' ? 'white' : 'black';
          myMpColorRef.current = color;
          setMyMpColor(color);
          if (routeMode === 'random') {
            // Random matchmaking already paired both players; do not block on a
            // possibly-missed game_started event.
            setMpStatus('playing');
            setMpOpeningPhase(prev => (prev === 'idle' ? 'rolling' : prev));
            setMyOpeningRoll(null);
            setOpponentOpeningRoll(null);
            setOpeningTieMsg(null);
          } else {
            setMpStatus('waiting');
          }
        };
        socket.on('match_found', (data: any) => {
          onRoomAssigned(data);
          socket.emit('player_ready', {roomId: data.roomId, userId});
        });
        socket.on('room_joined', (data: any) => { onRoomAssigned(data); });
        socket.on('opponent_joined', () => {
          if (cancelled || !resolvedRoomId) return;
          socket.emit('player_ready', {roomId: resolvedRoomId, userId});
          // Fallback for deployments where game_started is not consistently
          // emitted for Nardi. Once opponent joins, allow opening roll.
          setMpStatus('playing');
          setMpOpeningPhase(prev => (prev === 'idle' ? 'rolling' : prev));
        });
        socket.on('game_started', () => {
          if (cancelled) return;
          // Enter the pre-game opening roll ceremony instead of jumping straight in
          setMpStatus('playing');
          setMpOpeningPhase('rolling');
          setMyOpeningRoll(null);
          setOpponentOpeningRoll(null);
          setOpeningTieMsg(null);
        });
        socket.on('move_made', (data: any) => {
          if (cancelled) return;
          const mv = data.move;

          // ── Opening roll exchange ─────────────────────────────────────────
          if (mv?.type === 'opening_roll') {
            // Skip our own echo: compare mv.playerId against the ref that was set
            // synchronously before we emitted.  Using a ref (not a closure variable)
            // avoids the stale-closure problem — the socket useEffect has [] deps
            // so any closure-captured `userId` may be stale ('guest') if the session
            // loaded after first render.
            if (mv.playerId && mv.playerId === pendingOpeningRollPlayerIdRef.current) {
              pendingOpeningRollPlayerIdRef.current = null;
              return;
            }
            setOpponentOpeningRoll(mv.die);
            return;
          }

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
            // Skip echo of our own move (counter survives turn switches)
            if (pendingMyMoveEchoesRef.current > 0) {
              pendingMyMoveEchoesRef.current -= 1;
              return;
            }
            setGameState(prev => {
              if (!prev) return prev;
              // Use the checker colour sent in the message (never infer from currentPlayer
              // — it can change between when the move was emitted and when the echo arrives).
              const checker: 'white' | 'black' = mv.checker ?? prev.currentPlayer;
              return applyMove(prev, {
                from: mv.from,
                to: mv.to,
                checker,
              });
            });
          } else if (mv?.type === 'end_turn') {
            // Skip the echo of our own end_turn (we already switched locally)
            if (justEndedTurnRef.current) {
              justEndedTurnRef.current = false;
              return;
            }
            setGameState(prev => {
              if (!prev) return prev;
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
          const matchData = await socketService.findMatch('nardi', userId);
          if (!cancelled) {
            onRoomAssigned(matchData);
            socket.emit('player_ready', { roomId: matchData.roomId, userId });
          }
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

  // ── Opening roll resolution ──────────────────────────────────────────────
  // Runs when both players have sent their opening-roll die. Decides colors and
  // starts the game once the result has been shown for a moment.
  useEffect(() => {
    if (!isMultiplayer || mpOpeningPhase !== 'rolling') return;
    if (myOpeningRoll === null || opponentOpeningRoll === null) return;

    if (myOpeningRoll === opponentOpeningRoll) {
      // Tie — show message and re-roll after delay
      setOpeningTieMsg(`Tie! Both rolled ${myOpeningRoll}. Rolling again...`);
      const t = setTimeout(() => {
        setMyOpeningRoll(null);
        setOpponentOpeningRoll(null);
        setOpeningTieMsg(null);
        setMpRollKey(k => k + 1); // force NardiDice remount so PanResponder is fresh
      }, 1600);
      return () => clearTimeout(t);
    }

    // Higher roll → 'white' (red pieces, goes first)
    const iGoFirst = myOpeningRoll > opponentOpeningRoll;
    const myColor: 'white' | 'black' = iGoFirst ? 'white' : 'black';
    myMpColorRef.current = myColor;
    setMyMpColor(myColor);

    const t = setTimeout(() => {
      setGameState({ ...initializeNardiGame('short'), phase: 'rolling' });
      setMpOpeningPhase('done');
    }, 1400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myOpeningRoll, opponentOpeningRoll]);

  // Helper: figure out which die value a move consumed.
  // For a bear-off (to === 24 or to === -1) we must pick the die whose value
  // is >= the actual distance so that high-roll bear-offs are handled correctly.
  const getUsedDieValue = (move: Move, player: PlayerColor, dice: Dice): number => {
    if (move.from === -1) {
      // Re-entering from bar:
      // White enters Black's home (entryPoint = 24 - die), so die = 24 - move.to
      // Black enters White's home (entryPoint = die - 1),  so die = move.to + 1
      return player === 'white' ? 24 - move.to : move.to + 1;
    }
    if (move.to === 24 || move.to === -1) {
      // Bearing off:
      // White bears off to -1: distance = fromPos - (-1) = fromPos + 1
      // Black bears off to 24: distance = 24 - fromPos
      const dist = player === 'white' ? (move.from + 1) : (24 - move.from);
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

  // Detect a combined move that uses BOTH dice on the same piece in one tap.
  // Only valid for non-doubles when both dice are still available.
  const isCombinedMove = (state: NardiGameState, move: Move): boolean => {
    if (move.from < 0) return false;             // bar entry not combined
    if (move.to < 0 || move.to >= 24) return false; // bear-off not combined
    const { die1, die2 } = state.dice;
    if (die1 <= 0 || die2 <= 0) return false;
    if (die1 === die2) return false;             // doubles handled per-die
    if (state.movesRemaining < 2) return false;
    return Math.abs(move.to - move.from) === die1 + die2;
  };

  // For doubles only: how many dice this move consumes (1..movesRemaining).
  // E.g. with double-3 and movesRemaining=4, a tap from 23→11 consumes 4 dice.
  const doublesChainLength = (state: NardiGameState, move: Move): number => {
    if (move.from < 0 || move.to < 0 || move.to >= 24) return 1;
    const { die1, die2 } = state.dice;
    if (die1 <= 0 || die1 !== die2) return 1;
    const dist = Math.abs(move.to - move.from);
    if (dist % die1 !== 0) return 1;
    const n = dist / die1;
    if (n < 1) return 1;
    return Math.min(n, state.movesRemaining);
  };

  // Helper: apply a move to a state and return the updated state
  const applyMove = (state: NardiGameState, move: Move): NardiGameState => {
    const newBoardState = executeMove(state, move);
    const combined = isCombinedMove(state, move);
    let newDice = { ...state.dice };
    let movesRemaining: number;

    if (combined) {
      // Consume both dice in a single move
      newDice.die1 = 0;
      newDice.die2 = 0;
      movesRemaining = Math.max(0, state.movesRemaining - 2);
    } else if (state.dice.die1 === state.dice.die2 && state.dice.die1 > 0) {
      // Doubles: a single tap may consume multiple dice if the destination
      // is `n * dieValue` away (chain move).
      const nConsumed = doublesChainLength(state, move);
      movesRemaining = Math.max(0, state.movesRemaining - nConsumed);
      // Keep dice face values intact — movesRemaining drives end-of-turn.
    } else {
      const usedDie = getUsedDieValue(move, state.currentPlayer, state.dice);
      movesRemaining = Math.max(0, state.movesRemaining - 1);
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
    
    // White moves 24→1 (decreasing), bears off from home board indices 0-5 (ptNum 1-6)
    // Black moves 1→24 (increasing), bears off from home board indices 18-23 (ptNum 19-24)
    const homeStart = player === 'white' ? 0 : 18;
    const homeEnd = player === 'white' ? 6 : 24;
    
    for (let i = 0; i < 24; i++) {
      if (i >= homeStart && i < homeEnd) continue;
      const point = gameState.points[i];
      if (point.checkers.some(c => c === player)) {
        return false;
      }
    }
    return true;
  };

  const applyDiceRoll = (dice: Dice) => {
    setGameState(prev => {
      if (!prev) return prev;
      const movesRemaining = dice.die1 === dice.die2 ? 4 : 2;
      const newState: NardiGameState = {
        ...prev,
        dice,
        phase: 'moving',
        movesRemaining,
        possibleMoves: [],
      };
      newState.possibleMoves = calculatePossibleMoves(newState);
      console.log('🎲 Applied:', dice.die1, dice.die2, 'possible moves:', newState.possibleMoves.length);
      if (newState.possibleMoves.length === 0) {
        if (isMultiplayer && roomIdRef.current) {
          justEndedTurnRef.current = true;
          socketService.makeMove(roomIdRef.current, userId, {type: 'end_turn'});
        }
        return switchPlayer(newState);
      }
      return newState;
    });
  };

  const handleRollDice = () => {
    if (!gameState || gameState.phase !== 'rolling') return;
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (gameState.currentPlayer !== myColor) return;

    const dice = rollDice();
    console.log('🎲 Rolled (animating):', dice.die1, dice.die2);

    if (isMultiplayer && roomIdRef.current) {
      socketService.makeMove(roomIdRef.current, userId, {type: 'roll_dice', dice: {die1: dice.die1, die2: dice.die2}});
    }

    if (arEnabled) {
      // Show 3D dice animation over the board; applyDiceRoll is called after both dice finish
      diceCompleteCount.current = 0;
      setPendingDice(dice);
      setDiceAnimating(true);
    } else {
      // Non-AR mode — apply immediately (NardiDice handles its own visual animation)
      applyDiceRoll(dice);
    }
  };
  // Keep ref current so swipe PanResponder always calls latest version
  handleRollDiceRef.current = handleRollDice;

  // AR physics dice swipe — updated every render for fresh closure
  arDiceSwipeRef.current = (vx: number, vy: number) => {
    if (!gameState || gameState.phase !== 'rolling') return;
    if (arDiceRollingRef.current) return;
    arDiceRollingRef.current = true;
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (gameState.currentPlayer !== myColor) return;
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    if (isMultiplayer && roomIdRef.current) {
      socketService.makeMove(roomIdRef.current, userId, { type: 'roll_dice', dice: { die1, die2 } });
    }
    playDiceRollSound();
    arOverlayRef.current?.rollDiceOnBoard(vx, vy, die1, die2);
    // Animate the tray flying off, then commit dice state
    Animated.parallel([
      Animated.timing(arTraySlideY, { toValue: -320, duration: 290, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(arTrayOpacity, { toValue: 0, duration: 210, useNativeDriver: true }),
    ]).start(() => {
      diceCompleteCount.current = 0;
      setPendingDice({ die1, die2 });
      setDiceAnimating(true);
    });
  };

  const handleMove = (move: Move) => {
    if (!gameState) return;
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (gameState.currentPlayer !== myColor) return;

    const combined = isCombinedMove(gameState, move);
    const usedDieVal = getUsedDieValue(move, gameState.currentPlayer, gameState.dice);
    const updated = applyMove(gameState, move);
    console.log('📍 Move:', move.from, '->', move.to, 'movesLeft:', updated.movesRemaining, combined ? '(combined)' : '');

    // Play piece move sound
    playPieceMoveSound();

    // Tint matching die(s) red in AR mode
    if (arEnabled) {
      const isDoubles = gameState.dice.die1 === gameState.dice.die2 && gameState.dice.die1 > 0;
      if (combined) {
        // Both dice consumed in one move — tint both
        arOverlayRef.current?.useDieTint(gameState.dice.die1, updated.movesRemaining + 1, isDoubles);
        arOverlayRef.current?.useDieTint(gameState.dice.die2, updated.movesRemaining, isDoubles);
      } else if (isDoubles) {
        // Doubles chain: this single tap may have consumed 1..N dice of the
        // same face value. Tint one die per consumed die.
        const nConsumed = doublesChainLength(gameState, move);
        for (let k = 0; k < nConsumed; k++) {
          arOverlayRef.current?.useDieTint(
            gameState.dice.die1,
            updated.movesRemaining + (nConsumed - 1 - k),
            true,
          );
        }
      } else if (usedDieVal > 0) {
        arOverlayRef.current?.useDieTint(usedDieVal, updated.movesRemaining, isDoubles);
      }
    }

    if (isMultiplayer && roomIdRef.current) {
      pendingMyMoveEchoesRef.current += 1;
      socketService.makeMove(roomIdRef.current, userId, {type: 'move_piece', from: move.from, to: move.to, checker: move.checker});
    }
    if (updated.movesRemaining === 0 || updated.possibleMoves.length === 0) {
      if (isMultiplayer && roomIdRef.current) {
        justEndedTurnRef.current = true;
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

    // In AR mode throw the AI dice onto the board so both players see physics
    if (arEnabled) {
      // Random swipe from the opposite side (top of board) heading downward
      const aiVx = (Math.random() - 0.5) * 0.6;
      const aiVy = 0.8 + Math.random() * 0.4; // positive Y = toward player
      playDiceRollSound();
      arOverlayRef.current?.rollDiceOnBoard(aiVx, aiVy, dice.die1, dice.die2);
    } else {
      // Non-AR AI roll: still play the audio cue.
      playDiceRollSound();
    }

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
    // Parallel array: dice value(s) consumed at each step. For combined moves
    // both dice are recorded so AR can tint both. Index 0 = initial state.
    const aiDieValues: number[][] = [[]];
    const aiIsDoubles = dice.die1 === dice.die2;
    let workingState = currentState;

    // Heuristic search picks the best sequence of moves for this dice roll.
    const plannedSequence = chooseBestAiSequence(workingState, 'black');
    console.log('🤖 AI planned sequence length:', plannedSequence.length);

    for (const move of plannedSequence) {
      // Safety: if board state somehow drifted, fall back to a legal move.
      const legal = workingState.possibleMoves.find(
        p => p.from === move.from && p.to === move.to,
      );
      const chosen = legal ?? workingState.possibleMoves[0];
      if (!chosen) break;
      console.log('🤖 AI planned move:', chosen.from, '->', chosen.to);
      const combined = isCombinedMove(workingState, chosen);
      let consumed: number[];
      if (combined) {
        consumed = [workingState.dice.die1, workingState.dice.die2];
      } else if (aiIsDoubles) {
        // Doubles chain: tint one die per dice consumed (1..N).
        const n = doublesChainLength(workingState, chosen);
        consumed = Array(n).fill(workingState.dice.die1);
      } else {
        consumed = [getUsedDieValue(chosen, workingState.currentPlayer, workingState.dice)];
      }
      workingState = applyMove(workingState, chosen);
      statesSequence.push(workingState);
      aiDieValues.push(consumed);
      if (workingState.movesRemaining <= 0 || workingState.possibleMoves.length === 0) break;
    }

    // Schedule showing each state with delays (give dice time to land first)
    // Slower pacing so the player can clearly see each AI move animate one at a time.
    let delay = arEnabled ? 2200 : 1400; // initial wait (longer in AR while dice settle)
    const PER_MOVE_DELAY = 1500; // gap between consecutive AI moves
    statesSequence.forEach((s, i) => {
      const t = setTimeout(() => {
        setGameState(s);
        // Play piece-move sound for each AI step (skip index 0 = pre-move state)
        if (i > 0) {
          playPieceMoveSound();
        }
        // Tint the AI's consumed die/dice red (skip index 0 = initial state)
        if (arEnabled && i > 0) {
          const consumed = aiDieValues[i];
          consumed.forEach((dv, k) => {
            if (dv > 0) {
              // movesRemaining shown for tint purposes counts down per consumed die
              arOverlayRef.current?.useDieTint(dv, s.movesRemaining + (consumed.length - 1 - k), aiIsDoubles);
            }
          });
        }
      }, delay);
      aiTimeoutsRef.current.push(t);
      delay += PER_MOVE_DELAY;
    });

    // After all moves, pause briefly so the final position is visible, then switch to white
    const switchT = setTimeout(() => {
      setGameState(prev => {
        if (!prev || prev.currentPlayer !== 'black') return prev; // AI is black
        console.log('🤖 AI turn complete, switching to white');
        return switchPlayer(prev);
      });
    }, delay + 400);
    aiTimeoutsRef.current.push(switchT);

  }, [gameState?.currentPlayer, gameState?.phase, opponentType]);

  // === AUTO-SKIP: If it's the player's turn with moves remaining but no possible moves, auto-end ===
  // Use a content-based identity check (not strict reference equality) so that benign re-renders
  // don't suppress the skip. When the player is stuck on the bar (cannot re-enter at all) we
  // skip much faster so the game doesn't feel hung.
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase !== 'moving') return;
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (gameState.currentPlayer !== myColor) return;
    if (gameState.possibleMoves.length > 0) return;
    if (gameState.movesRemaining <= 0) return;

    const stuckOnBar = gameState.bar[myColor] > 0;
    const delay = stuckOnBar ? 500 : 1200;
    console.log(
      stuckOnBar
        ? '⏭️ Bar checker cannot re-enter — auto-ending turn'
        : `⏭️ No valid moves with ${gameState.movesRemaining} remaining — auto-ending turn`,
    );

    const t = setTimeout(() => {
      const mc = isMultiplayer ? myMpColorRef.current : 'white';
      setGameState(prev => {
        if (!prev) return prev;
        // Content-based check: only switch if we're still genuinely stuck for the same player.
        if (prev.currentPlayer !== mc || prev.phase !== 'moving') return prev;
        if (prev.possibleMoves.length > 0) return prev;
        if (prev.movesRemaining <= 0) return prev;
        if (isMultiplayer && roomIdRef.current) {
          justEndedTurnRef.current = true;
          socketService.makeMove(roomIdRef.current, userId, { type: 'end_turn' });
        }
        setSelectedPoint(null);
        return switchPlayer(prev);
      });
    }, delay);
    return () => clearTimeout(t);
  // Only re-run when we enter a genuinely new stuck state (player + phase + movesRemaining combo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.currentPlayer, gameState?.phase, gameState?.movesRemaining, gameState?.possibleMoves?.length]);

  // Handle tapping the bar (to enter checkers from bar)
  const handleBarPress = () => {
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (!gameState || gameState.currentPlayer !== myColor || gameState.phase !== 'moving') return;
    if (gameState.bar[myColor] <= 0) return;

    const barMoves = gameState.possibleMoves.filter(m => m.from === -1);

    if (barMoves.length > 0) {
      // Always highlight bar first so the player sees visual feedback before any move fires.
      // When there is exactly one valid entry point the destination is revealed on the board;
      // the player still needs a second tap to confirm, preventing accidental auto-moves.
      setSelectedPoint(-1);
      return;
    }

    // No bar entries possible — end the turn immediately so the game doesn't hang.
    console.log('🚫 Bar tapped but no valid entries — ending turn now');
    flashInvalid();
    setSelectedPoint(null);
    if (isMultiplayer && roomIdRef.current) {
      justEndedTurnRef.current = true;
      socketService.makeMove(roomIdRef.current, userId, { type: 'end_turn' });
    }
    setGameState(prev => (prev ? switchPlayer(prev) : prev));
  };

  const handleBearOffTrayPress = (player: PlayerColor) => {
    const myColor = isMultiplayer ? myMpColorRef.current : 'white';
    if (!gameState || gameState.currentPlayer !== myColor || gameState.phase !== 'moving') return;
    if (player !== myColor) return;

    // White bears off to -1 (below index 0); Black bears off to 24 (above index 23)
    const bearOffTarget = player === 'white' ? -1 : 24;

    const bearOffMoves = gameState.possibleMoves.filter(m => m.to === bearOffTarget);
    if (bearOffMoves.length === 0) {
      console.log('❌ No bear-off moves available for current dice');
      flashInvalid();
      return;
    }

    // Prefer the user's selected piece if it can bear off
    if (selectedPoint !== null) {
      const selectedBearOffMove = bearOffMoves.find(m => m.from === selectedPoint);
      if (selectedBearOffMove) {
        console.log('✅ Bearing off from selected point to tray:', selectedBearOffMove);
        handleMove(selectedBearOffMove);
        setSelectedPoint(null);
        return;
      }
      console.log('ℹ️ Selected point cannot bear off — falling back to optimal bear-off');
    }

    // No (usable) selection — pick the optimal bear-off move per Nardi rules:
    // white = highest-index piece (furthest from exit edge),
    // black = lowest-index piece (furthest from exit edge).
    let chosen = bearOffMoves[0];
    for (const m of bearOffMoves) {
      if (player === 'white' ? m.from > chosen.from : m.from < chosen.from) chosen = m;
    }
    console.log('✅ Auto-bearing off optimal piece:', chosen);
    handleMove(chosen);
    setSelectedPoint(null);
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

    // ── Bar-entry flow ───────────────────────────────────────────────────────
    // When player has pieces on bar they MUST enter first. Two-tap: first tap
    // selects the bar (piece floats), second tap picks the entry column.
    if (gameState.bar[myColor] > 0) {
      if (selectedPoint === -1) {
        // Bar already selected — try to enter at tapped point
        const barMove = gameState.possibleMoves.find(m => m.from === -1 && m.to === pointIndex);
        if (barMove) {
          handleMove(barMove);
          setSelectedPoint(null);
        } else {
          // Invalid entry point — flash red, keep bar selected
          flashInvalid();
        }
      } else {
        // Nothing selected yet — select the bar so the piece floats
        handleBarPress();
      }
      return;
    }

    // ── Normal two-tap flow ──────────────────────────────────────────────────
    if (selectedPoint === null) {
      // FIRST TAP: select a piece
      const point = gameState.points[pointIndex];
      const hasOwnChecker = point.checkers.length > 0 &&
        point.checkers[point.checkers.length - 1] === gameState.currentPlayer;
      if (hasOwnChecker && gameState.possibleMoves.some(m => m.from === pointIndex)) {
        setSelectedPoint(pointIndex);
      } else {
        // Tapped empty or opponent point with nothing selected — flash red
        flashInvalid();
      }
    } else if (selectedPoint === pointIndex) {
      // Re-tapped the selected piece — deselect
      setSelectedPoint(null);
    } else {
      // SECOND TAP: try to move selected piece to this point
      const move = gameState.possibleMoves.find(m => m.from === selectedPoint && m.to === pointIndex);
      if (move) {
        handleMove(move);
        setSelectedPoint(null);
      } else {
        // Invalid destination — flash red
        // Also check if player tapped one of their own pieces to switch selection
        const point = gameState.points[pointIndex];
        const hasOwnChecker = point.checkers.length > 0 &&
          point.checkers[point.checkers.length - 1] === gameState.currentPlayer;
        if (hasOwnChecker && gameState.possibleMoves.some(m => m.from === pointIndex)) {
          // Switch selection to this piece instead
          setSelectedPoint(pointIndex);
        } else {
          flashInvalid();
          setSelectedPoint(null);
        }
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

    const maxVisible = 4;
    const stackGap = CHECKER_SIZE * 0.35;
    const overflow = checkers > maxVisible;
    const visibleCheckers = overflow ? maxVisible : checkers;
    const isDragging = !easyMode && draggedFrom === pointIndex;

    const positionStyle = {
      left: pos.x - CHECKER_SIZE / 2,
      width: CHECKER_SIZE,
      ...(pos.isTop
        ? { top: pos.y, minHeight: CHECKER_SIZE * 1.5 }
        : { top: pos.y - TRIANGLE_HEIGHT, height: TRIANGLE_HEIGHT, justifyContent: 'flex-end' as const }),
    };

    const countBadge = overflow && !isDragging ? (
      <View key="count" style={styles.checkerCount}>
        <Text style={styles.checkerCountText}>{checkers}</Text>
      </View>
    ) : null;

    const checkerItems = checkers > 0 ? Array.from({ length: visibleCheckers }).map((_, i) => {
      const checkerIndex = overflow ? (checkers - visibleCheckers) + i : i;
      const individualColor = (point.checkers[checkerIndex] ?? color) as 'white' | 'black';
      return (
        <View key={i} style={{ marginTop: i > 0 ? -stackGap : 0, opacity: isDragging ? 0.25 : 1 }}>
          {renderChecker(individualColor, i)}
        </View>
      );
    }) : [];

    // For bottom columns the tip is at the TOP — badge goes before checkers so it sits at the tip.
    // For top columns the tip is at the BOTTOM — badge goes after checkers.
    const children = pos.isTop
      ? [...checkerItems, countBadge]
      : [countBadge, ...checkerItems];

    // Drag mode: plain non-interactive Views — board PanResponder handles all gestures
    if (!easyMode) {
      return (
        <View key={pointNum} style={[styles.pointStack, positionStyle]} pointerEvents="none">
          {children}
        </View>
      );
    }

    // Easy mode: tinted green rectangle over the arrow background of any
    // legal destination, so the player sees exactly where the selected
    // piece can move.
    const showDestinationOverlay = isValidDestination || isBarEntryDest;
    const overlayStyle = {
      position: 'absolute' as const,
      left: pos.x - CHECKER_SIZE / 2,
      width: CHECKER_SIZE,
      height: TRIANGLE_HEIGHT,
      ...(pos.isTop ? { top: pos.y } : { top: pos.y - TRIANGLE_HEIGHT }),
    };

    return (
      <React.Fragment key={pointNum}>
        {showDestinationOverlay && (
          <View pointerEvents="none" style={[styles.destinationOverlay, overlayStyle]} />
        )}
        <TouchableOpacity
          style={[
            styles.pointStack,
            positionStyle,
            isSelected && styles.pointSelected,
            canMove && styles.canMove,
          ]}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          onPress={() => handlePointPress(pointIndex)}
          activeOpacity={0.8}>
          {children}
          {checkers === 0 && showDestinationOverlay && (
            <View style={styles.emptyDestinationMarker}>
              <Text style={styles.emptyDestinationText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
      </React.Fragment>
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
  // White bears off to -1 (below point 0), Black bears off to 24 (above point 23)
  const whiteTrayIsValidDestination = easyMode &&
    selectedPoint !== null &&
    gameState.currentPlayer === 'white' &&
    gameState.possibleMoves.some(m => m.from === selectedPoint && m.to === -1);
  const blackTrayIsValidDestination = easyMode &&
    selectedPoint !== null &&
    gameState.currentPlayer === 'black' &&
    gameState.possibleMoves.some(m => m.from === selectedPoint && m.to === 24);

  return (
    <View style={styles.container} collapsable={false}>
      <AraratBackground  />
      <AR3DOverlay
        ref={arOverlayRef}
        visible={arEnabled}
        boardGlbPath="glb/game_boards/Backgammon.glb"
        hideCheckerboard
        boardFixed
        boardFixedZoom={1.78}
        boardY={-1.40}
        tableDist={0.50}
        pieces={arPieces}
        chessPieceGlbPaths={{
          white_bg_checker: 'glb/checkers/nyu_red_checker.glb',
          black_bg_checker: 'glb/checkers/nyu_black_checker.glb',
        }}
        onNardiPointTap={handlePointPress}
        onDiceRolled={(die1, die2) => {
          arDiceRollingRef.current = false;
          arOverlayRef.current?.resetDiceTint();
          // Only apply dice roll for the human player — the AI useEffect already
          // computed and scheduled its state updates before throwing the dice.
          const myColor = isMultiplayer ? myMpColorRef.current : 'white';
          if (!gameState || gameState.currentPlayer !== myColor) return;
          const diceData: Dice = { die1, die2, rolled: true };
          setSettledDice(diceData);
          setDiceAnimating(false);
          applyDiceRoll(diceData);
          setPendingDice(null);
        }}
      />
      {/* Red flash overlay — covers entire screen on invalid tap */}
      <ReAnimated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: '#ff2020', zIndex: 5 },
          invalidFlashStyle,
        ]}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <GamePlayerOverlay opponent={isMultiplayer ? null : 'ai'} />
        <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
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
            />
            <View>
              <GameToolbarControls
                buttons={[
                  { icon: easyMode ? '🎮' : '🎯', onPress: () => setEasyMode(!easyMode), label: easyMode ? 'Easy Mode' : 'Normal Mode' },
                  // { icon: arEnabled ? '🥽' : '🎮', onPress: () => setArEnabled(!arEnabled) },
                  // { icon: showMusicPlayer ? '🎵' : '🎶', onPress: () => setShowMusicPlayer(s => !s) },
                  // ...(isMultiplayer && mpStatus === 'playing' ? [{ icon: '✏️', onPress: () => setShowRoomNameModal(true) }] : []),
                ]}
              />
            </View>
          </View>

          {/* Bear-off trays — visible 2D HUD showing borne-off checkers.
              Hidden during opening-roll so they don't overlap the dice. */}
          {spOpeningPhase === 'done' && mpOpeningPhase !== 'rolling' && (() => {
            const myColor = myNardiColor;
            const oppColor: PlayerColor = myColor === 'white' ? 'black' : 'white';
            const myCount = gameState.home[myColor] || 0;
            const oppCount = gameState.home[oppColor] || 0;
            const myPieceColor = myColor === 'white' ? '#cc2828' : '#1a1a30';
            const oppPieceColor = oppColor === 'white' ? '#cc2828' : '#1a1a30';
            return (
              <>
                {/* Opponent / AI tray — top right */}
                <View pointerEvents="none" style={styles.bearOffTrayTop}>
                  <Text style={styles.bearOffTrayLabel}>
                    {isMultiplayer ? 'Opponent' : 'AI'} • {oppCount}/15
                  </Text>
                  <View style={styles.bearOffStack}>
                    {Array.from({ length: Math.min(oppCount, 15) }).map((_, i) => (
                      <View
                        key={`opp_${i}`}
                        style={[
                          styles.bearOffPiece,
                          { backgroundColor: oppPieceColor, marginLeft: i === 0 ? 0 : -14 },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                {/* Player tray — bottom right */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!(canPlayerBearOff(myColor) &&
                    gameState.currentPlayer === myColor &&
                    gameState.phase === 'moving' &&
                    gameState.possibleMoves.some(m => m.to === (myColor === 'white' ? -1 : 24)))}
                  onPress={() => handleBearOffTrayPress(myColor)}
                  style={[
                    styles.bearOffTrayBottom,
                    canPlayerBearOff(myColor) &&
                      gameState.currentPlayer === myColor &&
                      gameState.phase === 'moving' &&
                      styles.bearOffTrayActive,
                  ]}>
                  <Text style={styles.bearOffTrayLabel}>You • {myCount}/15</Text>
                  <View style={styles.bearOffStack}>
                    {Array.from({ length: Math.min(myCount, 15) }).map((_, i) => (
                      <View
                        key={`me_${i}`}
                        style={[
                          styles.bearOffPiece,
                          { backgroundColor: myPieceColor, marginLeft: i === 0 ? 0 : -14 },
                        ]}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              </>
            );
          })()}

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

          {/* Opening roll overlay — shown after match found, before game begins */}
          {isMultiplayer && mpStatus === 'playing' && mpOpeningPhase === 'rolling' && (
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(10,10,30,0.95)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 110,
              gap: 24,
              paddingHorizontal: 32,
            }}>
              <Text style={{ color: '#fbbf24', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
                🎲 Roll for First Move
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' }}>
                Highest roll plays as 🔴 Red and goes first
              </Text>

              {/* Die result display */}
              <View style={{ flexDirection: 'row', gap: 32, alignItems: 'center' }}>
                {/* My die */}
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>YOU</Text>
                  <View style={{
                    width: 64, height: 64,
                    backgroundColor: myOpeningRoll !== null ? '#ef4444' : 'rgba(255,255,255,0.1)',
                    borderRadius: 14,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: myOpeningRoll !== null ? '#ef4444' : 'rgba(255,255,255,0.2)',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>
                      {myOpeningRoll !== null ? myOpeningRoll : '?'}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 24 }}>vs</Text>

                {/* Opponent die */}
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>OPPONENT</Text>
                  <View style={{
                    width: 64, height: 64,
                    backgroundColor: opponentOpeningRoll !== null ? '#6366f1' : 'rgba(255,255,255,0.1)',
                    borderRadius: 14,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: opponentOpeningRoll !== null ? '#6366f1' : 'rgba(255,255,255,0.2)',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>
                      {opponentOpeningRoll !== null ? opponentOpeningRoll : '?'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Tie message */}
              {openingTieMsg !== null && (
                <Text style={{ color: '#fbbf24', fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
                  {openingTieMsg}
                </Text>
              )}

              {/* Result message when both have rolled */}
              {myOpeningRoll !== null && opponentOpeningRoll !== null && openingTieMsg === null && (
                <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                  {myOpeningRoll > opponentOpeningRoll
                    ? '🔴 You go first!'
                    : '⚫ Opponent goes first — you play Black'}
                </Text>
              )}

              {/* NardiDice — swipe to roll (only before rolling) */}
              {myOpeningRoll === null && (
                <NardiDice
                  key={mpRollKey}
                  singleDie
                  onRollComplete={(die1) => {
                    setMyOpeningRoll(die1);
                    if (roomIdRef.current) {
                      pendingOpeningRollPlayerIdRef.current = userId;
                      socketService.makeMove(roomIdRef.current, userId, { type: 'opening_roll', die: die1, playerId: userId });
                    }
                  }}
                  enabled={true}
                />
              )}

              {/* Waiting message when we rolled but opponent hasn't */}
              {myOpeningRoll !== null && opponentOpeningRoll === null && openingTieMsg === null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator size="small" color="#6366f1" />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                    Waiting for opponent to roll...
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.boardContainer} pointerEvents={arEnabled ? 'box-none' : 'auto'}>
            {arEnabled ? (
              // In AR mode: WebView handles all touches (tap = nardi point, pinch = zoom).
              // This View must NOT intercept touches — pointerEvents=none passes everything to WebView.
              <View
                style={[styles.board, { width: boardSize, height: boardSize, backgroundColor: 'transparent' }]}
                pointerEvents="none"
              />
            ) : (
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
                  <TouchableOpacity style={barContainerStyle} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={handleBarPress}>
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
            )}
          </View>

          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            {/* Opening roll ceremony (singleplayer) — dice in same position as game dice */}
            {!isMultiplayer && spOpeningPhase === 'rolling' && (
              <View style={{ gap: 8 }}>
                <View style={{
                  backgroundColor: 'rgba(10,10,30,0.75)',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <Text style={{ color: '#fbbf24', fontSize: 16, fontWeight: '800' }}>🎲 Roll for First Move</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, textAlign: 'center' }}>
                    Left die is yours · Right die is AI's · Highest goes first as 🔴 Red
                  </Text>
                  {spPlayerRoll !== null && spAiRoll !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
                      <Text style={{ color: '#ef4444', fontSize: 15, fontWeight: '700' }}>You: {spPlayerRoll}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>vs</Text>
                      <Text style={{ color: '#6366f1', fontSize: 15, fontWeight: '700' }}>AI: {spAiRoll}</Text>
                      {spTieMsg !== null ? (
                        <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '600' }}>{spTieMsg}</Text>
                      ) : (
                        <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '700' }}>
                          {spPlayerRoll > spAiRoll ? '🔴 You go first!' : '⚫ AI goes first'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
                <NardiDice
                  key={spRollKey}
                  singleDie
                  onRollComplete={performOpeningRoll}
                  enabled={spDiceEnabled}
                />
              </View>
            )}
            {!arEnabled && spOpeningPhase === 'done' && gameState.phase === 'rolling' && gameState.currentPlayer === myNardiColor && (
              <NardiDice
                onRollComplete={(die1, die2) => {
                  console.log('🎲 Rolled:', die1, die2);
                  // Use the values NardiDice already animated so the UI stays in sync
                  const dice: Dice = { die1, die2, rolled: true };
                  if (isMultiplayer && roomIdRef.current) {
                    socketService.makeMove(roomIdRef.current, userId, { type: 'roll_dice', dice: { die1, die2 } });
                  }
                  applyDiceRoll(dice);
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
                  <View
                    style={{ backgroundColor: '#ef4444',   paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>End Turn Now</Text>
                  </View>
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
              <>
                <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                  🎯 You can bear off! Tap a checker, then Bear Off.
                </Text>
                {gameState.possibleMoves.some(m => m.to === (myNardiColor === 'white' ? -1 : 24)) && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleBearOffTrayPress(myNardiColor)}
                    style={{
                      marginTop: 8,
                      alignSelf: 'center',
                      borderRadius: 999,
                      overflow: 'hidden',
                      shadowColor: '#10b981',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.7,
                      shadowRadius: 10,
                      elevation: 8,
                    }}>
                    <View
                      style={{ paddingHorizontal: 26, paddingVertical: 10 }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.8 }}>
                        🏁 Bear Off{selectedPoint !== null ? ` (Point ${selectedPoint + 1})` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </>
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

          {/* Win overlay rendered at the root of the component (after dice
              overlays) so it sits on top of everything and blocks touches.
              See block at the bottom of the return tree. */}
        </SafeAreaView>
      </View>

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
      <SyncedYouTubePlayer roomId={null} visible={true} />
      {/* 3D dice overlay — spinning while animating, then shows settled face during moving phase */}
      {!arEnabled && (diceAnimating ? pendingDice : settledDice) && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 220,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <View style={{
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: 24,
            paddingHorizontal: 28,
            paddingVertical: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
          }}>
            <Dice3DSimple
              value={diceAnimating ? pendingDice!.die1 : settledDice!.die1}
              isRolling={diceAnimating}
              index={0}
              size={110}
              onRollComplete={() => {
                diceCompleteCount.current += 1;
                if (diceCompleteCount.current >= 2) {
                  const settled = pendingDice!;
                  setSettledDice(settled);
                  setDiceAnimating(false);
                  applyDiceRoll({ ...settled, rolled: true });
                  setPendingDice(null);
                }
              }}
            />
            <Dice3DSimple
              value={diceAnimating ? pendingDice!.die2 : settledDice!.die2}
              isRolling={diceAnimating}
              index={1}
              size={110}
              onRollComplete={() => {
                diceCompleteCount.current += 1;
                if (diceCompleteCount.current >= 2) {
                  const settled = pendingDice!;
                  setSettledDice(settled);
                  setDiceAnimating(false);
                  applyDiceRoll({ ...settled, rolled: true });
                  setPendingDice(null);
                }
              }}
            />
          </View>
        </View>
      )}
      {/* AR dice tray — visible dice sitting at the bottom; swipe anywhere to throw onto board */}
      {arEnabled && gameState?.phase === 'rolling' && gameState.currentPlayer === myNardiColor && !diceAnimating && (
        <View
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 3 }}
          {...arDicePanResponder.panHandlers}
        >
          <Animated.View
            style={{
              position: 'absolute',
              bottom: 50,
              left: 0,
              right: 0,
              alignItems: 'center',
              transform: [{ translateY: arTraySlideY }],
              opacity: arTrayOpacity,
            }}
            pointerEvents="none"
          >
            <View style={{
              backgroundColor: 'rgba(18,18,22,0.84)',
              borderRadius: 28,
              paddingHorizontal: 36,
              paddingVertical: 22,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              shadowColor: '#000',
              shadowOpacity: 0.55,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
            }}>
              {/* Static dice preview — two 6s */}
              <View style={{ flexDirection: 'row', gap: 22, marginBottom: 16 }}>
                {[0, 1].map(di => (
                  <View key={di} style={{
                    width: 62, height: 62, backgroundColor: '#FFF8D4', borderRadius: 13,
                    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 }, borderWidth: 1.5,
                    borderColor: 'rgba(160,140,60,0.35)',
                    padding: 7, justifyContent: 'space-between',
                  }}>
                    {/* 6 pips: 3 columns × 2 rows */}
                    {[[0,1],[0,1],[0,1]].map((col, ci) => (
                      <View key={ci} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        {col.map((_, ri) => (
                          <View key={ri} style={{
                            width: 10, height: 10, borderRadius: 5, backgroundColor: '#1A1A1A',
                          }} />
                        ))}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: '600', letterSpacing: 0.4 }}>
                ↗ Swipe to throw dice onto board
              </Text>
            </View>
          </Animated.View>
        </View>
      )}

      {/* Game-over win overlay rendered LAST so it sits on top of every
          floating overlay (dice tray, AR pan responder, etc.) and absorbs
          all touches except the buttons inside it. */}
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
                navigation.replace('GameInfo', {
                  gameType: 'nardi',
                  preferredMode: isMultiplayer ? 'random' : 'ai',
                });
              }}>
              <Text style={styles.newGameText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exitBtn}
              onPress={() => {
                navigation.navigate('Home' as never);
              }}>
              <Text style={styles.exitBtnText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  destinationOverlay: {
    backgroundColor: 'rgba(34, 197, 94, 0.32)',
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.85)',
    borderRadius: 6,
    zIndex: 5,
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
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 3,
    marginVertical: 1,
    alignSelf: 'center',
    minWidth: 26,
    alignItems: 'center',
  },
  checkerCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
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
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#333',
  },
  dieTextUsed: {
    fontSize: 26,
    fontWeight: '800',
    color: '#555',
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
    zIndex: 9999,
    elevation: 30,
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
  exitBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  exitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  newGameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  bearOffTrayTop: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    height: 56,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    zIndex: 1,
  },
  bearOffTrayBottom: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    height: 56,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    zIndex: 1,
  },
  bearOffTrayActive: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16,185,129,0.22)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  bearOffTrayLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 10,
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bearOffStack: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    flex: 1,
  },
  bearOffPiece: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});

export default NardiScreen;
