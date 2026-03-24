import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../../libs/hooks/useAuth';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import Svg, { Polyline } from 'react-native-svg';
import apiConfig from '../../../libs/utils/api.utils';
import tokenService from '../../../services/token.service';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import { apiService } from '../../../services/api.service';
import { v4 as uuidv4 } from 'uuid';

const { width } = Dimensions.get('window');
const CONTAINER_PADDING = 8;
const REEL_GAP = 4;
const REEL_WIDTH = (width - 80) / 5;
const SYMBOL_HEIGHT = 70;
const REELS_TOTAL_WIDTH = CONTAINER_PADDING * 2 + REEL_WIDTH * 5 + REEL_GAP * 4;
const REELS_TOTAL_HEIGHT = CONTAINER_PADDING * 2 + SYMBOL_HEIGHT * 3;

const SYMBOLS = ['7️⃣', '💎', '⭐', '🔔', '🍒', '🍋', 'BAR'];

// Number of full symbol-set repetitions in the spin strip before the result
const SPIN_REPS = 12;
// Total scroll distance = SPIN_REPS × SYMBOLS.length × SYMBOL_HEIGHT
const SPIN_DISTANCE = -(SPIN_REPS * SYMBOLS.length * SYMBOL_HEIGHT);

// Build the repeating part of each reel strip once
const SPIN_STRIP_SYMBOLS = Array.from(
  { length: SPIN_REPS * SYMBOLS.length },
  (_, i) => SYMBOLS[i % SYMBOLS.length],
);

// Stable module-level animation values — created once, never recreated
const reelAnim0 = new Animated.Value(0);
const reelAnim1 = new Animated.Value(0);
const reelAnim2 = new Animated.Value(0);
const reelAnim3 = new Animated.Value(0);
const reelAnim4 = new Animated.Value(0);
const REEL_ANIMS = [reelAnim0, reelAnim1, reelAnim2, reelAnim3, reelAnim4];

// Paylines (row indices for each reel)
const PAYLINES = [
  { id: 1, path: [1, 1, 1, 1, 1], color: '#fbbf24', label: 'Center' },
  { id: 2, path: [0, 0, 0, 0, 0], color: '#10b981', label: 'Top' },
  { id: 3, path: [2, 2, 2, 2, 2], color: '#3b82f6', label: 'Bottom' },
  { id: 4, path: [0, 1, 2, 1, 0], color: '#ec4899', label: 'V' },
  { id: 5, path: [2, 1, 0, 1, 2], color: '#8b5cf6', label: 'Λ' },
];

interface SpinResult {
  result: string[][];
  winningLines: Array<{ line: number; symbols: string; payout: number }>;
  totalPayout: number;
  netResult: number;
  activePaylines: number;
}

const SlotsScreen = ({ navigation }: any) => {
  const { user, refreshUser } = useAuth();
  const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'slots');
  // Use user's actual balance - no entry fee, real money gameplay
  const [balance, setBalance] = useState(Math.floor((user as any)?.balance || 0));
  const [betAmount, setBetAmount] = useState(10);
  const [showBlur, setShowBlur] = useState(true);
  const [showBackground, setShowBackground] = useState(true);
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const [spinning, setSpinning] = useState(false);
  // 5 reels × 3 rows — what shows at the bottom of each reel strip (the result)
  const [reelSymbols, setReelSymbols] = useState<string[][]>([
    ['🍒', '⭐', '🔔'],
    ['💎', '7️⃣', '🍋'],
    ['⭐', '⭐', '⭐'],
    ['🔔', '💎', '🍒'],
    ['🍋', '🔔', '7️⃣'],
  ]);
  const [winnings, setWinnings] = useState<SpinResult | null>(null);
  
  // Neon flicker animation
  const neonFlicker = useRef(new Animated.Value(1)).current;

  // Reset animation positions each time this screen mounts
  useEffect(() => {
    REEL_ANIMS.forEach(anim => anim.setValue(0));
  }, []);

  // Sync balance with user data
  useEffect(() => {
    if (user?.balance !== undefined) {
      setBalance(Math.floor(user.balance));
    }
  }, [user?.balance]);

  // Neon flickering effect
  useEffect(() => {
    const flicker = () => {
      Animated.sequence([
        Animated.timing(neonFlicker, {
          toValue: 0.6,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(neonFlicker, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(Math.random() * 3000 + 1000), // Random delay 1-4s
      ]).start(() => flicker());
    };
    flicker();
  }, []);

  // Auto-dismiss win banner after 3 seconds
  useEffect(() => {
    if (!winnings || winnings.totalPayout <= 0) return;
    const timer = setTimeout(() => setWinnings(null), 3000);
    return () => clearTimeout(timer);
  }, [winnings]);

  const getActivePaylines = () => {
    if (betAmount >= 50) return 5;
    if (betAmount >= 25) return 3;
    if (betAmount >= 15) return 2;
    return 1;
  };

  const spin = async () => {
    if (spinning || balance < betAmount) return;

    setSpinning(true);
    setWinnings(null);
    setBalance((prev: number) => prev - betAmount);

    // Reset each reel to the top of its strip
    REEL_ANIMS.forEach(anim => anim.setValue(0));

    // Each reel scrolls at a slightly different speed for a natural feel.
    const spinAnims = REEL_ANIMS.map((anim, i) =>
      Animated.timing(anim, {
        toValue: SPIN_DISTANCE,
        duration: 2000 + i * 300,
        useNativeDriver: false,
      }),
    );

    Animated.parallel(spinAnims).start();

    try {
      const token = await tokenService.getAccessToken();
      const response = await fetch(`${apiConfig.baseURL}/api/slots/spin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ betAmount }),
      });

      if (!response.ok) {
        throw new Error(`Spin API error: ${response.status}`);
      }

      const data: SpinResult = await response.json();

      // Guard: only update symbols if result is a valid 5-column array
      if (Array.isArray(data.result) && data.result.length === 5) {
        setReelSymbols(data.result);
      }
      setWinnings(data);
      
      // Update local balance
      if (data.totalPayout > 0) {
        setBalance((prev: number) => prev + data.totalPayout);
      }
      
      // Sync user balance from backend
      refreshUser().catch(console.error);
      refreshOnGameEnd().catch(console.error);
    } catch (error) {
      console.error('Spin failed:', error);
      setBalance((prev: number) => prev + betAmount);
    } finally {
      setSpinning(false);
    }
  };

  const renderPaylineOverlay = () => {
    const activeCount = getActivePaylines();
    const activePaylines = PAYLINES.slice(0, activeCount);
    const winningLineNums = winnings?.winningLines?.map(w => w.line) || [];

    return (
      <Svg
        height={REELS_TOTAL_HEIGHT}
        width={REELS_TOTAL_WIDTH}
        style={styles.paylinesOverlay}
        pointerEvents="none"
      >
        {activePaylines.map(payline => {
          const isWinning = winningLineNums.includes(payline.id);
          const points = payline.path
            .map((row, col) => {
              const x =
                CONTAINER_PADDING +
                col * (REEL_WIDTH + REEL_GAP) +
                REEL_WIDTH / 2;
              const y =
                CONTAINER_PADDING + row * SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2;
              return `${x},${y}`;
            })
            .join(' ');

          return (
            <Polyline
              key={payline.id}
              points={points}
              fill="none"
              stroke={isWinning ? '#fbbf24' : payline.color}
              strokeWidth={isWinning ? 4 : 2}
              strokeOpacity={isWinning ? 1 : 0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </Svg>
    );
  };

  const renderReel = (colIndex: number) => {
    const finalSymbols: string[] =
      reelSymbols && reelSymbols[colIndex]
        ? reelSymbols[colIndex]
        : ['?', '?', '?'];
    const spinAnim = REEL_ANIMS[colIndex] as Animated.Value;

    // Strip = repeated symbols for the spin + the result 3 symbols at the end.
    // At translateY=0 the top of the strip is visible.
    // At translateY=SPIN_DISTANCE the result symbols are visible.
    const strip = [...SPIN_STRIP_SYMBOLS, ...finalSymbols];

    return (
      <View key={colIndex} style={styles.reel}>
        <Animated.View style={{ transform: [{ translateY: spinAnim }] }}>
          {strip.map((sym, i) => (
            <View key={i} style={styles.symbolCell}>
              <Text style={styles.symbol}>{sym}</Text>
            </View>
          ))}
        </Animated.View>
      </View>
    );
  };

  const renderPaylineIndicators = () => {
    const activeCount = getActivePaylines();
    return (
      <View style={styles.paylinesList}>
        {PAYLINES.slice(0, activeCount).map(payline => (
          <View key={payline.id} style={styles.paylineItem}>
            <View
              style={[styles.paylineDot, { backgroundColor: payline.color }]}
            />
            <Text style={styles.paylineLabel}>{payline.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={showBackground ? ['#0f0f23', '#1a1742', '#0f0f23'] : ['#1a1a2e', '#1a1a2e', '#1a1a2e']}
        style={styles.gradient}
      >
        <View>
          <GameToolbar
            title="🎰 SLOTS"
            onBack={() => navigation.goBack()}
            backgroundColor="transparent"
            rightElement={
              <TouchableOpacity
                onPress={() => { toolbarExpanded.value = !toolbarExpanded.value; }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 6, borderRadius: 8 }}>
                <ReAnimated.Text style={[{ fontSize: 22, color: '#FFD700' }, chevronStyle]}>⌄</ReAnimated.Text>
              </TouchableOpacity>
            }
          />
          <ExpandableView isExpanded={toolbarExpanded} viewKey="slotsToolbarControls" duration={300}>
            <GameToolbarControls
              buttons={[
                { icon: showBlur ? '🌫️' : '✨', onPress: () => setShowBlur(!showBlur) },
                { icon: showBackground ? '🖼️' : '🔲', onPress: () => setShowBackground(!showBackground) },
              ]}
            />
          </ExpandableView>
        </View>

        <View style={styles.balanceCard}>
          <LinearGradient
            colors={['#10b981', '#34d399']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceText}>💰 {balance.toLocaleString()}</Text>
        </View>

        {/* Neon Title */}
        <Animated.View style={[styles.neonTitle, { opacity: neonFlicker }]}>
          <Text style={styles.neonText}>ARMO SLOTS</Text>
        </Animated.View>

        <View style={styles.machine}>
          <LinearGradient
            colors={['#6366f1', '#8b5cf6', '#ec4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.machineFrame}
          >
            <View style={styles.reelsWrapper}>
              <View style={styles.reelsInner}>
                <View style={styles.reelsContainer}>
                  {[0, 1, 2, 3, 4].map(renderReel)}
                </View>
                {renderPaylineOverlay()}
              </View>
            </View>

            {renderPaylineIndicators()}
          </LinearGradient>
        </View>

        {winnings && winnings.totalPayout > 0 && (
          <View style={styles.winCard}>
            <LinearGradient
              colors={['#fbbf24', '#f59e0b']}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.winTitle}>🎉 WIN!</Text>
            <Text style={styles.winAmount}>
              +{winnings.totalPayout.toLocaleString()}
            </Text>
            {(winnings.winningLines ?? []).map((line, i) => (
              <Text key={i} style={styles.winLine}>
                Line {line.line}: {line.symbols} → {line.payout}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.controls}>
          <Text style={styles.betLabel}>BET AMOUNT</Text>
          <View style={styles.betRow}>
            <TouchableOpacity
              style={styles.betBtn}
              onPress={() => setBetAmount(prev => Math.max(1, prev - 5))}
              disabled={spinning}
            >
              <Text style={styles.betBtnText}>-</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.betBtn}
              onPress={() => setBetAmount(prev => Math.min(100, prev + 5))}
              disabled={spinning}
            >
              <Text style={styles.betBtnText}>+</Text>
            </TouchableOpacity>
          </View>

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
    paddingTop: 16,
    paddingBottom: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    alignItems: 'center',
    overflow: 'hidden',
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
    flex: 3,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  machineFrame: {
    flex: 1,
  },
  reelsWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  reelsInner: {
    width: REELS_TOTAL_WIDTH,
    height: REELS_TOTAL_HEIGHT,
  },
  reelsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    padding: 8,
    gap: 4,
    height: SYMBOL_HEIGHT * 3 + 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paylinesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  reel: {
    width: REEL_WIDTH,
    height: SYMBOL_HEIGHT * 3,
    backgroundColor: '#1a1742',
    borderRadius: 8,
    overflow: 'hidden',
  },
  symbolCell: {
    height: SYMBOL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    fontSize: 40,
  },
  paylinesList: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  paylineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  paylineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  paylineLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  winCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
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
    marginHorizontal: 20,
    marginTop: 24,
    flex: 1,
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  betBtnText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  betDisplay: {
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
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
    flex: 1,
    alignItems: 'center',
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
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 20,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    minHeight: 60,
  },
  spinBtnDisabled: {
    opacity: 0.5,
  },
  spinGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  spinText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  neonTitle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    marginHorizontal: 16,
  },
  neonText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textShadowColor: '#ec4899',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    // Additional neon glow layers
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10,
  },
});

export default SlotsScreen;
