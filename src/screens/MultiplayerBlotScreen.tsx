import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  ImageBackground,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { socketService } from '../services/SocketService';
import { blotAIService, LocalGameState, Card } from '../services/blotAI.service';
import { gameResultService } from '../services/gameResult.service';
import { aiMoveLogService } from '../services/aiMoveLog.service';
import tokenService from '../services/token.service';
import { v4 as uuidv4 } from 'uuid';
import { useGameEndRefresh } from '../libs/hooks/useGameEndRefresh';

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

const MultiplayerBlotScreen = ({ navigation, route }: any) => {
  const userId = route.params?.userId || 'test-user-' + Math.random().toString(36).substr(2, 9);
  const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'blot');
  const initialMode = route.params?.mode; // 'ai', 'private-create', 'private-join', 'random'
  const initialDifficulty = route.params?.difficulty || 'medium';
  const initialJoinCode = route.params?.joinCode;
  
  // Determine initial gameMode based on navigation params
  const getInitialGameMode = () => {
    if (initialMode === 'ai') return 'local';
    if (initialMode === 'private-create') return 'private';
    if (initialMode === 'random') return 'matchmaking';
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
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [opponent, setOpponent] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isLocalGame, setIsLocalGame] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const gameStartTime = useRef<Date | null>(null);
  const blotGameIdRef = useRef<string>(uuidv4());
  const trickCountRef = useRef(0);
  const lastPlayerCardRef = useRef<Card | null>(null);

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
        
        // Auto-find match if coming with random mode
        if (initialMode === 'random') {
          await findMatchOnMount();
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
        Alert.alert('Authentication Error', 'Please log in to play multiplayer games');
        navigation.goBack();
        return;
      }
      await socketService.connect(userId, token);
      setupSocketListeners();
    } catch (error) {
      console.error('Socket connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to server');
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
      
      // Determine my color based on userId
      const myColor = data.player1?.id === userId ? 'white' : 'black';
      console.log('My userId:', userId);
      console.log('Player1 id:', data.player1?.id);
      console.log('Player2 id:', data.player2?.id);
      console.log('Determined my color:', myColor);
      console.log('Game currentTurn:', data.gameState?.currentTurn);
      console.log('Setting isMyTurn to:', data.gameState?.currentTurn === myColor);
      
      setPlayerColor(myColor);
      setIsGameStarted(true);
      setGameState(data.gameState);
      setGameMode('game');
      setIsMyTurn(data.gameState?.currentTurn === myColor);
    });

    // Move made
    socketService.onMoveMade((data: any) => {
      console.log('=== MOVE MADE ===');
      console.log('Move made data:', data);
      console.log('New currentTurn:', data.currentTurn);
      
      // Re-determine my color to avoid closure issues
      setPlayerColor(prevColor => {
        console.log('My color:', prevColor);
        const isMyTurn = data.currentTurn === prevColor;
        console.log('Setting isMyTurn to:', isMyTurn);
        setIsMyTurn(isMyTurn);
        return prevColor;
      });
      
      setGameState(data.gameState);
      setSelectedCard(null); // Clear selected card after move
    });

    // Game ended
    socketService.onGameEnded((data: any) => {
      console.log('Game ended:', data);
      const isWinner = data.winnerId === userId;
      Alert.alert(
        'Game Over!',
        isWinner ? 'You won! 🎉' : 'You lost. Better luck next time!',
        [{ text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'blot'}) }]
      );
    });

    // Opponent disconnected
    socketService.onOpponentDisconnected(() => {
      Alert.alert('Opponent Disconnected', 'Your opponent has disconnected from the game.');
    });

    // Matchmaking status
    socketService.onMatchmakingStatus((data: any) => {
      if (data.status === 'cancelled') {
        navigation.replace('GameMode', {gameType: 'blot'});
      }
    });

    // Errors
    socketService.onError((error: any) => {
      Alert.alert('Error', error.message || 'An error occurred');
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
    Alert.alert('Local Game', `Playing against Computer (${selectedDifficulty})!`);
  };

  const handleFindMatch = async () => {
    setGameMode('matchmaking');
    
    // Reset all game state before starting new match
    setGameState(null);
    setIsGameStarted(false);
    setIsMyTurn(false);
    setSelectedCard(null);
    setCurrentRoom(null);
    setOpponent(null);
    
    try {
      await ensureSocketConnected();
      const matchData = await socketService.findMatch('blot', userId);
      console.log('Match found data:', matchData);
      setCurrentRoom({ roomId: matchData.roomId });
      setPlayerColor(matchData.color);
      setOpponent(matchData.opponent);
      setIsMyTurn(matchData.color === 'white');
      
      // Don't auto-ready, let user click the button
      setGameMode('game');
    } catch (error: any) {
      Alert.alert('Matchmaking Error', error.message || 'Failed to find match');
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
    setIsGameStarted(false);
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
      Alert.alert('Error', 'Failed to create room');
      setGameMode('menu');
      console.error(error);
    }
  };
  
  // Auto-find match when navigating with random mode
  const findMatchOnMount = async () => {
    setGameState(null);
    setIsGameStarted(false);
    setIsMyTurn(false);
    setSelectedCard(null);
    setCurrentRoom(null);
    setOpponent(null);
    
    try {
      await ensureSocketConnected();
      const matchData = await socketService.findMatch('blot', userId);
      setCurrentRoom({ roomId: matchData.roomId });
      setPlayerColor(matchData.color);
      setOpponent(matchData.opponent);
      setIsMyTurn(matchData.color === 'white');
      setGameMode('game');
    } catch (error: any) {
      Alert.alert('Matchmaking Error', error.message || 'Failed to find match');
      setGameMode('menu');
    }
  };

  const handleCreatePrivateRoom = async () => {
    setGameMode('private');
    
    // Reset all game state before creating new room
    setGameState(null);
    setIsGameStarted(false);
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
      Alert.alert('Error', 'Failed to create room');
      setGameMode('menu');
      console.error(error);
    }
  };

  const handleJoinPrivateRoom = async () => {
    if (!joinRoomCode.trim()) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }
    
    // Reset all game state before joining room
    setGameState(null);
    setIsGameStarted(false);
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
      Alert.alert('Error', error.message || 'Failed to join room');
    }
  };

  const handlePlayerReady = () => {
    console.log('handlePlayerReady called');
    console.log('currentRoom:', currentRoom);
    console.log('userId:', userId);
    
    if (currentRoom?.roomId) {
      console.log('Sending player_ready to backend:', currentRoom.roomId, userId);
      socketService.playerReady(currentRoom.roomId, userId);
    } else {
      console.error('Cannot send player_ready: roomId is missing');
      Alert.alert('Error', 'Room ID is missing. Please try rejoining.');
    }
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
    console.log('handleMultiplayerPlayCard called');
    console.log('isMyTurn:', isMyTurn);
    console.log('currentRoom:', currentRoom);
    
    if (!isMyTurn || !currentRoom?.roomId) {
      console.log('Cannot play card - not my turn or no room');
      return;
    }

    setSelectedCard(card);
    
    // For Blot, we send the card data as the move
    // Cast to any since the GameMove interface is for chess
    const move = {
      card,
      playerId: userId,
    } as any;

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
    
    Alert.alert(
      'Game Over!',
      (isDraw 
        ? "It's a draw!" 
        : isWinner 
          ? 'You won! 🎉' 
          : 'Computer won. Better luck next time!') + pointsMessage,
      [{ 
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

  const renderCard = (card: Card, index: number) => {
    const suitSymbol = {
      hearts: '♥️',
      diamonds: '♦️',
      clubs: '♣️',
      spades: '♠️',
    };

    const suitColor = card.suit === 'hearts' || card.suit === 'diamonds' ? '#ff0000' : '#000000';
    
    const canPlay = isLocalGame 
      ? (localGameState?.currentTurn === 'player')
      : isMyTurn;
    
    // Log for first card only to avoid spam
    if (index === 0) {
      console.log(`renderCard - isMyTurn: ${isMyTurn}, canPlay: ${canPlay}, isLocalGame: ${isLocalGame}`);
    }

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.card,
          selectedCard === card && styles.selectedCard,
          !canPlay && styles.disabledCard,
        ]}
        onPress={() => handlePlayCard(card)}
        disabled={!canPlay}
      >
        <Text style={[styles.cardRank, { color: suitColor }]}>{card.rank}</Text>
        <Text style={styles.cardSuit}>{suitSymbol[card.suit]}</Text>
        <Text style={styles.cardValue}>{card.value}</Text>
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

  const renderGame = () => {
    const playerHand = playerColor === 'white' 
      ? gameState?.player1Hand || [] 
      : gameState?.player2Hand || [];

    return (
      <ScrollView 
        style={styles.gameContainer}
        contentContainerStyle={styles.gameScrollContent}
        showsVerticalScrollIndicator={true}
      >
        {!isGameStarted ? (
          // Show waiting/ready screen
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingTitle}>Match Found!</Text>
            <Text style={styles.waitingText}>
              Playing as: {playerColor === 'white' ? '⚪ White' : '⚫ Black'}
            </Text>
            <Text style={styles.waitingSubtext}>
              {opponent ? 'Opponent found!' : 'Waiting for opponent...'}
            </Text>
            <TouchableOpacity style={styles.readyButton} onPress={handlePlayerReady}>
              <Text style={styles.readyButtonText}>Ready to Play</Text>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.handCards}>
                  {playerHand.map((card, index) => renderCard(card, index))}
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
              <Text style={styles.resignButtonText}>Resign</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <ImageBackground
      source={require('../../assets/blot/park-background.png')}
      style={styles.container}
      blurRadius={3}>
      <LinearGradient
        colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']}
        style={styles.overlay}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      {gameMode === 'menu' && renderMenu()}
      {gameMode === 'matchmaking' && renderMatchmaking()}
      {gameMode === 'private' && renderPrivateRoom()}
      {gameMode === 'local' && renderLocalGame()}
      {gameMode === 'game' && renderGame()}

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
  gameScrollContent: {
    padding: 15,
    paddingBottom: 40,
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
  currentTrickContainer: {
    backgroundColor: 'rgba(10, 54, 34, 0.75)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#fff',
  },
  trickCards: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    minHeight: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },
  handContainer: {
    backgroundColor: 'rgba(10, 54, 34, 0.75)',
    borderRadius: 10,
    padding: 15,
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
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
});

export default MultiplayerBlotScreen;
