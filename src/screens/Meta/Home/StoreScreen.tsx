import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../../../libs/hooks/useAuth';
import {colors, spacing} from '../../../theme';

const {width} = Dimensions.get('window');
const TILE_GAP = 12;
const TILES_PER_ROW = 2;
const TILE_WIDTH =
  (width - spacing.md * 2 - TILE_GAP * (TILES_PER_ROW - 1)) / TILES_PER_ROW;

type Category = 'hats' | 'glasses' | 'chains' | 'watches' | 'outfits' | 'backgrounds';

interface StoreItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  category: Category;
}

const CATEGORIES: {key: Category; label: string; icon: string}[] = [
  {key: 'hats', label: 'Hats', icon: '🎩'},
  {key: 'glasses', label: 'Glasses', icon: '🕶️'},
  {key: 'chains', label: 'Chains', icon: '⛓️'},
  {key: 'watches', label: 'Watches', icon: '⌚'},
  {key: 'outfits', label: 'Outfits', icon: '👔'},
  {key: 'backgrounds', label: 'Backgrounds', icon: '🖼️'},
];

const STORE_ITEMS: StoreItem[] = [
  // Hats
  {id: 'hat-fedora', name: 'Fedora', emoji: '🎩', price: 500, category: 'hats'},
  {id: 'hat-crown', name: 'Crown', emoji: '👑', price: 2000, category: 'hats'},
  {id: 'hat-cap', name: 'Baseball Cap', emoji: '🧢', price: 300, category: 'hats'},
  {id: 'hat-cowboy', name: 'Cowboy Hat', emoji: '🤠', price: 750, category: 'hats'},
  {id: 'hat-top', name: 'Top Hat', emoji: '🎩', price: 1000, category: 'hats'},
  {id: 'hat-beanie', name: 'Beanie', emoji: '🧶', price: 250, category: 'hats'},

  // Glasses
  {id: 'glasses-sun', name: 'Sunglasses', emoji: '🕶️', price: 400, category: 'glasses'},
  {id: 'glasses-nerd', name: 'Nerd Glasses', emoji: '🤓', price: 200, category: 'glasses'},
  {id: 'glasses-monocle', name: 'Monocle', emoji: '🧐', price: 800, category: 'glasses'},
  {id: 'glasses-vr', name: 'VR Headset', emoji: '🥽', price: 1500, category: 'glasses'},

  // Chains
  {id: 'chain-gold', name: 'Gold Chain', emoji: '📿', price: 1200, category: 'chains'},
  {id: 'chain-diamond', name: 'Diamond Chain', emoji: '💎', price: 3000, category: 'chains'},
  {id: 'chain-pearl', name: 'Pearl Necklace', emoji: '📿', price: 900, category: 'chains'},
  {id: 'chain-pendant', name: 'Pendant', emoji: '🔮', price: 600, category: 'chains'},

  // Watches
  {id: 'watch-gold', name: 'Gold Watch', emoji: '⌚', price: 1500, category: 'watches'},
  {id: 'watch-smart', name: 'Smart Watch', emoji: '⌚', price: 800, category: 'watches'},
  {id: 'watch-diamond', name: 'Diamond Watch', emoji: '💍', price: 5000, category: 'watches'},
  {id: 'watch-classic', name: 'Classic Watch', emoji: '🕰️', price: 1000, category: 'watches'},

  // Outfits
  {id: 'outfit-suit', name: 'Luxury Suit', emoji: '🤵', price: 2500, category: 'outfits'},
  {id: 'outfit-dress', name: 'Evening Dress', emoji: '👗', price: 2500, category: 'outfits'},
  {id: 'outfit-jersey', name: 'Sports Jersey', emoji: '👕', price: 500, category: 'outfits'},
  {id: 'outfit-leather', name: 'Leather Jacket', emoji: '🧥', price: 1800, category: 'outfits'},
  {id: 'outfit-hoodie', name: 'Designer Hoodie', emoji: '👘', price: 700, category: 'outfits'},
  {id: 'outfit-tux', name: 'Tuxedo', emoji: '🎩', price: 3500, category: 'outfits'},

  // Backgrounds
  {id: 'bg-galaxy', name: 'Galaxy', emoji: '🌌', price: 1000, category: 'backgrounds'},
  {id: 'bg-sunset', name: 'Sunset', emoji: '🌅', price: 800, category: 'backgrounds'},
  {id: 'bg-neon', name: 'Neon City', emoji: '🌃', price: 1200, category: 'backgrounds'},
  {id: 'bg-fire', name: 'Fire', emoji: '🔥', price: 1500, category: 'backgrounds'},
  {id: 'bg-ocean', name: 'Ocean', emoji: '🌊', price: 600, category: 'backgrounds'},
  {id: 'bg-forest', name: 'Enchanted Forest', emoji: '🌲', price: 900, category: 'backgrounds'},
];

const StoreScreen = ({navigation}: any) => {
  const {user} = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');

  const filteredItems =
    selectedCategory === 'all'
      ? STORE_ITEMS
      : STORE_ITEMS.filter(item => item.category === selectedCategory);

  const handleBuy = (item: StoreItem) => {
    Alert.alert(
      'Purchase Item',
      `Buy ${item.name} for ${item.price} points?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Buy',
          onPress: () => {
            Alert.alert('Coming Soon', 'Purchases will be available soon!');
          },
        },
      ],
    );
  };

  const renderTile = (item: StoreItem) => (
    <TouchableOpacity
      key={item.id}
      activeOpacity={0.85}
      onPress={() => handleBuy(item)}
      style={styles.tileWrapper}>
      <LinearGradient
        colors={['#1e1b4b', '#312e81']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.tile}>
        <View style={styles.tileEmoji}>
          <Text style={styles.emojiText}>{item.emoji}</Text>
        </View>
        <Text style={styles.tileName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceIcon}>⭐</Text>
          <Text style={styles.priceText}>{item.price.toLocaleString()}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PointsShop')}
          style={styles.balanceBadge}>
          <Text style={styles.balanceIcon}>⭐</Text>
          <Text style={styles.balanceText}>
            {(user?.balance ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.balancePlus}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Get More Points CTA */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('PointsShop')}
        style={styles.getPointsBtnWrap}>
        <View style={styles.getPointsBtn}>
          <Text style={styles.getPointsIcon}>🪙</Text>
          <Text style={styles.getPointsText}>Get More Points</Text>
          <Text style={styles.getPointsArrow}>→</Text>
        </View>
      </TouchableOpacity>

      {/* Category Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryBar}>
        <TouchableOpacity
          onPress={() => setSelectedCategory('all')}
          style={[
            styles.categoryChip,
            selectedCategory === 'all' && styles.categoryChipActive,
          ]}>
          <Text
            style={[
              styles.categoryChipText,
              selectedCategory === 'all' && styles.categoryChipTextActive,
            ]}>
            All
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            onPress={() => setSelectedCategory(cat.key)}
            style={[
              styles.categoryChip,
              selectedCategory === cat.key && styles.categoryChipActive,
            ]}>
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat.key && styles.categoryChipTextActive,
              ]}>
              {cat.icon} {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Product Grid */}
      <ScrollView contentContainerStyle={styles.grid}>
        <View style={styles.gridRow}>
          {filteredItems.map((item, index) => renderTile(item))}
        </View>
      </ScrollView>
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
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#fff',
    fontSize: 22,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  balanceIcon: {
    fontSize: 14,
  },
  balanceText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
  },
  balancePlus: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 4,
    backgroundColor: '#f59e0b',
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 18,
    overflow: 'hidden',
  },
  getPointsBtnWrap: {
    marginHorizontal: spacing.md,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  getPointsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: '#f59e0b',
  },
  getPointsIcon: {
    fontSize: 20,
  },
  getPointsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  getPointsArrow: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 4,
  },
  categoryBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  categoryChipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  grid: {
    paddingHorizontal: spacing.md,
    paddingBottom: 40,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
  },
  tileWrapper: {
    width: TILE_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tile: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tileEmoji: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emojiText: {
    fontSize: 32,
  },
  tileName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceIcon: {
    fontSize: 13,
  },
  priceText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default StoreScreen;
