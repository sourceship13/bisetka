import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
  ImageBackground,
  ActivityIndicator,
  Image,
} from 'react-native';
import AppVersionFooter from '../../../components/global/AppVersionFooter';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import useBisetkaBackground, { DEFAULT_BISETKA_BACKGROUND_PROMPT } from '../../../hooks/useBisetkaBackground';
import { useAuth } from '../../../libs/hooks/useAuth';
import bisetkaService, { Bisetka } from '../../../services/bisetka.service';

const buildAccountBisetka = (accountBisetka: {
  id: string;
  neighborhood: string;
  city: string;
  country: string;
  active_users: number;
}): Bisetka => ({
  id: accountBisetka.id,
  neighborhood_id: accountBisetka.id,
  neighborhood_name: accountBisetka.neighborhood,
  city: accountBisetka.city,
  country: accountBisetka.country,
  active_users: accountBisetka.active_users,
  created_at: '',
  updated_at: '',
});

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 42) / 2; // 2 columns with gap

// Game configurations with PushBird-style colors
const GAMES = [
  {
    id: 'blot',
    name: 'Blot',
    description: 'Classic card game',
    icon: require('../../../../assets/game-icons/blot-icon.png'),
    gradient: ['#6366f1', '#8b5cf6'],
    gameType: 'blot',
    isImage: true,
  },
  {
    id: 'baazar-blot',
    name: 'Baazar Blot',
    description: 'Fast variant',
    icon: require('../../../../assets/game-icons/baazar-blot-icon.png'),
    gradient: ['#ec4899', '#f472b6'],
    gameType: 'baazar-blot',
    isImage: true,
  },
  {
    id: 'checkers',
    name: 'Checkers',
    description: 'Quick matches',
    icon: require('../../../../assets/game-icons/checkers-icon.png'),
    gradient: ['#f59e0b', '#fbbf24'],
    gameType: 'checkers',
    isImage: true,
  },
  {
    id: 'chess',
    name: 'Chess',
    description: 'Strategy',
    icon: require('../../../../assets/game-icons/chess-icon.png'),
    gradient: ['#3b82f6', '#60a5fa'],
    gameType: 'chess',
    isImage: true,
  },
  {
    id: 'poker',
    name: 'Poker',
    description: "Texas Hold'em",
    icon: require('../../../../assets/game-icons/poker-icon.png'),
    gradient: ['#10b981', '#34d399'],
    gameType: 'poker',
    isImage: true,
  },
  {
    id: 'nardi',
    name: 'Nardi',
    description: 'Backgammon',
    icon: require('../../../../assets/game-icons/nardi-icon.png'),
    gradient: ['#8b5cf6', '#a78bfa'],
    gameType: 'nardi',
    isImage: true,
  },
  {
    id: 'billiards',
    name: '8-Ball',
    description: 'Pool',
    icon: require('../../../../assets/game-icons/8ball-icon.png'),
    gradient: ['#06b6d4', '#22d3ee'],
    gameType: 'billiards',
    isImage: true,
  },
  {
    id: '9-ball',
    name: '9-Ball',
    description: 'Race to 9',
    icon: require('../../../../assets/game-icons/9ball-icon.png'),
    gradient: ['#f59e0b', '#fbbf24'],
    gameType: '9-ball',
    isImage: true,
  },
  {
    id: 'mrotsi',
    name: 'Mrotsi',
    description: 'Dice game',
    icon: require('../../../../assets/game-icons/mrotsi-icon.png'),
    gradient: ['#14b8a6', '#2dd4bf'],
    gameType: 'mrotsi',
    isImage: true,
  },
  {
    id: 'slots',
    name: 'Slots',
    description: 'Arcade',
    icon: '🎰',
    gradient: ['#ef4444', '#f87171'],
    gameType: 'slots',
    isImage: false,
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    description: '21 Card Game',
    icon: require('../../../../assets/game-icons/blackjack-icon.png'),
    gradient: ['#7c3aed', '#a78bfa'],
    gameType: 'blackjack',
    isImage: true,
  },
] as const;

type GameConfig = (typeof GAMES)[number];

const GameSelectionScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [bisetka, setBisetka] = useState<Bisetka | null>(
    user?.bisetka ? buildAccountBisetka(user.bisetka) : null,
  );
  const [bisetkaLoading, setBisetkaLoading] = useState(!user?.bisetka);
  const { imageSource: bisetkaBackgroundSource } = useBisetkaBackground({
    city: bisetka?.city || user?.bisetka?.city || null,
    neighborhood: bisetka?.neighborhood_name || user?.bisetka?.neighborhood || null,
    country: bisetka?.country || user?.bisetka?.country || null,
    cacheKey: bisetka?.id || user?.bisetka?.id || null,
    promptTemplate: DEFAULT_BISETKA_BACKGROUND_PROMPT,
    enabled: Boolean(bisetka?.city || user?.bisetka?.city),
  });

  useEffect(() => {
    let isMounted = true;

    const loadBisetka = async () => {
      if (user?.bisetka) {
        setBisetka(buildAccountBisetka(user.bisetka));
        setBisetkaLoading(false);
        return;
      }

      setBisetkaLoading(true);
      const currentBisetka = await bisetkaService.getMyBisetka();
      const ipResult = currentBisetka ? null : await bisetkaService.getByIpBisetka();

      if (!isMounted) {
        return;
      }

      setBisetka(currentBisetka || ipResult?.bisetka || null);
      setBisetkaLoading(false);
    };

    void loadBisetka();

    return () => {
      isMounted = false;
    };
  }, [user?.bisetka]);

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
          {(game as any).isImage ? (
            <Image 
              source={game.icon} 
              style={styles.gameIconImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.gameIcon}>{game.icon}</Text>
          )}
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
        source={bisetkaBackgroundSource}
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
            {/* Bisetka Location Card */}
            {bisetkaLoading ? (
              <View style={styles.bisetkaCardWrapper}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bisetkaCard}
                >
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.bisetkaLoadingText}>Finding your Bisetka...</Text>
                </LinearGradient>
              </View>
            ) : bisetka ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate('BisetkaDetail', { bisetkaId: bisetka.id })}
                style={styles.bisetkaCardWrapper}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bisetkaCard}
                >
                  <View style={styles.bisetkaCardContent}>
                    <View style={styles.bisetkaIconContainer}>
                      <Text style={styles.bisetkaCardIcon}>📍</Text>
                    </View>
                    <View style={styles.bisetkaCardTextContainer}>
                      <Text style={styles.bisetkaCardLabel}>NEAREST TO YOU</Text>
                      <Text style={styles.bisetkaCardTitle}>
                        {bisetka.neighborhood_name}, {bisetka.city}
                      </Text>
                      <Text style={styles.bisetkaCardDescription}>
                        This is the Bisetka matched from your account or current connection.
                      </Text>
                    </View>
                    <View style={styles.bisetkaCardBadge}>
                      <Text style={styles.bisetkaCardBadgeText}>
                        {bisetka.active_users} active
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            {/* Games Grid */}
            <View style={styles.gamesGrid}>
              {GAMES.map(game => renderGameCard(game))}
            </View>

            {/* Footer */}
            <AppVersionFooter containerStyle={styles.footer} />
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
  bisetkaCardWrapper: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bisetkaCard: {

    minHeight: 120,
  },
  bisetkaCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding:10
  },
  bisetkaIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bisetkaCardIcon: {
    fontSize: 32,
  },
  bisetkaCardTextContainer: {
    flex: 1,
  },
  bisetkaCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bisetkaCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  bisetkaCardDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },
  bisetkaCardBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  bisetkaCardBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  bisetkaLoadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 12,
    textAlign: 'center',
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  gameIconImage: {
    width: 120,
    height: 120,
    marginBottom: 8,
    alignSelf: 'center',
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
});

export default GameSelectionScreen;
