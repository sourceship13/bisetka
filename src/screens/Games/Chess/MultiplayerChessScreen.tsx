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
import GameToolbar from '../../../components/global/GameToolbar';
import {
  ChessGameState,
  initializeChessGame,
  getPossibleMoves,
  makeMove as makeChessMove,
  isKingInCheck,
  isCheckmate,
  isStalemate,
  Position,
} from '../../../game/chessLogic';
import ChessPiece from '../../../components/ChessPiece';
import {socketService, GameMove} from '../../../services/SocketService';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import InGameChat from '../../../components/InGameChat';

const MultiplayerChessScreen = ({navigation, route}: any) => {
  const {userId, mode: routeMode, joinCode} = route.params; // Get from auth context
  const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'chess');
  const [mode, setMode] = useState<'menu' | 'matchmaking' | 'private' | 'game'>('menu');
  const [gameState, setGameState] = useState<ChessGameState | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const roomIdRef = React.useRef<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinRoomCode, setJoinRoomCode] = useState<string>('');
  const [myColor, setMyColor] = useState<'white' | 'black'>('white');
  // Ref so stale closures (socket listeners) always read the current value
  const myColorRef = React.useRef<'white' | 'black'>('white');
  const [opponentId, setOpponentId] = useState<string>('');
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [isMyTurn, setIsMyTurn] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<string>('Waiting for opponent...');
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    // Connect to socket server
    connectToServer();

    // Setup socket listeners (only once on mount)
    socketService.onMatchmakingStatus((data) => {
      if (data.status === 'searching') {
        setGameStatus('Searching for opponent...');
      }
    });

    socketService.onOpponentJoined((data) => {
      setOpponentId(data.opponent.id);
      setGameStatus('Opponent found! Get ready...');
    });

    socketService.onGameStarted((data) => {
      setGameStatus('Game started!');
      setMode('game');
      const initialGame = initializeChessGame('medium');
      setGameState(initialGame);
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
        const isStaleMate = isStalemate(newBoard, nextPlayer);

        return {
          ...prevState,
          board: newBoard,
          currentPlayer: nextPlayer,
          selectedSquare: null,
          possibleMoves: [],
          isCheck,
          isCheckmate: isCheckMate,
          isStalemate: isStaleMate,
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

    // Auto-start based on route mode
    if (routeMode === 'random') {
      handleFindMatch();
    } else if (routeMode === 'private-create') {
      handleCreatePrivateRoom();
    } else if (routeMode === 'private-join' && joinCode) {
      setJoinRoomCode(joinCode);
    }

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
      await socketService.connect(userId, 'temp-token'); // Use real token from auth
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
      myColorRef.current = matchData.color;
      setRoomId(matchData.roomId);
      setMyColor(matchData.color);
      setOpponentId(matchData.opponent.id);
      setIsMyTurn(matchData.color === 'white');
      
      // Send ready signal
      socketService.playerReady(matchData.roomId, userId);
    } catch (error: any) {
      BisetkaAlert.error('Matchmaking Error', error.message);
      setMode('menu');
    }
  };

  const handleCreatePrivateRoom = async () => {
    try {
      const roomData = await socketService.createPrivateRoom('chess', userId);
      roomIdRef.current = roomData.roomId;
      myColorRef.current = 'white';
      setRoomId(roomData.roomId);
      setRoomCode(roomData.roomCode);
      setMyColor('white');
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
      myColorRef.current = roomData.color;
      setRoomId(roomData.roomId);
      setMyColor(roomData.color);
      setOpponentId(roomData.opponent.id);
      setMode('private');
      setShowJoinModal(false);
      
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

  const handleSquarePress = (row: number, col: number) => {
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
      const isValidMove = gameState.possibleMoves.some(
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
    const isStaleMate = isStalemate(newBoard, nextPlayer);

    setGameState({
      ...gameState,
      board: newBoard,
      currentPlayer: nextPlayer,
      selectedSquare: null,
      possibleMoves: [],
      isCheck,
      isCheckmate: isCheckMate,
      isStalemate: isStaleMate,
    });

    // Send move to server — use ref to avoid stale roomId
    const move: GameMove = {from, to};
    const liveRoomId = roomIdRef.current || roomId;
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
      BisetkaAlert.alert('Stalemate!', 'The game is a draw.', [
        {text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'chess-multiplayer'})},
      ]);
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

  const renderSquare = (row: number, col: number) => {
    if (!gameState) return null;

    const piece = gameState.board[row][col];
    const isWhiteSquare = (row + col) % 2 === 0;
    const isSelected =
      gameState.selectedSquare?.row === row &&
      gameState.selectedSquare?.col === col;
    const isPossibleMove = gameState.possibleMoves.some(
      m => m.row === row && m.col === col
    );

    return (
      <TouchableOpacity
        key={`${row}-${col}`}
        style={[
          styles.square,
          isWhiteSquare ? styles.whiteSquare : styles.blackSquare,
          isSelected && styles.selectedSquare,
        ]}
        onPress={() => handleSquarePress(row, col)}>
        {piece && <ChessPiece type={piece.type} color={piece.color} />}
        {isPossibleMove && <View style={styles.possibleMove} />}
      </TouchableOpacity>
    );
  };

  const renderBoard = () => {
    if (!gameState) return null;

    return (
      <View style={styles.board}>
        {gameState.board.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((_, colIndex) => renderSquare(rowIndex, colIndex))}
          </View>
        ))}
      </View>
    );
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
      <ActivityIndicator size="large" color="#007AFF" />
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
          <Text style={styles.title}>Private Game Created</Text>
          <Text style={styles.roomCodeText}>Room Code:</Text>
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
    <SafeAreaView style={styles.container}>
      <GameToolbar title="Multiplayer Chess" onBack={() => navigation.goBack()} backgroundColor="transparent" />
      {mode === 'menu' && renderMenu()}
      {mode === 'matchmaking' && renderMatchmaking()}
      {mode === 'private' && renderPrivateRoom()}
      {mode === 'game' && gameState && (
        <>
          <View style={styles.header}>
            <Text style={styles.turnText}>
              {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
            </Text>
            <Text style={styles.colorText}>
              You are playing as: {myColor === 'white' ? '⚪ White' : '⚫ Black'}
            </Text>
            {gameState.isCheck && (
              <Text style={styles.checkText}>⚠️ Check!</Text>
            )}
          </View>

          {renderBoard()}

          <View style={styles.controls}>
            <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
              <Text style={styles.resignButtonText}>Resign</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* In-game chat overlay (multiplayer only) */}
      <InGameChat
        roomId={roomId}
        currentUserId={userId}
        gameType="chess"
        visible={mode === 'game' && !!gameState && !!roomId}
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
                <Text style={[styles.modalButtonText, {color: 'white'}]}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    color: '#fff',
    marginBottom: 40,
  },
  menuButton: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 15,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#555',
    marginTop: 20,
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
    color: '#888',
    marginTop: 10,
    textAlign: 'center',
  },
  roomCodeText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 30,
  },
  roomCode: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 10,
    letterSpacing: 4,
  },
  cancelButton: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    minWidth: 150,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    padding: 15,
    backgroundColor: '#16213e',
    alignItems: 'center',
  },
  turnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  colorText: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 5,
  },
  checkText: {
    fontSize: 18,
    color: '#ff3b30',
    fontWeight: 'bold',
    marginTop: 5,
  },
  board: {
    alignSelf: 'center',
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#333',
  },
  row: {
    flexDirection: 'row',
  },
  square: {
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whiteSquare: {
    backgroundColor: '#f0d9b5',
  },
  blackSquare: {
    backgroundColor: '#b58863',
  },
  selectedSquare: {
    backgroundColor: '#7cb342',
  },
  possibleMove: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.5)',
  },
  controls: {
    padding: 20,
    alignItems: 'center',
  },
  resignButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
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
});

export default MultiplayerChessScreen;
