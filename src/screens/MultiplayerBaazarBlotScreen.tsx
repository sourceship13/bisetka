import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  Image,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../components/global/ExpandableView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BisetkaAlert } from '../utils/BisetkaAlert';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { socketService } from '../services/SocketService';
import tokenService from '../services/token.service';
import apiService from '../services/api.service';
import DynamicCard from '../components/DynamicCard';
import { CardType } from '../components/Card';
import InGameChat from '../components/InGameChat';
import GameToolbar from '../components/global/GameToolbar';
import RoomNameModal from '../components/RoomNameModal';
import CardCustomizationModal from '../components/global/GameCustomizationModal';
import RoomInfoDrawer from '../components/RoomInfoDrawer';
import CardHandFan from '../components/CardHandFan';
import { RiffleDealAnimation } from '../components/RiffleDealAnimation';
import type { CardTheme } from '../components/global/GameCustomizationModal';

const { width: SW } = Dimensions.get('window');

const SUIT_ICON: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};
const SUIT_NAME: Record<string, string> = {
  hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs', spades: 'Spades',
};
const SUIT_COLOR: Record<string, string> = {
  hearts: '#e74c3c', diamonds: '#e74c3c', clubs: '#ecf0f1', spades: '#ecf0f1',
};

interface GamePlayer {
  id: string;
  socketId: string;
  ready: boolean;
  isAI: boolean;
  team: 1 | 2;
  position: number;
}

interface BaazarGameState {
  phase: 'bidding' | 'playing' | 'scoring';
  currentPlayer: number;
  dealer: number;
  trump: string | null;
  playerHands: CardType[][];
  currentBid: number;
  bidderPlayer: number | null;
  bidderTeam: 1 | 2 | null;
  passedPlayers: number[];
  currentTrick: { playerPosition: number; card: CardType }[];
  completedTricks: any[];
  scores: { team1: number; team2: number };
  gameScore: { team1: number; team2: number };
  targetScore: number;
  lastRoundResult?: {
    team1Raw: number; team2Raw: number;
    team1Final: number; team2Final: number;
    bid: number; biddingTeam: number; madeBid: boolean;
  } | null;
}

const MultiplayerBaazarBlotScreen = ({ navigation, route }: any) => {
  const userId = route.params?.userId || route.params?.session?.userId || 'test-user-' + Math.random().toString(36).substr(2, 9);
  const teamMode: 'hybrid' | 'full-multiplayer' = route.params?.teamMode ?? 'hybrid';
  const initialMode = route.params?.mode; // 'random' | 'private-create' | 'private-join' | 'replace-ai' | 'spectate'
  const initialJoinCode: string | undefined = route.params?.joinCode;
  const dbSessionId: string | undefined = route.params?.dbSessionId;
  const allowReplaceAI: boolean = route.params?.allowReplaceAI || false;

  const getInitialGameMode = () => {
    if (initialMode === 'private-create') return 'private';
    if (initialMode === 'private-join') return 'matchmaking';
    if (initialMode === 'random') return 'matchmaking';
    if (initialMode === 'replace-ai') return 'matchmaking';
    if (initialMode === 'spectate') return 'matchmaking';
    return 'menu';
  };

  const [gameMode, setGameMode] = useState<'menu' | 'matchmaking' | 'private' | 'game'>(getInitialGameMode());
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [myPosition, setMyPosition] = useState<number>(-1);
  const [myTeam, setMyTeam] = useState<1 | 2>(1);
  const [gameState, setGameState] = useState<BaazarGameState | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [isSpectating, setIsSpectating] = useState(false);
  const [pendingBidLevel, setPendingBidLevel] = useState<number>(9);
  const [pendingBidSuit, setPendingBidSuit] = useState<string>('hearts'); // pre-select hearts so Make Bid is always ready
  const [showCustomization, setShowCustomization] = useState(false);
  const [customTheme, setCustomTheme] = useState<CardTheme | undefined>(undefined);
  const [showBackground, setShowBackground] = useState(true);
  const [showBlur, setShowBlur] = useState(true);
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const [roomName, setRoomName] = useState('Multiplayer Baazar Blot');
  const [displayTrick, setDisplayTrick] = useState<{ playerPosition: number; card: CardType }[]>([]);
  const trickCompleteTimeRef = useRef<number>(0);
  const resolutionInProgressRef = useRef(false);
  const resolutionStartTimeRef = useRef<number>(0);
  const [isShowingCompletedTrick, setIsShowingCompletedTrick] = useState(false);
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);
  const [showDealAnimation, setShowDealAnimation] = useState(false);
  const showDealAnimationRef = useRef(false);
  const pendingGameStateRef = useRef<(BaazarGameState & { currentPlayer: number }) | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  // Trigger deal animation when bidding phase ends and playing begins
  useEffect(() => {
    if (gameState?.phase === 'playing' && prevPhaseRef.current === 'bidding') {
      showDealAnimationRef.current = true;
      setShowDealAnimation(true);
    }
    prevPhaseRef.current = gameState?.phase ?? null;
  }, [gameState?.phase]);

  // Ensure socket is connected before operations
  const ensureSocketConnected = async (): Promise<boolean> => {
    try {
      if (!socketService.isConnected()) {
        console.log('🔌 Socket not connected, connecting now...');
        const token = await tokenService.getAccessToken();
        if (!token) {
          console.error('❌ No token available for authentication');
          return false;
        }

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
          
          socketService.connect(userId, token);
          
          socketService.getSocket()?.once('authenticated', () => {
            clearTimeout(timeout);
            console.log('✅ Socket authenticated');
            resolve();
          });

          socketService.getSocket()?.once('connect_error', (error) => {
            clearTimeout(timeout);
            console.error('❌ Socket connection error:', error);
            reject(error);
          });
        });
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to ensure socket connection:', error);
      return false;
    }
  };

  useEffect(() => {
    const setupSocketListeners = async () => {
      const connected = await ensureSocketConnected();
      if (!connected) {
        BisetkaAlert.error('Connection Error', 'Failed to connect to multiplayer server');
        return;
      }

      const socket = socketService.getSocket();
      if (!socket) return;

      // Room name updates (same socket that handles game events)
      socket.on('room_name_updated', (data: any) => {
        setRoomName(data.roomName);
      });

      // Baazar Blot matchmaking events
      socket.on('baazar_match_found', (data: { 
        roomId: string; 
        players: GamePlayer[]; 
        myPosition: number;
        myTeam: 1 | 2;
        gameState?: BaazarGameState;
        isRejoining?: boolean;
      }) => {
        console.log('🎲 Baazar match found:', data);
        setRoomId(data.roomId);
        setPlayers(data.players);
        setMyPosition(data.myPosition);
        setMyTeam(data.myTeam);
        setGameMode('game');
        setIsConnecting(false);

        // If rejoining (replace-AI), apply the current game state immediately
        if (data.isRejoining && data.gameState) {
          setGameState(data.gameState);
          // Game is already active — no need for the ready handshake.
          // Request a fresh state sync after a short delay as a safety net.
          setTimeout(() => {
            socket.emit('baazar_request_sync', { roomId: data.roomId, userId });
          }, 2000);
        } else {
          // Fresh game: mark player as ready so allReady can trigger game start
          socket.emit('baazar_player_ready', {
            roomId: data.roomId,
            userId
          });
        }
      });

      socket.on('baazar_game_started', (data: { 
        roomId?: string;
        players: GamePlayer[]; 
        gameState: BaazarGameState;
        roomTheme?: any;
      }) => {
        console.log('🚀 Baazar game started:', data);
        setGameState(data.gameState);
        setPlayers(data.players);
        setGameMode('game');
        setIsConnecting(false);

        // Set roomId if we missed baazar_match_found
        if (data.roomId) {
          setRoomId(prev => prev || data.roomId!);
        }

        // Apply existing room theme for reconnecting players
        if (data.roomTheme) {
          handleSaveTheme(data.roomTheme);
        }

        // If myPosition wasn't set (missed baazar_match_found), derive it from userId
        setMyPosition(prev => {
          if (prev >= 0) return prev; // already set
          const me = data.players.find(p => p.id === userId);
          return me ? me.position : 0;
        });
        setMyTeam(prev => {
          if (prev) return prev;
          const me = data.players.find(p => p.id === userId);
          return me ? me.team : 1;
        });
      });

      socket.on('baazar_bid_made', (data: { 
        playerPosition: number;
        bid: { level: number; suit: string } | null;
        pass: boolean;
        gameState: BaazarGameState;
        currentPlayer: number;
      }) => {
        console.log('💰 Bid made:', data.playerPosition, 'currentPlayer now:', data.currentPlayer, 'myPosition:', myPosition, 'phase:', data.gameState?.phase);
        // Merge data.currentPlayer into gameState — gameState.currentPlayer is
        // initialized to 0 and only room.currentPlayer is updated server-side.
        setGameState(prev => ({ ...data.gameState, currentPlayer: data.currentPlayer }));
        // Clamp bid level to at least currentBid+1 for the next turn
        setPendingBidLevel(prev => Math.max(prev, (data.gameState.currentBid || 8) + 1));
      });

      socket.on('baazar_card_played', (data: { 
        playerPosition: number;
        card: CardType;
        gameState: BaazarGameState;
        currentPlayer: number;
      }) => {
        console.log('🃏 Card played by pos:', data.playerPosition, 'currentPlayer now:', data.currentPlayer, 'myPosition:', myPosition, 'myHand length:', data.gameState?.playerHands?.[myPosition]?.length);
        const nextState = { ...data.gameState, currentPlayer: data.currentPlayer };
        if (showDealAnimationRef.current) {
          // Buffer during deal animation — applied in onComplete
          pendingGameStateRef.current = nextState;
        } else {
          setGameState(nextState);
          setSelectedCard(null);
        }
      });

      socket.on('baazar_game_ended', (data: { 
        winningTeam: 1 | 2;
        finalScore: { team1: number; team2: number };
      }) => {
        console.log('🎮 Game ended:', data);
        BisetkaAlert.alert(
          'Game Over!',
          `Team ${data.winningTeam} wins!\nFinal Score:\nTeam 1: ${data.finalScore.team1}\nTeam 2: ${data.finalScore.team2}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      });

      // State sync fallback — server responds to baazar_request_sync
      socket.on('baazar_state_sync', (data: {
        roomId: string;
        players: GamePlayer[];
        gameState: BaazarGameState;
        currentPlayer: number;
      }) => {
        console.log('🔄 State sync received — currentPlayer:', data.currentPlayer, 'phase:', data.gameState?.phase);
        setGameState({ ...data.gameState, currentPlayer: data.currentPlayer });
        setPlayers(data.players);
        setRoomId(prev => prev || data.roomId);
      });

      socket.on('error', (error: { message: string }) => {
        console.error('❌ Socket error:', error);
        // For replace-ai mode: only reset to menu if we haven't joined a room yet.
        // roomIdRef.current is always current (updated via ref effect) so avoids stale closure.
        if (initialMode === 'replace-ai') {
          if (!roomIdRef.current) {
            BisetkaAlert.error('Could Not Join', error.message || 'Room not found or game already full.');
            setGameMode('menu');
          }
          // Silently ignore errors once in-game (e.g. "not your turn") to avoid disrupting game
        } else {
          BisetkaAlert.error('Error', error.message);
        }
      });

      // An AI slot in this room was taken by a real player
      socket.on('baazar_player_replaced_ai', (data: { position: number; userId: string; players: GamePlayer[] }) => {
        console.log('🤖→👤 AI replaced by human at position', data.position);
        setPlayers(data.players);
      });

      // Private room creation event
      socket.on('baazar_room_created', (data: { roomId: string; roomCode: string }) => {
        setRoomId(data.roomId);
        setRoomCode(data.roomCode);
        setMyPosition(0);
        setMyTeam(1);
        setGameMode('private');
      });

      // Auto-start private flows after listeners are ready
      if (initialMode === 'private-create') {
        socket.emit('create_baazar_private_room', { userId, desiredCode: initialJoinCode });
      } else if (initialMode === 'private-join' && initialJoinCode) {
        socket.emit('join_baazar_private_room', { roomCode: initialJoinCode, userId });
      } else if (initialMode === 'random') {
        if (teamMode === 'full-multiplayer') {
          socket.emit('find_baazar_teams_match', { userId });
        } else {
          socket.emit('find_baazar_match', { userId, allowReplaceAI });
        }
      } else if (initialMode === 'replace-ai' && dbSessionId) {
        // Replace an AI player in an existing Baazar Blot room from the Active Rooms lobby.
        // Backend will emit baazar_match_found back with gameState so the existing listener
        // sets up everything and transitions to 'game' mode.
        socket.emit('replace_ai_player', { dbSessionId, userId, displayName: route.params?.session?.displayName });
      } else if (initialMode === 'spectate' && dbSessionId) {
        // Spectate an in-progress Baazar Blot game
        socket.once('spectate_started', (data: any) => {
          setIsSpectating(true);
          setRoomId(data.roomId);
          // Use position 0 so the trick table renders all 4 player slots
          setMyPosition(0);
          setMyTeam(1);
          if (data.gameState) setGameState(data.gameState);
          if (data.players) setPlayers(data.players);
          setGameMode('game');
          setIsConnecting(false);
          if (data.roomTheme) {
            handleSaveTheme(data.roomTheme);
          }
        });
        socket.emit('spectate_room', { dbSessionId, userId, displayName: route.params?.session?.displayName });
      }
    };

    setupSocketListeners();

    // Room theme broadcast from any player in the room
    socketService.onRoomThemeUpdated((data) => {
      if (data.roomId === roomIdRef.current) {
        const theme = data.theme;
        const urls = [theme?.boardImage, theme?.backgroundImage].filter(Boolean) as string[];
        if (urls.length > 0) {
          Promise.all(urls.map((url: string) => Image.prefetch(url).catch(() => {}))).then(() => {
            setCustomTheme({ ...theme });
            AsyncStorage.setItem('baazar_card_theme', JSON.stringify(theme));
          });
        } else {
          setCustomTheme({ ...theme });
          AsyncStorage.setItem('baazar_card_theme', JSON.stringify(theme));
        }
      }
    });

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('baazar_match_found');
        socket.off('baazar_game_started');
        socket.off('baazar_bid_made');
        socket.off('baazar_card_played');
        socket.off('baazar_game_ended');
        socket.off('baazar_state_sync');
        socket.off('baazar_room_created');
        socket.off('baazar_player_replaced_ai');
        socket.off('error');
      }
      socketService.offRoomThemeUpdated();
    };
  }, [userId, navigation]);

  // Delay trick clearing to show all 4 cards for 2 seconds
  useEffect(() => {
    if (!gameState?.currentTrick) return;

    // Safety check: if we're showing a completed trick for more than 5 seconds, force clear
    if (resolutionInProgressRef.current && isShowingCompletedTrick) {
      const elapsed = Date.now() - resolutionStartTimeRef.current;
      if (elapsed > 5000) {
        console.warn('Display stuck, forcing clear');
        setDisplayTrick([]);
        setTimeout(() => {
          setIsShowingCompletedTrick(false);
          resolutionInProgressRef.current = false;
        }, 500);
        return;
      }
    }

    // When trick is complete (4 cards), save it and delay clearing
    if (gameState.currentTrick.length === 4 && !isShowingCompletedTrick && !resolutionInProgressRef.current) {
      setDisplayTrick(gameState.currentTrick);
      setIsShowingCompletedTrick(true);
      resolutionInProgressRef.current = true;
      resolutionStartTimeRef.current = Date.now();
      trickCompleteTimeRef.current = Date.now();
    }
    // When trick is cleared by server (0 cards), wait for delay before updating display
    else if (gameState.currentTrick.length === 0 && isShowingCompletedTrick && resolutionInProgressRef.current) {
      const elapsed = Date.now() - trickCompleteTimeRef.current;
      const remainingDelay = Math.max(0, 2000 - elapsed); // 2 second total delay

      const clearTimer = setTimeout(() => {
        setDisplayTrick([]);
        // Add brief pause after clearing before allowing new cards
        setTimeout(() => {
          setIsShowingCompletedTrick(false);
          resolutionInProgressRef.current = false;
        }, 500);
      }, remainingDelay);
      
      return () => {
        clearTimeout(clearTimer);
        // Don't reset state here - let the timer complete naturally
      };
    }
    // Normal case: sync display with server (but not during completed trick display)
    else if (!isShowingCompletedTrick && gameState.currentTrick.length < 4) {
      setDisplayTrick(gameState.currentTrick);
    }
  }, [gameState?.currentTrick, displayTrick.length, isShowingCompletedTrick]);

  const handleFindMatch = async () => {
    const connected = await ensureSocketConnected();
    if (!connected) {
      BisetkaAlert.error('Connection Error', 'Failed to connect to server');
      return;
    }

    setIsConnecting(true);
    setGameMode('matchmaking');

    const socket = socketService.getSocket();
    if (socket) {
      if (teamMode === 'full-multiplayer') {
        socket.emit('find_baazar_teams_match', { userId });
        console.log('🔍 Joined Baazar Blot 2v2 (all-human) matchmaking queue');
      } else {
        // hybrid: 1 human + AI partners per side
        socket.emit('find_baazar_match', { userId, allowReplaceAI });
        console.log('🔍 Joined Baazar Blot hybrid (1+AI vs 1+AI) matchmaking queue');
      }
    }
  };

  const handleCancelMatchmaking = () => {
    const socket = socketService.getSocket();
    if (socket) {
      if (teamMode === 'full-multiplayer') {
        socket.emit('cancel_baazar_teams_match', { userId });
      } else {
        socket.emit('cancel_baazar_match', { userId });
      }
      console.log('❌ Cancelled matchmaking');
    }
    setIsConnecting(false);
    setGameMode('menu');
  };

  const handleMakeBid = () => {
    if (isSpectating) return;
    if (!roomId || !gameState) return;
    const suit = pendingBidSuit || 'hearts';
    const minLevel = (gameState.currentBid || 8) + 1;
    const level = Math.max(pendingBidLevel, minLevel);

    const socket = socketService.getSocket();
    if (socket) {
      console.log(`💰 Sending bid: level=${level} suit=${suit} roomId=${roomId} userId=${userId}`);
      socket.emit('baazar_make_bid', {
        roomId,
        userId,
        bid: { level, suit }
      });
    }
  };

  const handlePass = () => {
    if (isSpectating) return;
    if (!roomId || !gameState) return;

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('baazar_make_bid', {
        roomId,
        userId,
        pass: true
      });
    }
  };

  const handlePlayCard = (card: CardType) => {
    if (isSpectating) return;
    if (!roomId || !gameState || gameState.currentPlayer !== myPosition) return;

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('baazar_play_card', {
        roomId,
        userId,
        card
      });
    }
  };

  // Load saved theme on mount
  useEffect(() => {
    AsyncStorage.getItem('baazar_card_theme').then((stored) => {
      if (stored) {
        try { setCustomTheme(JSON.parse(stored)); } catch {}
      }
    });
  }, []);

  const handleSaveTheme = (theme: CardTheme) => {
    const applyTheme = () => {
      setCustomTheme({ ...theme });
      AsyncStorage.setItem('baazar_card_theme', JSON.stringify(theme));
      const currentRoomId = roomIdRef.current;
      if (currentRoomId) {
        socketService.setRoomTheme(currentRoomId, theme);
      }
      apiService.logThemeApplied({
        gameType: 'baazar-blot',
        roomId: currentRoomId ?? undefined,
        themeName: theme.name,
        backgroundImageUrl: theme.backgroundImage,
        boardImageUrl: theme.boardImage,
        cardBackImageUrl: theme.cardBackImage,
        fontFamily: theme.font,
        source: 'generated',
      });
    };
    const urls = [theme.boardImage, theme.backgroundImage].filter(Boolean) as string[];
    if (urls.length > 0) {
      Promise.all(urls.map(url => Image.prefetch(url).catch(() => {}))).then(applyTheme);
    } else {
      applyTheme();
    }
  };

  const renderMenu = () => (
    <ImageBackground
      source={require('../../assets/blot/park-background.png')}
      style={styles.bg}
      blurRadius={3}
      resizeMode="cover">
      <LinearGradient
        colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <GameToolbar
          title="Bazaar Blot"
          onBack={() => navigation.goBack()}
          backgroundColor="transparent"
        />
        <View style={styles.menuBody}>
          <Text style={styles.bigTitle}>🃏 Bazaar Blot</Text>
          <Text style={styles.subtitle}>Multiplayer – 4 Player Team Game</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>👥 You + Teammate vs 2 Opponents</Text>
            <Text style={styles.infoText}>🤖 AI players fill empty spots</Text>
            <Text style={styles.infoText}>🎯 First to 301 points wins!</Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleFindMatch}>
            <Text style={styles.primaryBtnText}>Find Match</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );

  const renderMatchmaking = () => (
    <ImageBackground
      source={require('../../assets/blot/park-background.png')}
      style={styles.bg}
      blurRadius={3}
      resizeMode="cover">
      <LinearGradient
        colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <GameToolbar
          title="Bazaar Blot"
          onBack={handleCancelMatchmaking}
          backgroundColor="transparent"
        />
        <View style={styles.menuBody}>
          <Text style={styles.bigTitle}>🔍 Finding Match…</Text>

          <ActivityIndicator size="large" color="#FFD700" style={{ marginVertical: 40 }} />

          <Text style={styles.statusText}>Looking for players…</Text>
          <Text style={styles.infoText}>Minimum 2 real players required</Text>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelMatchmaking}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );

  const renderPrivateRoom = () => (
    <ImageBackground
      source={require('../../assets/blot/park-background.png')}
      style={styles.bg}
      blurRadius={3}
      resizeMode="cover">
      <LinearGradient
        colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <GameToolbar
          title="Bazaar Blot"
          onBack={() => navigation.goBack()}
          backgroundColor="transparent"
        />
        <View style={styles.menuBody}>
          <Text style={styles.bigTitle}>🔒 Private Room</Text>
          <Text style={styles.subtitle}>Share this code with your opponent</Text>

          <View style={[styles.infoBox, { paddingVertical: 24, paddingHorizontal: 32, marginVertical: 24 }]}>
            <Text style={{ fontSize: 42, fontWeight: 'bold', color: '#FFD700', letterSpacing: 8 }}>
              {roomCode}
            </Text>
          </View>

          <ActivityIndicator size="small" color="#FFD700" style={{ marginTop: 16 }} />
          <Text style={[styles.statusText, { marginTop: 12 }]}>Waiting for opponent to join…</Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );

  const renderBiddingPhase = () => {
    const isMyTurn = gameState?.currentPlayer === myPosition;
    const iHavePassed = gameState?.passedPlayers?.includes(myPosition) ?? false;
    const myHand = gameState?.playerHands[myPosition] || [];
    const currentPlayerInfo = players.find(p => p.position === gameState?.currentPlayer);
    const currentPlayerLabel = currentPlayerInfo
      ? (currentPlayerInfo.isAI ? `CPU (T${currentPlayerInfo.team})` : `P${currentPlayerInfo.position} (T${currentPlayerInfo.team})`)
      : `Player ${gameState?.currentPlayer}`;
    const currentBid = gameState?.currentBid || 0;
    const hasBid = gameState?.bidderPlayer !== null && gameState?.bidderPlayer !== undefined;
    const minBid = hasBid ? Math.min(currentBid + 1, 16) : 8;
    const displayLevel = Math.max(pendingBidLevel, minBid);

    return (
      <View style={styles.centeredSection}>
        <Text style={styles.sectionTitle}>🃏 Bazaar Blot</Text>

        {hasBid ? (
          <View style={styles.bidStatusRow}>
            <Text style={styles.bidStatusText}>
              T{gameState?.bidderTeam} bid{' '}
            </Text>
            <Text style={[styles.bidStatusValue, { color: gameState?.trump ? SUIT_COLOR[gameState.trump] : '#fff' }]}>
              {currentBid} {gameState?.trump ? SUIT_ICON[gameState.trump] : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.bidStatusText}>No bids yet</Text>
        )}

        {gameState?.lastRoundResult && (
          <View style={styles.lastRoundRow}>
            <Text style={styles.lastRoundLabel}>Last round</Text>
            <Text style={styles.lastRoundDetail}>
              T1: {gameState.lastRoundResult.team1Raw}→{gameState.lastRoundResult.team1Final}{'  '}
              T2: {gameState.lastRoundResult.team2Raw}→{gameState.lastRoundResult.team2Final}{'  '}
              (Bid {gameState.lastRoundResult.bid} T{gameState.lastRoundResult.biddingTeam}{' '}
              {gameState.lastRoundResult.madeBid ? '✅' : '❌'})
            </Text>
          </View>
        )}

        {isSpectating ? (
          <Text style={styles.waitingText}>
            Watching bidding phase…
          </Text>
        ) : iHavePassed ? (
          <View style={styles.waitingBox}>
            <Text style={[styles.waitingText, { color: '#ff6b6b' }]}>You passed ✗</Text>
            <ActivityIndicator size="small" color="#555" style={{ marginTop: 6 }} />
            <Text style={styles.waitingText}>Waiting for {currentPlayerLabel}…</Text>
          </View>
        ) : isMyTurn ? (
          <>
            <Text style={styles.yourTurnLabel}>Your turn to bid</Text>

            <View style={styles.bidLevelRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setPendingBidLevel(l => Math.max(minBid, l - 1))}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.bidLevelValue}>{displayLevel}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setPendingBidLevel(l => Math.min(16, l + 1))}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.suitRow}>
              {(['hearts', 'diamonds', 'clubs', 'spades'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.suitChip, pendingBidSuit === s && styles.suitChipSelected]}
                  onPress={() => setPendingBidSuit(s)}>
                  <Text style={[styles.suitChipIcon, { color: SUIT_COLOR[s] }]}>
                    {SUIT_ICON[s]}
                  </Text>
                  <Text style={styles.suitChipLabel}>{SUIT_NAME[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.bidActionRow}>
              <TouchableOpacity
                style={[styles.bidActionBtn, styles.bidBtnGreen, displayLevel <= currentBid && styles.bidBtnDisabled]}
                onPress={handleMakeBid}
                disabled={displayLevel <= currentBid}>
                <Text style={styles.bidActionBtnText}>Bid {displayLevel} {SUIT_ICON[pendingBidSuit || 'hearts']}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bidActionBtn, styles.bidBtnRed]}
                onPress={handlePass}>
                <Text style={styles.bidActionBtnText}>Pass</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.waitingText}>
            Waiting for {currentPlayerLabel}…
          </Text>
        )}

        <View style={styles.handContainer}>
          {isSpectating ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={[styles.handLabel, { fontSize: 16, color: '#f59e0b' }]}>👁️ Watching Game</Text>
              <Text style={[styles.handLabel, { fontSize: 12, opacity: 0.6, marginTop: 4 }]}>You are spectating this match</Text>
            </View>
          ) : myHand.length > 0 && (
            <>
              <Text style={styles.handLabel}>Your Hand</Text>
              <CardHandFan
                cards={myHand}
                maxWidth={SW - 32}
                renderCard={(card, idx) => (
                  <DynamicCard
                    key={`${card.suit}-${card.rank}-${idx}`}
                    card={card}
                    theme={customTheme}
                    size="medium"
                  />
                )}
              />
            </>
          )}
        </View>

        <View style={styles.scoreReminder}>
          <View style={styles.scoreBoard}>
            <View style={styles.teamScore}>
              <Text style={styles.teamLabel}>Team 1</Text>
              <Text style={styles.score}>{gameState?.gameScore.team1}</Text>
            </View>
            {gameState?.trump && (
              <View style={styles.trumpDisplay}>
                <Text style={styles.trumpLabel}>Trump</Text>
                <Text style={styles.trumpSuit}>
                  {SUIT_ICON[gameState.trump]}
                </Text>
              </View>
            )}
            <View style={styles.teamScore}>
              <Text style={styles.teamLabel}>Team 2</Text>
              <Text style={styles.score}>{gameState?.gameScore.team2}</Text>
            </View>
          </View>
          <Text style={styles.targetText}>Target: {gameState?.targetScore}</Text>
        </View>
      </View>
    );
  };

  const computeCurrentRoundPoints = () => {
    if (!gameState) return { team1: 0, team2: 0 };
    const rankPts: Record<string, number> = { '7':0,'8':0,'9':0,'J':2,'Q':3,'K':4,'10':10,'A':11 };
    const trumpPts: Record<string, number> = { '7':0,'8':0,'9':14,'J':20,'Q':3,'K':4,'10':10,'A':11 };
    let t1 = 0, t2 = 0;
    for (const trick of (gameState.completedTricks || [])) {
      for (const play of trick) {
        const pts = play.card.suit === gameState.trump
          ? trumpPts[play.card.rank] ?? 0
          : rankPts[play.card.rank] ?? 0;
        const pl = players.find(p => p.position === play.playerPosition);
        if (pl?.team === 1) t1 += pts; else t2 += pts;
      }
    }
    return { team1: t1, team2: t2 };
  };

  const trickCardForPlayer = (pos: number): CardType | null =>
    (gameState?.currentTrick ?? []).find(c => c.playerPosition === pos)?.card ?? null;

  const playerLabelForPos = (pos: number): string => {
    const info = players.find(p => p.position === pos);
    if (!info) return `P${pos}`;
    return info.isAI ? `CPU (T${info.team})` : `P${pos} (T${info.team})`;
  };

  const renderPlayingPhase = () => {
    const isMyTurn = gameState?.currentPlayer === myPosition;
    const myHand = gameState?.playerHands[myPosition] || [];
    const currentPlayerInfo = players.find(p => p.position === gameState?.currentPlayer);
    const currentPlayerLabel = currentPlayerInfo
      ? (currentPlayerInfo.isAI ? `CPU (T${currentPlayerInfo.team})` : `P${currentPlayerInfo.position} (T${currentPlayerInfo.team})`)
      : `Player ${gameState?.currentPlayer}`;

    const topPos   = (myPosition + 2) % 4;
    const rightPos = (myPosition + 1) % 4;
    const leftPos  = (myPosition + 3) % 4;
    const trump = gameState?.trump;

    const { width, height } = Dimensions.get('window');
    const TABLE_SIZE = Math.min(width - 32, height * 0.4);

    return (
      <>
        <View style={styles.playArea}>
          {/* Whose turn */}
          <Text style={styles.currentPlayerText}>
            {isMyTurn
              ? `⭐ Your Turn (Team ${myTeam})`
              : `⏳ ${currentPlayerLabel}'s Turn`
            }
          </Text>

          {/* Card table */}
          <View style={[styles.tableContainer, { width: TABLE_SIZE, height: TABLE_SIZE }]}>
            {showBackground ? (
              <ImageBackground
                source={customTheme?.boardImage ? { uri: customTheme.boardImage } : require('../../assets/blot/card-table.png')}
                style={styles.cardTable}
                imageStyle={{ borderRadius: 16 }}>
                <View style={styles.trickArea}>
                  <View style={[styles.cardPlaceholder, styles.trickSlotTop]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotBottom]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotLeft]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotRight]} />
                </View>
                {displayTrick && displayTrick.length > 0 && (() => {
                  const ledSuit = displayTrick[0].card.suit;
                  const positionStyle: Record<number, object> = {
                    0: styles.trickSlotBottom, 1: styles.trickSlotRight,
                    2: styles.trickSlotTop, 3: styles.trickSlotLeft,
                  };
                  return (
                    <View style={styles.trickArea}>
                      <View style={styles.ledSuitBadge}>
                        <Text style={[styles.ledSuitIcon, { color: SUIT_COLOR[ledSuit] }]}>{SUIT_ICON[ledSuit]}</Text>
                        <Text style={styles.ledSuitLabel}>Led</Text>
                      </View>
                      {displayTrick.map((tc, idx) => {
                        const relativePos = (tc.playerPosition - myPosition + 4) % 4;
                        return (
                          <View key={idx} style={[styles.trickSlot, positionStyle[relativePos] ?? styles.trickSlotTop]}>
                            <DynamicCard card={tc.card} theme={customTheme} size="small" />
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </ImageBackground>
            ) : (
              <View style={styles.cardTable}>
                <View style={styles.trickArea}>
                  <View style={[styles.cardPlaceholder, styles.trickSlotTop]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotBottom]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotLeft]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotRight]} />
                </View>
                {displayTrick && displayTrick.length > 0 && (() => {
                  const ledSuit = displayTrick[0].card.suit;
                  const positionStyle: Record<number, object> = {
                    0: styles.trickSlotBottom, 1: styles.trickSlotRight,
                    2: styles.trickSlotTop, 3: styles.trickSlotLeft,
                  };
                  return (
                    <View style={styles.trickArea}>
                      <View style={styles.ledSuitBadge}>
                        <Text style={[styles.ledSuitIcon, { color: SUIT_COLOR[ledSuit] }]}>{SUIT_ICON[ledSuit]}</Text>
                        <Text style={styles.ledSuitLabel}>Led</Text>
                      </View>
                      {displayTrick.map((tc, idx) => {
                        const relativePos = (tc.playerPosition - myPosition + 4) % 4;
                        return (
                          <View key={idx} style={[styles.trickSlot, positionStyle[relativePos] ?? styles.trickSlotTop]}>
                            <DynamicCard card={tc.card} theme={customTheme} size="small" />
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            )}
          </View>
        </View>

        {/* Player's hand */}
        <View style={styles.handContainer}>
          {isSpectating ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={[styles.handLabel, { fontSize: 16, color: '#f59e0b' }]}>👁️ Watching Game</Text>
              <Text style={[styles.handLabel, { fontSize: 12, opacity: 0.6, marginTop: 4 }]}>You are spectating this match</Text>
            </View>
          ) : (
            <>
              {isMyTurn ? (
                <Text style={styles.handLabel}>Your turn ↓</Text>
              ) : (
                <Text style={styles.handLabelWait}>Waiting…</Text>
              )}
              <CardHandFan
                cards={myHand}
                maxWidth={SW - 32}
                renderCard={(card, idx) => {
                  return (
                    <TouchableOpacity
                      key={`${card.suit}-${card.rank}-${idx}`}
                      onPress={() => {
                        if (isMyTurn) {
                          setSelectedCard(card);
                          handlePlayCard(card);
                        }
                      }}
                      style={[
                        styles.cardWrapper,
                        !isMyTurn ? styles.cardDimmed : styles.cardLegal,
                        selectedCard === card && styles.selectedCard,
                      ]}>
                      <DynamicCard card={card} theme={customTheme} size="medium" />
                    </TouchableOpacity>
                  );
                }}
              />
            </>
          )}
        </View>
      </>
    );
  };

  const handleSaveRoomName = useCallback((newName: string) => {
    setRoomName(newName);
    const rid = roomIdRef.current || roomId;
    if (rid) {
      socketService.setRoomName(rid, newName);
    }
  }, [roomId]);

  const renderGame = () => {
    if (!gameState) {
      return (
        <ImageBackground
          source={require('../../assets/blot/park-background.png')}
          style={styles.bg}
          blurRadius={showBlur ? 3 : 0}
          resizeMode="cover">
          <LinearGradient
            colors={showBlur ? ['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)'] : ['transparent', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={styles.safe}>
            <View>
              <GameToolbar
                title="Bazaar Blot"
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
              <ExpandableView isExpanded={toolbarExpanded} viewKey="baazarMpToolbarControls" duration={300}>
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
                </View>
              </ExpandableView>
            </View>
            <View style={styles.centeredSection}>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.waitingText}>Waiting for game to start…</Text>
            </View>
          </SafeAreaView>
        </ImageBackground>
      );
    }

    return (
      <ImageBackground
        source={require('../../assets/blot/park-background.png')}
        style={styles.bg}
        blurRadius={showBlur ? 3 : 0}
        resizeMode="cover">
        <LinearGradient
          colors={showBlur ? ['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)'] : ['transparent', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe}>
          <View>
            <GameToolbar
              title={roomName}
              onBack={() => navigation.goBack()}
              backgroundColor="transparent"
              rightElement={
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <RoomInfoDrawer roomId={roomId} />
                  <TouchableOpacity
                    onPress={() => { toolbarExpanded.value = !toolbarExpanded.value; }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.editRoomButton}
                  >
                    <Animated.Text style={[styles.editRoomIcon, chevronStyle]}>⌄</Animated.Text>
                  </TouchableOpacity>
                </View>
              }
            />
            <ExpandableView isExpanded={toolbarExpanded} viewKey="baazarMpToolbarControls" duration={300}>
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
                  onPress={() => setShowRoomNameModal(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.editRoomButton}
                >
                  <Text style={styles.editRoomIcon}>✏️</Text>
                </TouchableOpacity>
              </View>
            </ExpandableView>
          </View>

          {/* Players strip */}
          <View style={styles.playersStrip}>
            {players.filter(p => p != null).map((player, idx) => {
              const hasPassed = gameState.passedPlayers?.includes(player.position);
              return (
                <View
                  key={idx}
                  style={[
                    styles.playerChip,
                    player.position === myPosition && styles.playerChipMe,
                    gameState.currentPlayer === player.position && styles.playerChipActive,
                    hasPassed && { opacity: 0.4 }
                  ]}>
                  <Text style={[styles.playerChipText, { color: player.isAI ? '#ff9500' : '#fff' }]}>
                    {player.isAI ? '🤖' : '👤'} {player.isAI ? 'CPU' : 'P' + player.position} (T{player.team}){hasPassed ? ' ✗' : ''}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Score Board - always visible when in game */}
          {gameState && gameState.phase === 'playing' && (() => {
            const rp = computeCurrentRoundPoints();
            const trump = gameState.trump;
            return (
              <View style={styles.scoreBoard}>
                <View style={styles.teamScore}>
                  <Text style={styles.teamLabel}>Team 1</Text>
                  <Text style={styles.score}>{gameState.gameScore.team1 ?? 0}</Text>
                  {gameState.phase === 'playing' && (
                    <Text style={styles.roundScore}>
                      {rp.team1} this round
                    </Text>
                  )}
                </View>
                {trump && (
                  <View style={styles.trumpDisplay}>
                    <Text style={styles.trumpLabel}>Trump</Text>
                    <Text style={styles.trumpSuit}>{SUIT_ICON[trump]}</Text>
                    <Text style={styles.bidInfo}>
                      Bid: {gameState.currentBid}
                      {gameState.lastRoundResult && !gameState.lastRoundResult.madeBid ? ' ❌' : ''}
                    </Text>
                  </View>
                )}
                <View style={styles.teamScore}>
                  <Text style={styles.teamLabel}>Team 2</Text>
                  <Text style={styles.score}>{gameState.gameScore.team2 ?? 0}</Text>
                  {gameState.phase === 'playing' && (
                    <Text style={styles.roundScore}>
                      {rp.team2} this round
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}

          <View style={styles.body}>
            {gameState.phase === 'bidding' && renderBiddingPhase()}
            {gameState.phase === 'playing' && renderPlayingPhase()}
          </View>

          {/* In-game chat overlay */}
          <InGameChat
            roomId={roomId || ''}
            currentUserId={userId}
            gameType="baazar-blot"
            visible={!!(roomId)}
          />
        </SafeAreaView>

      <RiffleDealAnimation
        visible={showDealAnimation}
        playerPositions={[
          { x: 0, y: SW * 0.6 },
          { x: SW * 0.34, y: 0 },
          { x: 0, y: -SW * 0.6 },
          { x: -SW * 0.34, y: 0 },
        ]}
        dealerPosition={{ x: SW / 2, y: Dimensions.get('window').height / 2 }}
        cardsPerPlayer={8}
        theme={customTheme as any}
        onComplete={() => {
          showDealAnimationRef.current = false;
          setShowDealAnimation(false);
          if (pendingGameStateRef.current !== null) {
            setGameState(pendingGameStateRef.current);
            pendingGameStateRef.current = null;
            setSelectedCard(null);
          }
        }}
      />

      {/* Room Name Editor Modal */}
      <RoomNameModal
          visible={showRoomNameModal}
          onClose={() => setShowRoomNameModal(false)}
          currentName={roomName}
          onSave={handleSaveRoomName}
          gameType="Baazar Blot"
        />
      </ImageBackground>
    );
  };

  if (gameMode === 'menu') return (
    <>
      {renderMenu()}
      <CardCustomizationModal
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onSave={handleSaveTheme}
        currentTheme={customTheme}
      />
    </>
  );
  if (gameMode === 'matchmaking') return renderMatchmaking();
  if (gameMode === 'private') return renderPrivateRoom();
  if (gameMode === 'game') return (
    <>
      {renderGame()}
      <CardCustomizationModal
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onSave={handleSaveTheme}
        currentTheme={customTheme}
      />
    </>
  );

  return null;
};

const styles = StyleSheet.create({
  // ── Root layout ────────────────────────────────────────────────────────
  bg: { flex: 1 },
  safe: { flex: 1 },
  body: { flex: 1 },

  // ── Menu / matchmaking ─────────────────────────────────────────────────
  menuBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bigTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 24,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 20,
    marginBottom: 32,
    width: '100%',
  },
  infoText: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 14,
    alignItems: 'center',
    minWidth: 200,
  },
  primaryBtnText: { fontSize: 17, fontWeight: 'bold', color: '#0A3622' },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 40,
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
    minWidth: 200,
  },
  secondaryBtnText: { color: '#FFD700', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusText: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },

  // ── Players strip ──────────────────────────────────────────────────────
  playersStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 6,
  },
  playerChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  playerChipMe: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderColor: '#FFD700',
  },
  playerChipActive: {
    borderColor: '#4caf50',
    borderWidth: 2,
  },
  playerChipText: { fontSize: 12, fontWeight: '600' },

  // ── Bidding phase ──────────────────────────────────────────────────────
  centeredSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 16,
  },
  bidStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  bidStatusText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bidStatusValue: { fontSize: 20, fontWeight: 'bold' },
  yourTurnLabel: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
  },
  bidLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  stepBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#fff', fontSize: 26, fontWeight: '700', lineHeight: 30 },
  bidLevelValue: {
    color: '#FFD700',
    fontSize: 36,
    fontWeight: 'bold',
    minWidth: 48,
    textAlign: 'center',
  },
  suitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  suitChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 70,
  },
  suitChipSelected: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.18)',
  },
  suitChipIcon: { fontSize: 26 },
  suitChipLabel: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 2 },
  bidActionRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  bidActionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
  },
  bidBtnGreen: { backgroundColor: '#2e7d32', borderColor: '#4caf50' },
  bidBtnRed: { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  bidBtnDisabled: { opacity: 0.4 },
  bidActionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  waitingBox: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  waitingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  lastRoundRow: {
    marginTop: 6,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 6,
    width: '100%',
  },
  lastRoundLabel: {
    color: '#888',
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  lastRoundDetail: {
    color: '#ccc',
    fontSize: 11,
    textAlign: 'center',
  },
  handLabel: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  handLabelWait: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  scoreReminder: { alignItems: 'center', marginTop: 12 },
  scoreBoard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'transparent',
    marginVertical: 12,
  },
  teamScore: {
    flex: 1,
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
  roundScore: {
    fontSize: 12,
    color: '#90EE90',
  },
  trumpDisplay: {
    flex: 1,
    maxWidth: 70,
    maxHeight: 98,
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
  },
  trumpLabel: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 4,
  },
  trumpSuit: {
    fontSize: 32,
  },
  bidInfo: {
    fontSize: 10,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  targetText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 8,
  },

  // ── Playing phase ──────────────────────────────────────────────────────
  playArea: { 
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  currentPlayerText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  tableContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardTable: { 
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
  ledSuitBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  ledSuitIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  ledSuitLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  trickSlot: { position: 'absolute', alignItems: 'center' },
  trickSlotTop: { 
    top: 25,
    left: '50%',
    marginLeft: -45,
  },
  trickSlotBottom: { 
    bottom: 25,
    left: '50%',
    marginLeft: -45,
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
  trickPlayerName: { color: '#fff', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  handContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 12,
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cardWrapper: { borderRadius: 6 },
  cardLegal: { opacity: 1, transform: [{ translateY: -4 }] },
  cardDimmed: { opacity: 0.45 },
  selectedCard: { transform: [{ translateY: -10 }] },
  editRoomButton: { padding: 6, borderRadius: 8 },
  editRoomIcon: { fontSize: 22, color: '#FFD700' },
  toolbarControls: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 3,
    flexWrap: 'wrap',
    alignSelf: 'flex-end',
  },
});

export default MultiplayerBaazarBlotScreen;
