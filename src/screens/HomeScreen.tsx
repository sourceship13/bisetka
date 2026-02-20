import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../context/AuthContext';
import {iOSUIKit} from 'react-native-typography';
import {colors} from '../theme';
import packageJson from '../../package.json';

const {width} = Dimensions.get('window');
const CARD_WIDTH = (width - 42) / 2; // 2 columns with gap

// Game configurations with PushBird-style colors
const GAMES = [
  {
    id: 'blot',
    name: 'Blot',
    description: 'Classic card game',
    icon: '🃏',
    gradient: ['#6366f1', '#8b5cf6'],
    gameType: 'blot',
  },
  {
    id: 'baazar-blot',
    name: 'Baazar Blot',
    description: 'Fast variant',
    icon: '⚡',
    gradient: ['#ec4899', '#f472b6'],
    gameType: 'baazar-blot',
  },
  {
    id: 'poker',
    name: 'Poker',
    description: "Texas Hold'em",
    icon: '♠️',
    gradient: ['#10b981', '#34d399'],
    gameType: 'poker',
  },
  {
    id: 'chess',
    name: 'Chess',
    description: 'Strategy',
    icon: '♟️',
    gradient: ['#3b82f6', '#60a5fa'],
    gameType: 'chess',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    description: 'Quick matches',
    icon: '🔴',
    gradient: ['#f59e0b', '#fbbf24'],
    gameType: 'checkers',
  },
  {
    id: 'nardi',
    name: 'Nardi',
    description: 'Backgammon',
    icon: '🎲',
    gradient: ['#8b5cf6', '#a78bfa'],
    gameType: 'nardi',
  },
  {
    id: 'billiards',
    name: '8-Ball',
    description: 'Pool',
    icon: '🎱',
    gradient: ['#06b6d4', '#22d3ee'],
    gameType: 'billiards',
  },
  {
    id: '9-ball',
    name: '9-Ball',
    description: 'Race to 9',
    icon: '9️⃣',
    gradient: ['#f59e0b', '#fbbf24'],
    gameType: '9-ball',
  },
  {
    id: 'mrotsi',
    name: 'Mrotsi',
    description: 'Dice game',
    icon: '🎯',
    gradient: ['#14b8a6', '#2dd4bf'],
    gameType: 'mrotsi',
  },
  {
    id: 'slots',
    name: 'Slots',
    description: 'Arcade',
    icon: '🎰',
    gradient: ['#ef4444', '#f87171'],
    gameType: 'slots',
  },
] as const;

type GameConfig = (typeof GAMES)[number];

const HomeScreen = ({navigation}: any) => {
  const {user, signOut} = useAuth();

  const handleGamePress = (game: GameConfig) => {
    // Navigate to GameInfo screen first to show rules and points
    navigation.navigate('GameInfo', {
      gameType: game.gameType,
      gradient: game.gradient as unknown as string[],
    });
  };

  const renderGameCard = (game: GameConfig) => {
    const isComingSoon = 'comingSoon' in game && game.comingSoon;

    return (
      <TouchableOpacity
        key={game.id}
        activeOpacity={0.85}
        disabled={isComingSoon}
        onPress={() => handleGamePress(game)}
        style={[styles.gameCardWrapper, isComingSoon && styles.cardDisabled]}>
        <LinearGradient
          colors={game.gradient as unknown as string[]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.gameCard}>
          <Text style={styles.gameIcon}>{game.icon}</Text>
          <Text style={styles.gameName}>{game.name}</Text>
          <Text style={styles.gameDescription}>{game.description}</Text>
          {isComingSoon && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Soon</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f23" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.header}>
          <View style={[styles.headerContent, {minHeight: 80  }]}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>
              {user?.username || 'Player'}! 👋
            </Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Balance & Chat Buttons */}
        <View style={styles.quickRow}>
          <View style={[styles.balanceWrap]}>
            <LinearGradient
              colors={['#10b981', '#34d399']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={[{minHeight: 100, borderRadius: 16, alignItems: 'flex-start', justifyContent: 'center', margin: 8}]}>
              <Text style={[styles.balanceLabel, iOSUIKit.bodyEmphasizedWhite]}>Points</Text>
              <Text style={styles.balanceAmount}>
                🏆 {(user as any)?.totalPoints?.toLocaleString() || '0'}
              </Text>
            </LinearGradient>
          </View>
          
          <View style={styles.chatBtns}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('GlobalChat')}
              style={styles.chatBtn}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.chatGrad}>
                <Text style={styles.chatIcon}>🌍</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => navigation.navigate('DMList')}
              style={styles.chatBtn}>
              <LinearGradient
                colors={['#ec4899', '#f472b6']}
                style={styles.chatGrad}>
                <Text style={styles.chatIcon}>💬</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => navigation.navigate('Leaderboard')}
              style={styles.chatBtn}>
              <LinearGradient
                colors={['#f59e0b', '#fbbf24']}
                style={styles.chatGrad}>
                <Text style={styles.chatIcon}>🏆</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>🎮 Choose a Game</Text>
          <Text style={styles.sectionSub}>Pick your game</Text>
        </View>

        {/* Games Grid */}
        <View style={styles.gamesGrid}>
          {GAMES.map(game => renderGameCard(game))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>🇦🇲 Bisetka</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flex: 1,
    marginRight: 8,
  },
  welcomeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight:26,
    borderRadius: 14,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  quickRow: {
    marginHorizontal: 16,
    marginTop: 0,
    flexDirection: 'row',
    gap: 8,
  },
  balanceWrap: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceGrad: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
    marginHorizontal:40,
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',    
    color: '#fff',
    marginHorizontal: 40,
  },
  chatBtns: {
    gap: 8,
    flex:1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chatBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    flex: 1,
  },
  chatGrad: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIcon: {
    fontSize: 24,
  },
  sectionHead: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  sectionSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  gameCardWrapper: {
    width: CARD_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  gameCard: {
    padding: 2,
    minHeight: 130,
    justifyContent: 'center',

  },
  gameIcon: {
    fontSize: 36,
    marginBottom: 8,
    textAlign: 'center',
  },
  gameName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 3,
    margin:10,
    textAlign: 'center',
  },
  gameDescription: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    marginHorizontal:10
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
});

export default HomeScreen;
