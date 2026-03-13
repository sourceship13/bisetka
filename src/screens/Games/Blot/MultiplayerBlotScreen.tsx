import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ImageBackground,
  Image,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { socketService } from '../../../services/SocketService';
import { blotAIService, LocalGameState, Card } from '../../../services/blotAI.service';
import { gameResultService } from '../../../services/gameResult.service';
import { aiMoveLogService } from '../../../services/aiMoveLog.service';
import tokenService from '../../../services/token.service';
import { v4 as uuidv4 } from 'uuid';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import CardHandFan from '../../../components/CardHandFan';
import DynamicCard from '../../../components/DynamicCard';
import InGameChat from '../../../components/InGameChat';
import GameToolbar from '../../../components/global/GameToolbar';
import RoomNameModal from '../../../components/RoomNameModal';
import RoomInfoDrawer from '../../../components/RoomInfoDrawer';
import type { RoomInfoDrawerHandle } from '../../../components/RoomInfoDrawer';
import {apiConfig} from '../../../libs/utils/api.utils';
import CardCustomizationModal from '../../../components/global/GameCustomizationModal';
import type { CardTheme } from '../../../components/global/GameCustomizationModal';
import ExpandableView from '../../../components/global/ExpandableView';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface GameState {
  deck: Card[];
  player1Hand: Card[];
  player2Hand: Card[];
  cpuWhiteHand?: Card[];
  cpuBlackHand?: Card[];
  currentTrick: Card[];
  trumpSuit: string | null;
  player1Score: number;
  player2Score: number;
  round: number;
  // 4-player team mode extensions
  hands?: Card[][];          // indexed by position 0-3
  myHand?: Card[];           // this player's hand (server-filtered)
  whiteScore?: number;
  blackScore?: number;
  currentTurn?: number | string; // number in 4p mode, string in 2p mode
}

const MultiplayerBlotScreen = ({ navigation, route }: any) => {
  const userId = route.params?.userId || route.params?.session?.id || route.params?.session?.userId || 'test-user-' + Math.random().toString(36).substr(2, 9);
  const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'blot');
  const initialMode = route.params?.mode; // 'ai', 'private-create', 'private-join', 'random', 'join-from-lobby', 'spectate', 'replace-ai'
  const initialDifficulty = route.params?.difficulty || 'medium';
  const initialJoinCode = route.params?.joinCode;
  const teamMode = route.params?.teamMode; // 'hybrid' | 'full-multiplayer'
  const dbSessionId: string | undefined = route.params?.dbSessionId;
  const allowReplaceAI: boolean = route.params?.allowReplaceAI || false;
  const [isSpectating, setIsSpectating] = useState(false);
  
  // Determine initial gameMode based on navigation params
  const getInitialGameMode = () => {
    if (initialMode === 'ai') return 'local';
    if (initialMode === 'private-create') return 'private';
    if (initialMode === 'private-join') return 'matchmaking';
    if (initialMode === 'random') return 'matchmaking';
    if (initialMode === 'join-from-lobby') return 'matchmaking';
    if (initialMode === 'spectate') return 'matchmaking';
    if (initialMode === 'replace-ai') return 'matchmaking';
    return 'menu';
  };
  
  const [gameMode, setGameMode] = useState<'menu' | 'matchmaking' | 'private' | 'game' | 'local'>(
    getInitialGameMode()
  );
  const [roomCode, setRoomCode] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localGameState, setLocalGameState] = useState<LocalGameState | null>(null);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  // Ref so socket callbacks can always read the latest playerColor without stale closures
  const roomIdRef = useRef<string | null>(null);
  // Keep roomIdRef in sync with currentRoom
  useEffect(() => { roomIdRef.current = currentRoom?.roomId ?? null; }, [currentRoom]);
  const playerColorRef = useRef<'white' | 'black'>('white');
  // 4-player team mode: position 0-3 (0,2=white; 1,3=black). null = 2-player mode.
  const [playerPosition, setPlayerPosition] = useState<number | null>(null);
  const playerPositionRef = useRef<number | null>(null);
  // CPU replacement role: set when this player replaced a CPU via replace-ai
  const [myCpuRole, setMyCpuRole] = useState<string | null>(null);
  const myCpuRoleRef = useRef<string | null>(null);
  const updateMyCpuRole = (role: string | null) => {
    myCpuRoleRef.current = role;
    setMyCpuRole(role);
  };
  // Blocks a second card tap until the server acknowledges the current move
  const moveInFlightRef = useRef(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [opponent, setOpponent] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const isGameStartedRef = useRef(false);
  const [isLocalGame, setIsLocalGame] = useState(false);
  const [isReadySent, setIsReadySent] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [roomName, setRoomName] = useState('Multiplayer Blot');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [customTheme, setCustomTheme] = useState<CardTheme | undefined>(undefined);
  const [showBackground, setShowBackground] = useState(true);
  const [showBlur, setShowBlur] = useState(true);
  const toolbarExpanded = useSharedValue(false);
  const roomInfoRef = useRef<RoomInfoDrawerHandle>(null);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));

  // Load saved theme from storage on mount
  useEffect(() => {
    AsyncStorage.getItem('blot_card_theme').then((stored) => {
      if (stored) {
        try { setCustomTheme(JSON.parse(stored)); } catch {}
      }
    });
  }, []);
  const roomNameRef = useRef(roomName);
  useEffect(() => { roomNameRef.current = roomName; }, [roomName]);

  const gameStartTime = useRef<Date | null>(null);
  const blotGameIdRef = useRef<string>(uuidv4());
  const trickCountRef = useRef(0);
  const lastPlayerCardRef = useRef<Card | null>(null);

  // Helper: set playerColor and keep ref in sync
  const updatePlayerColor = (color: 'white' | 'black') => {
    playerColorRef.current = color;
    setPlayerColor(color);
  };
  // Helper: set playerPosition and keep ref in sync
  const updatePlayerPosition = (pos: number | null) => {
    playerPositionRef.current = pos;
    setPlayerPosition(pos);
  };

  // SUIT constants for table UI
  const SUIT_ICON: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };
  const SUIT_NAME: Record<string, string> = {
    hearts: 'Hearts',
    diamonds: 'Diamonds',
    clubs: 'Clubs',
    spades: 'Spades',
  };
  const SUIT_COLOR: Record<string, string> = {
    hearts: '#e74c3c',
    diamonds: '#e74c3c',
    clubs: '#ecf0f1',
    spades: '#ecf0f1',
  };

  // Handle computer's turn when it needs to lead a trick (e.g., after winning a trick)
  useEffect(() => {
    if (!isLocalGame || !localGameState || localGameState.status !== 'active') return;
    
    // Computer should move when it's their turn and the trick is empty (leading)
    if (localGameState.currentTurn === 'computer' && localGameState.currentTrick.length === 0) {
      const timer = setTimeout(() => {
        setLocalGameState(prevState => {
          if (!prevState || prevState.currentTurn !== 'computer' || prevState.currentTrick.length !== 0) {
            return prevState;
          }
          const stateAfterComputer = blotAIService.computerMove(prevState);
          // Check if game ended after computer move
          if (stateAfterComputer.status !== 'active') {
            handleLocalGameEnd(stateAfterComputer);
          }
          return stateAfterComputer;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [localGameState, isLocalGame]);

  useEffect(() => {
    // If mode is 'ai', auto-start the AI game immediately (no socket needed)
    if (initialMode === 'ai') {
      setDifficulty(initialDifficulty);
      setIsLocalGame(true);
      // Reset logging refs for new game
      blotGameIdRef.current = uuidv4();
      trickCountRef.current = 0;
      lastPlayerCardRef.current = null;
      const newGame = blotAIService.initializeGame();
      setLocalGameState(newGame);
      setIsGameStarted(true);
      gameStartTime.current = new Date();
      // Don't connect to socket for AI games
      return;
    }
    
    // Connect socket and then perform initial actions
    const initializeMultiplayer = async () => {
      try {
        await connectSocket();
        
        // Auto-create private room if coming from GameModeScreen with private-create mode
        if (initialMode === 'private-create') {
          await createPrivateRoomOnMount();
        }
        
        // Auto-join private room if coming from GameModeScreen with private-join mode
        if (initialMode === 'private-join' && initialJoinCode) {
          await joinPrivateRoomOnMount();
        }
        
        // Auto-find match if coming with random mode
        if (initialMode === 'random') {
          await findMatchOnMount();
        }

        // Join a waiting room directly from the Active Rooms lobby
        if (initialMode === 'join-from-lobby' && dbSessionId) {
          const socket = socketService.getSocket();
          if (socket) {
            socket.once('room_joined', (data: any) => {
              socket.off('spectate_started');
              setCurrentRoom({ roomId: data.roomId });
              setPlayerColor(data.color ?? 'black');
              setOpponent(data.opponent);
              setIsMyTurn((data.color ?? 'black') === 'white');
              setGameMode('game');
            });
            // Fallback: server may send spectate_started if game already in progress
            socket.once('spectate_started', (data: any) => {
              socket.off('room_joined');
              setIsSpectating(true);
              setCurrentRoom({ roomId: data.roomId });
              if (data.gameState) setGameState(data.gameState);
              setIsGameStarted(true);
              isGameStartedRef.current = true;
              setGameMode('game');
            });
          }
          socketService.joinRoomBySession(dbSessionId, userId);
        }

        // Spectate an in-progress room from the Active Rooms lobby
        if (initialMode === 'spectate' && dbSessionId) {
          try {
            const data = await socketService.spectateRoom(dbSessionId, userId, route.params?.session?.displayName);
            setIsSpectating(true);
            setCurrentRoom({ roomId: data.roomId });
            if (data.gameState) setGameState(data.gameState);
            setIsGameStarted(true);
            isGameStartedRef.current = true;
            setGameMode('game');
          } catch (err: any) {
            BisetkaAlert.error('Error', err.message || 'Could not connect to this game.');
            setGameMode('menu');
          }
        }

        // Replace an AI (CPU) player in a regular Blot room
        if (initialMode === 'replace-ai' && dbSessionId) {
          const socket = socketService.getSocket();
          if (socket) {
            socket.emit('replace_ai_player', {
              dbSessionId,
              userId,
              displayName: route.params?.session?.displayName || 'Player',
            });
            // The backend will emit game_started with cpuRole — handled by onGameStarted listener
          }
        }
      } catch (error) {
        console.error('Failed to initialize multiplayer:', error);
        // Connection error alert is already shown in connectSocket
        setGameMode('menu');
      }
    };
    
    initializeMultiplayer();

    return () => {
      socketService.removeAllListeners();
    };
  }, []);

  const connectSocket = async () => {
    try {
      setIsConnecting(true);
      const token = await tokenService.getAccessToken();
      if (!token) {
        BisetkaAlert.error('Authentication Error', 'Please log in to play multiplayer games');
        navigation.goBack();
        return;
      }
      await socketService.connect(userId, token);
      setupSocketListeners();
    } catch (error) {
      console.error('Socket connection error:', error);
      BisetkaAlert.error('Connection Error', 'Failed to connect to server');
      throw error; // Re-throw to handle in calling function
    } finally {
      setIsConnecting(false);
    }
  };

  const ensureSocketConnected = async () => {
    if (!socketService.isConnected()) {
      await connectSocket();
    }
  };

  const setupSocketListeners = () => {
    // Room name updates from other players
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('room_name_updated', (data: { roomId: string; dbSessionId?: string; roomName: string }) => {
        if (data.roomId === roomIdRef.current || data.dbSessionId === roomIdRef.current) {
          setRoomName(data.roomName);
        }
      });
      // Spectator state updates (hand-stripped game state) — only apply for spectators
      socket.on('spectate_state_update', (data: any) => {
        if (initialMode === 'spectate' && data.gameState) setGameState(data.gameState);
      });
    }

    // Opponent joined
    socketService.onOpponentJoined((data: any) => {
      console.log('Opponent joined:', data);
      setOpponent(data.opponent);
      setGameMode('game'); // Transition to game mode
    });

    // Game started
    socketService.onGameStarted((data: any) => {
      console.log('=== GAME STARTED ===');
      console.log('Game started data:', data);

      if (isGameStartedRef.current) {
        console.log('⚠️ Duplicate game_started event ignored');
        return;
      }
      isGameStartedRef.current = true;

      // ── 4-player team blot ──────────────────────────────────────────────
      if (data.gameType === 'blot-teams' && data.myPosition !== undefined) {
        updatePlayerPosition(data.myPosition);
        updatePlayerColor(data.myTeam ?? 'white');
        setGameState(data.gameState);
        setGameMode('game');
        setIsGameStarted(true);
        setIsMyTurn(data.gameState?.currentTurn === data.myPosition);
        return;
      }
      // ────────────────────────────────────────────────────────────────────

      const myColor: 'white' | 'black' = data.myColor
        ? data.myColor
        : (data.player1?.id === userId ? 'white' : 'black');
      console.log('✅ My color (from server):', myColor, '| gameState.currentTurn:', data.gameState?.currentTurn);

      updatePlayerColor(myColor);

      // If this player replaced a CPU, store the cpuRole for turn detection
      if (data.cpuRole) {
        updateMyCpuRole(data.cpuRole);
        // Merge myHand into gameState for rendering
        if (data.myHand) {
          setGameState({ ...data.gameState, myHand: data.myHand });
        } else {
          setGameState(data.gameState);
        }
        setCurrentRoom({ roomId: data.roomId });
      } else {
        setGameState(data.gameState);
      }
      setGameMode('game');
      setIsGameStarted(true);
      setIsMyTurn(
        data.cpuRole
          ? data.gameState?.currentTurn === data.cpuRole
          : data.gameState?.currentTurn === myColor
      );
    });

    // Move made
    socketService.onMoveMade((data: any) => {
      console.log('=== MOVE MADE ===');
      // Server has acknowledged the move — allow the next card to be played
      moveInFlightRef.current = false;

      // 4-player team blot: currentTurn is a position number
      const pos = playerPositionRef.current;
      const cpuRole = myCpuRoleRef.current;
      const myTurn = pos !== null
        ? data.gameState?.currentTurn === pos
        : cpuRole
          ? data.currentTurn === cpuRole
          : data.currentTurn === playerColorRef.current;

      setIsMyTurn(myTurn);
      setGameState(data.gameState);
      // In 4p mode or replacement mode: merge myHand into gameState for rendering
      if ((pos !== null || cpuRole) && data.myHand) {
        setGameState((prev: any) => prev ? { ...prev, myHand: data.myHand } : prev);
      }
      setSelectedCard(null);
    });

    // Game ended
    socketService.onGameEnded((data: any) => {
      console.log('Game ended:', data);
      const isWinner = data.winnerId === userId;
      if (isWinner) {
        BisetkaAlert.success(
          'Game Over!',
          'You won! 🎉',
          [{ text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'blot'}) }]
        );
      } else {
        BisetkaAlert.error(
          'Game Over!',
          'You lost. Better luck next time!',
          [{ text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'blot'}) }]
        );
      }
    });

    // Opponent disconnected
    socketService.onOpponentDisconnected(() => {
      BisetkaAlert.warning('Opponent Disconnected', 'Your opponent has disconnected from the game.');
    });

    // Matchmaking status
    socketService.onMatchmakingStatus((data: any) => {
      if (data.status === 'cancelled') {
        navigation.replace('GameMode', {gameType: 'blot'});
      }
    });

    // Errors
    socketService.onError((error: any) => {
      BisetkaAlert.error('Error', error.message || 'An error occurred');
    });
  };

  const handlePlayVsComputer = () => {
    setShowDifficultyModal(true);
  };

  const startLocalGame = (selectedDifficulty: 'easy' | 'medium' | 'hard') => {
    setDifficulty(selectedDifficulty);
    setIsLocalGame(true);
    setGameMode('local');
    // Reset logging refs for new game
    blotGameIdRef.current = uuidv4();
    trickCountRef.current = 0;
    lastPlayerCardRef.current = null;
    const newGame = blotAIService.initializeGame();
    setLocalGameState(newGame);
    setIsGameStarted(true);
    setShowDifficultyModal(false);
    gameStartTime.current = new Date();
    BisetkaAlert.alert('Local Game', `Playing against Computer (${selectedDifficulty})!`);
  };

  const handleFindMatch = async () => {
    setGameMode('matchmaking');
    
    // Reset all game state before starting new match
    setGameState(null);
    isGameStartedRef.current = false;
    setIsGameStarted(false);
    setIsReadySent(false);
    setIsMyTurn(false);
    setSelectedCard(null);
    setCurrentRoom(null);
    setOpponent(null);
    
    try {
      await ensureSocketConnected();
      const isTeams = teamMode === 'full-multiplayer';
      const matchData = await socketService.findMatch(isTeams ? 'blot-teams' : 'blot', userId, allowReplaceAI || undefined);
      console.log('Match found data:', matchData);
      setCurrentRoom({ roomId: matchData.roomId });
      if (isTeams) {
        updatePlayerPosition(matchData.position ?? 0);
        updatePlayerColor(matchData.team ?? 'white');
        setIsMyTurn((matchData.position ?? 0) === 0);
      } else {
        setPlayerColor(matchData.color);
        setOpponent(matchData.opponent);
        setIsMyTurn(matchData.color === 'white');
      }
      
      // Don't auto-ready, let user click the button
      setGameMode('game');
    } catch (error: any) {
      BisetkaAlert.error('Matchmaking Error', error.message || 'Failed to find match');
      setGameMode('menu');
    }
  };

  const handleCancelMatchmaking = () => {
    socketService.cancelMatchmaking(userId);
    navigation.replace('GameMode', {gameType: 'blot'});
  };

  // Auto-create private room when navigating with private-create mode
  const createPrivateRoomOnMount = async () => {
    // Reset all game state
    setGameState(null);
    isGameStartedRef.current = false;
    setIsGameStarted(false);
    setIsReadySent(false);
    setIsMyTurn(false);
    setSelectedCard(null);
    setOpponent(null);
    
    try {
      await ensureSocketConnected();
      const roomData = await socketService.createPrivateRoom('blot', userId, initialJoinCode);
      setCurrentRoom({ roomId: roomData.roomId, roomCode: roomData.roomCode });
      setRoomCode(roomData.roomCode);
      setPlayerColor('white');
    } catch (error: any) {
      BisetkaAlert.error('Error', 'Failed to create room');
      setGameMode('menu');
      console.error(error);
    }
  };
  
  // Auto-join private room when navigating with private-join mode
  const joinPrivateRoomOnMount = async () => {
    setGameState(null);
    isGameStartedRef.current = false;
    setIsGameStarted(false);
    setIsReadySent(false);
    setIsMyTurn(false);
    setSelectedCard(null);
    setCurrentRoom(null);
    setOpponent(null);

    try {
      await ensureSocketConnected();
      const roomData = await socketService.joinPrivateRoom(initialJoinCode!, userId);
      setCurrentRoom({ roomId: roomData.roomId });
      setPlayerColor(roomData.color || 'black');
      setOpponent(roomData.opponent);
      setIsMyTurn((roomData.color || 'black') === 'white');
      setGameMode('game'); // Exit matchmaking — show game screen with "Ready to Play"
    } catch (error: any) {
      BisetkaAlert.error('Error', 'Failed to join room. Check the code and try again.');
      setGameMode('menu');
      console.error(error);
    }
  };

  // Auto-find match when navigating with random mode
  const findMatchOnMount = async () => {
    setGameState(null);
    isGameStartedRef.current = false;
    setIsGameStarted(false);
    setIsReadySent(false);
    setIsMyTurn(false);
    setSelectedCard(null);
    setCurrentRoom(null);
    setOpponent(null);
    
    try {
      await ensureSocketConnected();
      const isTeams = teamMode === 'full-multiplayer';
      const matchData = await socketService.findMatch(isTeams ? 'blot-teams' : 'blot', userId, allowReplaceAI || undefined);
      if (isTeams) {
        updatePlayerPosition(matchData.position ?? 0);
        updatePlayerColor(matchData.team ?? 'white');
        setIsMyTurn((matchData.position ?? 0) === 0);
      } else {
        setCurrentRoom({ roomId: matchData.roomId });
        setPlayerColor(matchData.color);
        setOpponent(matchData.opponent);
        setIsMyTurn(matchData.color === 'white');
      }
      setCurrentRoom({ roomId: matchData.roomId });
      setGameMode('game');
    } catch (error: any) {
      BisetkaAlert.error('Matchmaking Error', error.message || 'Failed to find match');
      setGameMode('menu');
    }
  };

  const handleCreatePrivateRoom = async () => {
    setGameMode('private');
    
    // Reset all game state before creating new room
    setGameState(null);
    isGameStartedRef.current = false;
    setIsGameStarted(false);
    setIsReadySent(false);
    setIsMyTurn(false);
    setSelectedCard(null);
    setOpponent(null);
    
    try {
      await ensureSocketConnected();
      const roomData = await socketService.createPrivateRoom('blot', userId);
      setCurrentRoom({ roomId: roomData.roomId, roomCode: roomData.roomCode });
      setRoomCode(roomData.roomCode);
      setPlayerColor('white');
    } catch (error: any) {
      BisetkaAlert.error('Error', 'Failed to create room');
      setGameMode('menu');
      console.error(error);
    }
  };

  const handleJoinPrivateRoom = async () => {
    if (!joinRoomCode.trim()) {
      BisetkaAlert.error('Error', 'Please enter a room code');
      return;
    }
    
    // Reset all game state before joining room
    setGameState(null);
    isGameStartedRef.current = false;
    setIsGameStarted(false);
    setIsReadySent(false);
    setIsMyTurn(false);
    setSelectedCard(null);
    
    try {
      await ensureSocketConnected();
      const roomData = await socketService.joinPrivateRoom(joinRoomCode.toUpperCase(), userId);
      setCurrentRoom({ roomId: roomData.roomId });
      setPlayerColor(roomData.color);
      setOpponent(roomData.opponent);
      setIsMyTurn(roomData.color === 'white');
      
      // Don't auto-ready, let user click the button
      setGameMode('game');
      setShowJoinModal(false);
    } catch (error: any) {
      BisetkaAlert.error('Error', error.message || 'Failed to join room');
    }
  };

  const handlePlayerReady = () => {
    console.log('handlePlayerReady called');
    console.log('currentRoom:', currentRoom);
    console.log('userId:', userId);
    
    if (!currentRoom?.roomId) {
      console.error('Cannot send player_ready: roomId is missing');
      BisetkaAlert.error('Error', 'Room ID is missing. Please try rejoining.');
      return;
    }

    if (isReadySent) {
      console.log('player_ready already sent, ignoring duplicate tap');
      return;
    }

    console.log('Sending player_ready to backend:', currentRoom.roomId, userId);
    setIsReadySent(true);
    socketService.playerReady(currentRoom.roomId, userId);
  };

  const handleSaveRoomName = async (newName: string) => {
    try {
      setRoomName(newName);
      if (currentRoom?.roomId) {
        socketService.setRoomName(currentRoom.roomId, newName);
      }
      BisetkaAlert.success('Success', 'Room name updated!');
    } catch (error) {
      console.error('Failed to update room name:', error);
      BisetkaAlert.error('Error', 'Failed to update room name');
    }
  };

  const handleSaveTheme = (theme: CardTheme) => {
    const urls = [theme.boardImage, theme.backgroundImage].filter(Boolean) as string[];
    if (urls.length > 0) {
      Promise.all(urls.map(url => Image.prefetch(url).catch(() => {})))
        .then(() => {
          setCustomTheme({...theme});
          AsyncStorage.setItem('blot_card_theme', JSON.stringify(theme));
        });
    } else {
      setCustomTheme({...theme});
      AsyncStorage.setItem('blot_card_theme', JSON.stringify(theme));
    }
  };

  // Room name listener — registered after socket connects (inside mp setup)

  const handlePlayCard = (card: Card) => {
    if (isSpectating) return;
    if (isLocalGame) {
      handleLocalPlayCard(card);
    } else {
      handleMultiplayerPlayCard(card);
    }
  };

  const handleLocalPlayCard = (card: Card) => {
    if (!localGameState || localGameState.currentTurn !== 'player') return;

    setSelectedCard(card);
    lastPlayerCardRef.current = card;
    
    // Capture state before player move
    const playerHandBefore = [...localGameState.playerHand];
    const aiHandBefore = [...localGameState.computerHand];
    const trumpSuit = localGameState.trumpSuit;
    
    // Player plays card
    let newState = blotAIService.playCard(localGameState, card);
    setLocalGameState(newState);

    // Check if game ended
    if (newState.status !== 'active') {
      handleLocalGameEnd(newState);
      return;
    }

    // Computer's turn
    if (newState.currentTurn === 'computer') {
      setTimeout(() => {
        const stateAfterComputer = blotAIService.computerMove(newState);
        
        // Find AI card played (the one added to currentTrick by AI)
        const aiCard = stateAfterComputer.currentTrick.length > 0 
          ? stateAfterComputer.currentTrick[stateAfterComputer.currentTrick.length - 1]
          : null;
        
        // Log the trick
        if (lastPlayerCardRef.current && aiCard) {
          trickCountRef.current++;
          const trickWinner = stateAfterComputer.currentTrick.length === 0 
            ? (stateAfterComputer.currentTurn === 'player' ? 'computer' : 'player')
            : undefined;
          
          aiMoveLogService.logBlotMove({
            gameId: blotGameIdRef.current,
            trickNumber: trickCountRef.current,
            playerCard: lastPlayerCardRef.current,
            aiCard: aiCard,
            trickWinner: trickWinner,
            trumpSuit: trumpSuit || undefined,
            playerHandBefore,
            aiHandBefore,
            playerScoreAfter: stateAfterComputer.playerScore,
            aiScoreAfter: stateAfterComputer.computerScore,
            difficulty,
          });
          lastPlayerCardRef.current = null;
        }
        
        setLocalGameState(stateAfterComputer);
        
        // Check if game ended after computer move
        if (stateAfterComputer.status !== 'active') {
          handleLocalGameEnd(stateAfterComputer);
        }
      }, 1000); // Delay for better UX
    }
  };

  const handleMultiplayerPlayCard = (card: Card) => {
    if (!isMyTurn || !currentRoom?.roomId) {
      console.log('Cannot play card - not my turn or no room');
      return;
    }

    // Prevent double-play while waiting for server acknowledgement
    if (moveInFlightRef.current) {
      console.log('Cannot play card - move already in flight');
      return;
    }
    moveInFlightRef.current = true;

    setSelectedCard(card);
    
    const move = { card, playerId: userId } as any;
    console.log('Sending move to backend:', move);
    socketService.makeMove(currentRoom.roomId, userId, move);
  };

  const handleLocalGameEnd = async (finalState: LocalGameState) => {
    const isWinner = finalState.winnerId === 'player';
    const isDraw = finalState.status === 'draw';
    
    // Calculate duration
    const durationSeconds = gameStartTime.current 
      ? Math.floor((new Date().getTime() - gameStartTime.current.getTime()) / 1000)
      : undefined;

    // Record game result to backend
    const result = isDraw ? 'draw' : (isWinner ? 'win' : 'loss');
    const gameResultResponse = await gameResultService.recordGameResult({
      gameType: 'blot',
      gameMode: 'ai',
      result,
      difficulty,
      playerScore: finalState.playerScore,
      opponentScore: finalState.computerScore,
      durationSeconds,
      startedAt: gameStartTime.current || undefined,
    });
    refreshOnGameEnd().catch(console.error);

    const pointsMessage = gameResultResponse?.pointsEarned 
      ? `\n+${gameResultResponse.pointsEarned} points earned!`
      : '';
    
    const gameOverMessage = (isDraw 
      ? "It's a draw!" 
      : isWinner 
        ? 'You won! 🎉' 
        : 'Computer won. Better luck next time!') + pointsMessage;
    const gameOverButtons = [{ 
      text: 'Play Again', 
      onPress: () => {
        // Reset logging refs for new game
        blotGameIdRef.current = uuidv4();
        trickCountRef.current = 0;
        lastPlayerCardRef.current = null;
        const newGame = blotAIService.initializeGame();
        setLocalGameState(newGame);
        gameStartTime.current = new Date();
      }
    },
    { 
      text: 'Main Menu', 
      onPress: () => {
        setIsLocalGame(false);
        setLocalGameState(null);
        navigation.replace('GameMode', {gameType: 'blot'});
      }
    }];
    if (isDraw) {
      BisetkaAlert.alert('Game Over!', gameOverMessage, gameOverButtons);
    } else if (isWinner) {
      BisetkaAlert.success('Game Over!', gameOverMessage, gameOverButtons);
    } else {
      BisetkaAlert.error('Game Over!', gameOverMessage, gameOverButtons);
    }
  };

  const handleResign = () => {
    BisetkaAlert.warning(
      'Resign',
      'Are you sure you want to resign?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resign',
          style: 'destructive',
          onPress: async () => {
            if (isLocalGame) {
              // Record resignation for AI game
              const durationSeconds = gameStartTime.current 
                ? Math.floor((new Date().getTime() - gameStartTime.current.getTime()) / 1000)
                : undefined;
              
              await gameResultService.recordGameResult({
                gameType: 'blot',
                gameMode: 'ai',
                result: 'resigned',
                difficulty,
                playerScore: localGameState?.playerScore || 0,
                opponentScore: localGameState?.computerScore || 0,
                durationSeconds,
                startedAt: gameStartTime.current || undefined,
              });
              refreshOnGameEnd().catch(console.error);

              setIsLocalGame(false);
              setLocalGameState(null);
              navigation.replace('GameMode', {gameType: 'blot'});
            } else if (currentRoom?.roomId) {
              socketService.resign(currentRoom.roomId, userId);
              navigation.replace('GameMode', {gameType: 'blot'});
            }
          },
        },
      ]
    );
  };

  const renderCard = (card: Card, index: number, isTrickCard = false) => {
    const canPlay = isLocalGame
      ? (localGameState?.currentTurn === 'player')
      : isMyTurn && !moveInFlightRef.current;

    if (index === 0) {
      console.log(`renderCard - isMyTurn: ${isMyTurn}, canPlay: ${canPlay}, isLocalGame: ${isLocalGame}`);
    }

    return (
      <TouchableOpacity
        key={index}
        style={[
          isTrickCard ? styles.trickCard : styles.card,
          selectedCard === card && styles.selectedCard,
          !canPlay && styles.disabledCard,
        ]}
        onPress={() => handlePlayCard(card)}
        disabled={!canPlay}
      >
        <DynamicCard
          card={card}
          size={isTrickCard ? 'small' : 'medium'}
          theme={customTheme}
        />
      </TouchableOpacity>
    );
  };

  const renderMenu = () => (
    <View style={styles.menuContainer}>
      <Text style={styles.title}>Blot Game</Text>
      <Text style={styles.userId}>Player ID: {userId}</Text>

      {isConnecting ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <>
          <TouchableOpacity style={[styles.button, styles.localButton]} onPress={handlePlayVsComputer}>
            <Text style={styles.buttonText}>🤖 Play vs Computer</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleFindMatch}>
            <Text style={styles.buttonText}>🎮 Find Random Match</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleCreatePrivateRoom}>
            <Text style={styles.buttonText}>🔒 Create Private Room</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => setShowJoinModal(true)}>
            <Text style={styles.buttonText}>🔗 Join Private Room</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.backButton]}
            onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>← Back</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderMatchmaking = () => (
    <View style={styles.menuContainer}>
      <Text style={styles.title}>Finding Match...</Text>
      <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      <TouchableOpacity style={styles.cancelButton} onPress={handleCancelMatchmaking}>
        <Text style={styles.buttonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPrivateRoom = () => (
    <View style={styles.menuContainer}>
      <Text style={styles.title}>Private Room</Text>
      {roomCode && (
        <>
          <Text style={styles.roomCodeLabel}>Room Code:</Text>
          <Text style={styles.roomCodeText}>{roomCode}</Text>
          <Text style={styles.waitingText}>Waiting for opponent to join...</Text>
        </>
      )}
      <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLocalGame = () => {
    if (!localGameState) return null;

    const { width, height } = Dimensions.get('window');
    const TABLE_SIZE = Math.min(width - 32, height * 0.4);

    return (
      <View style={styles.gameContainer}>
        <View style={styles.scoreBoard}>
          <View style={styles.teamScore}>
            <Text style={styles.teamLabel}>You</Text>
            <Text style={styles.score}>{localGameState.playerScore}</Text>
          </View>
          {localGameState.trumpSuit && (
            <View style={styles.trumpDisplay}>
              <Text style={styles.trumpLabel}>Trump</Text>
              <Text style={styles.trumpSuit}>
                {localGameState.trumpSuit === 'hearts' ? '♥' :
                 localGameState.trumpSuit === 'diamonds' ? '♦' :
                 localGameState.trumpSuit === 'clubs' ? '♣' : '♠'}
              </Text>
            </View>
          )}
          <View style={styles.teamScore}>
            <Text style={styles.teamLabel}>Computer</Text>
            <Text style={styles.score}>{localGameState.computerScore}</Text>
          </View>
        </View>

        <View style={styles.playArea}>
          <Text style={styles.currentPlayerText}>
            {localGameState.currentTurn === 'player' ? "★ Your Turn" : "Computer's Turn"}
          </Text>

          <View
            style={[
              styles.tableContainer,
              { width: TABLE_SIZE, height: TABLE_SIZE },
            ]}
          >
            {showBackground ? (
            <ImageBackground
              source={customTheme?.boardImage ? { uri: customTheme.boardImage } : require('../../../../assets/blot/card-table.png')}
              style={styles.cardTable}
              imageStyle={{ borderRadius: 16 }}
            >
              {/* Card placement placeholders - always visible */}
              <View style={styles.trickArea}>
                <View style={[styles.cardPlaceholder, styles.trickSlotTop]} />
                <View style={[styles.cardPlaceholder, styles.trickSlotBottom]} />
              </View>
              
              {localGameState.currentTrick.length > 0 && (
                <View style={styles.trickArea}>
                  {localGameState.currentTrick.map((card, idx) => {
                    const isBottom = idx === localGameState.currentTrick.length - 1;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.trickSlot,
                          isBottom ? styles.trickSlotBottom : styles.trickSlotTop,
                        ]}
                      >
                        <Text style={styles.trickPlayerName}>
                          {isBottom ? 'You' : 'Computer'}
                        </Text>
                        {renderCard(card, idx, true)}
                      </View>
                    );
                  })}
                </View>
              )}
            </ImageBackground>
            ) : (
            <View style={styles.cardTable}>
              <View style={styles.trickArea}>
                <View style={[styles.cardPlaceholder, styles.trickSlotTop]} />
                <View style={[styles.cardPlaceholder, styles.trickSlotBottom]} />
              </View>
              {localGameState.currentTrick.length > 0 && (
                <View style={styles.trickArea}>
                  {localGameState.currentTrick.map((card, idx) => {
                    const isBottom = idx === localGameState.currentTrick.length - 1;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.trickSlot,
                          isBottom ? styles.trickSlotBottom : styles.trickSlotTop,
                        ]}
                      >
                        <Text style={styles.trickPlayerName}>
                          {isBottom ? 'You' : 'Computer'}
                        </Text>
                        {renderCard(card, idx, true)}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
            )}
          </View>
        </View>

        <View style={styles.handContainer}>
          <Text style={styles.handLabel}>Your Hand:</Text>
          <CardHandFan
            cards={localGameState.playerHand}
            maxWidth={width - 32}
            renderCard={(card, index) => renderCard(card, index)}
          />
        </View>

        <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
          <Text style={styles.resignButtonText}>Quit Game</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderGame = () => {
    const is4P = playerPosition !== null;
    // 4-player: use the per-player hand from gameState.myHand or hands[position]
    // 2-player: use player1Hand / player2Hand
    // CPU replacement: use myHand (from server) or cpuWhiteHand / cpuBlackHand
    const playerHand = is4P
      ? (gameState?.myHand || gameState?.hands?.[playerPosition] || [])
      : myCpuRole
        ? (gameState?.myHand || (myCpuRole === 'cpuWhite' ? gameState?.cpuWhiteHand : gameState?.cpuBlackHand) || [])
        : (playerColor === 'white' ? gameState?.player1Hand || [] : gameState?.player2Hand || []);

    // Score helpers
    const myScore = is4P
      ? (playerColor === 'white' ? gameState?.whiteScore || 0 : gameState?.blackScore || 0)
      : (playerColor === 'white' ? gameState?.player1Score || 0 : gameState?.player2Score || 0);
    const oppScore = is4P
      ? (playerColor === 'white' ? gameState?.blackScore || 0 : gameState?.whiteScore || 0)
      : (playerColor === 'white' ? gameState?.player2Score || 0 : gameState?.player1Score || 0);

    // Turn text for 4-player: distinguish partner vs opponent
    const turnText = (() => {
      if (isMyTurn) return '★ Your Turn';
      if (is4P && gameState?.currentTurn !== undefined) {
        const rel = ((gameState.currentTurn as number) - playerPosition! + 4) % 4;
        if (rel === 2) return "Partner's Turn";
      }
      return "Opponent's Turn";
    })();

    const { width, height } = Dimensions.get('window');
    const TABLE_SIZE = Math.min(width - 32, height * 0.4);

    return (
      <View style={styles.gameContainer}>
        {!isGameStarted ? (
          // Show waiting/ready screen
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingTitle}>Match Found!</Text>
            <Text style={styles.waitingText}>
              {is4P
                ? `Team: ${playerColor === 'white' ? '⚪ White' : '⚫ Black'} • Position ${playerPosition}`
                : `Playing as: ${playerColor === 'white' ? '⚪ White' : '⚫ Black'}`}
            </Text>
            <Text style={styles.waitingSubtext}>
              {is4P ? 'Waiting for all 4 players...' : (opponent ? 'Opponent found!' : 'Waiting for opponent...')}
            </Text>
            <TouchableOpacity
              style={[styles.readyButton, isReadySent && { opacity: 0.6 }]}
              onPress={handlePlayerReady}
              disabled={isReadySent}
            >
              <Text style={styles.readyButtonText}>
                {isReadySent ? 'Waiting for opponent...' : 'Ready to Play'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelButton, { marginTop: 20 }]} onPress={() => {
              if (currentRoom?.roomId) {
                socketService.resign(currentRoom.roomId, userId);
              }
              navigation.goBack();
            }}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Show actual game
          <>
            <View style={styles.scoreBoard}>
              <View style={styles.teamScore}>
                <Text style={styles.teamLabel}>Your Team</Text>
                <Text style={styles.score}>{myScore}</Text>
                <Text style={styles.roundScore}>{myScore} this round</Text>
              </View>
              
              {gameState?.trumpSuit && (
                <View style={styles.trumpDisplay}>
                  <Text style={styles.trumpLabel}>Trump</Text>
                  <Text style={styles.trumpSuit}>
                    {gameState.trumpSuit === 'hearts' ? '♥' :
                     gameState.trumpSuit === 'diamonds' ? '♦' :
                     gameState.trumpSuit === 'clubs' ? '♣' : '♠'}
                  </Text>
                </View>
              )}

              <View style={styles.teamScore}>
                <Text style={styles.teamLabel}>Opp. Team</Text>
                <Text style={styles.score}>{oppScore}</Text>
                <Text style={styles.roundScore}>{oppScore} this round</Text>
              </View>
            </View>

            <View style={styles.playArea}>
              <Text style={styles.currentPlayerText}>{turnText}</Text>
              <Text style={styles.partnerLabel}>
                {is4P ? '👥 2v2 • 🤖 CPU-free' : '🤖 CPU Partner (same team)'}
              </Text>

              <View
                style={[
                  styles.tableContainer,
                  { width: TABLE_SIZE, height: TABLE_SIZE },
                ]}
              >
                {showBackground ? (
                <ImageBackground
                  source={customTheme?.boardImage ? { uri: customTheme.boardImage } : require('../../../../assets/blot/card-table.png')}
                  style={styles.cardTable}
                  imageStyle={{ borderRadius: 16 }}
                >
                  {/* Card placement placeholders - always visible */}
                  <View style={styles.trickArea}>
                    <View style={[styles.cardPlaceholder, styles.trickSlotTop]} />
                    <View style={[styles.cardPlaceholder, styles.trickSlotBottom]} />
                    <View style={[styles.cardPlaceholder, styles.trickSlotLeft]} />
                    <View style={[styles.cardPlaceholder, styles.trickSlotRight]} />
                  </View>
                  
                  {gameState?.currentTrick && gameState.currentTrick.length > 0 && (
                    <View style={styles.trickArea}>
                      {gameState.currentTrick.map((card: any, index: number) => {
                        let slotStyle;
                        if (is4P) {
                          const rel = ((card.position as number) - playerPosition! + 4) % 4;
                          if (rel === 0) slotStyle = styles.trickSlotBottom;
                          else if (rel === 2) slotStyle = styles.trickSlotTop;
                          else if (rel === 1) slotStyle = styles.trickSlotRight;
                          else slotStyle = styles.trickSlotLeft;
                        } else if (card.seat) {
                          const SEAT_IDX: Record<string, number> = { player1: 0, cpuWhite: 1, player2: 2, cpuBlack: 3 };
                          const mySeat = myCpuRole
                            ? myCpuRole
                            : (playerColor === 'white' ? 'player1' : 'player2');
                          const rel = (SEAT_IDX[card.seat] - SEAT_IDX[mySeat] + 4) % 4;
                          if (rel === 0) slotStyle = styles.trickSlotBottom;
                          else if (rel === 1) slotStyle = styles.trickSlotLeft;
                          else if (rel === 2) slotStyle = styles.trickSlotTop;
                          else slotStyle = styles.trickSlotRight;
                        } else {
                          const isMyCard   = card.color === playerColor;
                          const isHumanCard = card.isHuman !== false;
                          if (isMyCard && isHumanCard)        slotStyle = styles.trickSlotBottom;
                          else if (!isMyCard && isHumanCard)  slotStyle = styles.trickSlotTop;
                          else if (isMyCard && !isHumanCard)  slotStyle = styles.trickSlotLeft;
                          else                                slotStyle = styles.trickSlotRight;
                        }
                        return (
                          <View key={index} style={[styles.trickSlot, slotStyle]}>
                            {renderCard(card, index, true)}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ImageBackground>
                ) : (
                <View style={styles.cardTable}>
                  <View style={styles.trickArea}>
                    <View style={[styles.cardPlaceholder, styles.trickSlotTop]} />
                    <View style={[styles.cardPlaceholder, styles.trickSlotBottom]} />
                    <View style={[styles.cardPlaceholder, styles.trickSlotLeft]} />
                    <View style={[styles.cardPlaceholder, styles.trickSlotRight]} />
                  </View>
                  {gameState?.currentTrick && gameState.currentTrick.length > 0 && (
                    <View style={styles.trickArea}>
                      {gameState.currentTrick.map((card: any, index: number) => {
                        let slotStyle;
                        if (is4P) {
                          const rel = ((card.position as number) - playerPosition! + 4) % 4;
                          if (rel === 0) slotStyle = styles.trickSlotBottom;
                          else if (rel === 2) slotStyle = styles.trickSlotTop;
                          else if (rel === 1) slotStyle = styles.trickSlotRight;
                          else slotStyle = styles.trickSlotLeft;
                        } else if (card.seat) {
                          const SEAT_IDX: Record<string, number> = { player1: 0, cpuWhite: 1, player2: 2, cpuBlack: 3 };
                          const mySeat = myCpuRole
                            ? myCpuRole
                            : (playerColor === 'white' ? 'player1' : 'player2');
                          const rel = (SEAT_IDX[card.seat] - SEAT_IDX[mySeat] + 4) % 4;
                          if (rel === 0) slotStyle = styles.trickSlotBottom;
                          else if (rel === 1) slotStyle = styles.trickSlotLeft;
                          else if (rel === 2) slotStyle = styles.trickSlotTop;
                          else slotStyle = styles.trickSlotRight;
                        } else {
                          const isMyCard   = card.color === playerColor;
                          const isHumanCard = card.isHuman !== false;
                          if (isMyCard && isHumanCard)        slotStyle = styles.trickSlotBottom;
                          else if (!isMyCard && isHumanCard)  slotStyle = styles.trickSlotTop;
                          else if (isMyCard && !isHumanCard)  slotStyle = styles.trickSlotLeft;
                          else                                slotStyle = styles.trickSlotRight;
                        }
                        return (
                          <View key={index} style={[styles.trickSlot, slotStyle]}>
                            {renderCard(card, index, true)}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
                )}
              </View>
            </View>

            <View style={styles.handContainer}>
              {isSpectating ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Text style={[styles.handLabel, { fontSize: 16, color: '#f59e0b' }]}>👁️ Watching Game</Text>
                  <Text style={[styles.handLabel, { fontSize: 12, opacity: 0.6, marginTop: 4 }]}>You are spectating this match</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.handLabel}>Your Hand:</Text>
                  <CardHandFan
                    cards={playerHand}
                    maxWidth={width - 32}
                    renderCard={(card, index) => renderCard(card, index)}
                  />
                </>
              )}
            </View>

            {!isSpectating && (
              <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
                <Text style={styles.resignButtonText}>Resign</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* In-game chat overlay — only visible once the game has started */}
        <InGameChat
          roomId={currentRoom?.roomId || ''}
          currentUserId={userId}
          gameType={is4P ? 'blot-teams' : 'blot'}
          visible={isGameStarted && !!currentRoom?.roomId}
          opponentUsername={is4P ? undefined : (opponent as any)?.username}
        />
      </View>
    );
  };



  return (
    <ImageBackground
      source={require('../../../../assets/blot/park-background.png')}
      style={styles.container}
      blurRadius={showBlur ? 3 : 0}>
      <LinearGradient
        colors={showBlur ? ['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)'] : ['transparent', 'transparent']}
        style={styles.overlay}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      {(gameMode === 'game' || gameMode === 'local') && (
        <View>
          <GameToolbar
            title={roomName}
            onBack={() => navigation.goBack()}
            backgroundColor="transparent"
            rightElement={
              <TouchableOpacity
                onPress={() => { toolbarExpanded.value = !toolbarExpanded.value; }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.editRoomButton}
              >
                <Animated.Text style={[styles.editRoomIcon, chevronStyle]}>⌄</Animated.Text>
              </TouchableOpacity>
            }
          />
          <ExpandableView isExpanded={toolbarExpanded} viewKey="toolbarControls" duration={300}>
            <View style={styles.toolbarControls}>
              <TouchableOpacity
                onPress={() => setShowCustomization(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.editRoomButton}
              >
                <Text style={styles.editRoomIcon}>🎨</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowBlur(!showBlur)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.editRoomButton}
              >
                <Text style={styles.editRoomIcon}>{showBlur ? '🌫️' : '✨'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowBackground(!showBackground)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.editRoomButton}
              >
                <Text style={styles.editRoomIcon}>{showBackground ? '🖼️' : '🔲'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => roomInfoRef.current?.open()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.editRoomButton}
              >
                <Text style={styles.editRoomIcon}>👥</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowRoomNameModal(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.editRoomButton}
              >
                <Text style={styles.editRoomIcon}>✏️</Text>
              </TouchableOpacity>
            </View>
          </ExpandableView>
        </View>
      )}
      {gameMode === 'menu' && renderMenu()}
      {gameMode === 'matchmaking' && renderMatchmaking()}
      {gameMode === 'private' && renderPrivateRoom()}
      {gameMode === 'local' && renderLocalGame()}
      {gameMode === 'game' && renderGame()}

      {/* Room info drawer — triggered imperatively via roomInfoRef */}
      <RoomInfoDrawer
        ref={roomInfoRef}
        roomId={currentRoom?.roomId ?? null}
        hidePill
        staticPlayers={isLocalGame ? [
          {
            userId: userId,
            displayName: route.params?.session?.displayName || route.params?.session?.username || 'You',
            isAI: false,
            avatarUrl: route.params?.session?.avatar_url ?? null,
          },
          {
            userId: null,
            displayName: 'CPU Opponent',
            isAI: true,
          },
        ] : undefined}
      />

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
                <Text style={[styles.modalButtonText, styles.joinButtonText]}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Difficulty Selection Modal */}
      <Modal
        visible={showDifficultyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDifficultyModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Difficulty</Text>
            <TouchableOpacity
              style={[styles.difficultyButton, styles.easyButton]}
              onPress={() => startLocalGame('easy')}>
              <Text style={styles.difficultyButtonText}>😊 Easy</Text>
              <Text style={styles.difficultyDescription}>Computer makes simple moves</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.difficultyButton, styles.mediumButton]}
              onPress={() => startLocalGame('medium')}>
              <Text style={styles.difficultyButtonText}>🎯 Medium</Text>
              <Text style={styles.difficultyDescription}>Balanced gameplay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.difficultyButton, styles.hardButton]}
              onPress={() => startLocalGame('hard')}>
              <Text style={styles.difficultyButtonText}>🔥 Hard</Text>
              <Text style={styles.difficultyDescription}>Computer plays strategically</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowDifficultyModal(false)}>
              <Text style={styles.modalButtonText}>Cancel</Text>
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
        gameType="Blot"
      />

      {/* Card Customization Modal */}
      {showCustomization && (
        <CardCustomizationModal
          visible={showCustomization}
          onClose={() => setShowCustomization(false)}
          onSave={handleSaveTheme}
          currentTheme={customTheme}
        />
      )}
        </SafeAreaView>
      </LinearGradient>
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
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  userId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginVertical: 10,
    minWidth: 250,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  localButton: {
    backgroundColor: '#FF9500',
  },
  backButton: {
    backgroundColor: '#999',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: 250,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 30,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  roomCodeLabel: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  roomCodeText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
    marginVertical: 10,
    letterSpacing: 4,
  },
  waitingText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  waitingTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000',
  },
  waitingSubtext: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
  },
  readyButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 50,
    paddingVertical: 20,
    borderRadius: 12,
    minWidth: 250,
  },
  readyButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gameContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'rgba(10, 54, 34, 0.75)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  turnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  turnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
    marginLeft: 8,
  },
  trumpContainer: {
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  trumpText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
  handContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    width: 80,
    height: 110,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    marginHorizontal: 5,
  },
  trickCard: {
    width: 90,
    height: 120,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    marginHorizontal: 0,
  },
  selectedCard: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  disabledCard: {
    opacity: 0.5,
  },
  cardRank: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  cardSuit: {
    fontSize: 32,
  },
  cardValue: {
    fontSize: 12,
    color: '#666',
  },
  cardImageBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
  },
  readyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resignButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  resignButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  modalCancelButton: {
    backgroundColor: '#eee',
  },
  modalJoinButton: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  joinButtonText: {
    color: '#fff',
  },
  difficultyButton: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: 'center',
  },
  easyButton: {
    backgroundColor: '#4CAF50',
  },
  mediumButton: {
    backgroundColor: '#FF9800',
  },
  hardButton: {
    backgroundColor: '#f44336',
  },
  difficultyButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  difficultyDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  handLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  playArea: {
    flex: 2,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  cardTable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPlayerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  partnerLabel: {
    fontSize: 12,
    color: 'rgba(180,230,180,0.9)',
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  trickArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPlaceholder: {
    position: 'absolute',
    width: 90,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  trickSlot: {
    position: 'absolute',
    alignItems: 'center',
  },
  trickSlotTop: {
    top: 25,
    left: '50%',
    marginLeft: -45,
    alignItems: 'center',
  },
  trickSlotBottom: {
    bottom: 25,
    left: '50%',
    marginLeft: -45,
    alignItems: 'center',
  },
  trickSlotLeft: {
    left: 35,
    top: '50%',
    marginTop: -60,
    transform: [{ rotate: '90deg' }],
  },
  trickSlotRight: {
    right: 35,
    top: '50%',
    marginTop: -60,
    transform: [{ rotate: '90deg' }],
  },
  trickPlayerName: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 6,
    fontWeight: '600',
  },
  roundScore: {
    fontSize: 12,
    color: '#90EE90',
  },
  teamScore: {
    alignItems: 'center',
  },
  teamLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  score: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  scoreBoard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  trumpDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 92, 63, 0.9)',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    maxWidth: 70,
    maxHeight: 98,
  },
  trumpLabel: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 4,
  },
  trumpSuit: {
    fontSize: 32,
  },
  editRoomButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editRoomIcon: {
    fontSize: 18,
  },
  toolbarControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexWrap: 'wrap',
  },
});

export default MultiplayerBlotScreen;
