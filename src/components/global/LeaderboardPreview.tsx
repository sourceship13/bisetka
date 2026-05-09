import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import apiConfig from '../../libs/utils/api.utils';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_points: number;
  total_games: number;
  win_rate: number;
}

const RANK_GRADIENTS: Record<number, [string, string]> = {
  1: ['#caa14a', '#9b7a2b'],
  2: ['#b8c1cf', '#7e8794'],
  3: ['#c1873d', '#8b5a23'],
};

const LeaderboardPreview: React.FC<{ limit?: number }> = ({ limit = 4 }) => {
  const navigation = useNavigation<any>();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiConfig.apiURL}/game-results/leaderboard?limit=${limit}`,
      );
      const data = await response.json();
      if (response.ok) {
        setEntries((data.leaderboard || []).slice(0, limit));
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [fetchLeaderboard]),
  );

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Leaderboard')}
        style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Leaderboard 🏆</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : entries.length === 0 ? (
          <Text style={styles.emptyText}>No players yet — be the first!</Text>
        ) : (
          entries.map((item, idx) => {
            const rank = idx + 1;
            const gradient = RANK_GRADIENTS[rank] || ['#3a3057', '#2a234a'];
            return (
              <LinearGradient
                key={item.user_id}
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.row}>
                <Text style={styles.rank}>{rank}</Text>
                <View style={styles.rowInfo}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.username || 'Player'}
                  </Text>
                  <Text style={styles.subInfo}>
                    {item.total_games} games  •  {Math.round(item.win_rate || 0)}% wins
                  </Text>
                </View>
                <View style={styles.scoreCol}>
                  <Text style={styles.score}>
                    {Math.floor(item.total_points || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.scoreLabel}>pts</Text>
                </View>
              </LinearGradient>
            );
          })
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  card: {
    backgroundColor: 'rgba(8, 6, 24, 0.78)',
    borderRadius: 24,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  rank: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    width: 36,
    textAlign: 'center',
  },
  rowInfo: {
    flex: 1,
    marginLeft: 8,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  subInfo: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  scoreCol: {
    alignItems: 'flex-end',
  },
  score: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default LeaderboardPreview;
