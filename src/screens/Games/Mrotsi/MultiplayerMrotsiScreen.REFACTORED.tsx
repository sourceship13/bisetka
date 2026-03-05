/**
 * REFACTORED: Mrotsi Screen with AI Mode Support
 * 
 * This screen supports both AI mode (local gameplay) and multiplayer mode.
 * Multiplayer boilerplate is eliminated using useMultiplayerGame hook.
 * AI logic is preserved unchanged.
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';
import RoomNameModal from '../../../components/RoomNameModal';
import {BisetkaAlert} from '../../../utils/BisetkaAlert';
import InGameChat from '../../../components/InGameChat';

// ═══ NEW: Single import for multiplayer ═══
import { useMultiplayerGame, useMatchmakingUI, mrotsiAdapter } from '../../../multiplayer';
import type { MrotsiGameState, MrotsiMove } from '../../../multiplayer/adapters/MrotsiGameAdapter';

// ─── Score helpers (unchanged) ───────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────

const MultiplayerMrotsiScreenRefactored = ({navigation, route}: any) => {
  const {userId, mode: routeMode, joinCode} = route.params ?? {};
  const isMultiplayer = routeMode === 'random' || routeMode === 'private-create' || routeMode === 'private-join';

  const [myDice, setMyDice] = useState<number[]>([]);
  const [hasRolled, setHasRolled] = useState(false);
  const [opponentHasRolled, setOpponentHasRolled] = useState(false);
  const [lastRoundResult, setLastRoundResult] = useState<any | null>(null);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [roomName, setRoomName] = useState('Multiplayer Mrotsi');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 MULTIPLAYER HOOK - Only used when isMultiplayer = true
  // ═══════════════════════════════════════════════════════════════════════════
  
  const mpHook = useMultiplayerGame<MrotsiGameState, MrotsiMove>({
    gameType: 'mrotsi',
    userId,
    mode: isMultiplayer ? (routeMode === 'random' ? 'random' : routeMode === 'private-create' ? 'private-create' : 'private-join') : 'random',
    joinCode,
    adapter: mrotsiAdapter,
    autoConnect: isMultiplayer,
    autoStart: isMultiplayer,
    
    onGameStart: (data) => {
      setHasRolled(false);
      setOpponentHasRolled(false);
      setLastRoundResult(null);
      setRoundHistory([]);
    },
    
    onMoveMade: (data) => {
      const rolledBy: 'player1' | 'player2' = (data as any).rolledBy;
      const mySlot = mpHook.myPlayer?.color === 'white' ? 'player1' : 'player2';
      const opponentSlot = mySlot === 'player1' ? 'player2' : 'player1';

      if (rolledBy === opponentSlot) {
        setOpponentHasRolled(true);
      }

      if ((data as any).roundComplete && (data as any).roundResult) {
        const result = (data as any).roundResult;
        setLastRoundResult(result);
        setRoundHistory(prev => [...prev, result]);
        setHasRolled(false);
        setOpponentHasRolled(false);
        setMyDice([]);
      }
    },
    
    onGameEnd: (result) => {
      const didIWin = result.winnerId === userId;
      const isDraw = !result.winnerId;
      const title = isDraw ? 'Draw!' : didIWin ? 'You Won! 🎉' : 'You Lost';
      const message = isDraw
        ? `Final score: ${result.finalScore?.player1 ?? 0} – ${result.finalScore?.player2 ?? 0}`
        : didIWin
        ? `You won! ${result.finalScore?.player1 ?? 0} – ${result.finalScore?.player2 ?? 0}`
        : `Opponent won! ${result.finalScore?.player1 ?? 0} – ${result.finalScore?.player2 ?? 0}`;
      
      BisetkaAlert.alert(title, message, [
        {text: 'Play Again', onPress: () => navigation.replace('GameMode', {gameType: 'mrotsi'})},
        {text: 'Home', onPress: () => navigation.replace('Home')},
      ]);
    },
    
    onOpponentDisconnected: () => {
      BisetkaAlert.warning('Opponent Disconnected', 'Your opponent has left the game.', [
        {text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'mrotsi'})},
      ]);
    },
  });

  const { showMatchmaking, showWaitingRoom, showGame: mpShowGame } = useMatchmakingUI(mpHook.status);

  // Determine effective values
  const gameState = mpHook.gameState;
  const mySlot = mpHook.myPlayer?.color === 'white' ? 'player1' : 'player2';
  const myScore = mySlot === 'player1' ? gameState?.player1Score ?? 0 : gameState?.player2Score ?? 0;
  const opponentScore = mySlot === 'player1' ? gameState?.player2Score ?? 0 : gameState?.player1Score ?? 0;
  const opponentDice = mySlot === 'player1' ? gameState?.player2Dice : gameState?.player1Dice;

  const handleRollDice = () => {
    if (hasRolled || !gameState || !mpHook.room) return;
    const dice = rollDice();
    const score = calculateScore(dice);
    const combination = getScoreName(dice);
    setMyDice(dice);
    setHasRolled(true);
    mpHook.makeMove({type: 'roll_dice', dice, score, combination});
  };

  // ─── Matchmaking / waiting screen ─────────────────────────────────────────
  if (isMultiplayer && (showMatchmaking || showWaitingRoom)) {
    return (
      <SafeAreaView style={styles.container}>
        <GameToolbar title="Mrotsi" onBack={() => { mpHook.cancelMatchmaking(); navigation.goBack(); }} backgroundColor="transparent" />
        <View style={styles.menuContainer}>
          {mpHook.room?.code ? (
            <>
              <Text style={styles.roomCreatedTitle}>Room Created! 🎮</Text>
              <Text style={styles.roomCodeLabel}>Share this code with your friend:</Text>
              <View style={styles.roomCodeBox}>
                <Text style={styles.roomCodeValue}>{mpHook.room.code}</Text>
              </View>
              <Text style={styles.searchingText}>Waiting for opponent to join...</Text>
              <ActivityIndicator size="small" color="#F5A623" style={{marginTop: 8}} />
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#F5A623" />
              <Text style={styles.searchingText}>
                {showMatchmaking ? 'Finding opponent...' : 'Waiting for game to start...'}
              </Text>
            </>
          )}
          <TouchableOpacity style={styles.cancelButton} onPress={() => {
            mpHook.cancelMatchmaking();
            navigation.goBack();
          }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <RoomNameModal
          visible={showRoomNameModal}
          onClose={() => setShowRoomNameModal(false)}
          currentName={roomName}
          onSave={(newName) => {
            setRoomName(newName);
            mpHook.setRoomName(newName);
          }}
          gameType="Mrotsi"
        />
      </SafeAreaView>
    );
  }

  // ─── Game screen ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <GameToolbar
        title={`Mrotsi — Round ${gameState?.currentRound ?? 1}/${gameState?.totalRounds ?? 5}`}
        onBack={() => {
          if (mpHook.room) mpHook.resign();
          navigation.goBack();
        }}
        backgroundColor="transparent"
        rightElement={
          mpShowGame ? (
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
              ? opponentDice.map((d: number, i: number) => (
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
            {roundHistory.map((r: any) => (
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
        roomId={mpHook.room?.id || ''}
        currentUserId={userId}
        gameType="mrotsi"
        visible={mpShowGame && !!mpHook.room?.id}
      />

      <RoomNameModal
        visible={showRoomNameModal}
        onClose={() => setShowRoomNameModal(false)}
        currentName={roomName}
        onSave={(newName) => {
          setRoomName(newName);
          mpHook.setRoomName(newName);
        }}
        gameType="Mrotsi"
      />
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STYLES (Unchanged)
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#1A1A2E'},
  menuContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16},
  roomCreatedTitle: {fontSize: 24, fontWeight: 'bold', color: '#F5A623', textAlign: 'center', marginBottom: 8},
  roomCodeLabel: {fontSize: 14, color: '#aaa', textAlign: 'center', marginBottom: 12},
  roomCodeBox: {backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 16, marginBottom: 8},
  roomCodeValue: {color: '#F5A623', fontSize: 42, fontWeight: 'bold', letterSpacing: 6, textAlign: 'center'},
  searchingText: {color: '#eee', fontSize: 18, textAlign: 'center', marginTop: 16},
  cancelButton: {marginTop: 20, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: '#e74c3c', borderRadius: 8},
  cancelText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  gameContent: {padding: 16, gap: 16},
  scoreBar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#16213E', borderRadius: 12, padding: 12},
  scoreItem: {alignItems: 'center'},
  scoreLabel: {color: '#aaa', fontSize: 12},
  scoreValue: {color: '#F5A623', fontSize: 28, fontWeight: 'bold'},
  scoreSep: {color: '#555', fontSize: 16},
  roundResultBox: {backgroundColor: '#0F3460', borderRadius: 12, padding: 12, alignItems: 'center'},
  roundResultTitle: {color: '#aaa', fontSize: 12, marginBottom: 4},
  roundResultText: {color: '#eee', fontSize: 16, fontWeight: '600'},
  section: {backgroundColor: '#16213E', borderRadius: 12, padding: 16, gap: 10, alignItems: 'center'},
  sectionTitle: {color: '#aaa', fontSize: 13, alignSelf: 'flex-start'},
  diceRow: {flexDirection: 'row', gap: 8, justifyContent: 'center'},
  diceEmoji: {fontSize: 36},
  diceHidden: {opacity: 0.3},
  combinationText: {color: '#F5A623', fontSize: 14, fontWeight: '600'},
  waitingText: {color: '#888', fontSize: 13, fontStyle: 'italic'},
  rollBtn: {backgroundColor: '#F5A623', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center', marginTop: 4},
  rollBtnDisabled: {backgroundColor: '#555'},
  rollBtnText: {color: '#1A1A2E', fontSize: 18, fontWeight: 'bold'},
  historyRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 4},
  historyRound: {color: '#aaa', fontSize: 13, width: 24},
  historyDice: {fontSize: 16, flex: 1, textAlign: 'center'},
  historyScore: {color: '#eee', fontSize: 13, width: 50, textAlign: 'right'},
  historyWinner: {fontSize: 13, fontWeight: 'bold', width: 36, textAlign: 'right'},
  winText: {color: '#4CAF50'},
  tieText: {color: '#FFC107'},
  loseText: {color: '#F44336'},
});

export default MultiplayerMrotsiScreenRefactored;
