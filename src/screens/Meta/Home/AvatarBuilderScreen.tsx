import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  AvatarClothing,
  BaseAvatar,
} from '../../../types/avatar2d';
import AvatarPreview from '../../../components/AvatarPreview';
import AssetImage from '../../../components/AssetImage';
import {
  ALL_BASE_AVATARS,
  ALL_CLOTHING_ITEMS,
  filterClothingForAvatar,
  getStarterShirtIdForAvatar,
} from '../../../data/clothingItems';

const { width } = Dimensions.get('window');
const COL_GAP = 12;
const AVATAR_COLS = 2;
const AVATAR_CARD_W = (width - 40 - COL_GAP * (AVATAR_COLS - 1)) / AVATAR_COLS;

// Per-avatar viewBox overrides so every card renders the figure at a
// consistent scale, centered. The source SVGs have inconsistent canvases
// (some are tightly cropped 552x1744, others are 3508x2481 with the figure
// sitting off-center), which is why they look mismatched without this.
// Values were computed from each SVG's actual content bbox and then
// re-centered into a common box: 700x1545 for females, 750x1750 for males.
const BASE_AVATAR_VIEWBOX: Record<string, string> = {
  // Females — common box 700x1545
  'avatar-female-athletic': '-129.82 -2.72 700 1545',
  'avatar-female-fat': '-14.41 -2.72 700 1545',
  'avatar-female-muscle': '-132.37 -2.72 700 1545',
  'avatar-female-old': '-129.82 -2.72 700 1545',
  'avatar-female-slim': '-138.55 -2.72 700 1545',
  // Males — common box 750x1750
  'avatar-male-athletic': '-99.29 -3.4 750 1750',
  'avatar-male-fat': '1084.5 555.5 750 1750',
  'avatar-male-muscle': '1102.5 569.5 750 1750',
  'avatar-male-old': '69.5 490 750 1750',
  'avatar-male-slim': '-103.08 -3.4 750 1750',
};

interface BaseAvatarThumbProps {
  avatar: BaseAvatar;
  width: number;
  height: number;
}

const BaseAvatarThumb: React.FC<BaseAvatarThumbProps> = ({ avatar, width: w, height: h }) => {
  const src: any = avatar.imageUrl;
  const vb = BASE_AVATAR_VIEWBOX[avatar.id];
  if (src && (typeof src === 'function' || (typeof src === 'object' && src.render))) {
    const SvgComp: any = src;
    const props: any = { width: w, height: h, preserveAspectRatio: 'xMidYMid meet' };
    if (vb) props.viewBox = vb;
    return <SvgComp {...props} />;
  }
  return <AssetImage source={src} width={w} height={h} />;
};

const SELECTED_AVATAR_KEY = 'selectedAvatarId';
const SELECTED_AVATAR_OBJ_KEY = '@bisetka_selected_avatar';
const EQUIPPED_KEY = '@bisetka_equipped_clothing';
const OWNED_KEY = 'ownedClothing';

type GenderTab = 'male' | 'female';

const AvatarBuilderScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [equipped, setEquipped] = useState<Record<string, AvatarClothing>>({});
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [genderTab, setGenderTab] = useState<GenderTab>('male');

  const load = useCallback(async () => {
    try {
      const id = await AsyncStorage.getItem(SELECTED_AVATAR_KEY);
      setSelectedAvatarId(id);

      const eqStr = await AsyncStorage.getItem(EQUIPPED_KEY);
      setEquipped(eqStr ? JSON.parse(eqStr) : {});

      const ownedStr = await AsyncStorage.getItem(OWNED_KEY);
      const defaults = ALL_CLOTHING_ITEMS.filter(i => i.isDefault).map(i => i.id);
      setOwnedIds(
        ownedStr ? new Set<string>(JSON.parse(ownedStr)) : new Set<string>(defaults),
      );

      // Initialize gender tab from selected avatar (if any)
      if (id) {
        const a = ALL_BASE_AVATARS.find(x => x.id === id);
        if (a?.gender === 'female' || a?.gender === 'male') setGenderTab(a.gender);
      }
    } catch (e) {
      console.error('AvatarBuilder load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when returning from store / selection
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const selectedAvatar: BaseAvatar | null = useMemo(() => {
    if (!selectedAvatarId) return null;
    return ALL_BASE_AVATARS.find(a => a.id === selectedAvatarId) ?? null;
  }, [selectedAvatarId]);

  const previewAvatar: BaseAvatar | null = useMemo(() => {
    if (selectedAvatar) return selectedAvatar;
    // Fallback so AvatarPreview has something to render
    return (
      ALL_BASE_AVATARS.find(a => a.gender === genderTab) ?? ALL_BASE_AVATARS[0] ?? null
    );
  }, [selectedAvatar, genderTab]);

  const baseAvatarsForGender = useMemo(
    () =>
      ALL_BASE_AVATARS.filter(a => a.gender === genderTab).sort(
        (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
      ),
    [genderTab],
  );

  const ownedItems = useMemo<AvatarClothing[]>(() => {
    // Always include the starter shirt for the current avatar's gender/build,
    // even if it's not in the persisted owned set yet. Every player gets a
    // starter shirt on signup based on their avatar.
    const starterId = getStarterShirtIdForAvatar(
      selectedAvatar?.gender ?? genderTab,
      (selectedAvatar as any)?.build,
    );
    const all = ALL_CLOTHING_ITEMS.filter(
      i => ownedIds.has(i.id) || i.id === starterId,
    );
    return filterClothingForAvatar(
      all,
      selectedAvatar?.gender ?? genderTab,
      (selectedAvatar as any)?.build,
    );
  }, [ownedIds, selectedAvatar, genderTab]);

  const pickAvatar = async (a: BaseAvatar) => {
    try {
      setSelectedAvatarId(a.id);
      await AsyncStorage.setItem(SELECTED_AVATAR_KEY, a.id);
      await AsyncStorage.setItem(SELECTED_AVATAR_OBJ_KEY, JSON.stringify(a));
    } catch (e) {
      console.error('Failed to save avatar selection', e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Icon name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Avatar</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Preview */}
          <View style={styles.previewCard}>
            {previewAvatar ? (
              <AvatarPreview
                baseAvatar={previewAvatar}
                equipped={equipped}
                size={Math.min(width - 80, 320)}
              />
            ) : (
              <Text style={styles.dimText}>No avatar available</Text>
            )}
            {selectedAvatar && (
              <Text style={styles.previewName}>{selectedAvatar.name}</Text>
            )}
          </View>

          {/* Gender tabs */}
          <View style={styles.genderTabs}>
            {(['male', 'female'] as GenderTab[]).map(g => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.genderTab,
                  genderTab === g && styles.genderTabActive,
                ]}
                onPress={() => setGenderTab(g)}>
                <Text
                  style={[
                    styles.genderTabText,
                    genderTab === g && styles.genderTabTextActive,
                  ]}>
                  {g === 'male' ? 'Male' : 'Female'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Base avatars */}
          <Text style={styles.sectionTitle}>Choose a body that looks like you</Text>
          <Text style={styles.sectionSub}>
            Pick the avatar that best resembles you in real life.
          </Text>
          <View style={styles.avatarGrid}>
            {baseAvatarsForGender.map(a => {
              const isSelected = a.id === selectedAvatarId;
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.avatarCard,
                    isSelected && styles.avatarCardSelected,
                  ]}
                  onPress={() => pickAvatar(a)}
                  activeOpacity={0.85}>
                  <View style={styles.avatarImageWrap}>
                    <BaseAvatarThumb
                      avatar={a}
                      width={AVATAR_CARD_W - 32}
                      height={(AVATAR_CARD_W - 32) * (1750 / 750)}
                    />
                  </View>
                  <Text style={styles.avatarName}>{a.name}</Text>
                  {a.description ? (
                    <Text style={styles.avatarDesc}>{a.description}</Text>
                  ) : null}
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Icon name="check" size={16} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* My Clothes */}
          <View style={styles.clothesHeaderRow}>
            <Text style={styles.sectionTitle}>My Clothes</Text>
            <Text style={styles.dimText}>
              {ownedItems.length} item{ownedItems.length === 1 ? '' : 's'}
            </Text>
          </View>

          {ownedItems.length === 0 ? (
            <View style={styles.emptyClothes}>
              <Icon name="tshirt-crew-outline" size={36} color="#9ca3af" />
              <Text style={styles.emptyClothesText}>
                You don't own any clothes yet.
              </Text>
            </View>
          ) : (
            <View style={styles.clothesGrid}>
              {ownedItems.map(item => (
                <View key={item.id} style={styles.clothesCard}>
                  <View style={styles.clothesImageWrap}>
                    <AssetImage source={item.imageUrl} width="100%" height="100%" />
                  </View>
                  <Text style={styles.clothesName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Manage / Try-on link */}
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Wardrobe')}
            activeOpacity={0.85}>
            <Icon name="hanger" size={22} color="#fff" />
            <Text style={styles.linkRowText}>Open Wardrobe (try on & equip)</Text>
            <Icon name="chevron-right" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Store link */}
          <TouchableOpacity
            style={styles.storeButton}
            onPress={() => navigation.navigate('ClothingStore')}
            activeOpacity={0.9}>
            <View
              style={styles.storeButtonGradient}>
              <Icon name="cart" size={20} color="#fff" />
              <Text style={styles.storeButtonText}>Buy More Clothes</Text>
              <Icon name="arrow-right" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  previewName: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  genderTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  genderTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  genderTabActive: {
    backgroundColor: '#4f46e5',
  },
  genderTabText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  genderTabTextActive: {
    color: '#fff',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginBottom: 14,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COL_GAP,
    marginBottom: 28,
  },
  avatarCard: {
    width: AVATAR_CARD_W,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  avatarImageWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: AVATAR_CARD_W - 24,
    height: (AVATAR_CARD_W - 24) * (1750 / 750),
    overflow: 'hidden',
    alignSelf: 'center',
  },
  avatarImage: {
    resizeMode: 'contain',
  },
  avatarName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 2,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clothesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  emptyClothes: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyClothesText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
  clothesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  clothesCard: {
    width: (width - 40 - 20) / 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  clothesImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clothesName: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  linkRowText: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 12,
  },
  storeButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  storeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    backgroundColor: '#fbbf24',
  },
  storeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dimText: {
    color: 'rgba(255,255,255,0.6)',
  },
});

export default AvatarBuilderScreen;
