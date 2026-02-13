import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {systemWeights} from 'react-native-typography';
import {useAuth} from '../context/AuthContext';

const {width} = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 12) / 2; // 2 columns with gap

// Game configurations with colors and icons
const GAMES = [
  {
    id: 'blot',
    name: 'Blot',
    description: 'Classic Armenian card game',
    icon: '🃏',
    gradient: ['#667eea', '#764ba2'],
    gameType: 'blot',
  },
  {
    id: 'baazar-blot',
    name: 'Baazar Blot',
    description: 'Fast-paced variant',
    icon: '⚡',
    gradient: ['#f093fb', '#f5576c'],
    gameType: 'baazar-blot',
  },
  {
    id: 'poker',
    name: 'Poker',
    description: "Texas Hold'em",
    icon: '♠️',
    gradient: ['#11998e', '#38ef7d'],
    gameType: 'poker',
  },
  {
    id: 'chess',
    name: 'Chess',
    description: 'Classic strategy',
    icon: '♟️',
    gradient: ['#2c3e50', '#4ca1af'],
    gameType: 'chess',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    description: 'Quick casual matches',
    icon: '🔴',
    gradient: ['#ee0979', '#ff6a00'],
    gameType: 'checkers',
  },
  {
    id: 'nardi',
    name: 'Nardi',
    description: 'Armenian backgammon',
    icon: '🎲',
    gradient: ['#8E2DE2', '#4A00E0'],
    gameType: 'nardi',
  },
  {
    id: 'billiards',
    name: '8-Ball Pool',
    description: 'Sink solids or stripes',
    icon: '🎱',
    gradient: ['#1a2a6c', '#b21f1f', '#fdbb2d'],
    gameType: 'billiards',
  },
  {
    id: '9-ball',
    name: '9-Ball Pool',
    description: 'Race to the 9',
    icon: '9️⃣',
    gradient: ['#f7971e', '#ffd200'],
    gameType: '9-ball',
  },
  {
    id: 'mrotsi',
    name: 'Mrotsi',
    description: 'Armenian dice game',
    icon: '🎯',
    gradient: ['#00b09b', '#96c93d'],
    gameType: 'mrotsi',
  },
  {
    id: 'slots',
    name: 'Slots',
    description: 'Arcade fun',
    icon: '🎰',
    gradient: ['#c31432', '#240b36'],
    gameType: 'slots',
    comingSoon: true,
  },
] as const;

type GameConfig = (typeof GAMES)[number];

const HomeScreen = ({navigation}: any) => {
  const {user, signOut} = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  const handleGamePress = (game: GameConfig) => {
    // All games go through GameMode selector
    navigation.navigate('GameMode', {gameType: game.gameType});
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
      <StatusBar barStyle="light-content" backgroundColor="#0f0c29" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>
              {user?.fullName?.givenName || user?.username || 'Player'}! 👋
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Balance Card */}
        {/* Balance & Chat Quick Access */}
        <View style={styles.quickAccessRow}>
          <View style={[styles.balanceCard, ]}>
            <LinearGradient
              colors={['#11998e', '#38ef7d']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={[styles.balanceGradient, {backgroundColor: '#1a1742', padding: 20, borderRadius: 16, height: 150}]}>
              <Text style={styles.balanceLabel}>Your Balance</Text>
              <Text style={styles.balanceAmount}>
                💰 {(user as any)?.balance?.toLocaleString() || '1,000'}
              </Text>
            </LinearGradient>
          </View>
          
          <View style={styles.chatButtons}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('GlobalChat')}
              style={styles.chatButton}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.chatButtonGradient}>
                <Text style={styles.chatButtonText}>🌍</Text>
                <Text style={styles.chatButtonLabel}>Global</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => navigation.navigate('DMList')}
              style={styles.chatButton}>
              <LinearGradient
                colors={['#f093fb', '#f5576c']}
                style={styles.chatButtonGradient}>
                <Text style={styles.chatButtonText}>💬</Text>
                <Text style={styles.chatButtonLabel}>DMs</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Title */}
        <View style={[styles.sectionHeader, {backgroundColor: '#1a1742', padding: 20, borderRadius: 16, margin: 20}]}>
          <Text style={styles.sectionTitle}>🎮 Choose a Game</Text>
          <Text style={styles.sectionSubtitle}>
            Pick your game, then choose how to play
          </Text>
        </View>

        {/* Games Grid */}
        <View style={styles.gamesGrid}>
          {GAMES.map(game => renderGameCard(game))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🇦🇲 Bisetka — Armenian Gaming
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0c29',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flex: 1,
  },
  welcomeText: {
    ...systemWeights.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  userName: {
    ...systemWeights.bold,
    fontSize: 24,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
    flexShrink: 1,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  logoutText: {
    ...systemWeights.semibold,
    color: '#fff',
    fontSize: 13,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  quickAccessRow: {
    marginHorizontal: 20,
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  balanceCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#11998e',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceGradient: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    minHeight: 90,
  },
  chatButtons: {
    gap: 8,
  },
  chatButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  chatButtonGradient: {
    width: 70,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  chatButtonText: {
    fontSize: 20,
    marginBottom: 2,
    textAlign: 'center',
  },
  chatButtonLabel: {
    ...systemWeights.semibold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  balanceLabel: {
    ...systemWeights.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
    textAlign: 'center',
  },
  balanceAmount: {
    ...systemWeights.bold,
    fontSize: 22,
    color: '#fff',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 16,
    alignItems: 'center',
  },
  sectionTitle: {
    ...systemWeights.bold,
    fontSize: 22,
    color: '#fff',
    textAlign: 'center',
  },
  sectionSubtitle: {
    ...systemWeights.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  gameCardWrapper: {
    width: CARD_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  gameCard: {
    padding: 16,
    minHeight: 150,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  gameIcon: {
    fontSize: 36,
    marginBottom: 8,
    textAlign: 'center',
  },
  gameName: {
    ...systemWeights.bold,
    fontSize: 15,
    color: '#fff',
    marginBottom: 4,
    lineHeight: 18,
    textAlign: 'center',
    flexShrink: 1,
  },
  gameDescription: {
    ...systemWeights.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 13,
    textAlign: 'center',
    flexShrink: 1,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  comingSoonText: {
    ...systemWeights.bold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    ...systemWeights.regular,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default HomeScreen;
