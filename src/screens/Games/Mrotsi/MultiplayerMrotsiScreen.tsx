import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';
import RoomNameModal from '../../../components/RoomNameModal';
import {socketService} from '../../../services/SocketService';
import tokenService from '../../../services/token.service';
import InGameChat from '../../../components/InGameChat';
import {BisetkaAlert} from '../../../utils/BisetkaAlert';
import {useGameEndRefresh} from '../../../libs/hooks/useGameEndRefresh';

// ─── Score helpers (same logic as MrotsiScreen) ──────────────────────────────
function calculateScore(dice: number[]): number {
  const counts = new Map<number, number>();
  dice.forEach(d => counts.set(d, (counts.get(d) || 0) + 1));
  if (Array.from(counts.values()).some(c => c === 5)) return 100;
  if (Array.from(counts.values()).some(c => c === 4)) return 50;
  const values = Array.from(counts.values()).sort();
  if (values.length === 2 && values[0] === 2 && values[1] === 3) return 40;
  if (Array.from(counts.values()).some(c => c === 3)) return 30;
  if (values.filter(v => v === 2).length === 2) return 20;
  if (Array.from(counts.values()).some(c => c === 2)) return 10;
  return Math.floor(dice.reduce((a, b) => a + b, 0) / 10);
}

function getScoreName(dice: number[]): string {
  const counts = new Map<number, number>();
  dice.forEach(d => counts.set(d, (counts.get(d) || 0) + 1));
  if (Array.from(counts.values()).some(c => c === 5)) return 'Five of a Kind!';
  if (Array.from(counts.values()).some(c => c === 4)) return 'Four of a Kind!';
  const values = Array.from(counts.values()).sort();
  if (values.length === 2 && values[0] === 2 && values[1] === 3) return 'Full House!';
  if (Array.from(counts.values()).some(c => c === 3)) return 'Three of a Kind';
  if (values.filter(v => v === 2).length === 2) return 'Two Pairs';
  if (Array.from(counts.values()).some(c => c === 2)) return 'One Pair';
  return 'High Dice';
}

function rollDice(): number[] {
  return Array.from({length: 5}, () => Math.ceil(Math.random() * 6));
}

function getDiceEmoji(value: number): string {
  return ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][value - 1] ?? '⚀';
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface MrotsiGameState {
  player1Score: number;
  player2Score: number;
  currentRound: number;
  totalRounds: number;
  player1Dice: number[] | null;
  player2Dice: number[] | null;
  player1RoundScore: number | null;
  player2RoundScore: number | null;
  player1Combination: string | null;
  player2Combination: string | null;
}

interface RoundResult {
  roundWinner: 'player1' | 'player2' | 'tie';
  roundNumber: number;
  player1Dice: number[];
  player2Dice: number[];
  player1RoundScore: number;
  player2RoundScore: number;
  player1Combination?: string | null;
  player2Combination?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────
const MultiplayerMrotsiScreen = ({navigation, route}: any) => {
  const {userId, mode: routeMode, joinCode} = route.params ?? {};
  const {refreshOnGameEnd} = useGameEndRefresh(undefined, 'mrotsi');

  // UI state machine
  const [screen, setScreen] = useState<'menu' | 'matchmaking' | 'game'>('menu');
  const [gameStatus, setGameStatus] = useState('Waiting for opponent...');
  const [roomId, setRoomId] = useState('');
  const roomIdRef = useRef('');
  const [roomCode, setRoomCode] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Player identity
  const [mySlot, setMySlot] = useState<'player1' | 'player2'>('player1');
  const mySlotRef = useRef<'player1' | 'player2'>('player1');

  // Game state
  const [gameState, setGameState] = useState<MrotsiGameState | null>(null);
  const [myDice, setMyDice] = useState<number[]>([]);
  const [hasRolled, setHasRolled] = useState(false);
  const [opponentHasRolled, setOpponentHasRolled] = useState(false);
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundResult[]>([]);
  const [roomName, setRoomName] = useState('Multiplayer Mrotsi');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);

  // ─── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Connect socket first — ALL listeners must be registered AFTER the socket
    // exists, otherwise this.socket?.on(...) is a no-op and P1 never receives
    // game_started / opponent_joined.
    const initialize = async () => {
      try {
        await connectToServer();
      } catch {
        BisetkaAlert.error('Connection Error', 'Failed to connect to server');
        return;
      }

      // Register all listeners now that this.socket is valid
      socketService.onMatchmakingStatus(data => {
        if (data.status === 'searching') setGameStatus('Searching for opponent...');
      });

      socketService.onOpponentJoined(data => {
        setGameStatus(`Opponent found! Get ready...`);
      });

      socketService.onGameStarted(data => {
        setGameStatus('Game started!');
        setScreen('game');
        setGameState({
          player1Score: 0, player2Score: 0,
          currentRound: 1, totalRounds: 5,
          player1Dice: null, player2Dice: null,
          player1RoundScore: null, player2RoundScore: null,
          player1Combination: null, player2Combination: null,
        });
        setHasRolled(false);
        setOpponentHasRolled(false);
        setLastRoundResult(null);
        setRoundHistory([]);
      });

      socketService.onMoveMade((data: any) => {
        const gs: MrotsiGameState = data.gameState;
        const rolledBy: 'player1' | 'player2' = data.rolledBy;

        const liveSlot = mySlotRef.current;
        const opponentSlot = liveSlot === 'player1' ? 'player2' : 'player1';

        if (rolledBy === opponentSlot) {
          setOpponentHasRolled(true);
        }

        setGameState(gs);

        if (data.roundComplete && data.roundResult) {
          const result: RoundResult = data.roundResult;
          setLastRoundResult(result);
          setRoundHistory(prev => [...prev, result]);
          // Reset per-round roll flags
          setHasRolled(false);
          setOpponentHasRolled(false);
          setMyDice([]);
        }
      });

      socketService.onGameEnded((data: any) => {
        refreshOnGameEnd().catch(console.error);
        const {winnerId, finalScore} = data;
        const didIWin = winnerId === userId;
        const isDraw = !winnerId;

        const title = isDraw ? 'Draw!' : didIWin ? 'You Won! 🎉' : 'You Lost';
        const message = isDraw
          ? `Final score: ${finalScore?.player1 ?? 0} – ${finalScore?.player2 ?? 0}`
          : didIWin
          ? `You won! ${finalScore?.player1 ?? 0} – ${finalScore?.player2 ?? 0}`
          : `Opponent won! ${finalScore?.player1 ?? 0} – ${finalScore?.player2 ?? 0}`;

        BisetkaAlert.alert(title, message, [
          {text: 'Play Again', onPress: () => navigation.replace('GameMode', {gameType: 'mrotsi'})},
          {text: 'Home', onPress: () => navigation.replace('Home')},
        ]);
      });

      socketService.onOpponentDisconnected(() => {
        refreshOnGameEnd().catch(console.error);
        BisetkaAlert.warning('Opponent Disconnected', 'Your opponent has left the game.', [
          {text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'mrotsi'})},
        ]);
      });

      socketService.onError((error: any) => {
        BisetkaAlert.error('Error', error.message);
      });

      // Auto-start
      if (routeMode === 'random') {
        handleFindMatch();
      } else if (routeMode === 'private-create') {
        handleCreatePrivateRoom();
      } else if (routeMode === 'private-join' && joinCode) {
        setJoinRoomCode(joinCode);
      }
    };
    initialize();

    return () => {
      socketService.removeAllListeners();
      socketService.disconnect();
    };
  }, []);

  // Auto-join when code is ready
  useEffect(() => {
    if (routeMode === 'private-join' && joinRoomCode) {
      handleJoinPrivateRoom();
    }
  }, [joinRoomCode, routeMode]);

  const connectToServer = async () => {
    const token = await tokenService.getAccessToken() ?? 'guest';
    await socketService.connect(userId, token);
  };

  const handleFindMatch = async () => {
    setScreen('matchmaking');
    setGameStatus('Finding opponent...');
    try {
      const matchData = await socketService.findMatch('mrotsi', userId);
      roomIdRef.current = matchData.roomId;
      // Slot is determined by color: white → player1, black → player2
      const slot: 'player1' | 'player2' = matchData.color === 'white' ? 'player1' : 'player2';
      mySlotRef.current = slot;
      setMySlot(slot);
      setRoomId(matchData.roomId);
      socketService.playerReady(matchData.roomId, userId);
    } catch (err: any) {
      BisetkaAlert.error('Matchmaking Error', err.message);
      setScreen('menu');
    }
  };

  const handleCreatePrivateRoom = async () => {
    try {
      const roomData = await socketService.createPrivateRoom('mrotsi', userId, joinCode);
      roomIdRef.current = roomData.roomId;
      mySlotRef.current = 'player1';
      setMySlot('player1');
      setRoomId(roomData.roomId);
      setRoomCode(roomData.roomCode);
      setScreen('matchmaking');
      setGameStatus(`Room created! Share code: ${roomData.roomCode}`);
      socketService.playerReady(roomData.roomId, userId);
    } catch (err: any) {
      BisetkaAlert.error('Error', err?.message || String(err) || 'Failed to create room');
    }
  };

  const handleJoinPrivateRoom = async () => {
    try {
      const roomData = await socketService.joinPrivateRoom(joinRoomCode || joinCode, userId);
      roomIdRef.current = roomData.roomId;
      mySlotRef.current = 'player2';
      setMySlot('player2');
      setRoomId(roomData.roomId);
      setScreen('matchmaking');
      setGameStatus('Joined room! Waiting for game to start...');
      socketService.playerReady(roomData.roomId, userId);
    } catch (err: any) {
      BisetkaAlert.error('Error', err?.message || String(err) || 'Failed to join room');
    }
  };

  const handleRollDice = () => {
    if (hasRolled || !gameState) return;
    const dice = rollDice();
    const score = calculateScore(dice);
    const combination = getScoreName(dice);
    setMyDice(dice);
    setHasRolled(true);
    socketService.makeMove(roomIdRef.current, userId, {type: 'roll_dice', dice, score, combination});
  };

  // ─── Render helpers ─────────────────────────────────────────────────────────
  const myScore = mySlot === 'player1' ? gameState?.player1Score ?? 0 : gameState?.player2Score ?? 0;
  const opponentScore = mySlot === 'player1' ? gameState?.player2Score ?? 0 : gameState?.player1Score ?? 0;
  const opponentDice = mySlot === 'player1' ? gameState?.player2Dice : gameState?.player1Dice;

  // ─── Screens ────────────────────────────────────────────────────────────────
  if (screen === 'menu') {
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

  // Listen for room name updates from other players (real-time sync)
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;
    const onNameUpdate = (data: { roomId: string; roomName: string }) => {
      setRoomName(data.roomName);
    };
    socket.on('room_name_updated', onNameUpdate);
    return () => { socket.off('room_name_updated', onNameUpdate); };
  }, []);

    return (
      <SafeAreaView style={styles.container}>
        <GameToolbar title="Mrotsi Multiplayer" onBack={() => navigation.goBack()} backgroundColor="transparent" />
        <View style={styles.menuContainer}>
          <Text style={styles.title}>🎲 Mrotsi</Text>
          <Text style={styles.subtitle}>5 rounds · simultaneous dice rolling</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleFindMatch}>
            <Text style={styles.primaryBtnText}>Find Random Match</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleCreatePrivateRoom}>
            <Text style={styles.secondaryBtnText}>Create Private Room</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowJoinModal(true)}>
            <Text style={styles.secondaryBtnText}>Join with Code</Text>
          </TouchableOpacity>
        </View>

        {/* Join modal */}
        <Modal visible={showJoinModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Enter Room Code</Text>
              <TextInput
                style={styles.codeInput}
                value={joinRoomCode}
                onChangeText={setJoinRoomCode}
                placeholder="Room code"
                placeholderTextColor="#888"
                autoCapitalize="characters"
                maxLength={6}
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={() => {
                setShowJoinModal(false);
                handleJoinPrivateRoom();
              }}>
                <Text style={styles.primaryBtnText}>Join</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
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
          gameType="Mrotsi"
        />
      </SafeAreaView>
    );
  }

  if (screen === 'matchmaking') {
    return (
      <SafeAreaView style={styles.container}>
        <GameToolbar title="Mrotsi Multiplayer" onBack={() => navigation.goBack()} backgroundColor="transparent" />
        <View style={styles.menuContainer}>
          <ActivityIndicator size="large" color="#F5A623" />
          <Text style={styles.statusText}>{gameStatus}</Text>
          {roomCode ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Room Code</Text>
              <Text style={styles.codeValue}>{roomCode}</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  // ─── Game screen ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <GameToolbar
        title={`Mrotsi — Round ${gameState?.currentRound ?? 1}/${gameState?.totalRounds ?? 5}`}
        onBack={() =>
          BisetkaAlert.alert('Resign?', 'Leave the game?', [
            {text: 'Stay', style: 'cancel'},
            {text: 'Leave', style: 'destructive', onPress: () => {
              socketService.resignGame?.(roomIdRef.current, userId);
              navigation.replace('GameMode', {gameType: 'mrotsi'});
            }},
          ])
        }
        backgroundColor="transparent"
        rightElement={
          screen === 'game' ? (
            <TouchableOpacity
              onPress={() => setShowRoomNameModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Text style={{ fontSize: 18 }}>✏️</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
        {/* Score bar */}
        <View style={styles.scoreBar}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>You</Text>
            <Text style={styles.scoreValue}>{myScore}</Text>
          </View>
          <Text style={styles.scoreSep}>vs</Text>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Opponent</Text>
            <Text style={styles.scoreValue}>{opponentScore}</Text>
          </View>
        </View>

        {/* Last round result */}
        {lastRoundResult && (
          <View style={styles.roundResultBox}>
            <Text style={styles.roundResultTitle}>Round {lastRoundResult.roundNumber} result</Text>
            <Text style={styles.roundResultText}>
              {lastRoundResult.roundWinner === 'tie'
                ? "It's a tie!"
                : lastRoundResult.roundWinner === mySlot
                ? 'You won this round! 🎉'
                : 'Opponent won this round'}
            </Text>
          </View>
        )}

        {/* Opponent section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opponent</Text>
          <View style={styles.diceRow}>
            {opponentHasRolled && opponentDice
              ? opponentDice.map((d, i) => (
                  <Text key={i} style={styles.diceEmoji}>{getDiceEmoji(d)}</Text>
                ))
              : Array.from({length: 5}).map((_, i) => (
                  <Text key={i} style={[styles.diceEmoji, styles.diceHidden]}>🎲</Text>
                ))}
          </View>
          {opponentHasRolled && opponentDice ? (
            <Text style={styles.combinationText}>
              {getScoreName(opponentDice)} ({mySlot === 'player1' ? gameState?.player2RoundScore : gameState?.player1RoundScore} pts)
            </Text>
          ) : (
            <Text style={styles.waitingText}>
              {opponentHasRolled ? 'Rolled!' : 'Waiting to roll...'}
            </Text>
          )}
        </View>

        {/* Player section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>You</Text>
          <View style={styles.diceRow}>
            {myDice.length > 0
              ? myDice.map((d, i) => (
                  <Text key={i} style={styles.diceEmoji}>{getDiceEmoji(d)}</Text>
                ))
              : Array.from({length: 5}).map((_, i) => (
                  <Text key={i} style={[styles.diceEmoji, styles.diceHidden]}>🎲</Text>
                ))}
          </View>
          {myDice.length > 0 && (
            <Text style={styles.combinationText}>
              {getScoreName(myDice)} ({calculateScore(myDice)} pts)
            </Text>
          )}

          <TouchableOpacity
            style={[styles.rollBtn, hasRolled && styles.rollBtnDisabled]}
            onPress={handleRollDice}
            disabled={hasRolled}>
            <Text style={styles.rollBtnText}>{hasRolled ? 'Rolled ✓' : '🎲 Roll Dice'}</Text>
          </TouchableOpacity>

          {hasRolled && !opponentHasRolled && (
            <Text style={styles.waitingText}>Waiting for opponent...</Text>
          )}
        </View>

        {/* Round history */}
        {roundHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Round History</Text>
            {roundHistory.map(r => (
              <View key={r.roundNumber} style={styles.historyRow}>
                <Text style={styles.historyRound}>R{r.roundNumber}</Text>
                <Text style={styles.historyDice}>
                  {r[`${mySlot}Dice` as 'player1Dice'].map(getDiceEmoji).join('')}
                </Text>
                <Text style={styles.historyScore}>
                  {r[`${mySlot}RoundScore` as 'player1RoundScore']} pts
                </Text>
                <Text style={[
                  styles.historyWinner,
                  r.roundWinner === mySlot ? styles.winText :
                  r.roundWinner === 'tie' ? styles.tieText : styles.loseText,
                ]}>
                  {r.roundWinner === 'tie' ? 'Tie' : r.roundWinner === mySlot ? 'Win' : 'Loss'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* In-game chat overlay */}
      <InGameChat
        roomId={roomIdRef.current}
        currentUserId={userId}
        gameType="mrotsi"
        visible={screen === 'game' && !!roomIdRef.current}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#1A1A2E'},
  menuContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16},
  title: {fontSize: 36, fontWeight: 'bold', color: '#F5A623'},
  subtitle: {fontSize: 14, color: '#aaa', marginBottom: 8},
  statusText: {fontSize: 18, color: '#eee', textAlign: 'center', marginTop: 16},
  primaryBtn: {
    backgroundColor: '#F5A623', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32, width: '80%', alignItems: 'center',
  },
  primaryBtnText: {color: '#1A1A2E', fontSize: 16, fontWeight: 'bold'},
  secondaryBtn: {
    backgroundColor: 'transparent', borderRadius: 12, borderWidth: 1.5, borderColor: '#F5A623',
    paddingVertical: 12, paddingHorizontal: 32, width: '80%', alignItems: 'center',
  },
  secondaryBtnText: {color: '#F5A623', fontSize: 16},
  cancelText: {color: '#aaa', marginTop: 12},
  // Modal
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center'},
  modalBox: {backgroundColor: '#16213E', borderRadius: 16, padding: 24, width: '80%', alignItems: 'center', gap: 12},
  modalTitle: {fontSize: 20, fontWeight: 'bold', color: '#eee'},
  codeInput: {
    width: '100%', backgroundColor: '#0F3460', color: '#fff', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 18, textAlign: 'center', letterSpacing: 4,
  },
  // Code
  codeBox: {marginTop: 20, alignItems: 'center'},
  codeLabel: {color: '#aaa', fontSize: 13},
  codeValue: {color: '#F5A623', fontSize: 32, fontWeight: 'bold', letterSpacing: 6, marginTop: 4},
  // Score bar
  gameContent: {padding: 16, gap: 16},
  scoreBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: '#16213E', borderRadius: 12, padding: 12,
  },
  scoreItem: {alignItems: 'center'},
  scoreLabel: {color: '#aaa', fontSize: 12},
  scoreValue: {color: '#F5A623', fontSize: 28, fontWeight: 'bold'},
  scoreSep: {color: '#555', fontSize: 16},
  // Round result
  roundResultBox: {
    backgroundColor: '#0F3460', borderRadius: 12, padding: 12, alignItems: 'center',
  },
  roundResultTitle: {color: '#aaa', fontSize: 12, marginBottom: 4},
  roundResultText: {color: '#eee', fontSize: 16, fontWeight: '600'},
  // Sections
  section: {
    backgroundColor: '#16213E', borderRadius: 12, padding: 16, gap: 10, alignItems: 'center',
  },
  sectionTitle: {color: '#aaa', fontSize: 13, alignSelf: 'flex-start'},
  // Dice
  diceRow: {flexDirection: 'row', gap: 8, justifyContent: 'center'},
  diceEmoji: {fontSize: 36},
  diceHidden: {opacity: 0.3},
  combinationText: {color: '#F5A623', fontSize: 14, fontWeight: '600'},
  waitingText: {color: '#888', fontSize: 13, fontStyle: 'italic'},
  // Roll button
  rollBtn: {
    backgroundColor: '#F5A623', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center', marginTop: 4,
  },
  rollBtnDisabled: {backgroundColor: '#555'},
  rollBtnText: {color: '#1A1A2E', fontSize: 18, fontWeight: 'bold'},
  // History
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', paddingVertical: 4,
  },
  historyRound: {color: '#aaa', fontSize: 13, width: 24},
  historyDice: {fontSize: 16, flex: 1, textAlign: 'center'},
  historyScore: {color: '#eee', fontSize: 13, width: 50, textAlign: 'right'},
  historyWinner: {fontSize: 13, fontWeight: 'bold', width: 36, textAlign: 'right'},
  winText: {color: '#4CAF50'},
  tieText: {color: '#FFC107'},
  loseText: {color: '#F44336'},
});

export default MultiplayerMrotsiScreen;
