import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import AraratBackground from '../../../components/AraratBackground';
import AR3DOverlay, {type AR3DOverlayHandle, type ARPiece} from '../../../components/AR3DOverlay';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import GamePlayerOverlay from '../../../components/GamePlayerOverlay';
import GameThemeCustomizer from '../../../components/global/GameThemeCustomizer';
import type { GameTheme } from '../../../components/global/GameThemeCustomizer';
import RoomNameModal from '../../../components/RoomNameModal';
import {
  ChessGameState,
  initializeChessGame,
  getPossibleMoves,
  makeMove as makeChessMove,
  isKingInCheck,
  isCheckmate,
  getDrawReason,
  Position,
} from '../../../game/chessLogic';
import {socketService, GameMove} from '../../../services/SocketService';
import tokenService from '../../../services/token.service';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import { useI18n } from '../../../hooks/useI18n';
import InGameChat from '../../../components/InGameChat';
import {apiConfig} from '../../../libs/utils/api.utils';

/** Convert the server's compact string board to the client's ChessPiece object board */
const serverBoardToClient = (board: any[][]): (import('../../../game/chessLogic').ChessPiece | null)[][] => {
  const pieceMap: Record<string, { type: import('../../../game/chessLogic').PieceType; color: import('../../../game/chessLogic').PieceColor }> = {
    'p': { type: 'pawn', color: 'black' },
    'r': { type: 'rook', color: 'black' },
    'n': { type: 'knight', color: 'black' },
    'b': { type: 'bishop', color: 'black' },
    'q': { type: 'queen', color: 'black' },
    'k': { type: 'king', color: 'black' },
    'P': { type: 'pawn', color: 'white' },
    'R': { type: 'rook', color: 'white' },
    'N': { type: 'knight', color: 'white' },
    'B': { type: 'bishop', color: 'white' },
    'Q': { type: 'queen', color: 'white' },
    'K': { type: 'king', color: 'white' },
  };
  return board.map(row =>
    row.map(cell => {
      if (!cell) return null;
      // Already an object (client format)
      if (typeof cell === 'object' && cell.type) return cell;
      const entry = pieceMap[cell as string];
      return entry ? { ...entry, hasMoved: false } : null;
    }),
  );
};

const MultiplayerChessScreen = ({navigation, route}: any) => {
  const { translate } = useI18n();
  const {userId, mode: routeMode, joinCode, dbSessionId, preMatch} = route.params; // Get from auth context
  const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'chess');
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
  const [showCustomization, setShowCustomization] = useState(false);
  const [gameTheme, setGameTheme] = useState<GameTheme>({});
  const [arEnabled, setArEnabled] = useState(true);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const arOverlayRef = React.useRef<AR3DOverlayHandle>(null);
  const handleApplyTheme = (theme: GameTheme) => setGameTheme(theme);
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const isSpectatingRef = React.useRef(false);
  const [gameState, setGameState] = useState<ChessGameState | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const roomIdRef = React.useRef<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinRoomCode, setJoinRoomCode] = useState<string>('');
  const [myColor, setMyColor] = useState<'white' | 'black'>('white');
  // Ref so stale closures (socket listeners) always read the current value
  const myColorRef = React.useRef<'white' | 'black'>('white');
  const [opponentId, setOpponentId] = useState<string>('');
  const [opponentUsername, setOpponentUsername] = useState<string>('');
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [isMyTurn, setIsMyTurn] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<string>(
    routeMode === 'random' ? 'Finding opponent...' : 'Waiting for opponent...',
  );
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomName, setRoomName] = useState('Multiplayer Chess');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);
  const roomNameRef = React.useRef(roomName);
  useEffect(() => { roomNameRef.current = roomName; }, [roomName]);

  const normalizeColor = (value: any): 'white' | 'black' | null => {
    if (value === 'white' || value === 'black') return value;
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      if (v === 'red') return 'white';
      if (v === 'white') return 'white';
      if (v === 'black') return 'black';
    }
    return null;
  };

  const sameUser = (a: any, b: any): boolean => {
    if (a == null || b == null) return false;
    return String(a) === String(b);
  };

  const resolveColorFromPayload = (payload: any): 'white' | 'black' | null => {
    const direct =
      normalizeColor(payload?.myColor) ??
      normalizeColor(payload?.color) ??
      normalizeColor(payload?.playerColor) ??
      normalizeColor(payload?.team) ??
      normalizeColor(payload?.side);
    if (direct) return direct;

    if (sameUser(payload?.player1Id, userId) || sameUser(payload?.player1?.id, userId)) return 'white';
    if (sameUser(payload?.player2Id, userId) || sameUser(payload?.player2?.id, userId)) return 'black';
    return null;
  };

  const resolveTurnFromPayload = (payload: any): 'white' | 'black' => {
    return (
      normalizeColor(payload?.currentTurn) ??
      normalizeColor(payload?.gameState?.currentTurn) ??
      'white'
    );
  };

  const applyMyColor = (color: 'white' | 'black') => {
    myColorRef.current = color;
    setMyColor(color);
  };

  useEffect(() => {
    setIsMyTurn(currentTurn === myColor);
  }, [currentTurn, myColor]);

  const arPieces = React.useMemo<ARPiece[]>(() => {
    if (!gameState) return [];
    const result: ARPiece[] = [];
    gameState.board.forEach((row, r) => {
      row.forEach((piece, c) => {
        if (!piece) return;
        result.push({
          key: `${r}-${c}`,
          row: r,
          col: c,
          color: piece.color === 'white' ? 'red' : 'black',
          isKing: piece.type !== 'pawn',
          pieceType: piece.type,
          side: piece.color,
          isSelected:
            gameState.selectedSquare?.row === r &&
            gameState.selectedSquare?.col === c,
        });
      });
    });
    return result;
  }, [gameState?.board, gameState?.selectedSquare]);

  useEffect(() => {
    // Connect first, then register listeners on the live socket, then start matchmaking.
    // Registering listeners before connect() is a no-op because this.socket is null.
    const initialize = async () => {
      await connectToServer();

      // ── Register all event listeners NOW (socket exists) ──────────────────
      // Room name updates from other players
      const _sock = socketService.getSocket();
      if (_sock) {
        _sock.on('room_name_updated', (data: { roomId: string; dbSessionId?: string; roomName: string }) => {
          if (data.roomId === roomIdRef.current || data.dbSessionId === roomIdRef.current) {
            setRoomName(data.roomName);
          }
        });
      }

      socketService.onMatchmakingStatus((data) => {
        if (data.status === 'searching') {
          setGameStatus('Searching for opponent...');
        }
      });

      socketService.onOpponentJoined((data) => {
        setOpponentId(data.opponent.id);
        setOpponentUsername((data.opponent as any).username ?? (data.opponent as any).displayName ?? '');
        setGameStatus('Opponent found! Get ready...');
        // Player 1 (room creator) must also signal ready so the backend starts the game
        const liveRoomId = roomIdRef.current;
        if (liveRoomId) {
          socketService.playerReady(liveRoomId, userId);
        }
      });

      socketService.onGameStarted((data) => {
        console.log('🎮 game_started received:', data);
        setGameStatus('Game started!');
        setMode('game');
        // Resolve both color and starting turn from whichever payload shape arrived.
        const assignedColor = resolveColorFromPayload(data) ?? myColorRef.current;
        const serverTurn = resolveTurnFromPayload(data);
        applyMyColor(assignedColor);
        setCurrentTurn(serverTurn);
        setIsMyTurn(serverTurn === assignedColor);
        // Apply server-sent roomId if provided (ensures stale closures resolve correctly)
        const liveRoomId = data.roomId || roomIdRef.current;
        if (liveRoomId) {
          roomIdRef.current = liveRoomId;
          setRoomId(liveRoomId);
        }
        const initialGame = initializeChessGame('medium');
        if (data.gameState?.board) {
          const clientBoard = serverBoardToClient(data.gameState.board);
          setGameState({
            ...initialGame,
            board: clientBoard,
            currentPlayer: serverTurn,
          });
        } else {
          setGameState({ ...initialGame, currentPlayer: serverTurn });
        }
      });

      socketService.onMoveMade((data) => {
        // Use the current turn from the server (not nextTurn)
        const nextPlayer = data.currentTurn;
        // Always read from ref — the closure is stale, state is not
        const liveColor = myColorRef.current;
        console.log('♟️  move_made received:', {
          move: data.move,
          currentTurn: data.currentTurn,
          myColor: liveColor,
          willBeMyTurn: nextPlayer === liveColor
        });

        // Update game state - use functional update to avoid stale closure
        setGameState((prevState) => {
          if (!prevState) return prevState;

          const newBoard = makeChessMove(prevState.board, data.move);
          const isCheck = isKingInCheck(newBoard, nextPlayer);
          const isCheckMate = isCheckmate(newBoard, nextPlayer);
          const drawReason = getDrawReason(newBoard, nextPlayer);
          const isStaleMate = drawReason !== null;

          return {
            ...prevState,
            board: newBoard,
            currentPlayer: nextPlayer,
            selectedSquare: null,
            possibleMoves: [],
            isCheck,
            isCheckmate: isCheckMate,
            isStalemate: isStaleMate,
            drawReason,
          };
        });

        setCurrentTurn(nextPlayer);
        setIsMyTurn(nextPlayer === liveColor);
      });

      socketService.onGameEnded((data) => {
        console.log('🏁 game_ended received:', data);
        refreshOnGameEnd().catch(console.error);
        if (data.result === 'resignation') {
          const didIWin = data.winnerId === userId;
          if (didIWin) {
            BisetkaAlert.success(
              'Game Over',
              'Opponent resigned. You win!',
              [{text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'chess-multiplayer'})}]
            );
          } else {
            BisetkaAlert.alert(
              'Game Over',
              'You resigned.',
              [{text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'chess-multiplayer'})}]
            );
          }
        }
      });

      socketService.onOpponentDisconnected(() => {
        console.log('👋 opponent_disconnected received');
        refreshOnGameEnd().catch(console.error);
        BisetkaAlert.warning(
          'Opponent Disconnected',
          'Your opponent has disconnected from the game.',
          [{text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'chess-multiplayer'})}]
        );
      });

      socketService.onError((error) => {
        console.error('❌ Socket error:', error);
        BisetkaAlert.error('Error', error.message);
      });
      // ─────────────────────────────────────────────────────────────────────

      if (routeMode === 'random') {
        if (preMatch) {
          // Matchmaking was already completed on GameInfoScreen — use the
          // pre-fetched data directly so we don't double-queue and so the user
          // doesn't sit on a second "Finding opponent..." screen.
          roomIdRef.current = preMatch.roomId;
          setRoomId(preMatch.roomId);
          const resolvedColor = resolveColorFromPayload(preMatch) ?? myColorRef.current;
          applyMyColor(resolvedColor);
          setOpponentId(preMatch.opponent?.id ?? '');
          setOpponentUsername(
            (preMatch.opponent as any)?.username ??
              (preMatch.opponent as any)?.displayName ??
              '',
          );
          const preMatchTurn = resolveTurnFromPayload(preMatch);
          setCurrentTurn(preMatchTurn);
          setIsMyTurn(preMatchTurn === resolvedColor);
          setGameStatus('Opponent found! Get ready...');
          socketService.playerReady(preMatch.roomId, userId);
        } else {
          handleFindMatch();
        }
      } else if (routeMode === 'private-create') {
        handleCreatePrivateRoom();
      } else if (routeMode === 'private-join' && joinCode) {
        // Socket is now connected — safe to trigger join
        setJoinRoomCode(joinCode);
      } else if (routeMode === 'join-from-lobby' && dbSessionId) {
        setMode('matchmaking');
        setGameStatus('Joining game...');
        const _sock = socketService.getSocket();
        if (_sock) {
          _sock.once('room_joined', (data: any) => {
            _sock.off('spectate_started');
            roomIdRef.current = data.roomId;
            setRoomId(data.roomId);
            const resolvedColor = resolveColorFromPayload(data) ?? 'black';
            applyMyColor(resolvedColor);
            setOpponentId(data.opponent?.id ?? '');
            setOpponentUsername(((data.opponent as any)?.username ?? (data.opponent as any)?.displayName) ?? '');
            setGameStatus('Joined! Waiting for game to start...');
            socketService.playerReady(data.roomId, userId);
          });
          // Fallback: server may send spectate_started if game already in progress
          _sock.once('spectate_started', (data: any) => {
            _sock.off('room_joined');
            isSpectatingRef.current = true;
            setIsSpectating(true);
            roomIdRef.current = data.roomId;
            setRoomId(data.roomId);
            if (data.gameState?.board) {
              const clientBoard = serverBoardToClient(data.gameState.board);
              const initialGame = initializeChessGame('medium');
              setGameState({
                ...initialGame,
                board: clientBoard,
                currentPlayer: data.currentTurn || 'white',
              });
            } else {
              setGameState(initializeChessGame('medium'));
            }
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
            isSpectatingRef.current = true;
            setIsSpectating(true);
            roomIdRef.current = data.roomId;
            setRoomId(data.roomId);
            if (data.gameState?.board) {
              const clientBoard = serverBoardToClient(data.gameState.board);
              const initialGame = initializeChessGame('medium');
              setGameState({
                ...initialGame,
                board: clientBoard,
                currentPlayer: data.currentTurn || 'white',
              });
            } else {
              setGameState(initializeChessGame('medium'));
            }
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
      console.log('🧹 Cleaning up socket listeners');
      socketService.removeAllListeners();
      socketService.disconnect();
    };
  }, []); // Empty dependencies - listeners set up once on mount

  // Auto-join private room when code is set
  // Auto-join private room when code is set
  useEffect(() => {
    if (routeMode === 'private-join' && joinRoomCode) {
      handleJoinPrivateRoom();
    }
  }, [joinRoomCode, routeMode]);

  const connectToServer = async () => {
    try {
      const token = await tokenService.getAccessToken();
      await socketService.connect(userId, token || '');
      console.log('Connected to multiplayer server');
    } catch (error) {
      BisetkaAlert.error('Connection Error', 'Failed to connect to server');
      console.error(error);
    }
  };

  const handleFindMatch = async () => {
    setMode('matchmaking');
    setGameStatus('Finding opponent...');
    
    try {
      const matchData = await socketService.findMatch('chess', userId);
      roomIdRef.current = matchData.roomId;
      setRoomId(matchData.roomId);
      const resolvedColor = resolveColorFromPayload(matchData) ?? myColorRef.current;
      applyMyColor(resolvedColor);
      setOpponentId(matchData.opponent.id);
      setOpponentUsername((matchData.opponent as any).username ?? (matchData.opponent as any).displayName ?? '');
      const matchTurn = resolveTurnFromPayload(matchData);
      setCurrentTurn(matchTurn);
      setIsMyTurn(matchTurn === resolvedColor);
      
      // Send ready signal
      socketService.playerReady(matchData.roomId, userId);
    } catch (error: any) {
      BisetkaAlert.error('Matchmaking Error', error.message);
      setMode('menu');
    }
  };

  const handleCreatePrivateRoom = async () => {
    try {
      const roomData = await socketService.createPrivateRoom('chess', userId, joinCode);
      roomIdRef.current = roomData.roomId;
      applyMyColor('white');
      setRoomId(roomData.roomId);
      setRoomCode(roomData.roomCode);
      setCurrentTurn('white');
      setIsMyTurn(true);
      setMode('private');
      setGameStatus(`Share code: ${roomData.roomCode}`);
    } catch (error: any) {
      BisetkaAlert.error('Error', 'Failed to create room');
      console.error(error);
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
      setRoomId(roomData.roomId);
      const resolvedColor = resolveColorFromPayload(roomData) ?? 'black';
      applyMyColor(resolvedColor);
      setOpponentId(roomData.opponent.id);
      setOpponentUsername((roomData.opponent as any).username ?? (roomData.opponent as any).displayName ?? '');
      setMode('private');
      setShowJoinModal(false);
      const joinTurn = resolveTurnFromPayload(roomData);
      setCurrentTurn(joinTurn);
      setIsMyTurn(joinTurn === resolvedColor);
      
      // Send ready signal
      socketService.playerReady(roomData.roomId, userId);
      
      // Initialize game
      const initialGame = initializeChessGame('medium');
      setGameState(initialGame);
    } catch (error: any) {
      BisetkaAlert.error('Error', error.message || 'Failed to join room');
      console.error(error);
    }
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

  const handleSquarePress = (row: number, col: number) => {
    if (isSpectating) return;
    if (!gameState || !isMyTurn || gameState.isCheckmate || gameState.isStalemate) return;

    const position: Position = {row, col};
    const piece = gameState.board[row][col];

    // If no square selected and clicked on own piece
    if (!gameState.selectedSquare && piece && piece.color === myColor) {
      const moves = getPossibleMoves(gameState.board, position);
      setGameState({
        ...gameState,
        selectedSquare: position,
        possibleMoves: moves,
      });
      return;
    }

    // If square already selected
    if (gameState.selectedSquare) {
      const isValidMove = (gameState.possibleMoves || []).some(
        m => m.row === row && m.col === col
      );

      if (isValidMove) {
        executeMove(gameState.selectedSquare, position);
      } else if (piece && piece.color === myColor) {
        const moves = getPossibleMoves(gameState.board, position);
        setGameState({
          ...gameState,
          selectedSquare: position,
          possibleMoves: moves,
        });
      } else {
        setGameState({
          ...gameState,
          selectedSquare: null,
          possibleMoves: [],
        });
      }
    }
  };

  const executeMove = (from: Position, to: Position) => {
    if (!gameState) return;

    console.log('🎯 Executing move:', {from, to, myColor, currentTurn});

    const newBoard = makeChessMove(gameState.board, {from, to});
    const nextPlayer = myColor === 'white' ? 'black' : 'white';

    const isCheck = isKingInCheck(newBoard, nextPlayer);
    const isCheckMate = isCheckmate(newBoard, nextPlayer);
    const drawReason = getDrawReason(newBoard, nextPlayer);
    const isStaleMate = drawReason !== null;

    setGameState({
      ...gameState,
      board: newBoard,
      currentPlayer: nextPlayer,
      selectedSquare: null,
      possibleMoves: [],
      isCheck,
      isCheckmate: isCheckMate,
      isStalemate: isStaleMate,
      drawReason,
    });

    // Send move to server — use ref to avoid stale roomId
    const move: GameMove = {from, to};
    const liveRoomId = roomIdRef.current || roomId;
    if (!liveRoomId) {
      BisetkaAlert.error('Move Error', 'Missing room id. Please rejoin the match.');
      return;
    }
    console.log('📤 Sending move to server:', {roomId: liveRoomId, userId, move});
    socketService.makeMove(liveRoomId, userId, move);
    
    setCurrentTurn(nextPlayer);
    setIsMyTurn(false);
    console.log('✅ Move executed locally, turn switched to:', nextPlayer);

    if (isCheckMate) {
      BisetkaAlert.success('Checkmate!', 'You win!', [
        {text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'chess-multiplayer'})},
      ]);
    } else if (isStaleMate) {
      BisetkaAlert.alert(
        drawReason === 'insufficient-material' ? 'Draw!' : 'Stalemate!',
        drawReason === 'insufficient-material' ? 'Only the two kings remain. The game is a draw.' : 'The game is a draw.',
        [
        {text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'chess-multiplayer'})},
        ]
      );
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
          navigation.replace('GameMode', {gameType: 'chess-multiplayer'});
        },
      },
    ]);
  };

  const renderMenu = () => (
    <View style={styles.menuContainer}>
      <Text style={styles.title}>Multiplayer Chess</Text>
      
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

  return (
    <View style={styles.container}>
      <AraratBackground overlayOpacity={showBlur ? 0.5 : 0.3}>
        <AR3DOverlay
          ref={arOverlayRef}
          visible={arEnabled}
          pieces={arPieces}
          moves={gameState?.possibleMoves || []}
          boardGlbPath="glb/chess/ChessSet.glb"
          boardGlbHasEmbeddedChessPieces
          pieceColorBlack="#dc2626"
          hideCheckerboard={true}
          boardFixed
          boardFixedZoom={0.6}
          boardTiltX={0.1745}
          boardY={-0.35}
          tableDist={0.50}
          boardScale={0.8}
          onSquareTap={handleSquarePress}
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

          {mode === 'game' && gameState && (
            <>
              {/* Status bar */}
              <View style={styles.statusBar}>
                {isSpectating ? (
                  <Text style={styles.turnText}>👁️ Spectating</Text>
                ) : (
                  <Text style={styles.turnText}>
                    {isMyTurn ? '♟ Your Turn' : "⏳ Opponent's Turn"}
                  </Text>
                )}
                <Text style={styles.colorText}>
                  {myColor === 'white' ? '🔴 Red' : '⚫ Black'}
                </Text>
                {gameState.isCheck && <Text style={styles.checkText}>CHECK!</Text>}
              </View>

              {/* Game over overlay */}
              {(gameState.isCheckmate || gameState.isStalemate) && (
                <View style={styles.gameOverOverlay}>
                  <View style={styles.gameOverBox}>
                    <Text style={styles.gameOverTitle}>
                      {gameState.isCheckmate ? 'Checkmate!' : gameState.drawReason === 'insufficient-material' ? 'Draw!' : 'Stalemate!'}
                    </Text>
                    <Text style={styles.gameOverText}>
                      {gameState.isCheckmate
                        ? currentTurn !== myColor
                          ? 'You Win! 🏆'
                          : 'Opponent Wins'
                        : gameState.drawReason === 'insufficient-material'
                          ? 'Only kings remain. The game is a draw.'
                          : "It's a Draw!"}
                    </Text>
                    <TouchableOpacity
                      style={styles.playAgainButton}
                      onPress={() =>
                        navigation.replace('GameMode', {gameType: 'chess-multiplayer'})
                      }>
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

          {/* In-game chat overlay */}
          <InGameChat
            roomId={roomId}
            currentUserId={userId}
            gameType="chess"
            visible={mode === 'game' && !!gameState && !!roomId}
          />

           {/* Resign */}
              <View style={styles.controls}>
                <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
                  <Text style={styles.resignButtonText}>Resign</Text>
                </TouchableOpacity>
              </View>

          {/* Room Name Editor Modal */}
          <RoomNameModal
            visible={showRoomNameModal}
            onClose={() => setShowRoomNameModal(false)}
            currentName={roomName}
            onSave={handleSaveRoomName}
            gameType="Chess"
          />
        </SafeAreaView>
      </View>

      {/* Join Room Modal */}
      <Modal
        visible={showJoinModal}
        transparent={true}
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
        gameType="chess"
        initialTheme={gameTheme}
      />
      <SyncedYouTubePlayer
        roomId={mode === 'game' && roomId ? roomId : null}
        visible={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Shell ──────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  // ── Menu / waiting screens ────────────────────────────────────────────────
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
  // ── Status bar ────────────────────────────────────────────────────────────
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
  checkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  // ── Board ─────────────────────────────────────────────────────────────────
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
    paddingHorizontal: 52,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  square: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  selectedSquare: {
    backgroundColor: 'rgba(127, 166, 80, 0.6)',
  },
  possibleMoveSquare: {
    backgroundColor: 'rgba(127, 166, 80, 0.4)',
  },
  moveIndicator: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  // ── Controls ──────────────────────────────────────────────────────────────
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
  // ── Game over overlay ─────────────────────────────────────────────────────
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
  // ── Join modal ────────────────────────────────────────────────────────────
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
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  modalCancelButton: {
    backgroundColor: '#eee',
  },
  modalJoinButton: {
    backgroundColor: '#FFD700',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1C1917',
  },
  recenterBtn: { position:'absolute', bottom:200, alignSelf:'center', left:'50%', transform:[{translateX:-54}], flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(0,0,0,0.35)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)', borderRadius:24, paddingHorizontal:18, paddingVertical:10 },
  recenterIcon: { fontSize:20, color:'#fff' },
  recenterLabel: { fontSize:13, color:'#fff', fontWeight:'600', letterSpacing:0.3 },
});

export default MultiplayerChessScreen;
