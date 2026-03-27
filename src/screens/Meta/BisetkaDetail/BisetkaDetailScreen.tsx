import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  ImageBackground,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import bisetkaLeaderboardService, {
  type BisetkaKing,
} from '../../../services/bisetkaLeaderboard.service';
import bisetkaService from '../../../services/bisetka.service';
import { useAuth } from '../../../libs/hooks/useAuth';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import useBisetkaBackground, { DEFAULT_BISETKA_BACKGROUND_PROMPT } from '../../../hooks/useBisetkaBackground';
import useDeviceType from '../../../hooks/useDeviceType';
import { getGridColumns, getSpacing } from '../../../theme/responsive';

interface BisetkaDetailScreenProps {
  route: {
    params: {
      bisetkaId: string;
      bisetkaName: string;
      city: string;
      country: string;
    };
  };
  navigation: any;
}

// All 10 games with configurations - Using generated icons
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
    icon: require('../../../../assets/game-icons/slots-icon.png'),
    gradient: ['#ef4444', '#f87171'],
    gameType: 'slots',
    isImage: true,
  },
] as const;

const BisetkaDetailScreen: React.FC<BisetkaDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { bisetkaId, bisetkaName, city, country } = route.params;
  const { imageSource: bisetkaBackgroundSource } = useBisetkaBackground({
    city,
    neighborhood: bisetkaName,
    country,
    cacheKey: bisetkaId,
    promptTemplate: DEFAULT_BISETKA_BACKGROUND_PROMPT,
    enabled: Boolean(city),
  });
  const { user, refreshUser } = useAuth();
  const { isTablet, isLandscape, width: screenWidth } = useDeviceType();

  // Calculate responsive grid
  const columns = getGridColumns(isTablet, isLandscape);
  const horizontalPadding = getSpacing('lg', isTablet);
  const cardGap = getSpacing('sm', isTablet);
  const cardWidth = (screenWidth - (horizontalPadding * 2) - (cardGap * (columns - 1))) / columns;

  const [allKings, setAllKings] = useState<BisetkaKing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePlayers, setActivePlayers] = useState(0);
  const [recentScores, setRecentScores] = useState<Array<{
    username: string;
    game_type: string;
    score: number;
    timestamp: string;
  }>>([]);

  useEffect(() => {
    loadBisetkaData();
  }, []);

  // 🔄 Auto-refresh when screen comes back into focus (e.g., after playing a game)
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 BisetkaDetailScreen gained focus - refreshing data');
      loadBisetkaData(true); // Silent refresh
    }, [bisetkaId])
  );

  const loadBisetkaData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // TODO: Auto-join disabled temporarily due to endpoint issues
      // Will re-enable after backend endpoint is verified working
      // if (user && !user.current_bisetka_id) {
      //   try {
      //     await bisetkaService.joinBisetka(bisetkaId);
      //     await refreshUser();
      //     console.log('✅ Auto-joined user to Bisetka:', bisetkaName);
      //   } catch (err) {
      //     console.warn('⚠️ Could not auto-join Bisetka:', err);
      //   }
      // }
      
      // Load all Kings for this Bisetka
      const kingsData = await bisetkaLeaderboardService.getAllKings(bisetkaId);
      setAllKings(kingsData);
      
      // Get active player count (unique players across all kings)
      const uniquePlayers = new Set(kingsData.map(k => k.user_id)).size;
      setActivePlayers(uniquePlayers);
      
      // Load recent high scores from all game types
      const recentScoresList: typeof recentScores = [];
      for (const game of GAMES) {
        try {
          const leaderboard = await bisetkaLeaderboardService.getLeaderboard(bisetkaId, game.gameType, 3);
          leaderboard.forEach(entry => {
            recentScoresList.push({
              username: entry.username,
              game_type: game.name,
              score: entry.total_score,
              timestamp: new Date().toISOString(), // We'll use current time as proxy
            });
          });
        } catch (err) {
          // Skip if leaderboard doesn't exist for this game
        }
      }
      // Sort by score and take top 10
      recentScoresList.sort((a, b) => b.score - a.score);
      setRecentScores(recentScoresList.slice(0, 10));
    } catch (error: any) {
      console.error('Error loading Bisetka data:', error);
      if (!isRefresh) {
        BisetkaAlert.error(
          'Failed to Load',
          'Could not load Bisetka data.'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleGamePress = (game: typeof GAMES[number]) => {
    // Navigate to GameInfo screen with bisetkaId
    navigation.navigate('GameInfo', {
      gameType: game.gameType,
      gradient: game.gradient,
      bisetkaId: bisetkaId,
      bisetkaName: bisetkaName,
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}>
        <Icon name="arrow-left" size={24} color="#fff" />
      </TouchableOpacity>
      
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>🏘️ {bisetkaName}</Text>
        <Text style={styles.headerSubtitle}>
          {city}, {country}
        </Text>
        <Text style={styles.headerStats}>
          {activePlayers} {activePlayers === 1 ? 'player' : 'players'} • {allKings.length} {allKings.length === 1 ? 'king' : 'kings'}
        </Text>
      </View>
    </View>

  );

  const renderRecentScores = () => {
    return (
      <View style={styles.recentScoresSection}>
        <View style={styles.recentScoresHeader}>
          <Icon name="fire" size={18} color="#ef4444" />
          <Text style={styles.recentScoresTitle}>Hot Scores - Can You Beat Them?</Text>
        </View>
        
        {recentScores.length === 0 ? (
          <View style={styles.emptyScoresCard}>
            <Text style={styles.emptyScoresIcon}>🎯</Text>
            <Text style={styles.emptyScoresText}>No scores yet!</Text>
            <Text style={styles.emptyScoresSubtext}>Be the first to set a high score</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentScoresScroll}
          >
            {recentScores.map((score, index) => (
              <LinearGradient
                key={index}
                colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.3)']}
                style={styles.scoreCard}
              >
                <View style={styles.scoreCardContent}>
                  <Text style={styles.scoreValue}>⭐ {score.score}</Text>
                  <Text style={styles.scoreGame}>{score.game_type}</Text>
                  <Text style={styles.scorePlayer}>{score.username}</Text>
                  <Text style={styles.scoreChallengeText}>Beat this! 🎯</Text>
                </View>
              </LinearGradient>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderKingsSummary = () => {
    if (allKings.length === 0) {
      return (
        <View style={styles.emptyKings}>
          <Text style={styles.emptyKingsIcon}>👑</Text>
          <Text style={styles.emptyKingsText}>No Kings Yet</Text>
          <Text style={styles.emptyKingsSubtext}>
            Be the first to become King in this Bisetka!
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.kingsSection}>
        <Text style={styles.sectionTitle}>👑 Kings of {bisetkaName}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kingsScroll}>
          {allKings.map((king, index) => {
            const gameInfo = GAMES.find(g => g.id === king.game_type);
            return (
              <View
                key={index}
                style={styles.kingCard}>
                {gameInfo?.isImage ? (
                  <Image 
                    source={gameInfo.icon} 
                    style={styles.kingGameIconImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.kingGameIcon}>{gameInfo?.icon || '🎮'}</Text>
                )}
                <Text style={styles.kingGameName}>{gameInfo?.name || king.game_type}</Text>
                <Text style={styles.kingUsername}>{king.username}</Text>
                <Text style={styles.kingScore}>⭐ {king.total_score}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderGameCard = (game: typeof GAMES[number]) => {
    return (
      <TouchableOpacity
        key={game.id}
        activeOpacity={0.85}
        onPress={() => handleGamePress(game)}
        style={[styles.gameCardWrapper, { width: cardWidth }]}
      >
        <View style={{ ...styles.gameCard, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={styles.gameCardContent}>
            {game.isImage ? (
              <Image 
                source={game.icon} 
                style={styles.gameIconImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.gameIcon}>{game.icon}</Text>
            )}
            <Text style={styles.gameName}>{game.name }</Text>
            <Text style={styles.gameDescription}>{game.description}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGamesGrid = () => (
    <View style={styles.gamesSection}>
      <Text style={styles.sectionTitle}>🎮 Select Game</Text>
      <FlatList
        data={GAMES}
        keyExtractor={(game) => game.id}
        renderItem={({ item }) => renderGameCard(item)}
        numColumns={columns}
        key={columns} // Force re-render when columns change
        scrollEnabled={false}
        columnWrapperStyle={[styles.gamesRow, { gap: cardGap }]}
        contentContainerStyle={[styles.gamesGrid, { paddingHorizontal: horizontalPadding }]}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading Bisetka...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={bisetkaBackgroundSource}
        style={styles.backgroundImage}
        resizeMode="cover"
        blurRadius={2}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {renderHeader()}
          
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadBisetkaData(true)}
                tintColor="#6366f1"
              />
            }
          >
            {renderRecentScores()}
            {renderKingsSummary()}
            {renderGamesGrid()}
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  backgroundImage: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    backgroundColor:'#16213e',
    flexDirection: 'row',
    alignItems: 'center',
    padding:10,
    borderRadius:12
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  headerStats: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  kingsSection: {
    paddingVertical: 16,
    paddingLeft: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  kingsScroll: {
    paddingRight: 16,
  },
  kingCard: {
    backgroundColor: '#ffed4e',
    width: 140,
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kingGameIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  kingGameIconImage: {
    width: 72,
    height: 72,
    marginBottom: 8,
  },
  kingGameName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.7)',
    marginBottom: 8,
  },
  kingUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  kingScore: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.6)',
  },
  emptyKings: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyKingsIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyKingsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptyKingsSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  gamesSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  gamesGrid: {
    paddingBottom: 8,
  },
  gamesRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gameCardWrapper: {
    // Width set dynamically via inline style
  },
  gameCard: {
    aspectRatio: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameCardContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  gameIcon: {
    width: '100%',
    fontSize: 48,
    marginBottom: 12,
    textAlign: 'center',
  },
  gameIconImage: {
    width: 120,
    height: 120,
    marginBottom: 12,
    alignSelf: 'center',
  },
  gameName: {
    width: '100%',
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  gameDescription: {
    width: '100%',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f0f23',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  recentScoresSection: {
    marginTop: 16,
    marginBottom: 12,
  },
  recentScoresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  recentScoresTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 8,
  },
  recentScoresScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  scoreCard: {
    width: 140,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  scoreCardContent: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fbbf24',
    marginBottom: 4,
  },
  scoreGame: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  scorePlayer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  scoreChallengeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ef4444',
  },
  emptyScoresCard: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
  },
  emptyScoresIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyScoresText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  emptyScoresSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
});

export default BisetkaDetailScreen;
