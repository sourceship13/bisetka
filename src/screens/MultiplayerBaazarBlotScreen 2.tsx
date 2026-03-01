import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { BisetkaAlert } from '../utils/BisetkaAlert';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { socketService } from '../services/SocketService';
import tokenService from '../services/token.service';
import DynamicCard from '../components/DynamicCard';
import { CardType } from '../components/Card';

const { width: SW } = Dimensions.get('window');

const SUIT_ICON: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
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
}

const MultiplayerBaazarBlotScreen = ({ navigation, route }: any) => {
  const userId = route.params?.userId || 'test-user-' + Math.random().toString(36).substr(2, 9);
  
  const [gameMode, setGameMode] = useState<'menu' | 'matchmaking' | 'game'>('menu');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [myPosition, setMyPosition] = useState<number>(-1);
  const [myTeam, setMyTeam] = useState<1 | 2>(1);
  const [gameState, setGameState] = useState<BaazarGameState | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [pendingBidLevel, setPendingBidLevel] = useState<number>(9);
  const [pendingBidSuit, setPendingBidSuit] = useState<string>('hearts'); // pre-select hearts so Make Bid is always ready

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

      // Baazar Blot matchmaking events
      socket.on('baazar_match_found', (data: { 
        roomId: string; 
        players: GamePlayer[]; 
        yourPosition: number;
        yourTeam: 1 | 2;
      }) => {
        console.log('🎲 Baazar match found:', data);
        setRoomId(data.roomId);
        setPlayers(data.players);
        setMyPosition(data.yourPosition);
        setMyTeam(data.yourTeam);
        setGameMode('game');
        setIsConnecting(false);

        // Automatically mark player as ready
        socket.emit('baazar_player_ready', {
          roomId: data.roomId,
          userId
        });
      });

      socket.on('baazar_game_started', (data: { 
        roomId?: string;
        players: GamePlayer[]; 
        gameState: BaazarGameState 
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
        console.log('💰 Bid made:', data);
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
        console.log('🃏 Card played:', data);
        setGameState({ ...data.gameState, currentPlayer: data.currentPlayer });
        setSelectedCard(null);
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

      socket.on('error', (error: { message: string }) => {
        console.error('❌ Socket error:', error);
        BisetkaAlert.error('Error', error.message);
      });
    };

    setupSocketListeners();

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('baazar_match_found');
        socket.off('baazar_game_started');
        socket.off('baazar_bid_made');
        socket.off('baazar_card_played');
        socket.off('baazar_game_ended');
        socket.off('error');
      }
    };
  }, [userId, navigation]);

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
      socket.emit('find_match', {
        userId,
        gameType: 'baazar-blot'
      });
      console.log('🔍 Joined Baazar Blot matchmaking queue');
    }
  };

  const handleCancelMatchmaking = () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('cancel_matchmaking', { userId });
      console.log('❌ Cancelled matchmaking');
    }
    setIsConnecting(false);
    setGameMode('menu');
  };

  const handleMakeBid = () => {
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

  const renderMenu = () => (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Baazar Blot Multiplayer</Text>
        
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>🎮 4-Player Team Game</Text>
          <Text style={styles.infoText}>👥 You + Teammate vs 2 Opponents</Text>
          <Text style={styles.infoText}>🤖 AI players fill empty spots</Text>
          <Text style={styles.infoText}>🎯 First to 301 points wins!</Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleFindMatch}
        >
          <LinearGradient
            colors={['#00d4ff', '#0099cc']}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Find Match</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );

  const renderMatchmaking = () => (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Finding Match...</Text>
        
        <ActivityIndicator size="large" color="#00d4ff" style={styles.loader} />
        
        <Text style={styles.statusText}>
          Looking for players...
        </Text>
        <Text style={styles.infoText}>
          Minimum 2 real players required
        </Text>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleCancelMatchmaking}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );

  const renderBiddingPhase = () => {
    const isMyTurn = gameState?.currentPlayer === myPosition;
    const myHand = gameState?.playerHands[myPosition] || [];

    return (
      <View style={styles.biddingContainer}>
        <Text style={styles.phaseTitle}>Bidding Phase</Text>
        
        <View style={styles.currentBidBox}>
          <Text style={styles.bidText}>Current Bid: {gameState?.currentBid || 9}</Text>
          {gameState?.trump && (
            <Text style={styles.trumpText}>
              Trump: {SUIT_ICON[gameState.trump]} {gameState.trump}
            </Text>
          )}
        </View>

        {isMyTurn ? (
          <View style={styles.biddingControls}>
            <Text style={styles.yourTurnText}>Your Turn!</Text>
            
            <View style={styles.suitSelector}>
              {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                <TouchableOpacity
                  key={suit}
                  style={[
                    styles.suitButton,
                    pendingBidSuit === suit && styles.suitButtonSelected
                  ]}
                  onPress={() => setPendingBidSuit(suit)}
                >
                  <Text style={styles.suitIcon}>{SUIT_ICON[suit]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.bidLevelSelector}>
              <TouchableOpacity
                style={styles.bidButton}
                onPress={() => setPendingBidLevel(l => Math.max((gameState?.currentBid || 8) + 1, l - 1))}
              >
                <Text style={styles.bidButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.bidLevelText}>{Math.max(pendingBidLevel, (gameState?.currentBid || 8) + 1)}</Text>
              <TouchableOpacity
                style={styles.bidButton}
                onPress={() => setPendingBidLevel(l => Math.min(16, l + 1))}
              >
                <Text style={styles.bidButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bidActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleMakeBid}
              >
                <Text style={styles.actionButtonText}>Bid {Math.max(pendingBidLevel, (gameState?.currentBid || 8) + 1)} {SUIT_ICON[pendingBidSuit || 'hearts']}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.passButton}
                onPress={handlePass}
              >
                <Text style={styles.passButtonText}>Pass</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.waitingBox}>
            <ActivityIndicator size="small" color="#00d4ff" />
            <Text style={styles.waitingText}>
              Waiting for Player {gameState?.currentPlayer}...
            </Text>
          </View>
        )}

        <View style={styles.handPreview}>
          <Text style={styles.handTitle}>Your Hand:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.cardsRow}>
              {myHand.map((card, idx) => (
                <View key={idx} style={styles.smallCard}>
                  <DynamicCard
                    card={card}
                    size="small"
                    onPress={() => {}}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderPlayingPhase = () => {
    const isMyTurn = gameState?.currentPlayer === myPosition;
    const myHand = gameState?.playerHands[myPosition] || [];

    return (
      <View style={styles.playingContainer}>
        <View style={styles.gameInfo}>
          <Text style={styles.trumpInfo}>
            Trump: {gameState?.trump ? SUIT_ICON[gameState.trump] : 'None'}
          </Text>
          <Text style={styles.scoreInfo}>
            Team 1: {gameState?.gameScore.team1} | Team 2: {gameState?.gameScore.team2}
          </Text>
        </View>

        <View style={styles.trickArea}>
          <Text style={styles.trickTitle}>Current Trick:</Text>
          <View style={styles.trickCards}>
            {gameState?.currentTrick.map((play, idx) => (
              <View key={idx} style={styles.trickCard}>
                <Text style={styles.playerLabel}>P{play.playerPosition}</Text>
                <DynamicCard
                  card={play.card}
                  size="small"
                  onPress={() => {}}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.handArea}>
          <Text style={styles.handTitle}>
            Your Hand {isMyTurn && '(Your Turn!)'}:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.cardsRow}>
              {myHand.map((card, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.playCard,
                    selectedCard === card && styles.selectedCard
                  ]}
                  onPress={() => {
                    if (isMyTurn) {
                      setSelectedCard(card);
                      handlePlayCard(card);
                    }
                  }}
                  disabled={!isMyTurn}
                >
                  <DynamicCard
                    card={card}
                    size="medium"
                    onPress={() => {}}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderGame = () => {
    if (!gameState) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00d4ff" />
          <Text style={styles.loadingText}>Waiting for game to start...</Text>
        </View>
      );
    }

    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Baazar Blot</Text>
            <Text style={styles.teamBadge}>Team {myTeam}</Text>
          </View>

          <View style={styles.playersInfo}>
            {players.filter(p => p != null).map((player, idx) => {
              const hasPassed = gameState.passedPlayers?.includes(player.position);
              return (
                <View
                  key={idx}
                  style={[
                    styles.playerBadge,
                    player.position === myPosition && styles.playerBadgeMe,
                    gameState.currentPlayer === player.position && styles.playerBadgeActive,
                    hasPassed && { opacity: 0.4 }
                  ]}
                >
                  <Text style={[
                    styles.playerText,
                    { color: player.isAI ? '#ff9500' : '#ffffff' }
                  ]}>
                    {player.isAI ? '🤖' : '👤'} {player.isAI ? 'CPU' : 'P' + player.position} (T{player.team}){hasPassed ? ' ✗' : ''}
                  </Text>
                </View>
              );
            })}
          </View>

          {gameState.phase === 'bidding' && renderBiddingPhase()}
          {gameState.phase === 'playing' && renderPlayingPhase()}
        </SafeAreaView>
      </LinearGradient>
    );
  };

  if (gameMode === 'menu') return renderMenu();
  if (gameMode === 'matchmaking') return renderMatchmaking();
  if (gameMode === 'game') return renderGame();

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00d4ff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  infoText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  primaryButton: {
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#00d4ff',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    marginVertical: 40,
  },
  statusText: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    color: '#00d4ff',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  teamBadge: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playersInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  playerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 8,
    margin: 5,
  },
  playerBadgeMe: {
    backgroundColor: 'rgba(0, 212, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#00d4ff',
  },
  playerBadgeActive: {
    borderWidth: 2,
    borderColor: '#ffd700',
  },
  playerText: {
    color: '#fff',
    fontSize: 14,
  },
  biddingContainer: {
    flex: 1,
  },
  phaseTitle: {
    fontSize: 24,
    color: '#00d4ff',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  currentBidBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  bidText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  trumpText: {
    color: '#00d4ff',
    fontSize: 20,
    textAlign: 'center',
    marginTop: 5,
  },
  biddingControls: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  yourTurnText: {
    color: '#ffd700',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: 'bold',
  },
  suitSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  suitButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  suitButtonSelected: {
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0, 212, 255, 0.3)',
  },
  suitIcon: {
    fontSize: 32,
  },
  bidLevelSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  bidButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  bidButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  bidLevelText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  bidActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#00d4ff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  passButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  passButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  waitingBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  waitingText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  handPreview: {
    marginTop: 20,
  },
  handTitle: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
  },
  cardsRow: {
    flexDirection: 'row',
    paddingHorizontal: 5,
  },
  smallCard: {
    marginRight: 8,
  },
  playingContainer: {
    flex: 1,
  },
  gameInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  trumpInfo: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 5,
  },
  scoreInfo: {
    color: '#00d4ff',
    fontSize: 16,
    textAlign: 'center',
  },
  trickArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    minHeight: 150,
  },
  trickTitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  trickCards: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  trickCard: {
    margin: 5,
    alignItems: 'center',
  },
  playerLabel: {
    color: '#00d4ff',
    fontSize: 12,
    marginBottom: 5,
  },
  handArea: {
    flex: 1,
  },
  playCard: {
    marginRight: 10,
  },
  selectedCard: {
    transform: [{ translateY: -10 }],
  },
});

export default MultiplayerBaazarBlotScreen;
