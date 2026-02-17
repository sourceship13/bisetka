import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { gameResultService } from '../services/gameResult.service';

const { width } = Dimensions.get('window');
// Calculate responsive sizes based on screen width
const MACHINE_HORIZONTAL_PADDING = 12; // Machine container horizontal margin
const MACHINE_FRAME_PADDING = 6; // Inside machineFrame (reduced for better fit)
const REELS_CONTAINER_PADDING = 6; // Inside reelsContainer
const REEL_GAP = 3; // Gap between reels
const NUM_REELS = 5;

// Calculate available width for reels
const AVAILABLE_WIDTH =
  width -
  MACHINE_HORIZONTAL_PADDING * 2 -
  MACHINE_FRAME_PADDING * 2 -
  REELS_CONTAINER_PADDING * 2 -
  REEL_GAP * (NUM_REELS - 1);
const REEL_WIDTH = Math.floor(AVAILABLE_WIDTH / NUM_REELS);
const SYMBOL_HEIGHT = Math.min(60, REEL_WIDTH * 1.1); // Scale symbol height with reel width
const NUM_VISIBLE_ROWS = 3;
const STRIP_LENGTH = 20; // How many symbols in spinning strip

const SYMBOLS = ['7️⃣', '💎', '⭐', '🔔', '🍒', '🍋', '🅱️'];

interface SpinResult {
  result: string[][];
  winningLines: Array<{ line: number; symbols: string; payout: number }>;
  totalPayout: number;
  netResult: number;
  activePaylines: number;
}

// Generate a random symbol strip for spinning effect
const generateRandomStrip = (finalSymbols: string[]): string[] => {
  const strip: string[] = [];
  // Add random symbols for the spinning part
  for (let i = 0; i < STRIP_LENGTH - NUM_VISIBLE_ROWS; i++) {
    strip.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  }
  // Add the final result symbols at the end
  strip.push(...finalSymbols);
  return strip;
};

const SlotsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState((user as any)?.balance || 1000);
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [displayedReels, setDisplayedReels] = useState<string[][]>([
    ['🍒', '💎', '⭐'],
    ['7️⃣', '🔔', '🍋'],
    ['💎', '⭐', '🍒'],
    ['🅱️', '7️⃣', '🔔'],
    ['⭐', '🍋', '💎'],
  ]);
  const [winnings, setWinnings] = useState<SpinResult | null>(null);

  // Animation values for each reel
  const reelAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Reel strips during animation
  const reelStrips = useRef<string[][]>([[], [], [], [], []]);

  // Generate a random spin result (5 reels x 3 rows)
  const generateSpinResult = (): string[][] => {
    return [0, 1, 2, 3, 4].map(() =>
      [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]),
    );
  };

  // Calculate winnings based on middle row (row index 1)
  const calculateWinnings = (result: string[][]): SpinResult => {
    const middleRow = result.map(col => col[1]); // Get middle symbol from each reel
    const winningLines: Array<{
      line: number;
      symbols: string;
      payout: number;
    }> = [];
    let totalPayout = 0;

    // Check for matches (simplified - check consecutive from left)
    const firstSymbol = middleRow[0];
    let matchCount = 1;
    for (let i = 1; i < middleRow.length; i++) {
      if (middleRow[i] === firstSymbol) {
        matchCount++;
      } else {
        break;
      }
    }

    // Payout based on match count
    const payouts: Record<string, Record<number, number>> = {
      '7️⃣': { 3: 50, 4: 200, 5: 777 },
      '💎': { 3: 30, 4: 100, 5: 300 },
      '⭐': { 3: 20, 4: 60, 5: 150 },
      '🔔': { 3: 15, 4: 40, 5: 100 },
      '🍒': { 3: 10, 4: 25, 5: 60 },
      '🍋': { 3: 5, 4: 15, 5: 40 },
      '🅱️': { 3: 25, 4: 80, 5: 250 },
    };

    if (matchCount >= 3 && payouts[firstSymbol]) {
      const multiplier = payouts[firstSymbol][matchCount] || 0;
      const payout = betAmount * multiplier;
      totalPayout = payout;
      winningLines.push({
        line: 1,
        symbols: firstSymbol.repeat(matchCount),
        payout,
      });
    }

    return {
      result,
      winningLines,
      totalPayout,
      netResult: totalPayout - betAmount,
      activePaylines:
        betAmount >= 50 ? 5 : betAmount >= 25 ? 3 : betAmount >= 15 ? 2 : 1,
    };
  };

  // Track spin start time for duration calculation
  const spinStartTime = useRef<number>(0);
  const spinCountRef = useRef<number>(0);

  // Log spin result to backend
  const logSpinResult = async (spinData: SpinResult) => {
    try {
      const durationSeconds = Math.round(
        (Date.now() - spinStartTime.current) / 1000,
      );
      const isWin = spinData.totalPayout > 0;

      await gameResultService.recordGameResult({
        gameType: 'slots',
        gameMode: 'solo',
        result: isWin ? 'win' : 'loss',
        playerScore: spinData.totalPayout,
        opponentScore: betAmount, // Bet amount as "opponent" score
        durationSeconds,
        movesCount: 1, // Each spin is 1 "move"
        gameData: {
          betAmount,
          totalPayout: spinData.totalPayout,
          netResult: spinData.netResult,
          winningLines: spinData.winningLines,
          finalSymbols: spinData.result.map(col => col[1]), // Middle row
          spinNumber: spinCountRef.current,
        },
      });
    } catch (error) {
      console.warn('Failed to log slots result:', error);
      // Don't block gameplay if logging fails
    }
  };

  const spin = () => {
    if (spinning || balance < betAmount) return;

    setSpinning(true);
    setWinnings(null);
    setBalance((prev: number) => prev - betAmount);

    // Track spin start time and increment counter
    spinStartTime.current = Date.now();
    spinCountRef.current += 1;

    // Reset animations to start
    reelAnims.forEach(anim => anim.setValue(0));

    // Generate result locally (works offline)
    const spinResult = generateSpinResult();
    const data = calculateWinnings(spinResult);

    // Generate spinning strips with final results
    reelStrips.current = data.result.map((col: string[]) =>
      generateRandomStrip(col),
    );

    // Force a re-render to show the new strips
    setDisplayedReels([...reelStrips.current]);

    // Animate each reel with staggered timing
    const animations = reelAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 800 + i * 300, // Stagger each reel
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    Animated.stagger(150, animations).start(() => {
      // Animation complete - reset animations and show just the result
      reelAnims.forEach(anim => anim.setValue(0));
      setDisplayedReels(data.result);
      setWinnings(data);

      if (data.totalPayout > 0) {
        setBalance((prev: number) => prev + data.totalPayout);
      }

      // Log result to backend
      logSpinResult(data);

      setSpinning(false);
    });
  };

  const adjustBet = useCallback((delta: number) => {
    setBetAmount(prev => {
      const newValue = prev + delta;
      return Math.max(1, Math.min(100, newValue));
    });
  }, []);

  const renderReel = (colIndex: number) => {
    const strip = displayedReels[colIndex] || ['?', '?', '?'];
    const spinAnim = reelAnims[colIndex];
    const totalHeight = strip.length * SYMBOL_HEIGHT;
    const finalOffset = -(totalHeight - NUM_VISIBLE_ROWS * SYMBOL_HEIGHT);

    return (
      <View key={colIndex} style={styles.reel}>
        <Animated.View
          style={{
            transform: [
              {
                translateY: spinAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, finalOffset],
                }),
              },
            ],
          }}
        >
          {strip.map((sym, i) => (
            <View key={i} style={styles.symbolCell}>
              <Text style={styles.symbol}>{sym}</Text>
            </View>
          ))}
        </Animated.View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0f0f23', '#1a1742', '#0f0f23']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🎰 SLOTS</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Balance */}
        <LinearGradient
          colors={['#10b981', '#34d399']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceText}>💰 {balance.toLocaleString()}</Text>
        </LinearGradient>

        {/* Slot Machine */}
        <View style={styles.machine}>
          <LinearGradient
            colors={['#6366f1', '#8b5cf6', '#ec4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.machineFrame}
          >
            {/* Reels Container */}
            <View style={styles.reelsContainer}>
              {[0, 1, 2, 3, 4].map(renderReel)}
            </View>

            {/* Paylines Indicator */}
            <View style={styles.paylinesIndicator}>
              <Text style={styles.paylinesText}>
                {betAmount >= 50
                  ? '5'
                  : betAmount >= 25
                  ? '3'
                  : betAmount >= 15
                  ? '2'
                  : '1'}{' '}
                PAYLINES ACTIVE
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Winnings Display */}
        {winnings && winnings.totalPayout > 0 && (
          <LinearGradient
            colors={['#fbbf24', '#f59e0b']}
            style={styles.winCard}
          >
            <Text style={styles.winTitle}>🎉 WIN!</Text>
            <Text style={styles.winAmount}>
              +{winnings.totalPayout.toLocaleString()}
            </Text>
            {winnings.winningLines.map((line, i) => (
              <Text key={i} style={styles.winLine}>
                Line {line.line}: {line.symbols} → {line.payout}
              </Text>
            ))}
          </LinearGradient>
        )}

        {/* Bet Controls */}
        <View style={styles.controls}>
          <Text style={styles.betLabel}>BET AMOUNT</Text>
          <View style={styles.betRow}>
            <TouchableOpacity
              style={[styles.betBtn, spinning && styles.betBtnDisabled]}
              onPress={() => adjustBet(-5)}
              disabled={spinning}
              activeOpacity={0.7}
            >
              <Text style={styles.betBtnText}>−</Text>
            </TouchableOpacity>

            <View style={styles.betDisplay}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.betDisplayGradient}
              >
                <Text style={styles.betAmount}>{betAmount}</Text>
              </LinearGradient>
            </View>

            <TouchableOpacity
              style={[styles.betBtn, spinning && styles.betBtnDisabled]}
              onPress={() => adjustBet(5)}
              disabled={spinning}
              activeOpacity={0.7}
            >
              <Text style={styles.betBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Bet Buttons */}
          <View style={styles.quickBets}>
            {[10, 25, 50].map(amt => (
              <TouchableOpacity
                key={amt}
                style={[
                  styles.quickBet,
                  betAmount === amt && styles.quickBetActive,
                ]}
                onPress={() => setBetAmount(amt)}
                disabled={spinning}
              >
                <Text
                  style={[
                    styles.quickBetText,
                    betAmount === amt && styles.quickBetTextActive,
                  ]}
                >
                  {amt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Spin Button */}
        <TouchableOpacity
          style={[
            styles.spinBtn,
            (spinning || balance < betAmount) && styles.spinBtnDisabled,
          ]}
          onPress={spin}
          disabled={spinning || balance < betAmount}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={spinning ? ['#666', '#444'] : ['#ec4899', '#f472b6']}
            style={styles.spinGradient}
          >
            <Text style={styles.spinText}>
              {spinning ? '🎰 SPINNING...' : '🎰 SPIN'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backBtn: {
    color: '#a0a0ff',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(236, 72, 153, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  balanceCard: {
    borderRadius: 16,
    paddingTop:36,
    alignItems: 'center',

  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  balanceText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
  },
  machine: {
    marginHorizontal: MACHINE_HORIZONTAL_PADDING,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    flex: 4,
  },
  machineFrame: {
    paddingVertical: MACHINE_FRAME_PADDING,
    borderRadius: 16,
    flex:4
  },
  reelsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    padding: REELS_CONTAINER_PADDING,
    gap: REEL_GAP,
    height: SYMBOL_HEIGHT * 3 + REELS_CONTAINER_PADDING * 2,
    overflow: 'hidden',
  },
  reel: {
    flex: 1,
    backgroundColor: '#1a1742',
    borderRadius: 6,
    overflow: 'hidden',
  },
  symbolCell: {
    height: SYMBOL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    fontSize: Math.min(32, REEL_WIDTH * 0.6),
  },
  paylinesIndicator: {
    margin: 12,
    alignItems: 'center',
  },
  paylinesText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
  },
  winCard: {
    marginHorizontal: MACHINE_HORIZONTAL_PADDING,
    margin: 16,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  winTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  winAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginTop: 4,
  },
  winLine: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  controls: {
    marginHorizontal: MACHINE_HORIZONTAL_PADDING,
    flex: 5,
    paddingVertical:10
  },
  betLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
  },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  betBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  betBtnDisabled: {
    opacity: 0.4,
  },
  betBtnText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  betDisplay: {
    borderRadius: 16,
    overflow: 'hidden',
    flex: 1,
    maxWidth:120,
  },
  betDisplayGradient: {
    marginHorizontal:20,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  betAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  quickBets: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,

  },
  quickBet: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  quickBetActive: {
    backgroundColor: '#6366f1',
    borderColor: '#8b5cf6',
  },
  quickBetText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  quickBetTextActive: {
    color: '#fff',
  },
  spinBtn: {
    marginHorizontal: MACHINE_HORIZONTAL_PADDING,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  spinBtnDisabled: {
    opacity: 0.5,
  },
  spinGradient: {
    alignItems: 'center',
    borderRadius: 20,
    justifyContent: 'center',
  },
  spinText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
    marginVertical: 20,
  },
});

export default SlotsScreen;
