import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ImageBackground,
} from 'react-native';
import {BisetkaAlert} from '../../../utils/BisetkaAlert';
import {SafeAreaView} from 'react-native-safe-area-context';
import AraratBackground from '../../../components/AraratBackground';
import AR3DOverlay, {type AR3DOverlayHandle, type ARPiece} from '../../../components/AR3DOverlay';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import GamePlayerOverlay from '../../../components/GamePlayerOverlay';
import GameThemeCustomizer from '../../../components/global/GameThemeCustomizer';
import type { GameTheme } from '../../../components/global/GameThemeCustomizer';
import RoomNameModal from '../../../components/RoomNameModal';
import {socketService} from '../../../services/SocketService';
import tokenService from '../../../services/token.service';
import {useGameEndRefresh} from '../../../libs/hooks/useGameEndRefresh';
import { useI18n } from '../../../hooks/useI18n';
import InGameChat from '../../../components/InGameChat';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';
import {apiConfig} from '../../../libs/utils/api.utils';

// ─── types ────────────────────────────────────────────────────────────────────
type PieceType = 'regular' | 'king';
type PieceColor = 'red' | 'black';

interface Piece {color: PieceColor; type: PieceType}
interface Position {row: number; col: number}

interface GameState {
  board: (Piece | null)[][];
  currentPlayer: PieceColor;
  selectedSquare: Position | null;
  possibleMoves: Position[];
  isGameOver: boolean;
  winner: PieceColor | null;
}

// ─── pure helpers ─────────────────────────────────────────────────────────────
function initializeBoard(): (Piece | null)[][] {
  const b: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = {color: 'black', type: 'regular'};
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = {color: 'red', type: 'regular'};
  return b;
}

function freshGame(): GameState {
  return {
    board: initializeBoard(),
    currentPlayer: 'red',
    selectedSquare: null,
    possibleMoves: [],
    isGameOver: false,
    winner: null,
  };
}

function getPossibleMoves(board: (Piece | null)[][], pos: Position): Position[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];
  const dirs =
    piece.type === 'king'
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : piece.color === 'red'
      ? [[-1, -1], [-1, 1]]
      : [[1, -1], [1, 1]];
  const moves: Position[] = [];
  for (const [dr, dc] of dirs) {
    const nr = pos.row + dr, nc = pos.col + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
    if (!board[nr][nc]) {
      moves.push({row: nr, col: nc});
    } else if (board[nr][nc]!.color !== piece.color) {
      const jr = nr + dr, jc = nc + dc;
      if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !board[jr][jc])
        moves.push({row: jr, col: jc});
    }
  }
  return moves;
}

function applyMove(board: (Piece | null)[][], from: Position, to: Position): (Piece | null)[][] {
  const nb = board.map(row => [...row]);
  const piece = nb[from.row][from.col];
  if (!piece) return nb;
  nb[to.row][to.col] = piece;
  nb[from.row][from.col] = null;
  if (Math.abs(to.row - from.row) === 2)
    nb[(from.row + to.row) / 2][(from.col + to.col) / 2] = null;
  if (piece.color === 'red' && to.row === 0) nb[to.row][to.col] = {color: 'red', type: 'king'};
  if (piece.color === 'black' && to.row === 7) nb[to.row][to.col] = {color: 'black', type: 'king'};
  return nb;
}

function deserializeBoard(raw: any[][]): (Piece | null)[][] {
  return raw.map(row =>
    row.map(cell =>
      cell ? {color: cell.color as PieceColor, type: cell.type as PieceType} : null,
    ),
  );
}

function hasAnyMoves(board: (Piece | null)[][], color: PieceColor): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && getPossibleMoves(board, {row: r, col: c}).length > 0)
        return true;
    }
  return false;
}

// ─── component ────────────────────────────────────────────────────────────────
const MultiplayerCheckersScreen = ({navigation, route}: any) => {
  const { translate } = useI18n();
  const {userId, mode: routeMode, joinCode, dbSessionId, preMatch} = route.params;
  const {refreshOnGameEnd} = useGameEndRefresh(undefined, 'checkers');

  // ── screen mode ────────────────────────────────────────────────────────────
  // Match the route param so the matchmaking/private UI renders immediately on
  // mount — otherwise the menu flashes before the socket-init useEffect runs.
  const initialScreenMode: 'menu' | 'matchmaking' | 'private' | 'game' =
    routeMode === 'random' ||
    routeMode === 'private-join' ||
    routeMode === 'join-from-lobby' ||
    routeMode === 'spectate'
      ? 'matchmaking'
      : routeMode === 'private-create'
        ? 'private'
        : 'menu';
  const [mode, setMode] = useState<'menu' | 'matchmaking' | 'private' | 'game'>(initialScreenMode);
  const [isSpectating, setIsSpectating] = useState(false);
  const [showBlur, setShowBlur] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [showCustomization, setShowCustomization] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer]     = useState(false);
  const [arEnabled, setArEnabled] = useState(true);
  const arOverlayRef = useRef<AR3DOverlayHandle>(null);
  const [gameTheme, setGameTheme] = useState<GameTheme>({});
  const handleApplyTheme = (theme: GameTheme) => setGameTheme(theme);
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));

  // ── game state ─────────────────────────────────────────────────────────────
  const [gameState, setGameState] = useState<GameState>(freshGame());

  // ── room & player ──────────────────────────────────────────────────────────
  const [roomId, setRoomId] = useState<string>('');
  const roomIdRef = useRef<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinRoomCode, setJoinRoomCode] = useState<string>('');
  const [opponentId, setOpponentId] = useState<string>('');
  const [opponentUsername, setOpponentUsername] = useState<string>('');

  // server assigns 'white'|'black'; white → plays red pieces, black → plays black pieces
  const [mySocketColor, setMySocketColor] = useState<'white' | 'black'>('white');
  const mySocketColorRef = useRef<'white' | 'black'>('white');
  const myPieceColor: PieceColor = mySocketColor === 'black' ? 'black' : 'red';

  const [serverTurn, setServerTurn] = useState<'white' | 'black'>('white');
  const isMyTurn = mode === 'game' ? serverTurn === mySocketColor : false;

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const [gameStatus, setGameStatus] = useState<string>(
    routeMode === 'random' ? 'Finding opponent...' : '',
  );
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomName, setRoomName] = useState('Multiplayer Checkers');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);
  // Refs for room name — avoids stale closures in polling / socket handlers
  const roomNameRef = useRef(roomName);
  useEffect(() => { roomNameRef.current = roomName; }, [roomName]);
  const setRoomNameRef = useRef(setRoomName);
  useEffect(() => { setRoomNameRef.current = setRoomName; }, [setRoomName]);

  // ── socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const initialize = async () => {
      await connectToServer();

      // Room name listener — register right after connect (same pattern as other events)
      const sock = socketService.getSocket();
      if (sock) {
        sock.on('room_name_updated', (data: any) => {
          console.log('[MultiplayerCheckers] room_name_updated received:', data?.roomName);
          if (data?.roomName) setRoomName(data.roomName);
        });
      }

      socketService.onMatchmakingStatus(data => {
        if (data.status === 'searching') setGameStatus('Searching for opponent...');
      });

      socketService.onOpponentJoined(data => {
        setOpponentId(data.opponent?.id ?? '');
        setOpponentUsername(((data.opponent as any)?.username ?? (data.opponent as any)?.displayName) ?? '');
        setGameStatus('Opponent found! Get ready...');
        const liveRoomId = roomIdRef.current;
        if (liveRoomId) socketService.playerReady(liveRoomId, userId);
      });

      socketService.onGameStarted(data => {
        const assignedColor: 'white' | 'black' =
          data.myColor ||
          (data.player1Id === userId ? 'white' : 'black');
        mySocketColorRef.current = assignedColor;
        setMySocketColor(assignedColor);
        setServerTurn(data.gameState?.currentTurn ?? 'white');
        setGameState({
          board: data.gameState?.board
            ? deserializeBoard(data.gameState.board)
            : initializeBoard(),
          currentPlayer: 'red',
          selectedSquare: null,
          possibleMoves: [],
          isGameOver: false,
          winner: null,
        });
        if (data.roomId) {
          roomIdRef.current = data.roomId;
          setRoomId(data.roomId);
        }
        // Sync room name if set before player 2 joined
        if (data.roomName) setRoomName(data.roomName);
        setMode('game');
      });

      socketService.onMoveMade(data => {
        const nextTurn: 'white' | 'black' = data.currentTurn ?? 'white';
        if (data.gameState?.board) {
          setGameState(prev => ({
            ...prev,
            board: deserializeBoard(data.gameState.board),
            selectedSquare: null,
            possibleMoves: [],
          }));
        }
        setServerTurn(nextTurn);
        // Piggyback: sync room name on every move (proven channel)
        if (data.roomName) setRoomName(data.roomName);
      });

      socketService.onGameEnded(data => {
        refreshOnGameEnd().catch(console.error);
        if (data.result === 'resignation') {
          const didIWin = data.winnerId === userId;
          BisetkaAlert[didIWin ? 'success' : 'alert'](
            'Game Over',
            didIWin ? 'Opponent resigned. You win!' : 'You resigned.',
            [{text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'checkers'})}],
          );
        } else {
          const myC = mySocketColorRef.current === 'black' ? 'black' : ('red' as PieceColor);
          const iWon = data.winnerId === userId;
          setGameState(prev => ({
            ...prev,
            board: data.gameState?.board ? deserializeBoard(data.gameState.board) : prev.board,
            isGameOver: true,
            winner: iWon ? myC : myC === 'red' ? 'black' : 'red',
          }));
        }
      });

      socketService.onOpponentDisconnected(() => {
        refreshOnGameEnd().catch(console.error);
        BisetkaAlert.warning(
          'Opponent Disconnected',
          'Your opponent has disconnected. You win!',
          [{text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'checkers'})}],
        );
      });

      socketService.onError(error => {
        BisetkaAlert.error('Error', error.message);
      });

      // Auto-trigger mode from route params
      if (routeMode === 'random') {
        if (preMatch) {
          roomIdRef.current = preMatch.roomId;
          mySocketColorRef.current = preMatch.color;
          setRoomId(preMatch.roomId);
          setMySocketColor(preMatch.color);
          setOpponentId(preMatch.opponent?.id ?? '');
          setOpponentUsername(
            ((preMatch.opponent as any)?.username ??
              (preMatch.opponent as any)?.displayName) ??
              '',
          );
          setGameStatus('Opponent found! Get ready...');
          socketService.playerReady(preMatch.roomId, userId);
        } else {
          handleFindMatch();
        }
      } else if (routeMode === 'private-create') {
        handleCreatePrivateRoom();
      } else if (routeMode === 'private-join' && joinCode) {
        setJoinRoomCode(joinCode);
      } else if (routeMode === 'join-from-lobby' && dbSessionId) {
        setMode('matchmaking');
        setGameStatus('Joining game...');
        const _sock = socketService.getSocket();
        if (_sock) {
          _sock.once('room_joined', (data: any) => {
            _sock.off('spectate_started');
            roomIdRef.current = data.roomId;
            mySocketColorRef.current = data.color ?? 'black';
            setRoomId(data.roomId);
            setMySocketColor(data.color ?? 'black');
            setOpponentId(data.opponent?.id ?? '');
            setOpponentUsername(((data.opponent as any)?.username ?? (data.opponent as any)?.displayName) ?? '');
            setGameStatus('Joined! Waiting for game to start...');
            socketService.playerReady(data.roomId, userId);
          });
          // Fallback: server may send spectate_started if game already in progress
          _sock.once('spectate_started', (data: any) => {
            _sock.off('room_joined');
            setIsSpectating(true);
            roomIdRef.current = data.roomId;
            setRoomId(data.roomId);
            const board = data.gameState?.board
              ? deserializeBoard(data.gameState.board)
              : initializeBoard();
            setGameState(prev => ({
              ...prev,
              board,
              currentPlayer: data.gameState?.currentTurn === 'black' ? 'black' : 'red',
            }));
            if (data.gameState?.currentTurn) setServerTurn(data.gameState.currentTurn);
            setMode('game');
            setGameStatus('Spectating');
          });
        }
        socketService.joinRoomBySession(dbSessionId, userId);
      } else if (routeMode === 'spectate' && dbSessionId) {
        setMode('matchmaking');
        setGameStatus('Connecting to game...');
        socketService
          .spectateRoom(dbSessionId, userId)
          .then((data: any) => {
            setIsSpectating(true);
            roomIdRef.current = data.roomId;
            setRoomId(data.roomId);
            const board = data.gameState?.board
              ? deserializeBoard(data.gameState.board)
              : initializeBoard();
            setGameState(prev => ({
              ...prev,
              board,
              currentPlayer: data.gameState?.currentTurn === 'black' ? 'black' : 'red',
            }));
            if (data.gameState?.currentTurn) setServerTurn(data.gameState.currentTurn);
            setMode('game');
            setGameStatus('Spectating');
          })
          .catch((err: any) => {
            BisetkaAlert.error('Error', err.message || 'Could not connect to this game.');
            navigation.goBack();
          });
      }
    };

    initialize();

    return () => {
      socketService.removeAllListeners();
      socketService.disconnect();
    };
  }, []);

  // Auto-join when code is available
  useEffect(() => {
    if (routeMode === 'private-join' && joinRoomCode) {
      handleJoinPrivateRoom();
    }
  }, [joinRoomCode, routeMode]);

  const connectToServer = async () => {
    try {
      const token = await tokenService.getAccessToken();
      await socketService.connect(userId, token || '');
    } catch (error) {
      BisetkaAlert.error('Connection Error', 'Failed to connect to server');
    }
  };

  // ── matchmaking ────────────────────────────────────────────────────────────
  const handleFindMatch = async () => {
    setMode('matchmaking');
    setGameStatus('Finding opponent...');
    try {
      const matchData = await socketService.findMatch('checkers', userId);
      roomIdRef.current = matchData.roomId;
      mySocketColorRef.current = matchData.color;
      setRoomId(matchData.roomId);
      setMySocketColor(matchData.color);
      setOpponentId(matchData.opponent?.id ?? '');
      setOpponentUsername(((matchData.opponent as any)?.username ?? (matchData.opponent as any)?.displayName) ?? '');
      socketService.playerReady(matchData.roomId, userId);
    } catch (error: any) {
      BisetkaAlert.error('Matchmaking Error', error.message);
      setMode('menu');
    }
  };

  const handleCreatePrivateRoom = async () => {
    try {
      const roomData = await socketService.createPrivateRoom('checkers', userId, joinCode);
      roomIdRef.current = roomData.roomId;
      mySocketColorRef.current = 'white';
      setRoomId(roomData.roomId);
      setRoomCode(roomData.roomCode);
      setMySocketColor('white');
      setMode('private');
      setGameStatus(`Share code: ${roomData.roomCode}`);
    } catch (error: any) {
      BisetkaAlert.error('Error', 'Failed to create room');
    }
  };

  const handleJoinPrivateRoom = async () => {
    if (!joinRoomCode) {
      BisetkaAlert.error('Error', 'Please enter a room code');
      return;
    }
    try {
      const roomData = await socketService.joinPrivateRoom(joinRoomCode, userId);
      roomIdRef.current = roomData.roomId;
      mySocketColorRef.current = roomData.color;
      setRoomId(roomData.roomId);
      setMySocketColor(roomData.color);
      setOpponentId(roomData.opponent?.id ?? '');
      setOpponentUsername(((roomData.opponent as any)?.username ?? (roomData.opponent as any)?.displayName) ?? '');
      setMode('private');
      setShowJoinModal(false);
      socketService.playerReady(roomData.roomId, userId);
      setGameState(freshGame());
    } catch (error: any) {
      BisetkaAlert.error('Error', error.message || 'Failed to join room');
    }
  };

  const handleSaveRoomName = async (newName: string) => {
    try {
      setRoomName(newName);
      if (roomIdRef.current) socketService.setRoomName(roomIdRef.current, newName);
      BisetkaAlert.success('Success', 'Room name updated!');
    } catch {
      BisetkaAlert.error('Error', 'Failed to update room name');
    }
  };

  const handleResign = () => {
    BisetkaAlert.warning('Resign', 'Are you sure you want to resign?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Resign',
        style: 'destructive',
        onPress: () => {
          socketService.resign(roomId, userId);
          navigation.replace('GameMode', {gameType: 'checkers'});
        },
      },
    ]);
  };

  // ── board interaction ──────────────────────────────────────────────────────
  const handleSquarePress = useCallback(
    (dRow: number, dCol: number) => {
      // Flip board so your pieces are always at the bottom
      const row = myPieceColor === 'black' ? 7 - dRow : dRow;
      const col = myPieceColor === 'black' ? 7 - dCol : dCol;

      if (isSpectating) return;
      if (gameState.isGameOver) return;
      if (!isMyTurn) return;

      const piece = gameState.board[row]?.[col];

      if (!gameState.selectedSquare) {
        if (piece && piece.color === myPieceColor) {
          setGameState(prev => ({
            ...prev,
            selectedSquare: {row, col},
            possibleMoves: getPossibleMoves(prev.board, {row, col}),
          }));
        }
        return;
      }

      const sel = gameState.selectedSquare;
      const isValid = gameState.possibleMoves.some(m => m.row === row && m.col === col);

      if (isValid) {
        // Optimistic local update
        setGameState(prev => ({
          ...prev,
          board: applyMove(prev.board, sel, {row, col}),
          selectedSquare: null,
          possibleMoves: [],
        }));
        const liveRoomId = roomIdRef.current || roomId;
        socketService.makeMove(liveRoomId, userId, {from: sel, to: {row, col}});
      } else if (piece && piece.color === myPieceColor) {
        setGameState(prev => ({
          ...prev,
          selectedSquare: {row, col},
          possibleMoves: getPossibleMoves(prev.board, {row, col}),
        }));
      } else {
        setGameState(prev => ({...prev, selectedSquare: null, possibleMoves: []}));
      }
    },
    [gameState, isMyTurn, myPieceColor, roomId, userId, isSpectating],
  );

  const handleArSquareTap = useCallback((logRow: number, logCol: number) => {
    const dRow = myPieceColor === 'black' ? 7 - logRow : logRow;
    const dCol = myPieceColor === 'black' ? 7 - logCol : logCol;
    handleSquarePress(dRow, dCol);
  }, [myPieceColor, handleSquarePress]);

  const arPieces = useMemo<ARPiece[]>(() => {
    const FIELD_HALF = 0.305;
    const SQ = (FIELD_HALF * 2) / 8;
    const CHECKER_SZ = SQ * 0.70;
    const SURFACE_Z = 0.002;
    const EDGE_INSET = SQ * 0.45;
    const result: ARPiece[] = [];
    gameState.board.forEach((row, r) => {
      row.forEach((piece, c) => {
        if (!piece) return;
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
          side: piece.color === 'red' ? 'white' : 'black',
          pieceType: 'checker',
          pieceScale: CHECKER_SZ,
          posX,
          posY,
          posZ: SURFACE_Z,
          isKing: piece.type === 'king',
          isSelected: gameState.selectedSquare?.row === r && gameState.selectedSquare?.col === c,
        });
      });
    });
    return result;
  }, [gameState.board, gameState.selectedSquare]);

  // ── sub-renders ────────────────────────────────────────────────────────────
  const renderMenu = () => (
    <View style={styles.menuContainer}>
      <Text style={styles.title}>Multiplayer Checkers</Text>

      <TouchableOpacity style={styles.menuButton} onPress={handleFindMatch}>
        <Text style={styles.menuButtonText}>🎲 Find Random Opponent</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuButton} onPress={handleCreatePrivateRoom}>
        <Text style={styles.menuButtonText}>👥 Create Private Game</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuButton} onPress={() => setShowJoinModal(true)}>
        <Text style={styles.menuButtonText}>🔗 Join Private Game</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMatchmaking = () => (
    <View style={styles.waitingContainer}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.waitingText}>{gameStatus}</Text>
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => {
          socketService.cancelMatchmaking(userId);
          setMode('menu');
        }}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPrivateRoom = () => (
    <View style={styles.waitingContainer}>
      {!opponentId ? (
        <>
          <Text style={styles.privateTitleText}>Private Game Created</Text>
          <Text style={styles.roomCodeLabel}>Room Code:</Text>
          <Text style={styles.roomCode}>{roomCode}</Text>
          <Text style={styles.waitingText}>Share this code with your friend</Text>
          <Text style={styles.helpText}>Waiting for opponent to join...</Text>
        </>
      ) : (
        <>
          <Text style={styles.waitingText}>Opponent joined!</Text>
          <Text style={styles.helpText}>Get ready to play...</Text>
        </>
      )}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => {
          setMode('menu');
          navigation.goBack();
        }}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // ── main render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <AraratBackground overlayOpacity={showBlur ? 0.5 : 0.3}>
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
      </AraratBackground>
      <View style={styles.overlay} pointerEvents="box-none">
        <GamePlayerOverlay
          opponent={
            opponentId
              ? { userId: opponentId, username: opponentUsername }
              : null
          }
        />
        <SafeAreaView style={styles.safeArea}>
          <View>
            <GameToolbar
              title={roomName}
              onBack={() => navigation.goBack()}
              backgroundColor="transparent"
            />
            <View>
              <GameToolbarControls
                buttons={[
                  { icon: '🎨', onPress: () => setShowCustomization(true) },
                  { icon: showBackground ? '🖼️' : '🔲', onPress: () => setShowBackground(!showBackground) },
                  { icon: '✏️', onPress: () => setShowRoomNameModal(true) },
                  { icon: arEnabled ? '🥽' : '🎮', onPress: () => setArEnabled(!arEnabled) },
                  { icon: showMusicPlayer ? '🎵' : '🎶', onPress: () => setShowMusicPlayer(s => !s) },
                ]}
              />
            </View>
          </View>

          {mode === 'menu' && renderMenu()}
          {mode === 'matchmaking' && renderMatchmaking()}
          {mode === 'private' && renderPrivateRoom()}

          {mode === 'game' && (
            <>
              {/* Status bar */}
              <View style={styles.statusBar}>
                <Text style={styles.turnText}>
                  {isSpectating
                    ? '👁️ Spectating'
                    : isMyTurn
                    ? `🎯 Your Turn (${myPieceColor === 'red' ? '🔴 Red' : '⚫ Black'})`
                    : "⏳ Opponent's Turn"}
                </Text>
                {!isSpectating && (
                  <Text style={styles.colorText}>
                    {myPieceColor === 'red' ? '🔴 Red' : '⚫ Black'}
                  </Text>
                )}
              </View>

              {/* Board */}
              <View style={styles.boardContainer}>
                {arEnabled ? (
                  /* AR mode: transparent passthrough — board+pieces rendered by AR3DOverlay */
                  <View style={[styles.board, {backgroundColor: 'transparent'}]} pointerEvents="none" />
                ) : (
                  <ImageBackground
                    source={require('../../../../assets/chess/board.png')}
                    style={styles.board}
                    resizeMode="stretch">
                    <View style={styles.gridContainer}>
                      {Array(8)
                        .fill(null)
                        .map((_, dRow) => {
                          const logRow = myPieceColor === 'black' ? 7 - dRow : dRow;
                          return (
                            <View key={dRow} style={styles.row}>
                              {Array(8)
                                .fill(null)
                                .map((_, dCol) => {
                                  const logCol = myPieceColor === 'black' ? 7 - dCol : dCol;
                                  const piece = gameState.board[logRow]?.[logCol] ?? null;
                                  const isSel =
                                    gameState.selectedSquare?.row === logRow &&
                                    gameState.selectedSquare?.col === logCol;
                                  const isPoss = gameState.possibleMoves.some(
                                    m => m.row === logRow && m.col === logCol,
                                  );
                                  return (
                                    <TouchableOpacity
                                      key={`${dRow}-${dCol}`}
                                      style={[
                                        styles.square,
                                        isSel && styles.selectedSquare,
                                        isPoss && styles.possibleMoveSquare,
                                      ]}
                                      onPress={() => handleSquarePress(dRow, dCol)}
                                      hitSlop={{top: 2, bottom: 2, left: 2, right: 2}}>
                                      {piece && (
                                        <View
                                          style={[
                                            styles.piece,
                                            piece.color === 'red'
                                              ? styles.redPiece
                                              : styles.blackPiece,
                                            piece.type === 'king' && styles.kingPiece,
                                          ]}>
                                          {piece.type === 'king' && (
                                            <Text style={styles.kingText}>♔</Text>
                                          )}
                                        </View>
                                      )}
                                      {isPoss && !piece && (
                                        <View style={styles.moveIndicator} />
                                      )}
                                    </TouchableOpacity>
                                  );
                                })}
                            </View>
                          );
                        })}
                    </View>
                  </ImageBackground>
                )}
              </View>

              {/* Resign */}
              <View style={styles.controls}>
                <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
                  <Text style={styles.resignButtonText}>Resign</Text>
                </TouchableOpacity>
              </View>

              {/* Game over overlay */}
              {gameState.isGameOver && (
                <View style={styles.gameOverOverlay}>
                  <View style={styles.gameOverBox}>
                    <Text style={styles.gameOverTitle}>Game Over!</Text>
                    <Text style={styles.gameOverText}>
                      {gameState.winner === myPieceColor ? 'You Win! 🏆' : 'You Lose 😔'}
                    </Text>
                    <TouchableOpacity
                      style={styles.playAgainButton}
                      onPress={() => navigation.replace('GameMode', {gameType: 'checkers'})}>
                      <Text style={styles.playAgainText}>Play Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.playAgainButton, {marginTop: 10, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#fff'}]}
                      onPress={() => navigation.navigate('Home' as never)}>
                      <Text style={styles.playAgainText}>Exit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {/* In-game chat */}
          <InGameChat
            roomId={roomId}
            currentUserId={userId}
            gameType="checkers"
            visible={mode === 'game' && !!roomId}
          />

          {/* Synced music player */}
          <SyncedYouTubePlayer
            roomId={mode === 'game' && roomId ? roomId : null}
            visible={true}
          />

          {/* Room name modal */}
          <RoomNameModal
            visible={showRoomNameModal}
            onClose={() => setShowRoomNameModal(false)}
            currentName={roomName}
            onSave={handleSaveRoomName}
            gameType="Checkers"
          />
        </SafeAreaView>
      </View>

      {/* Join room modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJoinModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Private Game</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Room Code"
              value={joinRoomCode}
              onChangeText={setJoinRoomCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowJoinModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalJoinButton]}
                onPress={handleJoinPrivateRoom}>
                <Text style={[styles.modalButtonText, {color: 'white'}]}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <GameThemeCustomizer
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onApply={handleApplyTheme}
        gameType="checkers"
        initialTheme={gameTheme}
      />
    </View>
  );
};

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {flex: 1},
  overlay: {flex: 1},
  safeArea: {flex: 1},

  // ── menu / waiting ────────────────────────────────────────────────────────
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 40,
  },
  menuButton: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1,
    borderColor: '#FFD700',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 15,
  },
  menuButtonText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  waitingText: {
    fontSize: 20,
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 10,
    textAlign: 'center',
  },
  privateTitleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 12,
  },
  roomCodeLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 20,
  },
  roomCode: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 8,
    letterSpacing: 6,
  },
  cancelButton: {
    marginTop: 32,
    paddingVertical: 14,
    paddingHorizontal: 40,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 160,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── status bar ────────────────────────────────────────────────────────────
  statusBar: {
    backgroundColor: '#1C1917',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  turnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  colorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
  },

  // ── board ─────────────────────────────────────────────────────────────────
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  board: {
    aspectRatio: 1,
    width: '100%',
    maxWidth: 500,
  },
  gridContainer: {
    flex: 1,
    paddingTop: 40,
    paddingBottom: 55,
    paddingHorizontal: 50,
  },
  row: {flex: 1, flexDirection: 'row'},
  square: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  selectedSquare: {backgroundColor: 'rgba(130, 151, 105, 0.6)'},
  possibleMoveSquare: {backgroundColor: 'rgba(100, 111, 64, 0.5)'},

  // ── pieces ────────────────────────────────────────────────────────────────
  piece: {
    width: '70%',
    height: '70%',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  redPiece: {backgroundColor: '#e74c3c'},
  blackPiece: {backgroundColor: '#2c3e50'},
  kingPiece: {
    backgroundColor: '#FFD700',
    width: '90%',
    height: '90%',
    borderColor: '#8B6914',
    borderWidth: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 10,
  },
  kingText: {fontSize: 28, color: '#8B4513', fontWeight: '900', textShadowColor: '#fff8d6', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2},
  moveIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },

  // ── controls ──────────────────────────────────────────────────────────────
  controls: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  resignButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 11,
    paddingHorizontal: 44,
    borderRadius: 8,
  },
  resignButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── game over overlay ─────────────────────────────────────────────────────
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 36,
    alignItems: 'center',
    minWidth: 260,
  },
  gameOverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C1917',
    marginBottom: 12,
  },
  gameOverText: {
    fontSize: 20,
    color: '#312E2B',
    marginBottom: 24,
  },
  playAgainButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  playAgainText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1917',
  },

  // ── join modal ────────────────────────────────────────────────────────────
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    width: '82%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1C1917',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 20,
    color: '#1C1917',
  },
  modalButtons: {flexDirection: 'row', justifyContent: 'space-between'},
  modalButton: {flex: 1, padding: 14, borderRadius: 8, marginHorizontal: 5},
  modalCancelButton: {backgroundColor: '#eee'},
  modalJoinButton: {backgroundColor: '#FFD700'},
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1C1917',
  },

  // ── toolbar extras ────────────────────────────────────────────────────────
  editRoomButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  editRoomIcon: {fontSize: 18},
});

export default MultiplayerCheckersScreen;
