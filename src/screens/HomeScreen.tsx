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
        <View style={styles.balanceCard}>
          <LinearGradient
            colors={['#11998e', '#38ef7d']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.balanceGradient}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <Text style={styles.balanceAmount}>
              💰 {(user as any)?.balance?.toLocaleString() || '1,000'} coins
            </Text>
          </LinearGradient>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
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
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  balanceCard: {
    marginHorizontal: 20,
    marginTop: -12,
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
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
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
    minHeight: 140,
    justifyContent: 'flex-end',
  },
  gameIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  gameName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  gameDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
});

export default HomeScreen;
