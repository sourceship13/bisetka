import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiService from '../../../services/api.service';

const { width } = Dimensions.get('window');
const CARDS_PER_ROW = 3;
const GRID_PADDING = 16;
const CARD_GAP = 12;
const CARD_WIDTH = (width - (GRID_PADDING * 2) - (CARD_GAP * (CARDS_PER_ROW - 1))) / CARDS_PER_ROW;

interface Achievement {
  achievement_id: string;
  name: string;
  description: string;
  icon: string;
  icon_library: string;
  category: string;
  tier: string;
  game_type?: string;
  requirement_value: number;
  points_reward: number;
  is_secret: boolean;
  unlocked: boolean;
  unlocked_at?: string;
  progress: number;
  progress_percent: number;
}

interface AchievementStats {
  total: number;
  unlocked: number;
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
  diamond: number;
  total_points_earned: number;
  categories: Record<string, { total: number; unlocked: number }>;
}

const CATEGORY_NAMES: Record<string, string> = {
  game_mastery: 'Game Mastery',
  bisetka: 'Bisetka',
  cross_game: 'Cross-Game',
  points: 'Points & Wealth',
  social: 'Social',
  consistency: 'Consistency',
  time: 'Time-Based',
  secret: 'Secret',
  meta: 'Meta',
};

const TIER_COLORS: Record<string, string[]> = {
  bronze: ['#CD7F32', '#8B5A2B'],
  silver: ['#C0C0C0', '#808080'],
  gold: ['#FFD700', '#FFA500'],
  platinum: ['#E5E4E2', '#A8A8A8'],
  diamond: ['#B9F2FF', '#00BFFF'],
};

export default function AchievementsScreen({ navigation }: any) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadAchievements = async () => {
    setLoading(true);
    try {
      console.log('🏆 Loading achievements...');
      console.log('🏆 API URL:', apiService);
      
      console.log('🏆 Calling /achievements endpoint...');
      const achievementsData = await apiService.get('/achievements', true);
      console.log('✅ Achievements response:', achievementsData);
      
      console.log('🏆 Calling /achievements/stats endpoint...');
      const statsData = await apiService.get('/achievements/stats', true);
      console.log('✅ Stats response:', statsData);
      
      setAchievements(achievementsData.achievements || []);
      setStats(statsData.stats || null);
    } catch (error: any) {
      console.error('❌ Failed to load achievements:', error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error name:', error?.name);
      console.error('❌ Error toString:', error?.toString());
      
      // Show alert to user
      alert(`Failed to load achievements: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAchievements();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadAchievements();
    }, [])
  );

  const filteredAchievements =
    selectedCategory === 'all'
      ? achievements
      : achievements.filter((a) => a.category === selectedCategory);

  const renderAchievementCard = (achievement: Achievement) => {
    const isUnlocked = achievement.unlocked;
    const tierColors = TIER_COLORS[achievement.tier] || TIER_COLORS.bronze;
    const progressPercent = achievement.progress_percent || 0;

    // Hide secret achievements that aren't unlocked
    if (achievement.is_secret && !isUnlocked) {
      return (
        <View key={achievement.achievement_id} style={styles.cardWrapper}>
          <View style={styles.secretCard}>
            <Icon name="help-circle" size={36} color="#666" />
            <Text style={styles.secretText}>???</Text>
            <Text style={styles.secretDesc}>Secret Achievement</Text>
          </View>
        </View>
      );
    }

    return (
      <View
        key={achievement.achievement_id}
        style={styles.cardWrapper}
      >
        <TouchableOpacity
          style={[styles.card, !isUnlocked && styles.lockedCard]}
          activeOpacity={0.8}
        >
        <LinearGradient
          colors={isUnlocked ? tierColors : ['#2a2a2a', '#1a1a1a']}
          style={styles.cardGradient}
        >
          {/* Centered Content */}
          <View style={styles.cardContent}>
            {/* Icon */}
            <View style={[styles.iconContainer, !isUnlocked && styles.lockedIcon]}>
              <Icon
                name={achievement.icon}
                size={isUnlocked ? 40 : 36}
                color={isUnlocked ? '#fff' : '#666'}
              />
            </View>

            {/* Name */}
            <Text
              style={[styles.achievementName, !isUnlocked && styles.lockedText]}
              numberOfLines={2}
            >
              {achievement.name}
            </Text>

            {/* Progress bar (if not unlocked) */}
            {!isUnlocked && achievement.requirement_value > 0 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {Math.floor(achievement.progress)}/{achievement.requirement_value}
                </Text>
              </View>
            )}
          </View>

          {/* Points reward */}
          <View style={styles.pointsBadge}>
            <Icon name="star" size={10} color="#FFD700" />
            <Text style={styles.pointsText}>+{achievement.points_reward}</Text>
          </View>

          {/* Tier badge */}
          <View style={[styles.tierBadge, { backgroundColor: tierColors[0] }]}>
            <Text style={styles.tierText}>{achievement.tier.toUpperCase()}</Text>
          </View>
        </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AchievementTest')} style={styles.testButton}>
          <Icon name="eye" size={20} color="#8b5cf6" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading achievements...</Text>
        </View>
      ) : (
        <>
          {/* Stats Header */}
          {stats && (
            <View style={styles.statsContainer}>
              <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.statsGradient}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.unlocked}</Text>
                    <Text style={styles.statLabel}>Unlocked</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.total}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.total_points_earned}</Text>
                    <Text style={styles.statLabel}>Bonus Points</Text>
                  </View>
                </View>

                {/* Tier breakdown */}
                <View style={styles.tierRow}>
                  <View style={styles.tierItem}>
                    <Icon name="medal" size={16} color="#CD7F32" />
                    <Text style={styles.tierCount}>{stats.bronze}</Text>
                  </View>
                  <View style={styles.tierItem}>
                    <Icon name="medal" size={16} color="#C0C0C0" />
                    <Text style={styles.tierCount}>{stats.silver}</Text>
                  </View>
                  <View style={styles.tierItem}>
                    <Icon name="medal" size={16} color="#FFD700" />
                    <Text style={styles.tierCount}>{stats.gold}</Text>
                  </View>
                  <View style={styles.tierItem}>
                    <Icon name="star-four-points" size={16} color="#E5E4E2" />
                    <Text style={styles.tierCount}>{stats.platinum}</Text>
                  </View>
                  <View style={styles.tierItem}>
                    <Icon name="diamond-stone" size={16} color="#B9F2FF" />
                    <Text style={styles.tierCount}>{stats.diamond}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryButton,
                selectedCategory === 'all' && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === 'all' && styles.categoryButtonTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.categoryButton,
                  selectedCategory === key && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(key)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === key && styles.categoryButtonTextActive,
                  ]}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Achievement Grid */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.gridContainer}
          >
            {filteredAchievements.map(renderAchievementCard)}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  testButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 14,
  },
  statsContainer: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statsGradient: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#e0e0e0',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  tierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tierCount: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryScroll: {
    maxHeight: 50,

  },
  categoryContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#8b5cf6',
  },
  categoryButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: GRID_PADDING,
    gap: CARD_GAP,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  lockedCard: {
    opacity: 0.6,
  },
  secretCard: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  secretText: {
    color: '#666',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  secretDesc: {
    color: '#555',
    fontSize: 10,
    marginTop: 4,
  },
  cardGradient: {

    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 16,
  },
  cardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconContainer: {
    marginBottom: 8,
  },
  lockedIcon: {
    opacity: 0.4,
  },
  achievementName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 4,
  },
  lockedText: {
    color: '#666',
  },
  progressContainer: {
    marginTop: 8,
    width: '90%',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8b5cf6',
    borderRadius: 2,
  },
  progressText: {
    color: '#888',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 3,
    fontWeight: '500',
  },
  pointsBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  pointsText: {
    color: '#FFD700',
    fontSize: 8,
    fontWeight: 'bold',
  },
  tierBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
