import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { socketService } from '../services/socket.service';
import { blotAIService } from '../services/blotAI.service';

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
}

interface GameState {
  deck: Card[];
  player1Hand: Card[];
  player2Hand: Card[];
  currentTrick: Card[];
  trumpSuit: string | null;
  player1Score: number;
  player2Score: number;
  round: number;
}

interface LocalGameState {
  deck: Card[];
  playerHand: Card[];
  computerHand: Card[];
  playerTricks: Card[][];
  computerTricks: Card[][];
  currentTrick: Card[];
  trumpSuit: string | null;
  currentTurn: 'player' | 'computer';
  playerScore: number;
  computerScore: number;
  round: number;
  status: 'active' | 'won' | 'draw';
  winnerId?: 'player' | 'computer';
}

const MultiplayerBlotScreen = ({ navigation, route }: any) => {
  const userId = route.params?.userId || 'test-user-' + Math.random().toString(36).substr(2, 9);
  
  const [gameMode, setGameMode] = useState<'menu' | 'matchmaking' | 'private' | 'game' | 'local'>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localGameState, setLocalGameState] = useState<LocalGameState | null>(null);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [opponent, setOpponent] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isLocalGame, setIsLocalGame] = useState(false);

  useEffect(() => {
    connectSocket();

    return () => {
      socketService.removeAllListeners();
    };
  }, []);

  const connectSocket = async () => {
    try {
      setIsConnecting(true);
      await socketService.connect(userId);
      setupSocketListeners();
    } catch (error) {
      console.error('Socket connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to server');
    } finally {
      setIsConnecting(false);
    }
  };

  const setupSocketListeners = () => {
    // Match found
    socketService.onMatchFound((data) => {
      console.log('Match found:', data);
      setCurrentRoom(data);
      setPlayerColor(data.color);
      setOpponent(data.opponent);
      setGameMode('game');
      Alert.alert('Match Found!', 'Waiting for opponent to be ready...');
    });

    // Room created
    socketService.onRoomCreated((data) => {
      console.log('Room created:', data);
      setCurrentRoom(data);
      setRoomCode(data.roomCode);
      Alert.alert('Room Created!', `Share this code: ${data.roomCode}`);
    });

    // Room joined
    socketService.onRoomJoined((data) => {
      console.log('Room joined:', data);
      setCurrentRoom(data);
      setPlayerColor(data.color);
      setOpponent(data.opponent);
      setGameMode('game');
      Alert.alert('Joined Room!', 'Waiting for opponent to be ready...');
    });

    // Opponent joined
    socketService.onOpponentJoined((data) => {
      console.log('Opponent joined:', data);
      setOpponent(data.opponent);
      Alert.alert('Opponent Joined!', 'Get ready to play!');
    });

    // Game started
    socketService.onGameStarted((data) => {
      console.log('Game started:', data);
      setIsGameStarted(true);
      setGameState(data.gameState);
      setIsMyTurn(data.gameState.currentTurn === playerColor);
      Alert.alert('Game Started!', "Let's play!");
    });

    // Move made
    socketService.onMoveMade((data) => {
      console.log('Move made:', data);
      setGameState(data.gameState);
      setIsMyTurn(data.currentTurn === playerColor);
    });

    // Game ended
    socketService.onGameEnded((data) => {
      console.log('Game ended:', data);
      const isWinner = data.winnerId === userId;
      Alert.alert(
        'Game Over!',
        isWinner ? 'You won! 🎉' : 'You lost. Better luck next time!',
        [{ text: 'OK', onPress: () => setGameMode('menu') }]
      );
    });

    // Opponent disconnected
    socketService.onOpponentDisconnected((data) => {
      Alert.alert('Opponent Disconnected', data.message);
    });

    // Opponent reconnected
    socketService.onOpponentReconnected((data) => {
      Alert.alert('Opponent Reconnected', data.message);
    });

    // Matchmaking status
    socketService.onMatchmakingStatus((data) => {
      if (data.status === 'cancelled') {
        setGameMode('menu');
      }
    });

    // Errors
    socketService.onError((data) => {
      Alert.alert('Error', data.message || 'An error occurred');
    });
  };

  const handleFindMatch = () => {
    setGameMode('matchmaking');
    socketService.findMatch('blot', userId);
    Alert.alert('Finding Match', 'Looking for an opponent...');
  };

  const handleCancelMatchmaking = () => {
    socketService.cancelMatchmaking(userId);
    setGameMode('menu');
  };

  const handleCreatePrivateRoom = () => {
    setGameMode('private');
    socketService.createPrivateRoom('blot', userId);
  };

  const handleJoinPrivateRoom = () => {
    if (!roomCode.trim()) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }
    socketService.joinPrivateRoom(roomCode.toUpperCase(), userId);
  };

  const handlePlayerReady = () => {
    if (currentRoom?.roomId) {
      socketService.playerReady(currentRoom.roomId, userId);
    }
  };

  const handlePlayVsComputer = () => {
    setIsLocalGame(true);
    setGameMode('local');
    const newGame = blotAIService.initializeGame();
    setLocalGameState(newGame);
    setIsGameStarted(true);
    Alert.alert('Local Game', 'Playing against Computer!');
  };

  const handlePlayCard = (card: Card) => {
    if (isLocalGame) {
      handleLocalPlayCard(card);
    } else {
      handleMultiplayerPlayCard(card);
    }
  };

  const handleLocalPlayCard = (card: Card) => {
    if (!localGameState || localGameState.currentTurn !== 'player') return;

    setSelectedCard(card);
    
    // Player plays card
    let newStateisLocalGame) {
              setGameMode('menu');
              setIsLocalGame(false);
              setLocalGameState(null);
            } else if ( = blotAIService.playCard(localGameState, card);
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
        setLocalGameState(stateAfterComputer);
        
        // Check if game ended after computer move
        if (stateAfterComputer.status !== 'active') {
          handleLocalGameEnd(stateAfterComputer);
        }
      }, 1000); // Delay for better UX
    }
  };

  const handleMultiplayerPlayCard = (card: Card) => {
    if (!isMyTurn || !currentRoom?.roomId) return;

    setSelectedCard(card);
    
    const move = {
      card,
      playerId: userId,
    };

    socketService.makeMove(currentRoom.roomId, move);
  };

  const handleLocalGameEnd = (finalState: LocalGameState) => {
    const isWinner = finalState.winnerId === 'player';
    const isDraw = finalState.status === 'draw';
    
    Alert.alert(
      'Game Over!',
      isDraw 
        ? "It's a draw!" 
        : isWinner 
          ? 'You won! 🎉' 
          : 'Computer won. Better luck next time!',
      [{ 
        text: 'Play Again', 
        onPress: () => {
          const newGame = blotAIService.initializeGame();
          setLocalGameState(newGame);
        }
      },
      { 
        text: 'Main Menu', 
        onPress: () => {
          setGameMode('menu');
          setIsLocalGame(false);
          setLocalGameState(null);
        }
      }]
    );
  };

  const handleResign = () => {
    Alert.alert(
      'Resign',
      'Are you sure you want to resign?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resign',
          style: 'destructive',
          onPress: () => {
            if (currentRoom?.roomId) {
              socketService.resign(currentRoom.roomId, userId);
              setGameMode('menu');
            }
          },
        },
      ]
    );
  };

  const renderCard = (card: Card, index: number) => {
    const suitSymbol = {
      hearts: '♥️',
      diamonds: '♦️',
      clubs: '♣️',
    
    const canPlay = isLocalGame 
      ? (localGameState?.currentTurn === 'player')
      : isMyTurn;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.card,
          selectedCard === card && styles.selectedCard,
          !canPlay && styles.disabledCard,
        ]}
        onPress={() => handlePlayCard(card)}
        disabled={!canPlaycard && styles.selectedCard,
          !isMyTurn && styles.disabledCard,
        ]}
        onPress={() => handlePlayCard(card)}
        disabled={!isMyTurn}
      >
        <Text style={[styles.cardRank, { color: suitColor }]}>{card.rank}</Text>
        <Text style={styles.cardSuit}>Game</Text>
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
nderMenu = () => (
    <View style={styles.menuContainer}>
      <Text style={styles.title}>Blot Multiplayer</Text>
      <Text style={styles.userId}>Player ID: {userId}</Text>

      {isConnecting ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <>
          <TouchableOpacity style={styles.button} onPress={handleFindMatch}>
            <Text style={styles.buttonText}>🎮 Find Random Match</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleCreatePrivateRoom}>
            <Text style={styles.buttonText}>🔒 Create Private Room</Text>
          </TouchableOpacity>

          <View style={styles.joinContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter Room Code"
              value={roomCode}
              onChangeText={setRoomCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity 
              style={[styles.button, styles.joinButton]} 
              onPress={handleJoinPrivateRoom}
            >
              <Text style={styles.buttonText}>Join Room</Text>
            </TouchableOpacity>
          </View>
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
      {roomCodLocalGame = () => {
    if (!localGameState) return null;

    return (
      <View style={styles.gameContainer}>
        <View style={styles.header}>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Your Score:</Text>
            <Text style={styles.scoreValue}>{localGameState.playerScore}</Text>
          </View>
          
          <View style={styles.turnIndicator}>
            <Text style={styles.turnText}>
              {localGameState.currentTurn === 'player' ? "Your Turn" : "Computer's Turn"}
            </Text>
            {localGameState.currentTurn === 'player' && <View style={styles.turnDot} />}
          </View>

          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Computer Score:</Text>
            <Text style={styles.scoreValue}>{localGameState.computerScore}</Text>
          </View>
        </View>

        {localGameState.trumpSuit && (
          <View style={styles.trumpContainer}>
            <Text style={styles.trumpText}>Trump: {localGameState.trumpSuit}</Text>
          </View>
        )}

        <View style={styles.currentTrickContainer}>
          <Text style={styles.sectionTitle}>Current Trick</Text>
          <View style={styles.trickCards}>
            {localGameState.currentTrick.length > 0 ? (
              localGameState.currentTrick.map((card, index) => renderCard(card, index))
            ) : (
              <Text style={styles.emptyText}>No cards played yet</Text>
            )}
          </View>
        </View>

        <View style={styles.handContainer}>
          <Text style={styles.sectionTitle}>Your Hand</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.handCards}>
              {localGameState.playerHand.map((card, index) => renderCard(card, index))}
            </View>
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
          <Text style={styles.resignButtonText}>Quit Game</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const rendere && (
        <>
          <Text style={styles.roomCodeLabel}>Room Code:</Text>
          <Text style={styles.roomCodeText}>{roomCode}</Text>
          <Text style={styles.waitingText}>Waiting for opponent to join...</Text>
        </>
      )}
      <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      <TouchableOpacity style={styles.cancelButton} onPress={() => setGameMode('menu')}>
        <Text style={styles.buttonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGame = () => {
    const playerHand = playerColor === 'white' 
      ? gameState?.player1Hand || [] 
      : gameState?.player2Hand || [];

    return (local' && renderLocalGame()}
      {gameMode === '
      <View style={styles.gameContainer}>
        <View style={styles.header}>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Your Score:</Text>
            <Text style={styles.scoreValue}>
              {playerColor === 'white' ? gameState?.player1Score || 0 : gameState?.player2Score || 0}
            </Text>
          </View>
          
          <View style={styles.turnIndicator}>
            <Text style={styles.turnText}>
              {isMyTurn ? "Your Turn" : "Opponent's Turn"}
            </Text>
            {isMyTurn && <View style={styles.turnDot} />}
          </View>

          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Opponent Score:</Text>
            <Text style={styles.scoreValue}>
              {playerColor === 'white' ? gameState?.player2Score || 0 : gameState?.player1Score || 0}
            </Text>
          </View>
        </View>

        {gameState?.trumpSuit && (
          <View style={styles.trumpContainer}>
            <Text style={styles.trumpText}>Trump: {gameState.trumpSuit}</Text>
          </View>
        )}

        <View style={styles.currentTrickContainer}>
          <Text style={styles.sectionTitle}>Current Trick</Text>
          <View style={styles.trickCards}>
            {gameState?.currentTrick && gameState.currentTrick.length > 0 ? (
              gameState.currentTrick.map((card, index) => renderCard(card, index))
            ) : (
              <Text style={styles.emptyText}>No cards played yet</Text>
            )}
          </View>
        </View>

        <View style={styles.handContainer}>
          <Text style={styles.sectionTitle}>Your Hand</Text>
          {!isGameStarted ? (
            <View style={styles.readyContainer}>
              <TouchableOpacity style={styles.readyButton} onPress={handlePlayerReady}>
                <Text style={styles.buttonText}>Ready to Play</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.handCards}>
                {playerHand.map((card, index) => renderCard(card, index))}
              </View>
            </ScrollView>
          )}
        </View>

        <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
          <Text style={styles.resignButtonText}>Resign</Text>
        </TouchableOpacity>
      </View>
    calButton: {
    backgroundColor: '#FF9500',
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
  lo);
  };

  return (
    <View style={styles.container}>
      {gameMode === 'menu' && renderMenu()}
      {gameMode === 'matchmaking' && renderMatchmaking()}
      {gameMode === 'private' && renderPrivateRoom()}
      {gameMode === 'game' && renderGame()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  joinContainer: {
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    width: 250,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: '#34C759',
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
  gameContainer: {
    flex: 1,
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#666',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  turnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
  currentTrickContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  trickCards: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    minHeight: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
  },
  handContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    flex: 1,
  },
  handCards: {
    flexDirection: 'row',
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
  readyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readyButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 10,
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
});

export default MultiplayerBlotScreen;
