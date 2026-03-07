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
import {useAuth} from '../../libs/hooks/useAuth';
import {colors, spacing} from '../../theme';
import Config from 'react-native-config';
import AVATARS, {resolveAvatar} from '../../utils/avatars';
import type {AvatarOption} from '../../utils/avatars';
import apiService from '../../services/api.service';

const {width} = Dimensions.get('window');
const API_URL = Config.API_URL || 'http://localhost:3000';
const AVATAR_GRID_SIZE = (width - spacing.md * 2 - 20) / 4;

interface UserStats {
  total_games: number;
  total_wins: number;
  win_rate: number;
  best_win_streak: number;
  total_points: number;
  lifetime_points: number;
}

const ProfileScreen = ({navigation}: any) => {
  const {user, setUser} = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetch(`${API_URL}/api/leaderboard`)
        .then(r => r.json())
        .then(data => {
          const me = data?.leaderboard?.find((e: any) => e.user_id === user.id);
          if (me) {
            setStats({
              total_games: me.total_games || 0,
              total_wins: me.total_wins || 0,
              win_rate: me.win_rate || 0,
              best_win_streak: me.best_win_streak || 0,
              total_points: me.total_points || 0,
              lifetime_points: me.lifetime_points || 0,
            });
          }
        })
        .catch(() => {});
    }
  }, [user?.id]);

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

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sign-in Method</Text>
            <Text style={styles.infoValue}>{providerLabel}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={[styles.infoValue, styles.mono]}>{user?.id?.slice(0, 12)}…</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Game Stats</Text>

          <View style={styles.statsGrid}>
            <StatBox label="Games" value={stats?.total_games ?? '—'} gradient={['#6366f1', '#8b5cf6']} />
            <StatBox label="Wins" value={stats?.total_wins ?? '—'} gradient={['#10b981', '#34d399']} />
            <StatBox label="Win Rate" value={stats ? `${Math.round(stats.win_rate)}%` : '—'} gradient={['#ec4899', '#f472b6']} />
            <StatBox label="Best Streak" value={stats?.best_win_streak ?? '—'} gradient={['#f59e0b', '#fbbf24']} />
          </View>
        </View>

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
                  🏆 {((user as any)?.totalPoints ?? stats?.total_points ?? 0).toLocaleString()}
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
              numColumns={4}
              scrollEnabled={false}
              keyExtractor={a => a.key}
              contentContainerStyle={styles.avatarGrid}
              renderItem={({item}) => (
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

            {/* Women */}
            <Text style={styles.categoryLabel}>Women</Text>
            <FlatList
              data={AVATARS.filter(a => a.category === 'women')}
              numColumns={4}
              scrollEnabled={false}
              keyExtractor={a => a.key}
              contentContainerStyle={styles.avatarGrid}
              renderItem={({item}) => (
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
  },
  avatarWrap: {
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
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
    maxWidth: width * 0.5,
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
    width: (width - spacing.md * 2 - 10) / 2,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 85,
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
    padding: spacing.lg,
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
    width: AVATAR_GRID_SIZE,
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
    width: AVATAR_GRID_SIZE - 20,
    height: AVATAR_GRID_SIZE - 20,
    borderRadius: (AVATAR_GRID_SIZE - 20) / 2,
  },
  avatarGridLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  savingText: {
    textAlign: 'center',
    color: colors.text.secondary,
    marginTop: spacing.sm,
    fontSize: 13,
  },
});

export default ProfileScreen;
