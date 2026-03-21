import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import bisetkaLeaderboardService, {
  type LeaderboardEntry,
  type BisetkaKing,
} from '../../../services/bisetkaLeaderboard.service';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';

const { width } = Dimensions.get('window');

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

const GAME_TYPES = [
  { id: 'blot', name: 'Blot', icon: '🃏' },
  { id: 'baazar-blot', name: 'Baazar Blot', icon: '⚡' },
  { id: 'chess', name: 'Chess', icon: '♟️' },
  { id: 'checkers', name: 'Checkers', icon: '🔴' },
  { id: 'poker', name: 'Poker', icon: '♠️' },
  { id: 'nardi', name: 'Nardi', icon: '🎲' },
  { id: 'billiards', name: 'Billiards', icon: '🎱' },
  { id: 'mrotsi', name: 'Mrotsi', icon: '🎯' },
];

const BisetkaDetailScreen: React.FC<BisetkaDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { bisetkaId, bisetkaName, city, country } = route.params;

  const [selectedGame, setSelectedGame] = useState('blot');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [king, setKing] = useState<BisetkaKing | null>(null);
  const [allKings, setAllKings] = useState<BisetkaKing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPlayers, setTotalPlayers] = useState(0);

  useEffect(() => {
    loadBisetkaData();
  }, [selectedGame]);

  const loadBisetkaData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Load leaderboard for selected game
      const leaderboardData = await bisetkaLeaderboardService.getLeaderboard(
        bisetkaId,
        selectedGame,
        100
      );
      setLeaderboard(leaderboardData);

      // Count unique players
      const uniquePlayers = new Set(leaderboardData.map(p => p.user_id)).size;
      setTotalPlayers(uniquePlayers);

      // Load King for selected game
      const kingData = await bisetkaLeaderboardService.getKing(
        bisetkaId,
        selectedGame
      );
      setKing(kingData);

      // Load all Kings (for summary)
      if (!isRefresh) {
        const kingsData = await bisetkaLeaderboardService.getAllKings(bisetkaId);
        setAllKings(kingsData);
      }
    } catch (error: any) {
      console.error('Error loading Bisetka data:', error);
      BisetkaAlert.error(
        'Failed to Load',
        'Could not load Bisetka leaderboard data.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
          {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'} • {allKings.length} {allKings.length === 1 ? 'king' : 'kings'}
        </Text>
      </View>
    </LinearGradient>
  );

  const renderKingSummary = () => {
    if (allKings.length === 0) return null;

    return (
      <View style={styles.kingsSection}>
        <Text style={styles.sectionTitle}>👑 Kings of this Bisetka</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.kingsScroll}>
          {allKings.map((k, index) => {
            const gameInfo = GAME_TYPES.find(g => g.id === k.game_type);
            return (
              <TouchableOpacity
                key={index}
                style={styles.kingCard}
                onPress={() => setSelectedGame(k.game_type)}>
                <LinearGradient
                  colors={['#ffd700', '#ffed4e']}
                  style={styles.kingCardGrad}>
                  <Text style={styles.kingGameIcon}>
                    {gameInfo?.icon || '🎮'}
                  </Text>
                  <Text style={styles.kingGameName}>
                    {gameInfo?.name || k.game_type}
                  </Text>
                  <Text style={styles.kingUsername}>{k.username}</Text>
                  <Text style={styles.kingScore}>
                    {k.total_score.toLocaleString()} pts
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderGameSelector = () => (
    <View style={styles.gameSelector}>
      <Text style={styles.sectionTitle}>Select Game</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.gameScroll}>
        {GAME_TYPES.map(game => (
          <TouchableOpacity
            key={game.id}
            style={[
              styles.gameChip,
              selectedGame === game.id && styles.gameChipActive,
            ]}
            onPress={() => setSelectedGame(game.id)}>
            <Text style={styles.gameChipIcon}>{game.icon}</Text>
            <Text
              style={[
                styles.gameChipText,
                selectedGame === game.id && styles.gameChipTextActive,
              ]}>
              {game.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderLeaderboard = () => {
    if (leaderboard.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎮</Text>
          <Text style={styles.emptyText}>No players yet</Text>
          <Text style={styles.emptySubtext}>
            Be the first to play {GAME_TYPES.find(g => g.id === selectedGame)?.name} in this Bisetka!
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.leaderboardSection}>
        <Text style={styles.sectionTitle}>
          🏆 Leaderboard - {GAME_TYPES.find(g => g.id === selectedGame)?.name}
        </Text>

        {king && (
          <View style={styles.kingBanner}>
            <LinearGradient
              colors={['#ffd700', '#ffed4e', '#ffd700']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.kingBannerGrad}>
              <Text style={styles.kingBannerCrown}>👑</Text>
              <View style={styles.kingBannerContent}>
                <Text style={styles.kingBannerTitle}>King of the Bisetka</Text>
                <Text style={styles.kingBannerName}>{king.username}</Text>
                <Text style={styles.kingBannerStats}>
                  {king.total_score.toLocaleString()} points • {king.total_wins} wins
                </Text>
              </View>
              <Text style={styles.kingBannerCrown}>👑</Text>
            </LinearGradient>
          </View>
        )}

        <View style={styles.leaderboardList}>
          {leaderboard.map((player, index) => (
            <View key={index} style={styles.playerRow}>
              <View style={styles.playerRank}>
                {player.rank <= 3 ? (
                  <Text style={styles.playerRankEmoji}>
                    {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : '🥉'}
                  </Text>
                ) : (
                  <Text style={styles.playerRankText}>#{player.rank}</Text>
                )}
              </View>

              <View style={styles.playerInfo}>
                <View style={styles.playerNameRow}>
                  <Text style={styles.playerName}>{player.username}</Text>
                  {player.is_king && (
                    <Text style={styles.playerCrown}>👑</Text>
                  )}
                </View>
                <Text style={styles.playerStats}>
                  {player.total_score.toLocaleString()} pts • {player.wins}/{player.total_games} wins
                </Text>
              </View>

              <View style={styles.playerScore}>
                <Text style={styles.playerScoreText}>
                  {player.total_score.toLocaleString()}
                </Text>
                <Text style={styles.playerScoreLabel}>points</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading Bisetka data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadBisetkaData(true)}
            tintColor="#6366f1"
          />
        }>
        {renderKingSummary()}
        {renderGameSelector()}
        {renderLeaderboard()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0c29',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  headerStats: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  kingsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  kingsScroll: {
    marginTop: 8,
  },
  kingCard: {
    width: 140,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  kingCardGrad: {
    padding: 12,
    alignItems: 'center',
  },
  kingGameIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  kingGameName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  kingUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  kingScore: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.7)',
  },
  gameSelector: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  gameScroll: {
    marginTop: 8,
  },
  gameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  gameChipActive: {
    backgroundColor: '#6366f1',
  },
  gameChipIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  gameChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  gameChipTextActive: {
    color: '#fff',
  },
  leaderboardSection: {
    padding: 16,
  },
  kingBanner: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  kingBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  kingBannerCrown: {
    fontSize: 32,
  },
  kingBannerContent: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
  },
  kingBannerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.7)',
    marginBottom: 4,
  },
  kingBannerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  kingBannerStats: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.6)',
  },
  leaderboardList: {
    marginTop: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  playerRank: {
    width: 50,
    alignItems: 'center',
  },
  playerRankEmoji: {
    fontSize: 24,
  },
  playerRankText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  playerCrown: {
    fontSize: 16,
    marginLeft: 6,
  },
  playerStats: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  playerScore: {
    alignItems: 'flex-end',
  },
  playerScoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
  },
  playerScoreLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default BisetkaDetailScreen;
