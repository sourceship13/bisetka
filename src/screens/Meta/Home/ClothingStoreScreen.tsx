import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomTabBar from '../../../components/global/BottomTabBar';
import AssetImage from '../../../components/AssetImage';
import { ClothingItem, ClothingType, Rarity } from '../../../types/avatar2d';
import { ALL_CLOTHING_ITEMS, filterClothingForAvatar, getAvatarBuildById, getAvatarGenderById } from '../../../data/clothingItems';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { useAuth } from '../../../libs/hooks/useAuth';

const STORE_OWNED_KEY = 'ownedClothing';
const STORE_EQUIPPED_KEY = '@bisetka_equipped_clothing';

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

const SECTION_ORDER: ClothingType[] = [
  'hair',
  'top',
  'jacket',
  'bottom',
  'shorts',
  'shoes',
  'jewelry',
  'hat',
  'other',
];

const SECTION_META: Record<ClothingType, { label: string; icon: string }> = {
  hair: { label: 'Hair', icon: 'face-woman-shimmer' },
  top: { label: 'Shirts', icon: 'tshirt-crew' },
  jacket: { label: 'Jackets', icon: 'hanger' },
  bottom: { label: 'Pants', icon: 'human-handsdown' },
  shorts: { label: 'Shorts', icon: 'human-handsup' },
  shoes: { label: 'Shoes', icon: 'shoe-sneaker' },
  jewelry: { label: 'Jewelry', icon: 'diamond-stone' },
  hat: { label: 'Hats', icon: 'hat-fedora' },
  other: { label: 'Accessories', icon: 'bag-personal' },
};

const ClothingStoreScreen: React.FC<any> = ({ navigation }) => {
  const { user } = useAuth();
  const [avatarBuild, setAvatarBuild] = useState<string | undefined>(undefined);
  const [avatarGender, setAvatarGender] = useState<string | undefined>(undefined);
  const items = useMemo<ClothingItem[]>(
    () => filterClothingForAvatar(ALL_CLOTHING_ITEMS, avatarGender, avatarBuild) as ClothingItem[],
    [avatarBuild, avatarGender],
  );
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const selectedAvatarId = await AsyncStorage.getItem('selectedAvatarId');
        setAvatarBuild(getAvatarBuildById(selectedAvatarId));
        setAvatarGender(getAvatarGenderById(selectedAvatarId));

        const ownedStr = await AsyncStorage.getItem(STORE_OWNED_KEY);
        const defaults = ALL_CLOTHING_ITEMS.filter(i => i.isDefault).map(
          i => i.id,
        );
        const ownedSet = ownedStr
          ? new Set<string>(JSON.parse(ownedStr))
          : new Set<string>(defaults);
        setOwned(ownedSet);

        const eqStr = await AsyncStorage.getItem(STORE_EQUIPPED_KEY);
        if (eqStr) setEquipped(JSON.parse(eqStr));
      } catch {
        const defaults = ALL_CLOTHING_ITEMS.filter(i => i.isDefault).map(
          i => i.id,
        );
        setOwned(new Set(defaults));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const out: Partial<Record<ClothingType, ClothingItem[]>> = {};
    items.forEach(it => {
      if (!out[it.type]) out[it.type] = [];
      out[it.type]!.push(it);
    });
    return out;
  }, [items]);

  const persistOwned = async (next: Set<string>) => {
    setOwned(next);
    try {
      await AsyncStorage.setItem(STORE_OWNED_KEY, JSON.stringify([...next]));
    } catch {}
  };

  const persistEquipped = async (next: Record<string, string>) => {
    setEquipped(next);
    try {
      await AsyncStorage.setItem(STORE_EQUIPPED_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleUse = async (item: ClothingItem) => {
    setBusyId(item.id);
    const next = { ...equipped, [item.type]: item.id };
    await persistEquipped(next);
    setBusyId(null);
    BisetkaAlert({
      title: 'Equipped',
      message: `${item.name} is now equipped.`,
      type: 'success',
    });
  };

  const handleBuy = (item: ClothingItem) => {
    if (item.price === 0) {
      claimFree(item);
      return;
    }
    BisetkaAlert({
      title: 'Purchase Item',
      message: `Buy ${item.name} for $${(item.price / 100).toFixed(2)}?\n\n(Payment integration coming soon!)`,
      type: 'confirm',
      confirmText: 'Purchase',
      onConfirm: async () => {
        setBusyId(item.id);
        const next = new Set(owned);
        next.add(item.id);
        await persistOwned(next);
        setBusyId(null);
        BisetkaAlert({
          title: 'Success!',
          message: `${item.name} added to your wardrobe.`,
          type: 'success',
        });
      },
    });
  };

  const claimFree = async (item: ClothingItem) => {
    setBusyId(item.id);
    const next = new Set(owned);
    next.add(item.id);
    await persistOwned(next);
    setBusyId(null);
  };

  const renderCard = (item: ClothingItem) => {
    const isOwned = owned.has(item.id);
    const isEquipped = equipped[item.type] === item.id;
    const isBusy = busyId === item.id;

    return (
      <LinearGradient
        key={item.id}
        colors={['#7a6cf5', '#5b4ae0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <View style={styles.rarityPill}>
          <Text style={styles.rarityText}>{RARITY_LABEL[item.rarity]}</Text>
        </View>

        <View style={styles.imageWrap}>
          <AssetImage
            source={item.imageUrl}
            width="100%"
            height="100%"
          />
          {!isOwned && (
            <View style={styles.lockOverlay}>
              <View style={styles.lockCircle}>
                <Icon name="lock" size={28} color="#fff" />
              </View>
            </View>
          )}
        </View>

        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.coin}>🪙</Text>
          <Text style={styles.priceText}>
            {item.price === 0 ? 'FREE' : `$${(item.price / 100).toFixed(2)}`}
          </Text>
        </View>

        {isBusy ? (
          <View style={[styles.actionBtn, styles.actionBtnGhost]}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : isOwned ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleUse(item)}
            style={[
              styles.actionBtn,
              styles.actionBtnGhost,
              isEquipped && styles.actionBtnEquipped,
            ]}>
            <Text style={styles.actionTextGhost}>
              {isEquipped ? 'EQUIPPED' : 'USE'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleBuy(item)}
            style={styles.actionBtnWrap}>
            <LinearGradient
              colors={['#fbbf24', '#f59e0b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionBtnSolid}>
              <Text style={styles.actionTextSolid}>BUY</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </LinearGradient>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Header card */}
        <View style={styles.topHeader}>
          <Text style={styles.topHeaderTitle}>Store</Text>
          <View style={styles.topHeaderRight}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('PointsShop')}>
              <View style={styles.pointsPill}>
                <Text style={styles.pointsCoin}>🪙</Text>
                <Text style={styles.pointsAmount}>
                  {Math.floor(user?.balance || 0).toLocaleString()}
                </Text>
                <View style={styles.pointsPlus}>
                  <Icon name="plus" size={12} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('GlobalView', { userId: user?.id })
              }
              style={styles.globeBtn}>
              <Icon name="earth" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Avatar preview area */}
          <View style={styles.avatarStage}>
            <Text style={styles.playerNameBg} numberOfLines={1}>
              [{user?.username || 'Player Name'}]
            </Text>
            <View style={styles.avatarFrame}>
            {user?.avatarUrl ? (
              <AssetImage
                source={user.avatarUrl}
                width="100%"
                height="100%"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon name="account" size={90} color="#fff" />
              </View>
            )}
          </View>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 60 }}>
              <ActivityIndicator size="large" color="#7c4dff" />
            </View>
          ) : (
            SECTION_ORDER.map(type => {
              const list = grouped[type];
              if (!list || list.length === 0) return null;
              const meta = SECTION_META[type];
              return (
                <View key={type} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconCircle}>
                      <Icon name={meta.icon} size={18} color="#a78bfa" />
                    </View>
                    <Text style={styles.sectionTitle}>{meta.label}</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.cardsRow}>
                    {list.map(renderCard)}
                  </ScrollView>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
      <BottomTabBar active="Store" />
    </View>
  );
};

const CARD_W = 168;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100828' },
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 140 },

  /* Header */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 18,
    backgroundColor: 'rgba(40, 22, 96, 0.55)',
    borderRadius: 22,
  },
  topHeaderTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  topHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  globeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  /* Avatar stage */
  avatarStage: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  playerNameBg: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.2)',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -1,
  },
  avatarFrame: {
    width: 180,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Section */
  section: { marginTop: 18 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 77, 255, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(124, 77, 255, 0.55)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  cardsRow: {
    paddingHorizontal: 16,
    gap: 14,
    paddingRight: 32,
  },

  /* Card */
  card: {
    width: CARD_W,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    minHeight: 290,
  },
  rarityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 14, 60, 0.45)',
  },
  rarityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  imageWrap: {
    width: '100%',
    height: 130,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  itemImg: { width: '100%', height: '100%' },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91, 74, 224, 0.55)',
    borderRadius: 12,
  },
  lockCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(20, 14, 60, 0.4)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  coin: { fontSize: 14 },
  priceText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  actionBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 110,
    alignItems: 'center',
  },
  actionBtnGhost: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'transparent',
  },
  actionBtnEquipped: {
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
    borderColor: '#22c55e',
  },
  actionTextGhost: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  actionBtnWrap: {
    marginTop: 10,
    alignSelf: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnSolid: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    minWidth: 110,
    alignItems: 'center',
  },
  actionTextSolid: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
});

export default ClothingStoreScreen;
