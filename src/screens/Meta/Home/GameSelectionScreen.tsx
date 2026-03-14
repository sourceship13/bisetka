import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

const bisetkaBackground = require('../../../../assets/backgrounds/bisetka.png');

const { width } = Dimensions.get('window');
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
    id: 'checkers',
    name: 'Checkers',
    description: 'Quick matches',
    icon: '🔴',
    gradient: ['#f59e0b', '#fbbf24'],
    gameType: 'checkers',
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
    id: 'poker',
    name: 'Poker',
    description: "Texas Hold'em",
    icon: '♠️',
    gradient: ['#10b981', '#34d399'],
    gameType: 'poker',
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
  {
    id: 'blackjack',
    name: 'Blackjack',
    description: '21 Card Game',
    icon: '🎴',
    gradient: ['#7c3aed', '#a78bfa'],
    gameType: 'blackjack',
  },
] as const;

type GameConfig = (typeof GAMES)[number];

const GameSelectionScreen = ({ navigation }: any) => {
  const handleGamePress = (game: GameConfig) => {
    // Navigate to GameInfo screen first to show rules and points
    navigation.navigate('GameInfo', {
      gameType: game.gameType,
      gradient: game.gradient as unknown as string[],
    });
  };

  const renderGameCard = (game: GameConfig) => {
    const isComingSoon: boolean =
      'comingSoon' in game && (game as any).comingSoon === true;

    return (
      <TouchableOpacity
        key={game.id}
        activeOpacity={0.85}
        disabled={isComingSoon}
        onPress={() => handleGamePress(game)}
        style={[styles.gameCardWrapper, isComingSoon && styles.cardDisabled]}
      >
        <LinearGradient
          // colors={game.gradient as unknown as string[]}
          colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gameCard}
        >
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
    <View style={styles.container}>
      <ImageBackground
        source={bisetkaBackground}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {/* Header */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginVertical:20 }}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backBtn}
              >
                <Text style={styles.backText}>←</Text>
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>Choose a Game</Text>
              </View>
              <View style={styles.placeholder} />
            </View>
          </LinearGradient>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
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
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingTop: 16,
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 40,
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
    shadowOffset: { width: 0, height: 4 },
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
    margin: 10,
    textAlign: 'center',
  },
  gameDescription: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    marginHorizontal: 10,
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
    marginTop: 20,
    marginBottom: 0,
    paddingBottom: 0,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
});

export default GameSelectionScreen;
