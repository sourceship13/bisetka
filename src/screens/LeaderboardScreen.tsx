import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {colors, spacing, typography} from '../theme';
import apiConfig from '../libs/utils/api.utils';
import {useAuth} from '../context/AuthContext';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url?: string;
  total_points: number;
  lifetime_points: number;
  best_win_streak: number;
  total_games: number;
  total_wins: number;
  win_rate: number;
}

const LeaderboardScreen = ({navigation}: any) => {
  const {user} = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    try {
      setError(null);
      const response = await fetch(
        `${apiConfig.apiURL}/game-results/leaderboard?limit=100`,
      );
      const data = await response.json();

      if (response.ok) {
        setLeaderboard(data.leaderboard || []);
      } else {
        setError(data.error || 'Failed to load leaderboard');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const getRankColor = (rank: number): string[] => {
    if (rank === 0) return ['#FFD700', '#FFA500']; // Gold
    if (rank === 1) return ['#C0C0C0', '#A8A8A8']; // Silver
    if (rank === 2) return ['#CD7F32', '#B87333']; // Bronze
    return ['#6366f1', '#8b5cf6']; // Default purple
  };

  const getRankEmoji = (rank: number): string => {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return '';
  };

  const renderLeaderboardItem = ({
    item,
    index,
  }: {
    item: LeaderboardEntry;
    index: number;
  }) => {
    const isCurrentUser = item.user_id === user?.id;
    const rank = index + 1;
    const rankEmoji = getRankEmoji(index);

    return (
      <View style={styles.itemContainer}>
        <LinearGradient
          colors={
            isCurrentUser
              ? ['#10b981', '#34d399']
              : index < 3
              ? getRankColor(index)
              : ['#1f2937', '#374151']
          }
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={[styles.itemGradient, isCurrentUser && styles.currentUserItem]}>
          <View style={styles.rankContainer}>
            <Text style={styles.rankNumber}>
              {rankEmoji || `#${rank}`}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <Text
              style={[styles.username, isCurrentUser && styles.currentUsername]}
              numberOfLines={1}>
              {item.username}
              {isCurrentUser && ' (You)'}
            </Text>
            <View style={styles.statsRow}>
              <Text style={styles.statText}>
                {item.total_games || 0} games
              </Text>
              <Text style={styles.statSeparator}>•</Text>
              <Text style={styles.statText}>
                {item.win_rate ? Math.round(parseFloat(item.win_rate as any)) : 0}% wins
              </Text>
              {(item.best_win_streak || 0) > 0 && (
                <>
                  <Text style={styles.statSeparator}>•</Text>
                  <Text style={styles.statText}>
                    🔥 {item.best_win_streak}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.pointsContainer}>
            <Text style={styles.pointsValue}>
              {item.total_points.toLocaleString()}
            </Text>
            <Text style={styles.pointsLabel}>pts</Text>
          </View>
        </LinearGradient>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Leaderboard</Text>
          <View style={{width: 60}} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Leaderboard</Text>
          <View style={{width: 60}} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity
            onPress={fetchLeaderboard}
            style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🏆 Leaderboard</Text>
        <View style={{width: 60}} />
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>Top 100 Players by Points</Text>
        <Text style={styles.totalPlayers}>
          {leaderboard.length} players ranked
        </Text>
      </View>

      {/* Leaderboard List */}
      <FlatList
        data={leaderboard}
        keyExtractor={(item, index) => `${item.user_id}-${index}`}
        renderItem={renderLeaderboardItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No players on the leaderboard yet
            </Text>
            <Text style={styles.emptySubtext}>
              Play games to earn points and climb the ranks!
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.secondary,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  subtitleContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  totalPlayers: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: colors.error.main,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  itemContainer: {
    marginBottom: spacing.sm,
  },
  itemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
  },
  currentUserItem: {
    borderWidth: 2,
    borderColor: colors.success.main,
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  currentUsername: {
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  statSeparator: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginHorizontal: 6,
  },
  pointsContainer: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  pointsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  pointsLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 3,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: 18,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});

export default LeaderboardScreen;
