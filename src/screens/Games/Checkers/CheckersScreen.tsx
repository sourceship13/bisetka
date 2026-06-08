import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ImageBackground, Alert, Animated, ScrollView, Image } from 'react-native';
import AraratBackground from '../../../components/AraratBackground';
import AR3DOverlay, { type ARPiece, type AR3DOverlayHandle } from '../../../components/AR3DOverlay';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import GamePlayerOverlay from '../../../components/GamePlayerOverlay';
import GameThemeCustomizer from '../../../components/global/GameThemeCustomizer';
import type { GameTheme } from '../../../components/global/GameThemeCustomizer';
import { aiMoveLogService } from '../../../services/aiMoveLog.service';
import { socketService } from '../../../services/SocketService';
import { v4 as uuidv4 } from 'uuid';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import InGameChat from '../../../components/InGameChat';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';
import { apiService } from '../../../services/api.service';
import { useAuth } from '../../../libs/hooks/useAuth';
import { playPieceMoveSound } from '../../../utils/nardiSound';
import { useAchievements } from '../../../contexts/AchievementContext';
import { resolveAvatar } from '../../../utils/avatars';
import useDeviceType from '../../../hooks/useDeviceType';
import { getGameBoardSize } from '../../../utils/gameBoardSize';

const PANO_SOURCE = require('../../../../assets/backgrounds/capture360/pano2.jpg');

type PieceType = 'regular' | 'king';
type PieceColor = 'red' | 'black';

interface Piece { color: PieceColor; type: PieceType; }
interface Position { row: number; col: number; }

interface GameState {
  board: (Piece | null)[][];
  currentPlayer: PieceColor;
  selectedSquare: Position | null;
  possibleMoves: Position[];
  isGameOver: boolean;
  winner: PieceColor | null;
}

// ─── pure helpers ────────────────────────────────────────────────────────────

function initializeBoard(): (Piece | null)[][] {
  const b: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = { color: 'black', type: 'regular' };
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = { color: 'red', type: 'regular' };
  return b;
}

function freshGame(): GameState {
  // Black moves first (standard American/English checkers rule).
  // In AI mode the player controls Black and the CPU controls Red.
  return { board: initializeBoard(), currentPlayer: 'black', selectedSquare: null, possibleMoves: [], isGameOver: false, winner: null };
}

function getPossibleMoves(board: (Piece | null)[][], pos: Position): Position[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];
  const dirs = piece.type === 'king'
    ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : piece.color === 'red' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
  const moves: Position[] = [];
  for (const [dr, dc] of dirs) {
    const nr = pos.row+dr, nc = pos.col+dc;
    if (nr<0||nr>7||nc<0||nc>7) continue;
    if (!board[nr][nc]) { moves.push({row:nr,col:nc}); }
    else if (board[nr][nc]!.color !== piece.color) {
      const jr=nr+dr, jc=nc+dc;
      if (jr>=0&&jr<8&&jc>=0&&jc<8&&!board[jr][jc]) moves.push({row:jr,col:jc});
    }
  }
  return moves;
}

function hasAnyMoves(board: (Piece | null)[][], color: PieceColor): boolean {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = board[r][c];
    if (p && p.color===color && getPossibleMoves(board,{row:r,col:c}).length>0) return true;
  }
  return false;
}

function applyMove(board: (Piece | null)[][], from: Position, to: Position): (Piece | null)[][] {
  const nb = board.map(row=>[...row]);
  const piece = nb[from.row][from.col];
  if (!piece) return nb;
  nb[to.row][to.col] = piece;
  nb[from.row][from.col] = null;
  if (Math.abs(to.row-from.row)===2) nb[(from.row+to.row)/2][(from.col+to.col)/2]=null;
  if (piece.color==='red'   && to.row===0) nb[to.row][to.col]={color:'red',  type:'king'};
  if (piece.color==='black' && to.row===7) nb[to.row][to.col]={color:'black',type:'king'};
  return nb;
}

function deserializeBoard(raw: any[][]): (Piece | null)[][] {
  return raw.map(row=>row.map(cell=>cell?{color:cell.color as PieceColor,type:cell.type as PieceType}:null));
}

// ─── AI (minimax + alpha-beta) ───────────────────────────────────────────────
//
// We use the same move generator the UI uses (`getPossibleMoves`) so the AI
// can only play moves the rules allow on this screen (single steps or single
// jumps in any direction; kings move both ways). Although the screen does not
// enforce mandatory captures, the search heavily rewards them via material
// gain. Depth 6 with alpha-beta + move ordering is comfortably stronger than
// most casual human players.

type AIMove = { from: Position; to: Position; isJump: boolean };

function getAllMovesForColor(board: (Piece|null)[][], color: PieceColor): AIMove[] {
  const moves: AIMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const from = { row: r, col: c };
      for (const to of getPossibleMoves(board, from)) {
        moves.push({ from, to, isJump: Math.abs(to.row - r) === 2 });
      }
    }
  }
  return moves;
}

// Static evaluation from RED's perspective (CPU is RED, player is BLACK).
// Positive → good for RED.
function evaluateBoard(board: (Piece|null)[][]): number {
  const PAWN = 100;
  const KING = 280;
  // Positional bonus for advancing pawns toward promotion.
  // RED promotes at row 0, BLACK promotes at row 7.
  const ROW_BONUS_RED   = [0, 4, 8, 12, 18, 26, 34, 0];
  const ROW_BONUS_BLACK = [0, 34, 26, 18, 12, 8, 4, 0];
  // Center columns are worth a small bonus (control & mobility).
  const COL_BONUS = [0, 2, 4, 6, 6, 4, 2, 0];
  // Edge files are safer (can't be jumped from outside the board).
  const EDGE_SAFETY = 6;
  // Back-rank pawns block opponent promotion.
  const BACK_RANK_BONUS = 10;

  let score = 0;
  let redCount = 0, blackCount = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const isKing = p.type === 'king';
      const sign = p.color === 'red' ? 1 : -1;

      let v = isKing ? KING : PAWN;
      if (!isKing) {
        v += p.color === 'red' ? ROW_BONUS_RED[r] : ROW_BONUS_BLACK[r];
        // Defend back rank to deny opponent kings.
        if (p.color === 'red' && r === 7) v += BACK_RANK_BONUS;
        if (p.color === 'black' && r === 0) v += BACK_RANK_BONUS;
      }
      v += COL_BONUS[c];
      if (c === 0 || c === 7) v += EDGE_SAFETY;

      score += sign * v;
      if (p.color === 'red') redCount++; else blackCount++;
    }
  }

  // Endgame: when ahead in material, push toward the opponent (king activity).
  if (redCount + blackCount <= 8) {
    let redKingActivity = 0, blackKingActivity = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.type !== 'king') continue;
      // Bonus for being centralized in endgame
      const centralization = 6 - (Math.abs(3.5 - r) + Math.abs(3.5 - c));
      if (p.color === 'red') redKingActivity += centralization;
      else blackKingActivity += centralization;
    }
    score += (redKingActivity - blackKingActivity) * 3;
  }

  return score;
}

const WIN_SCORE = 1_000_000;

function minimax(
  board: (Piece|null)[][],
  depth: number,
  alpha: number,
  beta: number,
  toMove: PieceColor,
): number {
  const moves = getAllMovesForColor(board, toMove);
  // Terminal: no moves = current side loses.
  if (moves.length === 0) {
    return toMove === 'red' ? -WIN_SCORE - depth : WIN_SCORE + depth;
  }
  if (depth === 0) return evaluateBoard(board);

  // Move ordering: captures first for better alpha-beta pruning.
  moves.sort((a, b) => Number(b.isJump) - Number(a.isJump));

  const maximizing = toMove === 'red';
  const next: PieceColor = toMove === 'red' ? 'black' : 'red';

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      const nb = applyMove(board, m.from, m.to);
      const v = minimax(nb, depth - 1, alpha, beta, next);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const nb = applyMove(board, m.from, m.to);
      const v = minimax(nb, depth - 1, alpha, beta, next);
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

function chooseBestMoveForRed(board: (Piece|null)[][], depth: number): AIMove | null {
  const moves = getAllMovesForColor(board, 'red');
  if (moves.length === 0) return null;
  // Captures first for pruning effectiveness.
  moves.sort((a, b) => Number(b.isJump) - Number(a.isJump));

  let bestScore = -Infinity;
  let best: AIMove[] = [];
  let alpha = -Infinity;
  const beta = Infinity;

  for (const m of moves) {
    const nb = applyMove(board, m.from, m.to);
    const score = minimax(nb, depth - 1, alpha, beta, 'black');
    if (score > bestScore) {
      bestScore = score;
      best = [m];
    } else if (score === bestScore) {
      best.push(m);
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  // Randomise among equally-good moves so the AI isn't deterministic.
  return best[Math.floor(Math.random() * best.length)];
}

// ─── component ───────────────────────────────────────────────────────────────

const CheckersScreen = ({ navigation, route }: any) => {
  const { session, mode } = route.params;
  const fakeOpponent = route?.params?.fakeOpponent ?? null;
  const opponentLabel: string = fakeOpponent?.username || 'Computer';
  const { isTablet, isLandscape } = useDeviceType();
  
  // Calculate responsive board size
  const boardSize = getGameBoardSize(isTablet, isLandscape, 600, 32);
  const squareSize = boardSize / 8;
  
  // Stabilise userId for the lifetime of this component — never let it change between renders
  const userIdRef = useRef<string>(
    session?.user?.id || session?.id || ('guest-' + Math.random().toString(36).substr(2, 6))
  );
  const userId = userIdRef.current;
  const isMultiplayer = mode === 'random' || mode === 'private' || mode === 'private-create' || mode === 'private-join';

  const [gameState, setGameState] = useState<GameState>(freshGame());
  const gameIdRef   = useRef<string>(uuidv4());
  const moveCountRef = useRef(0);
  const lastPlayerMoveRef = useRef<{from:Position;to:Position;isJump?:boolean}|null>(null);
  useGameEndRefresh(gameState.isGameOver, 'checkers');

  // ── multiplayer state ──
  const [mpStatus, setMpStatus] = useState<'idle'|'connecting'|'searching'|'waiting'|'playing'|'ended'>('idle');
  const [roomId, setRoomId]     = useState<string|null>(null);
  const [roomCode, setRoomCode] = useState<string|null>(null);
  // server assigns 'white'|'black'; white→red pieces, black→black pieces.
  // In AI mode (no socket color), the player controls BLACK and the CPU plays RED.
  const [mySocketColor, setMySocketColor] = useState<'white'|'black'|null>(null);
  const [serverTurn,    setServerTurn]    = useState<'white'|'black'>('white');
  const [statusMsg,     setStatusMsg]     = useState('');
  const [showCustomization, setShowCustomization] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer] = useState(true);
  const [showBlur, setShowBlur] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [arEnabled, setArEnabled] = useState(true);
  const arOverlayRef = useRef<AR3DOverlayHandle>(null);
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const [gameTheme, setGameTheme] = useState<GameTheme>({});
  const [showPanel, setShowPanel] = useState(false);
  const panelAnim = useRef(new Animated.Value(0)).current;

  const togglePanel = () => {
    const toValue = showPanel ? 0 : 1;
    setShowPanel(!showPanel);
    Animated.spring(panelAnim, {
      toValue, useNativeDriver: true, speed: 20, bounciness: 4,
    }).start();
  };

  const toggleLeave = () => {
    BisetkaAlert.alert('Leave Game', 'Are you sure you want to leave the game?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => {
        if (isMultiplayer && roomId) socketService.resign(roomId, userId);
        navigation.goBack();
      }},
    ]);
  };

  // Entry fee and prize tracking
  const { user, refreshUser } = useAuth();
  const { showAchievements } = useAchievements();
  const [entryDeducted, setEntryDeducted] = useState(false);
  const [prizeAwarded, setPrizeAwarded] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());

  const handleApplyTheme = (theme: GameTheme) => {
    setGameTheme(theme);
  };

  // Entry fee deduction handler
  const handleGameStart = async () => {
    if (entryDeducted || !user?.id) return;

    try {
      console.log('💰 Deducting checkers entry fee...');
      const result = await apiService.deductEntry('checkers', gameIdRef.current);
      
      if (result.success) {
        console.log(`✅ Entry deducted: -50 points. Balance: ${result.newBalance}`);
        setEntryDeducted(true);
        refreshUser().catch(console.error);
      } else {
        console.error('❌ Insufficient points:', result.error);
        Alert.alert('Insufficient Points', result.error || 'You need 50 points to play checkers.', [
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

  // Prize award handler - NEW: Combined endpoint
  const handleGameEnd = async (didWin: boolean) => {
    if (prizeAwarded || !user?.id) return;

    try {
      const result = didWin ? 'win' : 'loss';
      console.log(`🏆 Awarding prize and logging game for ${result}...`);
      
      // NEW: Use combined endpoint that awards prize + logs result + logs activity
      const prizeResult = await apiService.awardPrizeAndLog(
        'checkers',
        result,
        'ai', // game mode
        {
          gameId: gameIdRef.current,
          playerScore: didWin ? 1 : 0, // Could track actual pieces captured
          durationSeconds: Math.floor((Date.now() - (gameStartTime || Date.now())) / 1000),
        }
      );
      
      if (prizeResult.success) {
        console.log(`✅ ${prizeResult.message}`);
        console.log(`   Prize: +${prizeResult.prize} points`);
        console.log(`   New balance: ${prizeResult.newBalance}`);
        
        if (prizeResult.unlockedAchievements?.length > 0) {
          showAchievements(prizeResult.unlockedAchievements);
        }
        console.log(`   Game logged with ID: ${prizeResult.gameResultId}`);
        
        setPrizeAwarded(true);
        refreshUser().catch(console.error);
        
        if (didWin) {
          setTimeout(() => {
            Alert.alert('🏆 Victory!', `${prizeResult.message}\n\nNew balance: ${prizeResult.newBalance} points`);
          }, 2000);
        }
      }
    } catch (error: any) {
      console.error('❌ Prize award error:', error);
    }
  };

  // ── AR board mapping ─────────────────────────────────────────────────────
  // Converts logical board (row, col) to an ARPiece for the 3D overlay.
  // The coordinates stay in board-space; AR3DOverlay maps them to 3D world space.
  const arPieces = useMemo<ARPiece[]>(() => {
    // SQUARE_W must match AR3DOverlay: FIELD_HALF_W*2/8 = 0.305*2/8
    // 15% smaller than before (was 0.82); 0.70 leaves a small margin so the
    // disc sits comfortably inside its dark square.
    const FIELD_HALF = 0.305;
    const SQ = (FIELD_HALF * 2) / 8;
    const CHECKER_SZ = SQ * 0.70;
    const SURFACE_Z = 0.002;
    // Pull the leftmost (col 0) and rightmost (col 7) columns inward so the
    // discs don't overhang the board edge.
    const EDGE_INSET = SQ * 0.45;
    const result: ARPiece[] = [];
    gameState.board.forEach((row, r) => {
      row.forEach((piece, c) => {
        if (!piece) return;
        // Only dark squares have pieces in checkers
        if ((r + c) % 2 === 0) return;
        const baseX = -FIELD_HALF + (c + 0.5) * SQ;
        const baseY = FIELD_HALF - (r + 0.5) * SQ;
        let posX = baseX;
        let posY = baseY;
        if (c === 0) posX = baseX + EDGE_INSET;
        else if (c === 7) posX = baseX - EDGE_INSET;
        result.push({
          key: `${r}-${c}`,
          row: r,
          col: c,
          color: piece.color,
          side: piece.color === 'red' ? 'white' : 'black',  // white→red GLB, black→black GLB
          pieceType: 'checker',
          pieceScale: CHECKER_SZ,
          posX,
          posY,
          posZ: SURFACE_Z,
          isKing: piece.type === 'king',
          isSelected:
            gameState.selectedSquare?.row === r &&
            gameState.selectedSquare?.col === c,
        });
      });
    });
    return result;
  }, [gameState.board, gameState.selectedSquare]);

  // In multiplayer, white socket → red pieces, black socket → black pieces.
  // In single-player AI mode the local player is BLACK.
  const myPieceColor: PieceColor = isMultiplayer
    ? (mySocketColor === 'black' ? 'black' : 'red')
    : 'black';
  const isMyTurn = isMultiplayer ? serverTurn === mySocketColor : gameState.currentPlayer === 'black';

  // ── Entry fee & prize logic ──────────────────────────────────────────────
  // Deduct entry fee when game starts (AI mode starts immediately, multiplayer waits for game_started)
  useEffect(() => {
    const shouldDeduct = mode === 'ai' || (isMultiplayer && mpStatus === 'playing');
    if (shouldDeduct && !entryDeducted) {
      handleGameStart();
    }
  }, [mode, isMultiplayer, mpStatus, entryDeducted]);

  // Award prize when game ends
  useEffect(() => {
    if (gameState.isGameOver && !prizeAwarded) {
      let didWin = false;
      
      if (mode === 'ai') {
        // AI mode: black (player) wins
        didWin = gameState.winner === 'black';
      } else if (isMultiplayer) {
        // Multiplayer: check if our color won
        didWin = gameState.winner === myPieceColor;
      }
      
      handleGameEnd(didWin);
    }
  }, [gameState.isGameOver, prizeAwarded, gameState.winner, mode, isMultiplayer, myPieceColor]);

  // ── multiplayer setup ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer) return;
    let cancelled = false;
    setMpStatus('connecting');
    setStatusMsg('Connecting...');

    (async () => {
      try {
        await socketService.connect(userId, session?.access_token || 'temp-token');
        if (cancelled) return;

        const socket = socketService.getSocket();
        if (!socket) return;

        // clean slate
        ['match_found','room_joined','opponent_joined','game_started','move_made','game_ended','opponent_disconnected']
          .forEach(ev => socket.off(ev));

        let resolvedRoomId: string | null = null;

        socket.on('match_found', (data: any) => {
          if (cancelled) return;
          resolvedRoomId = data.roomId;
          setRoomId(data.roomId);
          setMySocketColor(data.color);
          setMpStatus('waiting');
          setStatusMsg('Waiting for game to start...');
          socket.emit('player_ready', { roomId: data.roomId, userId });
        });

        // Fires on the JOINER when they successfully enter a private room
        socket.on('room_joined', (data: any) => {
          if (cancelled) return;
          resolvedRoomId = data.roomId;
          setRoomId(data.roomId);
          setMySocketColor(data.color);
          setMpStatus('waiting');
          setStatusMsg('Waiting for game to start...');
          // Joiner sends ready immediately — creator sends ready on opponent_joined
          socket.emit('player_ready', { roomId: data.roomId, userId });
        });

        // Fires on the CREATOR when player 2 joins the room
        socket.on('opponent_joined', () => {
          if (cancelled) return;
          setStatusMsg('Opponent joined! Starting...');
          if (resolvedRoomId) socket.emit('player_ready', { roomId: resolvedRoomId, userId });
        });

        socket.on('game_started', (data: any) => {
          if (cancelled) return;
          setGameState({
            board: data.gameState?.board ? deserializeBoard(data.gameState.board) : initializeBoard(),
            currentPlayer: 'red', selectedSquare: null, possibleMoves: [], isGameOver: false, winner: null,
          });
          setServerTurn(data.gameState?.currentTurn ?? 'white');
          setMpStatus('playing');
        });

        socket.on('move_made', (data: any) => {
          if (cancelled) return;
          if (data.gameState?.board) {
            setGameState(prev => ({
              ...prev,
              board: deserializeBoard(data.gameState.board),
              selectedSquare: null,
              possibleMoves: [],
            }));
            playPieceMoveSound();
          }
          setServerTurn(data.currentTurn ?? 'white');
        });

        socket.on('game_ended', (data: any) => {
          if (cancelled) return;
          const iWon = data.winnerId === userId;
          const myC = mySocketColor === 'black' ? 'black' : 'red';
          setGameState(prev => ({
            ...prev,
            board: data.gameState?.board ? deserializeBoard(data.gameState.board) : prev.board,
            isGameOver: true,
            winner: iWon ? myC as PieceColor : (myC === 'red' ? 'black' : 'red') as PieceColor,
          }));
          setMpStatus('ended');
        });

        socket.on('opponent_disconnected', () => {
          if (cancelled) return;
          BisetkaAlert.success('Opponent disconnected', 'You win by forfeit!');
          setGameState(prev => ({ ...prev, isGameOver: true, winner: mySocketColor === 'black' ? 'black' : 'red' }));
          setMpStatus('ended');
        });

        // ── start the right flow depending on mode ──────────────────────────
        if (mode === 'random') {
          setStatusMsg('Finding opponent...');
          setMpStatus('searching');
          socket.emit('find_match', { gameType: 'checkers', userId });
        } else if (mode === 'private-create') {
          setStatusMsg('Creating room...');
          setMpStatus('searching');
          try {
            const joinCode = session?.code;
            const roomData = await socketService.createPrivateRoom('checkers', userId, joinCode);
            if (!cancelled) {
              resolvedRoomId = roomData.roomId;
              setRoomId(roomData.roomId);
              setRoomCode(roomData.roomCode);
              setMySocketColor('white');
              setMpStatus('waiting');
              setStatusMsg(`Room created! Code: ${roomData.roomCode}`);
            }
          } catch (err: any) {
            if (!cancelled) {
              BisetkaAlert.error('Error', 'Failed to create room');
              setMpStatus('idle');
              navigation.goBack();
            }
          }
        } else if (mode === 'private-join') {
          const joinCode = session?.code;
          if (!joinCode) {
            BisetkaAlert.error('Error', 'No room code provided');
            setMpStatus('idle');
            navigation.goBack();
            return;
          }
          setStatusMsg('Joining room...');
          setMpStatus('searching');
          socket.emit('join_private_room', { roomCode: joinCode, userId });
        }
      } catch (err) {
        if (!cancelled) { setMpStatus('idle'); setStatusMsg('Connection failed. Please try again.'); }
      }
    })();

    return () => {
      cancelled = true;
      const socket = socketService.getSocket();
      if (socket) {
        ['match_found','room_joined','opponent_joined','game_started','move_made','game_ended','opponent_disconnected']
          .forEach(ev => socket.off(ev));
        if (mode === 'random') socket.emit('cancel_matchmaking', { userId });
      }
    };
  }, []);

  // ── AI turn ──────────────────────────────────────────────────────────────
  // CPU controls RED; player controls BLACK.
  useEffect(() => {
    if (isMultiplayer || mode !== 'ai') return;
    if (gameState.currentPlayer !== 'red' || gameState.isGameOver) return;
    const timer = setTimeout(() => {
      // Stronger AI: minimax with alpha-beta pruning. Depth 6 is comfortably
      // ahead of casual play while still returning in well under a second
      // even on mid-range phones.
      const mv = chooseBestMoveForRed(gameState.board, 6);
      if (!mv) return;
      setGameState(prev => {
        const nb = applyMove(prev.board, mv.from, mv.to);
        playPieceMoveSound();
        const hasLeft = hasAnyMoves(nb,'black');
        if (lastPlayerMoveRef.current) {
          moveCountRef.current++;
          aiMoveLogService.logCheckersMove({
            gameId: gameIdRef.current, moveNumber: moveCountRef.current,
            playerMove: lastPlayerMoveRef.current,
            aiMove: { from: mv.from, to: mv.to, isJump: Math.abs(mv.to.row-mv.from.row)===2 },
            boardStateBefore: prev.board, boardStateAfter: nb,
            playerPiecesRemaining: nb.flat().filter(p=>p?.color==='black').length,
            aiPiecesRemaining:     nb.flat().filter(p=>p?.color==='red').length,
            wasKingMove: prev.board[mv.from.row][mv.from.col]?.type==='king',
          });
          lastPlayerMoveRef.current = null;
        }
        if (!hasLeft) setTimeout(()=>BisetkaAlert.success('Game Over!','Red wins!'),100);
        return { ...prev, board:nb, currentPlayer:'black', selectedSquare:null, possibleMoves:[], isGameOver:!hasLeft, winner:!hasLeft?'red':null };
      });
    // Slow down AI so the player can clearly see which piece moved (1800-2500ms)
    }, 800 + Math.floor(Math.random() * 700));
    return () => clearTimeout(timer);
  }, [gameState.currentPlayer, gameState.isGameOver]);

  // ── board tap ─────────────────────────────────────────────────────────────
  const handleSquarePress = useCallback((dRow: number, dCol: number) => {
    // flip board visually for black player so their pieces are at the bottom
    const row = myPieceColor === 'black' ? 7-dRow : dRow;
    const col = myPieceColor === 'black' ? 7-dCol : dCol;

    if (gameState.isGameOver) return;
    if (isMultiplayer && (mpStatus !== 'playing' || !isMyTurn)) return;
    // In AI mode the CPU controls RED — block taps while it's the CPU's turn.
    if (mode === 'ai' && gameState.currentPlayer === 'red') return;

    const activeColor: PieceColor = isMultiplayer ? myPieceColor : gameState.currentPlayer;
    const piece = gameState.board[row]?.[col];

    if (!gameState.selectedSquare) {
      if (piece && piece.color === activeColor) {
        setGameState(prev => ({ ...prev, selectedSquare:{row,col}, possibleMoves: getPossibleMoves(prev.board,{row,col}) }));
      }
      return;
    }

    const sel = gameState.selectedSquare;
    const isValid = gameState.possibleMoves.some(m=>m.row===row&&m.col===col);

    if (isValid) {
      if (isMultiplayer && roomId) {
        // Optimistic: apply locally, server confirms via move_made
        setGameState(prev => ({ ...prev, board: applyMove(prev.board,sel,{row,col}), selectedSquare:null, possibleMoves:[] }));
        playPieceMoveSound();
        socketService.makeMove(roomId, userId, { from: sel, to: {row,col} });
      } else {
        if (mode==='ai') lastPlayerMoveRef.current = { from:sel, to:{row,col} };
        const nb = applyMove(gameState.board, sel, {row,col});
        playPieceMoveSound();
        const next: PieceColor = gameState.currentPlayer==='red'?'black':'red';
        const hasLeft = hasAnyMoves(nb, next);
        const winner: PieceColor|null = !hasLeft ? gameState.currentPlayer : null;
        if (!hasLeft) BisetkaAlert.success('Game Over!', `${gameState.currentPlayer==='red'?'Red':'Black'} wins!`);
        setGameState(prev => ({ ...prev, board:nb, currentPlayer:next, selectedSquare:null, possibleMoves:[], isGameOver:!hasLeft, winner }));
      }
    } else if (piece && piece.color === activeColor) {
      setGameState(prev => ({ ...prev, selectedSquare:{row,col}, possibleMoves: getPossibleMoves(prev.board,{row,col}) }));
    } else {
      setGameState(prev => ({ ...prev, selectedSquare:null, possibleMoves:[] }));
    }
  }, [gameState, isMyTurn, myPieceColor, mpStatus, roomId, isMultiplayer, mode, userId]);

  // ── AR board tap (raycasted logical coords from Three.js) ─────────────────
  // Raycasting delivers logical (row, col) directly; handleSquarePress expects
  // display coords, so we invert the flip before passing through.
  const handleArSquareTap = useCallback((logRow: number, logCol: number) => {
    const dRow = myPieceColor === 'black' ? 7 - logRow : logRow;
    const dCol = myPieceColor === 'black' ? 7 - logCol : logCol;
    handleSquarePress(dRow, dCol);
  }, [myPieceColor, handleSquarePress]);

  // ── matchmaking / waiting screen ──────────────────────────────────────────
  if (isMultiplayer && (mpStatus==='connecting'||mpStatus==='searching'||mpStatus==='waiting')) {
    return (
      <View style={styles.container}>
        <AraratBackground overlayOpacity={0.4} />
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safeArea}>
            <GameToolbar title="Checkers" onBack={() => { navigation.goBack(); }} backgroundColor="transparent" />
            <View style={styles.centeredContent}>
              {mode === 'private-create' && roomCode ? (
                // ── Room created — show shareable code ──────────────────────
                <>
                  <Text style={styles.roomCreatedTitle}>Room Created! 🎮</Text>
                  <Text style={styles.roomCodeLabel}>Share this code with your friend:</Text>
                  <View style={styles.roomCodeBox}>
                    <Text style={styles.roomCodeValue}>{roomCode}</Text>
                  </View>
                  <Text style={styles.searchingText}>Waiting for opponent to join...</Text>
                  <ActivityIndicator size="small" color="#3498db" style={{marginTop: 8}} />
                </>
              ) : (
                // ── Spinner for random / joining ────────────────────────────
                <>
                  <ActivityIndicator size="large" color="#3498db" />
                  <Text style={styles.searchingText}>{statusMsg}</Text>
                </>
              )}
              <TouchableOpacity style={styles.cancelButton} onPress={() => {
                const socket = socketService.getSocket();
                socket?.emit('cancel_matchmaking', { userId });
                navigation.goBack();
              }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    );
  }

  // ── turn label ────────────────────────────────────────────────────────────
  const turnLabel = isMultiplayer
    ? isMyTurn ? `Your Turn (${myPieceColor==='red'?'🔴 Red':'⚫ Black'})` : "Opponent's Turn..."
    : gameState.currentPlayer==='black' ? 'Your Turn (Black)' : mode==='ai' ? "AI's Turn (Red)" : "Red's Turn";

  // ── board render ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container} collapsable={false}>
      <AraratBackground />
      <AR3DOverlay
        ref={arOverlayRef}
        visible={arEnabled}
        pieces={arPieces}
        moves={gameState.possibleMoves}
        onSquareTap={handleArSquareTap}
        boardGlbPath="glb/checkers/Bisetka_Checkers.glb"
        boardGlbHasEmbeddedCheckersPieces
        hideCheckerboard
        boardFixed
        boardFixedZoom={0.6}
        boardTiltX={0}
        boardY={-0.35}
        tableDist={0.50}
        boardScale={0.8}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <GamePlayerOverlay
          opponent={
            isMultiplayer
              ? null
              : fakeOpponent
                ? {
                    userId: fakeOpponent.id,
                    username: fakeOpponent.username,
                    fakeAppearance: fakeOpponent.appearance,
                  }
                : 'ai'
          }
        />
        <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
          <View>
            <GameToolbar
              title={isMultiplayer ? 'Checkers (Online)' : mode==='ai' ? 'Checkers (vs AI)' : 'Checkers'}
              onBack={() => {
                if (isMultiplayer && roomId) socketService.resign(roomId, userId);
                navigation.goBack();
              }}
              backgroundColor="transparent"
            />
            <View>
              <GameToolbarControls
                buttons={[
                  // { icon: '🎨', onPress: () => setShowCustomization(true) },
                  // { icon: showBackground ? '🖼️' : '🔲', onPress: () => setShowBackground(!showBackground) },
                  // { icon: arEnabled ? '🥽' : '🎮', onPress: () => setArEnabled(!arEnabled) },
                  { icon: '👥', onPress: togglePanel },
                  // { icon: showMusicPlayer ? '🎵' : '🎶', onPress: () => setShowMusicPlayer(s => !s) },
                  { icon: '🚪', onPress: toggleLeave },
                ]}
              />
            </View>
          </View>

      <View style={styles.statusBar}>
        <Text style={styles.turnText}>{turnLabel}</Text>
        {isMultiplayer && mySocketColor && (
          <Text style={styles.colorBadge}>
            You: {myPieceColor==='red'?'🔴 Red':'⚫ Black'}  •  Opponent: {myPieceColor==='red'?'⚫ Black':'🔴 Red'}
          </Text>
        )}
      </View>

      <View style={styles.boardContainer} pointerEvents={arEnabled ? 'box-none' : 'box-none'}>
        {arEnabled ? (
          /* Board rendered in 3D by ViroSceneNavigator — transparent passthrough */
          <View style={[styles.board, { width: boardSize, height: boardSize }]} pointerEvents="none" />
        ) : (
          /* 2D interactive board */
          <View style={{ width: boardSize, height: boardSize, borderWidth: 2, borderColor: '#5d3a1a' }}>
            {Array(8).fill(null).map((_, displayRow) => {
              return (
                <View key={displayRow} style={{ flexDirection: 'row' }}>
                  {Array(8).fill(null).map((_, displayCol) => {
                    const row = myPieceColor === 'black' ? 7 - displayRow : displayRow;
                    const col = myPieceColor === 'black' ? 7 - displayCol : displayCol;
                    const isDark = (displayRow + displayCol) % 2 === 1;
                    const piece = gameState.board[row]?.[col];
                    const isSelected = gameState.selectedSquare?.row === row && gameState.selectedSquare?.col === col;
                    const isPossibleMove = gameState.possibleMoves.some(m => m.row === row && m.col === col);
                    return (
                      <TouchableOpacity
                        key={displayCol}
                        style={[
                          { width: squareSize, height: squareSize, justifyContent: 'center', alignItems: 'center' },
                          { backgroundColor: isDark ? '#b58863' : '#f0d9b5' },
                          isSelected ? { backgroundColor: 'rgba(130,151,105,0.95)' } : null,
                          isPossibleMove ? { backgroundColor: 'rgba(100,111,64,0.75)' } : null,
                        ]}
                        onPress={() => handleSquarePress(displayRow, displayCol)}
                        activeOpacity={0.75}
                      >
                        {piece && (() => {
                          // Per-piece horizontal nudges for the top-most red row (row 5).
                          // Values are fractions of squareSize.
                          // Top-most red row = row 5. Red pieces in row 5 occupy
                          // cols 0, 2, 4, 6 (left-to-right). Order index:
                          //   0 = leftmost (+10%), 1 = 2nd left (+10%),
                          //   2 = 3rd (-5%), 3 = rightmost (-30%).
                          const NUDGE_TOP_RED: Record<number, number> = { 0: 0.10, 2: 0.10, 4: -0.05, 6: -0.30 };
                          const nudgeX = piece.color === 'red' && row === 5 && NUDGE_TOP_RED[col] !== undefined
                            ? NUDGE_TOP_RED[col] * squareSize
                            : 0;
                          return (
                            <View style={[
                              styles.piece,
                              piece.color === 'red' ? styles.redPiece : styles.blackPiece,
                              piece.type === 'king' && styles.kingPiece,
                              nudgeX !== 0 && { transform: [{ translateX: nudgeX }] },
                            ]}>
                              {piece.type === 'king' && <Text style={styles.kingText}>♛</Text>}
                            </View>
                          );
                        })()}
                        {isPossibleMove && !piece && (
                          <View style={styles.moveIndicator} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {gameState.isGameOver && (
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverBox}>
            <Text style={styles.gameOverTitle}>Game Over!</Text>
            <Text style={styles.gameOverText}>
              {isMultiplayer
                ? gameState.winner===myPieceColor ? 'You Win! 🎉' : 'You Lose!'
                : gameState.winner==='red' ? 'Red Wins! 🎉' : 'Black Wins!'}
            </Text>
            {!isMultiplayer && (
              <TouchableOpacity style={styles.playAgainButton} onPress={() => {
                navigation.replace('GameInfo', {
                  gameType: 'checkers',
                  preferredMode: 'ai',
                });
              }}>
                <Text style={styles.playAgainText}>Play Again</Text>
              </TouchableOpacity>
            )}
            {isMultiplayer && (
              <TouchableOpacity style={styles.playAgainButton} onPress={() => {
                navigation.replace('GameInfo', {
                  gameType: 'checkers',
                  preferredMode: 'random',
                });
              }}>
                <Text style={styles.playAgainText}>Play Again</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.exitButton}
              onPress={() => navigation.navigate('Home' as never)}>
              <Text style={styles.exitButtonText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Player Panel */}
      {showPanel && (
        <TouchableOpacity
          style={styles.panelBackdrop}
          activeOpacity={1}
          onPress={togglePanel}
        />
      )}
      <Animated.View
        style={[
          styles.sidePanel,
          {
            transform: [{
              translateX: panelAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [280, 0],
              }),
            }],
          },
        ]}
        pointerEvents={showPanel ? 'auto' : 'none'}
      >
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Players</Text>
          <TouchableOpacity onPress={togglePanel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.panelClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.panelContent}>
          <Text style={styles.panelSectionTitle}>🎮 In Game</Text>

          {/* Player (uses myPieceColor — black in AI mode, server-assigned in multiplayer) */}
          <View style={[styles.panelPlayerRow, gameState.currentPlayer === myPieceColor && styles.panelPlayerRowActive]}>
            <View style={styles.panelAvatarClip}>
              {resolveAvatar(user?.avatar_url ?? null) ? (
                <Image source={resolveAvatar(user?.avatar_url ?? null)!} style={styles.panelAvatar} />
              ) : (
                <View style={styles.panelAvatarPlaceholder}>
                  <Text style={styles.panelAvatarInitials}>
                    {(user?.username || 'Y')[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            {gameState.currentPlayer === myPieceColor && <View style={styles.panelTurnDot} />}
            <View style={styles.panelPlayerInfo}>
              <Text style={styles.panelPlayerName}>{user?.username || 'You'}</Text>
              <View style={[styles.panelTeamBadge, { backgroundColor: myPieceColor === 'red' ? 'rgba(231,76,60,0.3)' : 'rgba(44,62,80,0.4)' }]}>
                <Text style={styles.panelTeamText}>{myPieceColor === 'red' ? '🔴 Red' : '⚫ Black'}</Text>
              </View>
            </View>
          </View>

          {/* Opponent (opposite color) */}
          <View style={[styles.panelPlayerRow, gameState.currentPlayer !== myPieceColor && styles.panelPlayerRowActive]}>
            <View style={styles.panelAvatarClip}>
              <View style={styles.panelAvatarPlaceholder}>
                <Text style={styles.panelAvatarInitials}>{isMultiplayer ? '👤' : '🤖'}</Text>
              </View>
            </View>
            {gameState.currentPlayer !== myPieceColor && <View style={styles.panelTurnDot} />}
            <View style={styles.panelPlayerInfo}>
              <Text style={styles.panelPlayerName}>{isMultiplayer ? 'Opponent' : opponentLabel}</Text>
              <View style={[styles.panelTeamBadge, { backgroundColor: myPieceColor === 'red' ? 'rgba(44,62,80,0.4)' : 'rgba(231,76,60,0.3)' }]}>
                <Text style={styles.panelTeamText}>{myPieceColor === 'red' ? '⚫ Black' : '🔴 Red'}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
        </SafeAreaView>
      </View>

      <GameThemeCustomizer
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onApply={handleApplyTheme}
        gameType="checkers"
        initialTheme={gameTheme}
      />

      {/* In-game chat overlay (multiplayer only) */}
      <InGameChat
        roomId={roomId || ''}
        currentUserId={userId}
        gameType="checkers"
        visible={isMultiplayer && !!roomId}
      />
      <SyncedYouTubePlayer
        roomId={isMultiplayer && roomId ? roomId : null}
        visible={true}
        defaultTrack={{ videoId: '_2kPf5NgVsY', title: 'Chill Mix', playlistId: 'RD_2kPf5NgVsY' }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:          { flex:1 },
  overlay:            { flex:1 },
  safeArea:           { flex:1 },
  centeredContent:    { flex:1, justifyContent:'center', alignItems:'center', gap:20, padding:20 },
  searchingText:      { color:'#ecf0f1', fontSize:18, textAlign:'center', marginTop:16 },
  cancelButton:       { marginTop:20, paddingHorizontal:32, paddingVertical:12, backgroundColor:'#e74c3c', borderRadius:8 },
  cancelText:         { color:'#fff', fontSize:16, fontWeight:'600' },
  roomCreatedTitle:   { color:'#ffffff', fontSize:24, fontWeight:'bold', textAlign:'center', marginBottom:8 },
  roomCodeLabel:      { color:'#bdc3c7', fontSize:15, textAlign:'center', marginBottom:12 },
  roomCodeBox:        { backgroundColor:'rgba(255,255,255,0.15)', borderRadius:12, paddingHorizontal:32, paddingVertical:16, marginBottom:8 },
  roomCodeValue:      { color:'#ffffff', fontSize:42, fontWeight:'bold', letterSpacing:6, textAlign:'center' },
  statusBar:          { alignItems:'center', paddingVertical:10, backgroundColor:'transparent', paddingHorizontal:10 },
  turnText:           { fontSize:16, fontWeight:'600', color:'#fff', textShadowColor:'rgba(0,0,0,0.8)', textShadowOffset:{width:0,height:1}, textShadowRadius:4 },
  colorBadge:         { fontSize:13, color:'#bdc3c7', marginTop:2 },
  boardContainer:     { flex:1, justifyContent:'center', alignItems:'center', padding:20 },
  board:              { aspectRatio:1 }, // Width/height set via inline style
  gridContainer:      { flex:1, paddingTop:40, paddingBottom:55, paddingHorizontal:50 },
  row:                { flex:1, flexDirection:'row' },
  square:             { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'transparent' },
  lightSquare:        { backgroundColor:'transparent' },
  darkSquare:         { backgroundColor:'transparent' },
  selectedSquare:     { backgroundColor:'rgba(130, 151, 105, 0.6)' },
  possibleMoveSquare: { backgroundColor:'rgba(100, 111, 64, 0.5)' },
  // AR mode touch-target overlays (invisible board; 3D overlay shows visuals)
  arSelectedSquare:   { backgroundColor:'rgba(255,215,0,0.28)', borderWidth:1.5, borderColor:'rgba(255,215,0,0.70)' },
  arPossibleSquare:   { backgroundColor:'rgba(255,255,255,0.14)' },
  piece:              { width:'70%', height:'70%', borderRadius:100, justifyContent:'center', alignItems:'center', borderWidth:2, borderColor:'#000' },
  redPiece:           { backgroundColor:'#e74c3c' },
  blackPiece:         { backgroundColor:'#2c3e50' },
  kingPiece:          {
    backgroundColor: '#FFD700',
    width: '90%',
    height: '90%',
    borderColor: '#8B6914',
    borderWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 5,
    elevation: 10,
  },
  kingText:           { fontSize:28, color:'#8B4513', fontWeight:'900', textShadowColor:'#fff8d6', textShadowOffset:{width:0,height:1}, textShadowRadius:2 },
  moveIndicator:      { width:12, height:12, borderRadius:6, backgroundColor:'rgba(255,255,255,0.6)' },
  recenterBtn: {
    position: 'absolute',
    bottom: 200,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -54 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  recenterIcon:  { fontSize: 20, color: '#fff' },
  recenterLabel: { fontSize: 13, color: '#fff', fontWeight: '600', letterSpacing: 0.3 },
  gameOverOverlay:    { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', alignItems:'center' },
  gameOverBox:        { backgroundColor:'#fff', padding:30, borderRadius:10, alignItems:'center', minWidth:250 },
  gameOverTitle:      { fontSize:24, fontWeight:'bold', marginBottom:10, color:'#2c3e50' },
  gameOverText:       { fontSize:18, marginBottom:20, color:'#34495e' },
  playAgainButton:    { backgroundColor:'#3498db', paddingHorizontal:24, paddingVertical:12, borderRadius:8 },
  playAgainText:      { color:'#fff', fontSize:16, fontWeight:'600' },
  exitButton:         { marginTop:12, paddingHorizontal:24, paddingVertical:10, borderRadius:8, borderWidth:1.5, borderColor:'#fff' },
  exitButtonText:     { color:'#fff', fontSize:15, fontWeight:'700' },  panelBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sidePanel: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 270, backgroundColor: 'rgba(12,12,30,0.97)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.12)', shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 20 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  panelTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  panelClose: { fontSize: 18, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  panelContent: { flex: 1, padding: 14 },
  panelSectionTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 6 },
  panelPlayerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, marginBottom: 4 },
  panelPlayerRowActive: { backgroundColor: 'rgba(255,215,0,0.10)' },
  panelAvatarClip: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', marginRight: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  panelAvatar: { width: 38, height: 38, borderRadius: 19 },
  panelAvatarPlaceholder: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.13)', justifyContent: 'center', alignItems: 'center' },
  panelAvatarInitials: { fontSize: 17, fontWeight: '700', color: '#fff' },
  panelTurnDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD700', marginRight: 6 },
  panelPlayerInfo: { flex: 1 },
  panelPlayerName: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  panelTeamBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  panelTeamText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  testButton: { backgroundColor: 'rgba(255,215,0,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  testButtonText: { fontSize: 14, color: '#FFD700', fontWeight: '600' },});

export default CheckersScreen;
