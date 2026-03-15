import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ClothingItem, ClothingType, Rarity } from '../../../types/avatar2d';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { ALL_CLOTHING_ITEMS } from '../../../data/clothingItems';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const RARITY_COLORS: Record<Rarity, [string, string]> = {
  common: ['#6b7280', '#9ca3af'],
  rare: ['#3b82f6', '#60a5fa'],
  epic: ['#8b5cf6', '#a78bfa'],
  legendary: ['#f59e0b', '#fbbf24'],
};

const CATEGORY_TABS: { type: ClothingType | 'all'; label: string; icon: string }[] = [
  { type: 'all', label: 'All', icon: '🛍️' },
  { type: 'hair', label: 'Hair', icon: '💇' },
  { type: 'top', label: 'Tops', icon: '👕' },
  { type: 'bottom', label: 'Bottoms', icon: '👖' },
  { type: 'shoes', label: 'Shoes', icon: '👟' },
  { type: 'jewelry', label: 'Jewelry', icon: '💎' },
  { type: 'hat', label: 'Hats', icon: '🧢' },
  { type: 'other', label: 'Other', icon: '🛹' },
];

export const ClothingStoreScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<ClothingType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    loadStoreItems();
    loadUserInventory();
  }, []);

  const loadStoreItems = async () => {
    try {
      setLoading(true);
      setTimeout(() => {
        setItems(ALL_CLOTHING_ITEMS);
        setLoading(false);
      }, 300);
    } catch (error: any) {
      console.error('Failed to load store:', error);
      setItems(ALL_CLOTHING_ITEMS);
      setLoading(false);
    }
  };

  const loadUserInventory = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const ownedStr = await AsyncStorage.getItem('ownedClothing');
      const defaultOwned = ALL_CLOTHING_ITEMS
        .filter(item => item.isDefault)
        .map(item => item.id);
      
      const owned = ownedStr ? new Set(JSON.parse(ownedStr)) : new Set(defaultOwned);
      setOwnedItems(owned);
    } catch (error) {
      console.error('Failed to load inventory:', error);
      const defaultOwned = ALL_CLOTHING_ITEMS
        .filter(item => item.isDefault)
        .map(item => item.id);
      setOwnedItems(new Set(defaultOwned));
    }
  };

  const purchaseItem = async (item: ClothingItem) => {
    if (ownedItems.has(item.id)) {
      BisetkaAlert({
        title: 'Already Owned',
        message: 'You already own this item!',
        type: 'warning',
      });
      return;
    }

    if (item.price === 0) {
      try {
        setPurchasing(item.id);
        
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const newOwned = new Set([...ownedItems, item.id]);
        await AsyncStorage.setItem('ownedClothing', JSON.stringify([...newOwned]));
        
        setOwnedItems(newOwned);
        BisetkaAlert({
          title: 'Claimed!',
          message: `${item.name} added to your wardrobe`,
          type: 'success',
        });
      } catch (error: any) {
        BisetkaAlert({
          title: 'Error',
          message: 'Failed to claim item',
          type: 'error',
        });
      } finally {
        setPurchasing(null);
      }
      return;
    }

    BisetkaAlert({
      title: 'Purchase Item',
      message: `Buy ${item.name} for $${(item.price / 100).toFixed(2)}?\n\n(Payment integration coming soon!)`,
      type: 'confirm',
      confirmText: 'Purchase',
      onConfirm: async () => {
        try {
          setPurchasing(item.id);
          
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const newOwned = new Set([...ownedItems, item.id]);
          await AsyncStorage.setItem('ownedClothing', JSON.stringify([...newOwned]));
          
          setOwnedItems(newOwned);
          BisetkaAlert({
            title: 'Success!',
            message: `${item.name} purchased!`,
            type: 'success',
          });
        } catch (error: any) {
          BisetkaAlert({
            title: 'Purchase Failed',
            message: 'Failed to purchase',
            type: 'error',
          });
        } finally {
          setPurchasing(null);
        }
      },
    });
  };

  const filteredItems = items.filter(
    (item) => selectedCategory === 'all' || item.type === selectedCategory
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Clothing Store</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContainer}
        >
          {CATEGORY_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.type}
              style={[
                styles.categoryTab,
                selectedCategory === tab.type && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(tab.type)}
            >
              <Text style={styles.categoryIcon}>{tab.icon}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  selectedCategory === tab.type && styles.categoryLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : (
          <ScrollView style={styles.scrollView}>
            <View style={styles.itemsGrid}>
              {filteredItems.map((item) => {
                const owned = ownedItems.has(item.id);
                const isPurchasing = purchasing === item.id;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemCard}
                    onPress={() => !owned && !isPurchasing && purchaseItem(item)}
                    disabled={owned || isPurchasing}
                  >
                    <View style={styles.itemContent}>
                      <View style={styles.itemImageWrapper}>
                        <Image
                          source={item.thumbnailUrl || item.imageUrl}
                          style={styles.itemImage}
                          resizeMode="contain"
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
                        <Text style={styles.itemRarity}>
                          {item.rarity.toUpperCase()}
                        </Text>
                        
                        {isPurchasing ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <View style={styles.priceContainer}>
                            {item.price === 0 ? (
                              <Text style={styles.priceText}>FREE</Text>
                            ) : (
                              <Text style={styles.priceText}>
                                ${(item.price / 100).toFixed(2)}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
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
    padding: 16,
  },
  backButton: {
    fontSize: 32,
    color: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 32,
  },
  categoryScroll: {
    maxHeight: 60,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryTabActive: {
    backgroundColor: '#6366f1',
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryLabelActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
    marginTop: 16,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
  },
  itemCard: {
    width: CARD_WIDTH,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2a2d3a',
  },
  itemContent: {
    padding: 12,
    minHeight: 240,
  },
  itemImageWrapper: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  ownedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
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
    marginTop: 8,
  },
  itemName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemRarity: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 8,
  },
  priceContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  priceText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ClothingStoreScreen;
