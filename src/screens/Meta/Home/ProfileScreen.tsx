import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  FlatList,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '../../../libs/hooks/useAuth';
import {colors, spacing} from '../../../theme';
import AVATARS, {resolveAvatar} from '../../../utils/avatars';
import type {AvatarOption} from '../../../utils/avatars';
import apiService from '../../../services/api.service';
import useDeviceType from '../../../hooks/useDeviceType';
import { getSpacing } from '../../../theme/responsive';


function formatGameName(gameType: string): string {
  const names: Record<string, string> = {
    chess: "Chess",
    checkers: "Checkers",
    nardi: "Nardi",
    mrotsi: "Mrotsi",
    blot: "Blot",
    "baazar-blot": "Baazar Blot",
    billiards: "Billiards",
    poker: "Poker",
    slots: "Slots",
  };
  return names[gameType] || gameType;
}
const ProfileScreen = ({navigation}: any) => {
  const {user, setUser} = useAuth();
  const { isTablet, width: screenWidth } = useDeviceType();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailedStats, setDetailedStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Calculate responsive avatar grid size
  const gridPadding = getSpacing('md', isTablet);
  const avatarColumns = isTablet ? 6 : 4;
  const avatarGridSize = (screenWidth - gridPadding * 2 - 20) / avatarColumns;
  
  const stats = user?.playerStats ?? null;

  useEffect(() => {
    if (user?.id) {
      loadUserStats();
    }
  }, [user?.id]);

  const loadUserStats = async () => {
    try {
      setLoadingStats(true);
      const response = await apiService.get(`/users/${user?.id}/stats`);
      if (response.success) {
        setDetailedStats(response.stats);
      }
    } catch (error) {
      console.error('Failed to load detailed stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSelectAvatar = async (avatar: AvatarOption) => {
    setSaving(true);
    try {
      const res = await apiService.updateAvatar(avatar.key);
      if (res.user && user) {
        setUser({...user, avatar_url: avatar.key});
      }
    } catch (e) {
      console.warn('Failed to update avatar:', e);
    } finally {
      setSaving(false);
      setPickerOpen(false);
    }
  };

  const displayName =
    user?.full_name ||
    [user?.fullName?.givenName, user?.fullName?.familyName]
      .filter(Boolean)
      .join(' ') ||
    user?.username ||
    'Player';

  const providerLabel =
    user?.provider === 'apple'
      ? '  Apple'
      : user?.provider === 'google'
      ? '🔵 Google'
      : '✉️ Email';

  const avatarSource = resolveAvatar(user?.avatar_url);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />

      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar + name card */}
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.avatarCard}>
          <TouchableOpacity onPress={() => setPickerOpen(true)} activeOpacity={0.8}>
            <View style={styles.avatarWrap}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatar} />
              ) : (
                <Image source={AVATARS[0].source} style={styles.avatar} />
              )}
              <View style={styles.editBadge}>
                <Text style={styles.editBadgeText}>✏️</Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Achievements')}
            activeOpacity={0.85}
            style={styles.achievementsLink}>
            <View style={styles.achievementsLinkContent}>
              <Icon name="trophy-award" size={20} color="#fff" />
              <Text style={styles.achievementsLinkText}>Achievements</Text>
            </View>
            <Icon name="chevron-right" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          <Text style={styles.displayName}>{displayName}</Text>
          {user?.username && (
            <Text style={styles.usernameText}>@{user.username}</Text>
          )}
        </LinearGradient>

        {/* Info rows */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Info</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || 'Not set'}</Text>
          </View>

          {/* <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sign-in Method</Text>
            <Text style={styles.infoValue}>{providerLabel}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={[styles.infoValue, styles.mono]}>{user?.id?.slice(0, 12)}…</Text>
          </View> */}
        </View>

        {/* Overall Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Stats</Text>

          <View style={styles.statsGrid}>
            <StatBox 
              label="Games" 
              value={loadingStats ? '...' : (detailedStats?.overall?.total_games ?? 0)} 
              gradient={['#6366f1', '#8b5cf6']} 
            />
            <StatBox 
              label="Wins" 
              value={loadingStats ? '...' : (detailedStats?.overall?.total_wins ?? 0)} 
              gradient={['#10b981', '#34d399']} 
            />
            <StatBox 
              label="Draws" 
              value={loadingStats ? '...' : (detailedStats?.overall?.total_draws ?? 0)} 
              gradient={['#f59e0b', '#fbbf24']} 
            />
            <StatBox 
              label="Losses" 
              value={loadingStats ? '...' : (detailedStats?.overall?.total_losses ?? 0)} 
              gradient={['#ef4444', '#f87171']} 
            />
          </View>

          <View style={[styles.statsGrid, {marginTop: 12}]}>
            <StatBox 
              label="Win Rate" 
              value={loadingStats ? '...' : `${detailedStats?.overall?.win_rate?.toFixed(1) ?? 0}%`} 
              gradient={['#ec4899', '#f472b6']} 
            />
            <StatBox 
              label="Current Streak" 
              value={loadingStats ? '...' : (detailedStats?.overall?.current_streak ?? 0)} 
              gradient={['#8b5cf6', '#a78bfa']} 
            />
            <StatBox 
              label="Best Streak" 
              value={loadingStats ? '...' : (detailedStats?.overall?.best_streak ?? 0)} 
              gradient={['#f59e0b', '#fbbf24']} 
            />
            <StatBox 
              label="Achievements" 
              value={loadingStats ? '...' : (detailedStats?.overall?.achievements_unlocked ?? 0)} 
              gradient={['#06b6d4', '#22d3ee']} 
            />
          </View>
        </View>

        {/* Per-Game Stats */}
        {!loadingStats && detailedStats?.per_game && detailedStats.per_game.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stats by Game</Text>
            {detailedStats.per_game.map((game: any) => (
              <View key={game.game_type} style={styles.gameStatRow}>
                <View style={styles.gameStatHeader}>
                  <Text style={styles.gameStatName}>{formatGameName(game.game_type)}</Text>
                  <Text style={styles.gameStatWinRate}>{game.win_rate?.toFixed(1)}% WR</Text>
                </View>
                <View style={styles.gameStatDetails}>
                  <Text style={styles.gameStatDetail}>
                    {game.games_played} games · {game.wins}W {game.draws}D {game.losses}L
                  </Text>
                  <Text style={styles.gameStatPoints}>+{game.points_earned} pts</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Points */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Points</Text>
          <LinearGradient
            colors={['#10b981', '#34d399']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.pointsCard}>
            <View style={styles.pointsRow}>
              <View>
                <Text style={styles.pointsLabel}>Current Points</Text>
                <Text style={styles.pointsValue}>
                  🏆 {((stats?.total_points ?? (user as any)?.totalPoints) || 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.pointsDivider} />
              <View>
                <Text style={styles.pointsLabel}>Lifetime Points</Text>
                <Text style={styles.pointsValue}>
                  ⭐ {(stats?.lifetime_points ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* Avatar Picker Modal */}
      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Avatar</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Men */}
            <Text style={styles.categoryLabel}>Men</Text>
            <FlatList
              data={AVATARS.filter(a => a.category === 'men')}
              numColumns={avatarColumns}
              key={avatarColumns}
              scrollEnabled={false}
              keyExtractor={a => a.key}
              contentContainerStyle={styles.avatarGrid}
              renderItem={({item}) => (
                <TouchableOpacity
                  onPress={() => !saving && handleSelectAvatar(item)}
                  activeOpacity={0.7}
                  style={[
                    styles.avatarGridItem,
                    { width: avatarGridSize },
                    user?.avatar_url === item.key && styles.avatarGridSelected,
                  ]}>
                  <Image source={item.source} style={[styles.avatarGridImage, { 
                    width: avatarGridSize - 20, 
                    height: avatarGridSize - 20,
                    borderRadius: (avatarGridSize - 20) / 2
                  }]} />
                  <Text style={styles.avatarGridLabel}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />

            {/* Women */}
            <Text style={styles.categoryLabel}>Women</Text>
            <FlatList
              data={AVATARS.filter(a => a.category === 'women')}
              numColumns={avatarColumns}
              key={`women-${avatarColumns}`}
              scrollEnabled={false}
              keyExtractor={a => a.key}
              contentContainerStyle={styles.avatarGrid}
              renderItem={({item}) => (
                <TouchableOpacity
                  onPress={() => !saving && handleSelectAvatar(item)}
                  activeOpacity={0.7}
                  style={[
                    styles.avatarGridItem,
                    { width: avatarGridSize },
                    user?.avatar_url === item.key && styles.avatarGridSelected,
                  ]}>
                  <Image source={item.source} style={[styles.avatarGridImage, { 
                    width: avatarGridSize - 20, 
                    height: avatarGridSize - 20,
                    borderRadius: (avatarGridSize - 20) / 2
                  }]} />
                  <Text style={styles.avatarGridLabel}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />

            {saving && <Text style={styles.savingText}>Saving…</Text>}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const StatBox = ({label, value, gradient}: {label: string; value: string | number; gradient: string[]}) => (
  <LinearGradient colors={gradient} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.statBox}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </LinearGradient>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    paddingBottom: 40,
  },
  avatarCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flex:1,
    minHeight:300
  },
  avatarWrap: {
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  achievementsLink: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  achievementsLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  achievementsLinkText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  avatar: {
    width: 140,
    height: 180,
    resizeMode: 'contain',
  },
  avatarFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  editBadgeText: {
    fontSize: 14,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  usernameText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  section: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    maxWidth: '50%',
    textAlign: 'right',
  },
  mono: {
    fontFamily: 'Courier',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    width: '48%',
    borderRadius: 14,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  pointsCard: {
    borderRadius: 16,
    minHeight: 60,
    justifyContent: 'center',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  pointsDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  pointsLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
    textAlign: 'center',
  },
  pointsValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.primary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
  },
  avatarGrid: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  avatarGridItem: {
    // Width set dynamically via inline style
    alignItems: 'center',
    padding: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarGridSelected: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  avatarGridImage: {
    // Dimensions set dynamically via inline style
  },
  avatarGridLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  gameStatRow: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  gameStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gameStatName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  gameStatWinRate: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: 'bold',
  },
  gameStatDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameStatDetail: {
    color: '#888',
    fontSize: 12,
  },
  gameStatPoints: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  savingText: {
    textAlign: 'center',
    color: colors.text.secondary,
    marginTop: spacing.sm,
    fontSize: 13,
  },
});

export default ProfileScreen;
