import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { apiConfig } from '../libs/utils/api.utils';

const { width } = Dimensions.get('window');
const REEL_WIDTH = (width - 80) / 5;
const SYMBOL_HEIGHT = 70;

const SYMBOLS = ['7️⃣', '💎', '⭐', '🔔', '🍒', '🍋', 'BAR'];

interface SpinResult {
  result: string[][];
  winningLines: Array<{ line: number; symbols: string; payout: number }>;
  totalPayout: number;
  netResult: number;
  activePaylines: number;
}

const SlotsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState((user as any)?.balance || 1000);
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string[][] | null>(null);
  const [winnings, setWinnings] = useState<SpinResult | null>(null);
  
  // Animation values for each reel
  const reelAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const spin = async () => {
    if (spinning || balance < betAmount) return;
    
    setSpinning(true);
    setWinnings(null);
    setBalance((prev: number) => prev - betAmount);

    // Animate reels spinning
    const spinAnims = reelAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 1500 + i * 200,
        useNativeDriver: true,
      })
    );

    Animated.parallel(spinAnims).start();

    try {
      // Call backend
      const response = await fetch(`${apiConfig.apiURL}/slots/spin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(user as any)?.token}`,
        },
        body: JSON.stringify({ betAmount }),
      });

      const data: SpinResult = await response.json();
      
      // Reset animations
      reelAnims.forEach(anim => anim.setValue(0));
      
      setResult(data.result);
      setWinnings(data);
      
      if (data.totalPayout > 0) {
        setBalance((prev: number) => prev + data.totalPayout);
      }
    } catch (error) {
      console.error('Spin failed:', error);
      setBalance((prev: number) => prev + betAmount); // Refund on error
    } finally {
      setSpinning(false);
    }
  };

  const renderReel = (colIndex: number) => {
    const symbols = result ? result[colIndex] : ['?', '?', '?'];
    const spinAnim = reelAnims[colIndex]!;

    return (
      <View key={colIndex} style={styles.reel}>
        <Animated.View
          style={{
            transform: [{
              translateY: spinAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -SYMBOL_HEIGHT * 10],
              }),
            }],
          }}>
          {[...SYMBOLS, ...SYMBOLS, ...symbols].map((sym, i) => (
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
        style={styles.gradient}>
        
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
          style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceText}>💰 {balance.toLocaleString()}</Text>
        </LinearGradient>

        {/* Slot Machine */}
        <View style={styles.machine}>
          <LinearGradient
            colors={['#6366f1', '#8b5cf6', '#ec4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.machineFrame}>
            
            {/* Reels Container */}
            <View style={styles.reelsContainer}>
              {[0, 1, 2, 3, 4].map(renderReel)}
            </View>

            {/* Paylines Indicator */}
            <View style={styles.paylinesIndicator}>
              <Text style={styles.paylinesText}>
                {betAmount >= 50 ? '5' : betAmount >= 25 ? '3' : betAmount >= 15 ? '2' : '1'} PAYLINES ACTIVE
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Winnings Display */}
        {winnings && winnings.totalPayout > 0 && (
          <LinearGradient
            colors={['#fbbf24', '#f59e0b']}
            style={styles.winCard}>
            <Text style={styles.winTitle}>🎉 WIN!</Text>
            <Text style={styles.winAmount}>+{winnings.totalPayout.toLocaleString()}</Text>
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
              style={styles.betBtn}
              onPress={() => setBetAmount(prev => Math.max(1, prev - 5))}
              disabled={spinning}>
              <Text style={styles.betBtnText}>-</Text>
            </TouchableOpacity>
            
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              style={styles.betDisplay}>
              <Text style={styles.betAmount}>{betAmount}</Text>
            </LinearGradient>
            
            <TouchableOpacity
              style={styles.betBtn}
              onPress={() => setBetAmount(prev => Math.min(100, prev + 5))}
              disabled={spinning}>
              <Text style={styles.betBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Bet Buttons */}
          <View style={styles.quickBets}>
            {[10, 25, 50].map(amt => (
              <TouchableOpacity
                key={amt}
                style={[styles.quickBet, betAmount === amt && styles.quickBetActive]}
                onPress={() => setBetAmount(amt)}
                disabled={spinning}>
                <Text style={[styles.quickBetText, betAmount === amt && styles.quickBetTextActive]}>
                  {amt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Spin Button */}
        <TouchableOpacity
          style={[styles.spinBtn, (spinning || balance < betAmount) && styles.spinBtnDisabled]}
          onPress={spin}
          disabled={spinning || balance < betAmount}
          activeOpacity={0.8}>
          <LinearGradient
            colors={spinning ? ['#666', '#444'] : ['#ec4899', '#f472b6']}
            style={styles.spinGradient}>
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
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
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
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  machineFrame: {
    padding: 16,
  },
  reelsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    padding: 8,
    gap: 4,
    height: SYMBOL_HEIGHT * 3 + 16,
    overflow: 'hidden',
  },
  reel: {
    width: REEL_WIDTH,
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
  paylinesIndicator: {
    marginTop: 12,
    alignItems: 'center',
  },
  paylinesText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
  },
  winCard: {
    marginHorizontal: 20,
    marginTop: 16,
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
    marginHorizontal: 20,
    marginTop: 24,
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
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
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
    marginHorizontal: 20,
    marginTop: 24,
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
    paddingVertical: 20,
    alignItems: 'center',
  },
  spinText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
});

export default SlotsScreen;
