import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { useI18n } from '../../../hooks/useI18n';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors, spacing} from '../../../theme';
import {BisetkaAlert} from '../../../utils/BisetkaAlert';
import {useAuth} from '../../../libs/hooks/useAuth';
import apiService from '../../../services/api.service';
import {buyPointsPack, buyClothingItem, PointsSKU} from '../../../services/iap.service';
import {ClothingItem, ClothingType, Rarity} from '../../../types/avatar2d';
import {
  ALL_CLOTHING_ITEMS,
  filterClothingForAvatar,
  getAvatarBuildById,
  getAvatarGenderById,
} from '../../../data/clothingItems';
import AssetImage from '../../../components/AssetImage';

const {width} = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// ── Tabs ─────────────────────────────────────────────────────────────────────
type StoreTab = 'points' | 'clothing';

// ── Clothing store constants ──────────────────────────────────────────────────
const RARITY_COLORS: Record<Rarity, string> = {
  common: '#9ca3af',
  rare: '#60a5fa',
  epic: '#a78bfa',
  legendary: '#fbbf24',
};

const RARITY_TABS: {value: Rarity | 'all'; label: string; icon: string; color: string}[] = [
  {value: 'all', label: 'All Tiers', icon: '✨', color: '#e5e7eb'},
  {value: 'common', label: 'Common', icon: '⚪', color: '#9ca3af'},
  {value: 'rare', label: 'Rare', icon: '🔵', color: '#60a5fa'},
  {value: 'epic', label: 'Epic', icon: '🟣', color: '#a78bfa'},
  {value: 'legendary', label: 'Legendary', icon: '👑', color: '#fbbf24'},
];

const CATEGORY_TABS: {type: ClothingType | 'all'; label: string; icon: string}[] = [
  {type: 'all', label: 'All', icon: '🛍️'},
  {type: 'hair', label: 'Hair', icon: '💇'},
  {type: 'top', label: 'Tops', icon: '👕'},
  {type: 'bottom', label: 'Bottoms', icon: '👖'},
  {type: 'shoes', label: 'Shoes', icon: '👟'},
  {type: 'jewelry', label: 'Jewelry', icon: '💎'},
  {type: 'hat', label: 'Hats', icon: '🧢'},
  {type: 'other', label: 'Other', icon: '🛹'},
];

interface PointPack {
  id: string;
  points: number;
  price: number;
  popular?: boolean;
  bonus?: number;
  icon: string;
  gradient: string[];
  glowColor: string;
}

const POINT_PACKS: PointPack[] = [
  {
    id: '299',
    points: 500,
    price: 2.99,
    icon: 'diamond',
    gradient: ['#667eea', '#764ba2'],
    glowColor: '#667eea',
  },
  {
    id: '399',
    points: 1500,
    price: 3.99,
    bonus: 300,
    popular: true,
    icon: 'diamond-stone',
    gradient: ['#f093fb', '#f5576c'],
    glowColor: '#f093fb',
  },
  {
    id: '599',
    points: 3500,
    price: 5.99,
    bonus: 1000,
    icon: 'treasure-chest',
    gradient: ['#fa709a', '#fee140'],
    glowColor: '#fa709a',
  },
  {
    id: '1099',
    points: 10000,
    price: 10.99,
    bonus: 5000,
    icon: 'crown',
    gradient: ['#11998e', '#38ef7d'],
    glowColor: '#38ef7d',
  },
];

const getGradientViewStyle = (
  gradient: string[],
  borderWidth: number = 1,
) => ({
  backgroundColor: gradient[0],
  borderColor: gradient[1] || gradient[0],
  borderWidth,
  borderRadius: 16,
});

// Approximate card height (itemContent.minHeight + borders) + row marginBottom.
// Used by FlatList.getItemLayout to skip per-row measurement and make scrolling
// + initial render snappier on the clothing tab.
const CLOTHING_ROW_HEIGHT = 232 + 14;
const getClothingItemLayout = (_data: any, index: number) => ({
  length: CLOTHING_ROW_HEIGHT,
  offset: CLOTHING_ROW_HEIGHT * Math.floor(index / 2),
  index,
});

interface ClothingCardProps {
  item: ClothingItem;
  owned: boolean;
  isPurchasing: boolean;
  onPress: (item: ClothingItem) => void;
}

// React.memo'd card so a state change in one card (e.g. purchasing toggling
// or one new item being marked owned) doesn't force every other card in the
// grid to re-render. The previous implementation re-rendered all visible
// cards on any ownedItems / purchasing change which made the grid feel
// sluggish, especially while images were still decoding.
const ClothingCard: React.FC<ClothingCardProps> = React.memo(
  ({item, owned, isPurchasing, onPress}) => {
    const rarityColor = RARITY_COLORS[item.rarity] ?? '#9ca3af';
    return (
      <TouchableOpacity
        style={[styles.itemCard, {borderColor: rarityColor + '55'}]}
        onPress={() => !owned && !isPurchasing && onPress(item)}
        disabled={owned || isPurchasing}>
        <View style={styles.itemContent}>
          <View style={styles.itemImageWrapper}>
            <AssetImage
              source={item.thumbnailUrl || item.imageUrl}
              width="100%"
              height="100%"
            />
          </View>

          {owned && (
            <View style={styles.ownedBadge}>
              <Text style={styles.ownedText}>✓ Owned</Text>
            </View>
          )}

          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.itemRarity, {color: rarityColor}]}>
              {item.rarity.toUpperCase()}
            </Text>
            {isPurchasing ? (
              <ActivityIndicator size="small" color="#a78bfa" />
            ) : (
              <View style={styles.itemPriceContainer}>
                <Text style={styles.itemPriceText}>
                  {item.price === 0
                    ? 'FREE'
                    : `$${(item.price / 100).toFixed(2)}`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  },
);

const PointsShopScreen = ({navigation, route}: any) => {
  const { translate } = useI18n();
  // ── Shared state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<StoreTab>(
    route?.params?.initialTab ?? 'points',
  );

  // ── Points tab state ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState<string | null>(null);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const {setUser, refreshUser} = useAuth();

  // ── Clothing tab state ────────────────────────────────────────────────────
  const [avatarGender, setAvatarGender] = useState<string | undefined>(undefined);
  const [avatarBuild, setAvatarBuild] = useState<string | undefined>(undefined);
  const clothingItems = useMemo<ClothingItem[]>(
    () => filterClothingForAvatar(ALL_CLOTHING_ITEMS, avatarGender, avatarBuild) as ClothingItem[],
    [avatarGender, avatarBuild],
  );
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<ClothingType | 'all'>('all');
  const [selectedRarity, setSelectedRarity] = useState<Rarity | 'all'>('all');
  const [clothingLoading, setClothingLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Pagination: render a small batch first, grow as user scrolls.
  const CLOTHING_PAGE_SIZE = 12;
  const [visibleClothingCount, setVisibleClothingCount] = useState(CLOTHING_PAGE_SIZE);

  useEffect(() => {
    loadUserInventory();
  }, []);

  // Resolve the user's avatar gender + build so the clothing tab only shows
  // items appropriate for their avatar. Falls back to 'male' / standard build
  // so we never display a mixed-gender catalogue.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage =
          require('@react-native-async-storage/async-storage').default;
        const selectedAvatarId = await AsyncStorage.getItem('selectedAvatarId');
        if (cancelled) return;
        setAvatarBuild(getAvatarBuildById(selectedAvatarId));
        setAvatarGender(getAvatarGenderById(selectedAvatarId) ?? 'male');
      } catch {
        if (!cancelled) setAvatarGender('male');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset paging when the category filter changes so users don't have to
  // scroll back to the top of a long list.
  useEffect(() => {
    setVisibleClothingCount(CLOTHING_PAGE_SIZE);
  }, [selectedCategory, selectedRarity]);

  const loadUserInventory = async () => {
    try {
      const AsyncStorage =
        require('@react-native-async-storage/async-storage').default;
      const ownedStr = await AsyncStorage.getItem('ownedClothing');
      const defaultOwned = ALL_CLOTHING_ITEMS.filter(i => i.isDefault).map(i => i.id);
      setOwnedItems(
        ownedStr ? new Set(JSON.parse(ownedStr)) : new Set(defaultOwned),
      );
    } catch {
      const defaultOwned = ALL_CLOTHING_ITEMS.filter(i => i.isDefault).map(i => i.id);
      setOwnedItems(new Set(defaultOwned));
    }
  };

  const handleClothingPurchase = useCallback(async (item: ClothingItem) => {
    // Read latest owned set via functional setState below; capture once for
    // the early-return branch so we don't need ownedItems in the deps.
    let alreadyOwned = false;
    setOwnedItems(curr => {
      alreadyOwned = curr.has(item.id);
      return curr;
    });
    if (alreadyOwned) {
      BisetkaAlert.warning('Already Owned', 'You already own this item!');
      return;
    }
    if (item.price === 0) {
      try {
        setPurchasing(item.id);
        const AsyncStorage =
          require('@react-native-async-storage/async-storage').default;
        let nextOwned: Set<string> | null = null;
        setOwnedItems(curr => {
          nextOwned = new Set([...curr, item.id]);
          return nextOwned;
        });
        if (nextOwned) {
          await AsyncStorage.setItem('ownedClothing', JSON.stringify([...nextOwned]));
        }
        // Auto-equip free items too.
        const eqStr = await AsyncStorage.getItem('@bisetka_equipped_clothing');
        const eq = eqStr ? JSON.parse(eqStr) : {};
        eq[item.type] = item.id;
        await AsyncStorage.setItem('@bisetka_equipped_clothing', JSON.stringify(eq));
        BisetkaAlert.success('Claimed!', `${item.name} added & equipped`);
      } catch {
        BisetkaAlert.error('Error', 'Failed to claim item');
      } finally {
        setPurchasing(null);
      }
      return;
    }
    const runPurchase = async () => {
      try {
        setPurchasing(item.id);
        const result = await buyClothingItem({
          clothingId: item.id,
          clothingType: item.type,
          priceCents: item.price,
        });
        if (!result.success) {
          throw new Error(result.error || 'Purchase failed');
        }
        const AsyncStorage =
          require('@react-native-async-storage/async-storage').default;
        let nextOwned: Set<string> | null = null;
        setOwnedItems(curr => {
          nextOwned = new Set([...curr, item.id]);
          return nextOwned;
        });
        if (nextOwned) {
          await AsyncStorage.setItem('ownedClothing', JSON.stringify([...nextOwned]));
        }
        const eqStr = await AsyncStorage.getItem('@bisetka_equipped_clothing');
        const eq = eqStr ? JSON.parse(eqStr) : {};
        eq[item.type] = item.id;
        await AsyncStorage.setItem('@bisetka_equipped_clothing', JSON.stringify(eq));
        BisetkaAlert.success(
          result.alreadyApplied ? 'Restored' : 'Success!',
          `${item.name} is now equipped on your avatar!`,
        );
      } catch (err: any) {
        if (!err?.cancelled) {
          BisetkaAlert.error('Purchase Failed', err?.message || 'Failed to purchase');
        }
      } finally {
        setPurchasing(null);
      }
    };

    BisetkaAlert.alert(
      'Purchase Item',
      `Buy ${item.name} for $${(item.price / 100).toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Purchase', onPress: () => { void runPurchase(); } },
      ],
    );
  }, []);

  const filteredClothingItems = useMemo(
    () =>
      clothingItems
        .filter(item => selectedCategory === 'all' || item.type === selectedCategory)
        .filter(item => selectedRarity === 'all' || item.rarity === selectedRarity)
        // Cheapest first (free items appear at the top), name as stable tie-break.
        .sort((a, b) => (a.price - b.price) || a.name.localeCompare(b.name)),
    [clothingItems, selectedCategory, selectedRarity],
  );

  const visibleClothingItems = useMemo(
    () => filteredClothingItems.slice(0, visibleClothingCount),
    [filteredClothingItems, visibleClothingCount],
  );

  const handleLoadMoreClothing = useCallback(() => {
    setVisibleClothingCount(prev => {
      if (prev >= filteredClothingItems.length) return prev;
      return Math.min(prev + CLOTHING_PAGE_SIZE, filteredClothingItems.length);
    });
  }, [filteredClothingItems.length]);

  const renderClothingItem: ListRenderItem<ClothingItem> = useCallback(
    ({item}) => {
      return (
        <ClothingCard
          item={item}
          owned={ownedItems.has(item.id)}
          isPurchasing={purchasing === item.id}
          onPress={handleClothingPurchase}
        />
      );
    },
    [ownedItems, purchasing, handleClothingPurchase],
  );

  const syncUserBalance = (pointsAdded: number, newBalance: number) => {
    setUser(currentUser => {
      if (!currentUser) {
        return currentUser;
      }

      return {
        ...currentUser,
        balance: newBalance,
        playerStats: currentUser.playerStats
          ? {
              ...currentUser.playerStats,
              available_points: newBalance,
              total_points: (currentUser.playerStats.total_points || 0) + pointsAdded,
              lifetime_points: (currentUser.playerStats.lifetime_points || 0) + pointsAdded,
            }
          : currentUser.playerStats,
      };
    });
  };

  const handleBackPress = async () => {
    if (isSyncingProfile) {
      return;
    }

    if (hasPurchased) {
      try {
        await refreshUser();
      } catch (error) {
        console.warn('Failed to refresh user before leaving Points Shop:', error);
      }
    }

    navigation.goBack();
  };

  const handlePurchase = async (pack: PointPack) => {
    setLoading(pack.id);

    try {
      // Real in-app purchase via App Store / Play Billing. The backend
      // validates the receipt before crediting the user's balance.
      const purchaseResult = await buyPointsPack(pack.id as PointsSKU);
      if (!purchaseResult.success) {
        throw new Error(purchaseResult.error || 'Receipt verification failed');
      }
      syncUserBalance(purchaseResult.pointsAdded, purchaseResult.newBalance);
      setHasPurchased(true);
      setIsSyncingProfile(true);

      await refreshUser();

      BisetkaAlert.success(
        purchaseResult.alreadyApplied ? '✅ Restored' : '🎉 Jackpot!',
        `You won ${(purchaseResult.basePoints || 0).toLocaleString()}${purchaseResult.bonusPoints ? ` + ${purchaseResult.bonusPoints.toLocaleString()} BONUS` : ''} points!\n\n💰 New balance: ${purchaseResult.newBalance.toLocaleString()}`,
      );
    } catch (error: any) {
      if (!error?.cancelled) {
        BisetkaAlert.error(
          'Purchase Failed',
          error?.message || 'Unable to complete your points purchase.',
        );
      }
    } finally {
      setLoading(null);
      setIsSyncingProfile(false);
    }
  };

  const renderPointPack = (pack: PointPack) => {
    const totalPoints = pack.points + (pack.bonus || 0);
    const isLoading = loading === pack.id;

    return (
      <TouchableOpacity
        key={pack.id}
        activeOpacity={0.85}
        onPress={() => handlePurchase(pack)}
        disabled={isLoading}
        style={[
          styles.packContainer,
          pack.popular && styles.packContainerPopular,
        ]}>
        <View style={[styles.packCard, getGradientViewStyle(pack.gradient)]}>
          
          {/* Glow effect overlay */}
          <View style={[styles.glowOverlay, {backgroundColor: pack.glowColor, opacity: 0.15}]} />

          {pack.popular && (
            <View style={styles.popularBadge}>
              <View
                style={[
                  styles.popularBadgeGradient,
                  getGradientViewStyle(['#fbbf24', '#f59e0b']),
                ]}>
                <Icon name="star" size={12} color="#fff" />
                <Text style={styles.popularText}>BEST VALUE</Text>
              </View>
            </View>
          )}

          {/* Animated diamond icon */}
          <View style={styles.packIconContainer}>
            <View style={styles.packIconGlow}>
              <Icon name={pack.icon} size={64} color="#fff" />
            </View>
          </View>

          {/* Points info */}
          <View style={styles.packInfo}>
            <View style={styles.pointsRow}>
              <Text style={styles.packPoints}>{pack.points.toLocaleString()}</Text>
              <Icon name="poker-chip" size={24} color="#fff" style={{marginLeft: 8}} />
            </View>

            {pack.bonus && (
              <View style={styles.bonusBadge}>
                <Icon name="lightning-bolt" size={14} color="#fbbf24" />
                <Text style={styles.bonusText}>+{pack.bonus.toLocaleString()} BONUS</Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Price and buy button */}
          <View style={styles.packFooter}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceSymbol}>$</Text>
              <Text style={styles.priceAmount}>{pack.price.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={styles.buyButton}
              onPress={() => handlePurchase(pack)}
              disabled={isLoading}>
              <View
                style={styles.buyButtonGradient}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="cart" size={18} color="#fff" />
                    <Text style={styles.buyButtonText}>BUY NOW</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {pack.bonus && (
            <View style={styles.saveBadge}>
              <View
                style={styles.saveBadgeGradient}>
                <Text style={styles.saveText}>
                  {Math.round((pack.bonus / pack.points) * 100)}% MORE
                </Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.backgroundGradient, getGradientViewStyle(['#0f172a', '#1e293b', '#0f172a'], 0)]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* ── Header ──────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
              disabled={isSyncingProfile}>
              <View style={[styles.backButtonGradient, getGradientViewStyle(['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)'])]}>
                <Icon name="arrow-left" size={24} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <View style={styles.headerTitleRow}>
                <Icon name="storefront" size={26} color="#fbbf24" />
                <Text style={styles.headerTitle}>Bisetka Store</Text>
              </View>
            </View>

            <View style={styles.headerRight} />
          </View>

          {/* ── Tab selector ─────────────────────────────────────────────── */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'points' && styles.tabItemActive]}
              onPress={() => setActiveTab('points')}>
              <Icon name="poker-chip" size={18} color={activeTab === 'points' ? '#fbbf24' : 'rgba(255,255,255,0.45)'} />
              <Text style={[styles.tabLabel, activeTab === 'points' && styles.tabLabelActive]}>
                Points
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'clothing' && styles.tabItemActive]}
              onPress={() => setActiveTab('clothing')}>
              <Icon name="tshirt-crew" size={18} color={activeTab === 'clothing' ? '#a78bfa' : 'rgba(255,255,255,0.45)'} />
              <Text style={[styles.tabLabel, activeTab === 'clothing' && styles.tabLabelClothing]}>
                Clothing
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Points tab ───────────────────────────────────────────────── */}
          {activeTab === 'points' && (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>

              <View style={[styles.promoBanner, getGradientViewStyle(['#ec4899', '#8b5cf6'])]}>
                <View style={styles.promoContent}>
                  <Icon name="sale" size={32} color="#fff" />
                  <View style={styles.promoText}>
                    <Text style={styles.promoTitle}>🎰 SPECIAL OFFER</Text>
                    <Text style={styles.promoDescription}>
                      Buy any pack and get INSTANT bonus points!
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.packsGrid}>
                {POINT_PACKS.map(pack => renderPointPack(pack))}
              </View>

              <View style={[styles.featuresContainer, getGradientViewStyle(['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'])]}>
                <Text style={styles.featuresTitle}>💎 What You Get</Text>
                {[
                  {icon: 'airplane-takeoff', color: '#10b981', text: 'Travel anywhere worldwide'},
                  {icon: 'trophy-variant', color: '#f59e0b', text: 'Unlock exclusive achievements'},
                  {icon: 'account-group', color: '#6366f1', text: 'Compete globally'},
                  {icon: 'crown', color: '#ef4444', text: 'Dominate leaderboards'},
                ].map(f => (
                  <View key={f.icon} style={styles.featureItem}>
                    <View style={styles.featureIconCircle}>
                      <Icon name={f.icon} size={20} color={f.color} />
                    </View>
                    <Text style={styles.featureText}>{f.text}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.trustBadges}>
                {[
                  {icon: 'shield-check', color: '#10b981', label: 'Secure'},
                  {icon: 'flash', color: '#f59e0b', label: 'Instant'},
                  {icon: 'credit-card', color: '#6366f1', label: 'Safe'},
                ].map(b => (
                  <View key={b.label} style={styles.trustBadge}>
                    <Icon name={b.icon} size={16} color={b.color} />
                    <Text style={styles.trustBadgeText}>{b.label}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.footerNote}>
                🔒 256-bit encryption • 💳 All cards accepted • ⚡ Instant delivery
              </Text>
            </ScrollView>
          )}

          {/* ── Clothing tab ─────────────────────────────────────────────── */}
          {activeTab === 'clothing' && (
            <>
              {/* Category filter */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryContainer}>
                {CATEGORY_TABS.map(tab => (
                  <TouchableOpacity
                    key={tab.type}
                    style={[styles.categoryTab, selectedCategory === tab.type && styles.categoryTabActive]}
                    onPress={() => setSelectedCategory(tab.type)}>
                    <Text style={styles.categoryIcon}>{tab.icon}</Text>
                    <Text style={[styles.categoryLabel, selectedCategory === tab.type && styles.categoryLabelActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Rarity / tier filter */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryContainer}>
                {RARITY_TABS.map(tab => {
                  const active = selectedRarity === tab.value;
                  return (
                    <TouchableOpacity
                      key={tab.value}
                      style={[
                        styles.categoryTab,
                        active && {
                          backgroundColor: tab.color + '33',
                          borderColor: tab.color,
                        },
                      ]}
                      onPress={() => setSelectedRarity(tab.value)}>
                      <Text style={styles.categoryIcon}>{tab.icon}</Text>
                      <Text
                        style={[
                          styles.categoryLabel,
                          active && {color: tab.color},
                        ]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {clothingLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#a78bfa" />
                </View>
              ) : (
                <FlatList
                  style={styles.scrollView}
                  data={visibleClothingItems}
                  renderItem={renderClothingItem}
                  keyExtractor={item => item.id}
                  numColumns={2}
                  columnWrapperStyle={styles.itemsGridRow}
                  contentContainerStyle={styles.itemsGridContent}
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={6}
                  maxToRenderPerBatch={6}
                  updateCellsBatchingPeriod={32}
                  windowSize={5}
                  removeClippedSubviews
                  getItemLayout={getClothingItemLayout}
                  onEndReached={handleLoadMoreClothing}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={
                    visibleClothingCount < filteredClothingItems.length ? (
                      <View style={styles.loadMoreFooter}>
                        <ActivityIndicator size="small" color="#a78bfa" />
                      </View>
                    ) : null
                  }
                />
              )}
            </>
          )}
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  backgroundGradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  headerRight: {
    width: 44,
  },
  // ── Tab bar ────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
  },
  tabLabelActive: {
    color: '#fbbf24',
  },
  tabLabelClothing: {
    color: '#a78bfa',
  },
  // ── Clothing ───────────────────────────────────────────────────────────────
  categoryScroll: {
    maxHeight: 56,
  },
  categoryContainer: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    alignItems: 'center',
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  categoryTabActive: {
    backgroundColor: 'rgba(167,139,250,0.25)',
    borderColor: '#a78bfa',
  },
  categoryIcon: {
    fontSize: 15,
  },
  categoryLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryLabelActive: {
    color: '#a78bfa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    gap: 14,
  },
  itemsGridContent: {
    padding: spacing.lg,
    gap: 14,
  },
  itemsGridRow: {
    gap: 14,
    marginBottom: 14,
  },
  loadMoreFooter: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  itemCard: {
    width: CARD_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1e2a3a',
    borderWidth: 1,
  },
  itemContent: {
    padding: 12,
    minHeight: 230,
  },
  itemImageWrapper: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  ownedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(16,185,129,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ownedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  itemInfo: {
    marginTop: 4,
  },
  itemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  itemRarity: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 7,
    letterSpacing: 0.5,
  },
  itemPriceContainer: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  itemPriceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  promoBanner: {
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  promoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  promoText: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  promoDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  packsGrid: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  packContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  packContainerPopular: {
    shadowColor: '#fbbf24',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  packCard: {
    borderRadius: 16,
    padding: spacing.lg,
    position: 'relative',
    minHeight: 200,
  },
  glowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  popularBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  popularBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    borderRadius: 16,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  packIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  packIconGlow: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 50,
    padding: 20,
  },
  packInfo: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packPoints: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: spacing.xs,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  bonusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: spacing.md,
  },
  packFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceSymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    opacity: 0.8,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  buyButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  buyButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  saveBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveBadgeGradient: {
    backgroundColor:'#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  saveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  featuresContainer: {
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
    fontWeight: '500',
  },
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  trustBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  footerNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default PointsShopScreen;
