import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../libs/hooks/useAuth';
import AVATARS, { resolveAvatar } from '../../../utils/avatars';
import type { AvatarOption } from '../../../utils/avatars';
import apiService from '../../../services/api.service';
import BottomTabBar from '../../../components/global/BottomTabBar';

interface AchievementItem {
  achievement_id: string;
  name: string;
  description?: string;
  icon?: string;
  tier?: string;
  unlocked?: boolean;
  progress?: number;
  progress_percent?: number;
  requirement_value?: number;
  points_reward?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ProfileScreen = ({ navigation }: any) => {
  const { user, setUser } = useAuth();
  const [detailedStats, setDetailedStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoadingStats(true);
      const response: any = await apiService.get(
        `/users/${user.id}/stats`,
      );
      if (response?.success) setDetailedStats(response.stats);
    } catch (e) {
      console.warn('Failed to load profile stats:', e);
    } finally {
      setLoadingStats(false);
    }
  }, [user?.id]);

  const loadAchievements = useCallback(async () => {
    try {
      const data: any = await apiService.get('/achievements', true);
      // Server returns achievements wrapped or as array — be tolerant.
      const list: AchievementItem[] = Array.isArray(data)
        ? data
        : data?.achievements || [];
      setAchievements(list);
    } catch (e) {
      // Non-fatal; just leave list empty
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadAchievements();
  }, [loadStats, loadAchievements]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
      loadAchievements();
    }, [loadStats, loadAchievements]),
  );

  const handleSelectAvatar = async (avatar: AvatarOption) => {
    setSaving(true);
    try {
      const res = await apiService.updateAvatar(avatar.key);
      if (res?.user && user) {
        setUser({ ...user, avatar_url: avatar.key });
      }
    } catch (e) {
      console.warn('Failed to update avatar:', e);
    } finally {
      setSaving(false);
      setPickerOpen(false);
    }
  };

  const overall = detailedStats?.overall;
  const totalGames = overall?.total_games ?? 0;
  const totalWins = overall?.total_wins ?? 0;
  const totalLosses = overall?.total_losses ?? 0;
  const totalDraws = overall?.total_draws ?? 0;
  const winRate = overall?.win_rate ?? 0;
  const currentStreak = overall?.current_streak ?? 0;
  const bestStreak = overall?.best_streak ?? 0;
  const achievementsUnlocked = overall?.achievements_unlocked ?? 0;

  const displayName =
    user?.full_name ||
    [user?.fullName?.givenName, user?.fullName?.familyName]
      .filter(Boolean)
      .join(' ') ||
    user?.username ||
    'Player';

  const avatarSource = resolveAvatar(user?.avatar_url) || AVATARS[0].source;

  // Sort achievements: unlocked first, then highest progress
  const featuredAchievements = [...achievements]
    .sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1;
      if (!a.unlocked && b.unlocked) return 1;
      return (b.progress_percent || 0) - (a.progress_percent || 0);
    })
    .slice(0, 6);

  const renderStatTile = (label: string, value: string | number) => (
    <View style={styles.statTile} key={label}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Top header card */}
          <View style={styles.topHeader}>
            <Text style={styles.topHeaderTitle}>Profile</Text>
            <View style={styles.topHeaderRight}>
              <TouchableOpacity
                onPress={() => navigation.navigate('PointsShop')}
                activeOpacity={0.85}>
                <View style={styles.pointsPill}>
                  <Text style={styles.pointsCoin}>🪙</Text>
                  <Text style={styles.pointsAmount}>
                    {Math.floor(user?.balance || 0).toLocaleString()}
                  </Text>
                  <View style={styles.pointsPlus}>
                    <Icon name="plus" size={11} color="#fff" />
                    <Text style={styles.pointsPlusText}>Get</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('GlobalView', { userId: user?.id })
                }
                style={styles.globeBtn}
                activeOpacity={0.85}>
                <Icon name="earth" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile card with floating avatar */}
          <View style={styles.profileCardWrap}>
            <TouchableOpacity
              onPress={() => setPickerOpen(true)}
              activeOpacity={0.85}
              style={styles.avatarFloat}>
              <View style={styles.avatarRing}>
                <Image source={avatarSource} style={styles.avatarImg} resizeMode="contain" />
              </View>
              <View style={styles.editBadge}>
                <Icon name="pencil" size={14} color="#fff" />
              </View>
            </TouchableOpacity>

            <View
              style={styles.profileCard}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileEmail}>
                {user?.email || 'No email set'}
              </Text>

              <TouchableOpacity
                onPress={() => navigation.navigate('Settings')}
                activeOpacity={0.85}
                style={styles.settingsBtnWrap}>
                <View
                  style={[styles.settingsBtn, { backgroundColor: '#fbbf24' }]}>
                  <Icon name="cog" size={18} color="#fff" />
                  <Text style={styles.settingsBtnText}>Settings</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar / Asset Gallery rows */}
          <TouchableOpacity
            onPress={() => navigation.navigate('AvatarBuilder')}
            activeOpacity={0.7}
            style={styles.linkRow}>
            <Text style={styles.linkRowText}>My Avatar</Text>
            <Icon name="chevron-right" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.linkRowDivider} />
          <TouchableOpacity
            onPress={() => navigation.navigate('ClothingStore')}
            activeOpacity={0.7}
            style={styles.linkRow}>
            <Text style={styles.linkRowText}>Asset Gallery</Text>
            <Icon name="chevron-right" size={26} color="#fff" />
          </TouchableOpacity>

          {/* My Results */}
          <Text style={styles.sectionHeading}>My Results:</Text>
          {loadingStats && !overall ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <>
              <View style={styles.statsRow}>
                {renderStatTile('Games', totalGames)}
                {renderStatTile('Wins', totalWins)}
                {renderStatTile('Losses', totalLosses)}
                {renderStatTile('Draws', totalDraws)}
              </View>
              <View style={styles.statsRow}>
                {renderStatTile(
                  'Win Rate',
                  `${Math.round(Number(winRate) || 0)}%`,
                )}
                {renderStatTile('Current Streak', currentStreak)}
                {renderStatTile('Best Streak', bestStreak)}
                {renderStatTile('Achivements', achievementsUnlocked)}
              </View>
            </>
          )}

          {/* Achievements */}
          <View style={styles.achievementsHeader}>
            <Text style={styles.sectionHeading}>Achivements:</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Achievements')}
              activeOpacity={0.85}
              style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {featuredAchievements.length === 0 ? (
            <View style={styles.emptyAchievements}>
              <Text style={styles.emptyAchievementsText}>
                Play games to unlock achievements!
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trophiesScroll}>
              {featuredAchievements.map(a => {
                const requirement = a.requirement_value || 1;
                const progress = Math.min(a.progress || 0, requirement);
                return (
                  <LinearGradient
                    key={a.achievement_id}
                    colors={
                      a.unlocked
                        ? ['#7a6cf5', '#5b4ae0']
                        : ['#3a2f8f', '#1f1860']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.trophyCard,
                      !a.unlocked && styles.trophyCardLocked,
                    ]}>
                    <View style={styles.trophyBadge}>
                      <Icon name="star" size={12} color="#fbbf24" />
                      <Text style={styles.trophyBadgeText}>
                        +{a.points_reward || 100}
                      </Text>
                    </View>
                    <Text style={styles.trophyEmoji}>🏆</Text>
                    <Text style={styles.trophyName} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={styles.trophyProgress}>
                      {progress}/{requirement}
                    </Text>
                  </LinearGradient>
                );
              })}
            </ScrollView>
          )}
        </ScrollView>
      </SafeAreaView>
      <BottomTabBar active="Profile" />

      {/* Avatar Picker Modal */}
      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Avatar</Text>
              <TouchableOpacity
                onPress={() => setPickerOpen(false)}
                style={styles.modalClose}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={AVATARS}
              numColumns={4}
              keyExtractor={a => a.key}
              contentContainerStyle={styles.avatarGrid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => !saving && handleSelectAvatar(item)}
                  activeOpacity={0.7}
                  style={[
                    styles.avatarGridItem,
                    user?.avatar_url === item.key && styles.avatarGridSelected,
                  ]}>
                  <Image source={item.source} style={styles.avatarGridImage} />
                  <Text style={styles.avatarGridLabel}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            {saving && <Text style={styles.savingText}>Saving…</Text>}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#100828',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(40, 22, 96, 0.55)',
    borderRadius: 22,
  },
  topHeaderTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 14, 60, 0.95)',
    borderWidth: 1.5,
    borderColor: '#7c4dff',
    gap: 6,
  },
  pointsCoin: { fontSize: 16 },
  pointsAmount: { color: '#fff', fontWeight: '800', fontSize: 14 },
  pointsPlus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f59e0b',
    marginLeft: 4,
    gap: 2,
  },
  pointsPlusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  globeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  /* Profile card */
  profileCardWrap: {
    marginHorizontal: 16,
    marginTop: 60,
    alignItems: 'center',
  },
  avatarFloat: {
    position: 'absolute',
    top: -55,
    zIndex: 2,
    alignItems: 'center',
  },
  avatarRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#fff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  avatarImg: {
    width: 100,
    height: 100,
  },
  editBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileCard: {
    width: '100%',
    borderRadius: 22,
    paddingTop: 70,
    paddingBottom: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    backgroundColor: "#6f5cf2"
  },
  profileName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  profileEmail: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 6,
  },
  settingsBtnWrap: {
    marginTop: 18,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 8,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 28,
  },
  settingsBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },

  /* Link rows */
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginTop: 6,
  },
  linkRowText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkRowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 20,
  },

  /* Section heading */
  sectionHeading: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 12,
  },

  /* Stats grid */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 77, 255, 0.45)',
    backgroundColor: 'rgba(20, 14, 60, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  statValue: {
    color: '#fbbf24',
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  centerLoading: {
    paddingVertical: 30,
    alignItems: 'center',
  },

  /* Achievements */
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 16,
  },
  viewAllBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#7c4dff',
    backgroundColor: 'rgba(40, 22, 96, 0.55)',
  },
  viewAllText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  trophiesScroll: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 8,
  },
  trophyCard: {
    width: (SCREEN_WIDTH - 32 - 24) / 3,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 170,
  },
  trophyCardLocked: {
    opacity: 0.65,
  },
  trophyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  trophyBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  trophyEmoji: {
    fontSize: 56,
    marginVertical: 4,
  },
  trophyName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  trophyProgress: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyAchievements: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyAchievementsText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },

  /* Avatar Picker Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1240',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatarGrid: {
    paddingBottom: 20,
  },
  avatarGridItem: {
    flex: 1,
    margin: 6,
    alignItems: 'center',
    padding: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarGridSelected: {
    borderColor: '#fbbf24',
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  avatarGridImage: {
    width: 60,
    height: 70,
    resizeMode: 'contain',
  },
  avatarGridLabel: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
  },
  savingText: {
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 8,
  },
});

export default ProfileScreen;
