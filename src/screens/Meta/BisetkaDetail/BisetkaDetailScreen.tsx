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
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import bisetkaLeaderboardService, {
  type BisetkaKing,
} from '../../../services/bisetkaLeaderboard.service';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';

const { width } = Dimensions.get('window');
const GRID_HORIZONTAL_PADDING = 16;
const GRID_GAP = 8;
const CARD_WIDTH = (width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;

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

// All 11 games with configurations - Using generated icons
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
    id: 'blackjack',
    name: 'Blackjack',
    description: '21 Card Game',
    icon: require('../../../../assets/game-icons/blackjack-icon.png'),
    gradient: ['#7c3aed', '#a78bfa'],
    gameType: 'blackjack',
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

  const [allKings, setAllKings] = useState<BisetkaKing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePlayers, setActivePlayers] = useState(0);

  useEffect(() => {
    loadBisetkaData();
  }, []);

  const loadBisetkaData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Load all Kings for this Bisetka
      const kingsData = await bisetkaLeaderboardService.getAllKings(bisetkaId);
      setAllKings(kingsData);
      
      // Get active player count (unique players across all kings)
      const uniquePlayers = new Set(kingsData.map(k => k.user_id)).size;
      setActivePlayers(uniquePlayers);
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
    <LinearGradient
      colors={['#1a1a2e', '#16213e']}
      style={styles.header}>
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
    </LinearGradient>
  );

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
              <LinearGradient
                key={index}
                colors={['#ffd700', '#ffed4e']}
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
              </LinearGradient>
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
        style={styles.gameCardWrapper}
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
        numColumns={2}
        scrollEnabled={false}
        columnWrapperStyle={styles.gamesRow}
        contentContainerStyle={styles.gamesGrid}
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
        source={require('../../../../assets/backgrounds/bisetka.png')}
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
    paddingVertical: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
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
    width: 140,
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
    alignItems: 'center',
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
    paddingBottom: GRID_GAP,
  },
  gamesRow: {
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },
  gameCardWrapper: {
    width: CARD_WIDTH,
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
});

export default BisetkaDetailScreen;
