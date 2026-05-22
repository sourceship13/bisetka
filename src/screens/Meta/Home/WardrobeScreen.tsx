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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AvatarClothing, CompleteAvatar, BaseAvatar } from '../../../types/avatar2d';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import AvatarPreview from '../../../components/AvatarPreview';
import TryOnModal from '../../../components/TryOnModal';
import AssetImage from '../../../components/AssetImage';
import { ALL_CLOTHING_ITEMS, filterClothingForAvatar } from '../../../data/clothingItems';
const DEFAULT_CLOTHING: any[] = [];

const { width, height } = Dimensions.get('window');

const CATEGORY_TABS = [
  { type: 'hair', label: 'Hair', icon: '💇' },
  { type: 'top', label: 'Tops', icon: '👕' },
  { type: 'bottom', label: 'Bottoms', icon: '👖' },
  { type: 'shoes', label: 'Shoes', icon: '👟' },
  { type: 'jewelry', label: 'Jewelry', icon: '💎' },
  { type: 'hat', label: 'Hats', icon: '🧢' },
  { type: 'other', label: 'Other', icon: '🛹' },
];

export const WardrobeScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [baseAvatar, setBaseAvatar] = useState<BaseAvatar | null>(null);
  const [inventory, setInventory] = useState<AvatarClothing[]>([]);
  const [equipped, setEquipped] = useState<Record<string, AvatarClothing>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('hair');
  const [tryOnModalVisible, setTryOnModalVisible] = useState(false);
  const [tryingOnItem, setTryingOnItem] = useState<AvatarClothing | null>(null);

  useEffect(() => {
    loadWardrobe();
  }, []);

  // const loadWardrobe = async () => {
  //   try {
  //     setLoading(true);

  //     // Load selected base avatar
  //     const avatarData = await AsyncStorage.getItem('@bisetka_selected_avatar');
  //     if (avatarData) {
  //       setBaseAvatar(JSON.parse(avatarData));
  //     } else {
  //       // Use default avatar if none selected
  //       const defaultAvatar: BaseAvatar = {
  //         id: 'm1',
  //         name: 'Average',
  //         description: 'Strong & confident',
  //         imageUrl: require('../../../../assets/avatars/base/male-average-bald.png'),
  //         gender: 'male',
  //         isActive: true,
  //         displayOrder: 1,
  //         createdAt: new Date().toISOString(),
  //       };
  //       setBaseAvatar(defaultAvatar);
  //     }

  //     // Load equipped items
  //     const equippedData = await AsyncStorage.getItem('@bisetka_equipped_clothing');
  //     if (equippedData) {
  //       setEquipped(JSON.parse(equippedData));
  //     }

  //     // TODO: Replace with real API call when backend is ready
  //     // const response = await apiService.get('/avatar/clothing/inventory');
  //     // setInventory(response.data.items);

  //     // Using mock data for now
  //     setInventory(ALL_CLOTHING_ITEMS);
  //     setLoading(false);
  //   } catch (error) {
  //     console.error('Failed to load wardrobe:', error);
  //     setInventory(ALL_CLOTHING_ITEMS);
  //     setLoading(false);
  //   }
  // };

  // const showTryOn = (item: AvatarClothing) => {
  //   setTryingOnItem(item);
  //   setTryOnModalVisible(true);
  // };

  // const equipItem = async (item: AvatarClothing) => {
  //   try {
  //     const newEquipped = { ...equipped, [item.type]: item };
  //     setEquipped(newEquipped);
  //     await AsyncStorage.setItem('@bisetka_equipped_clothing', JSON.stringify(newEquipped));

  //     // TODO: Call backend API
  //     // await apiService.post('/avatar/clothing/equip', { clothingId: item.id });
      
  //     // Close try-on modal if open
  //     setTryOnModalVisible(false);
  //   } catch (error) {
  //     console.error('Failed to equip item:', error);
  //     BisetkaAlert({
  //       title: 'Error',
  //       message: 'Failed to equip item. Please try again.',
  //     });
  //   }
  // };

  // const unequipItem = async (type: string) => {
  //   try {
  //     const newEquipped = { ...equipped };
  //     delete newEquipped[type];
  //     setEquipped(newEquipped);
  //     await AsyncStorage.setItem('@bisetka_equipped_clothing', JSON.stringify(newEquipped));

  //     // TODO: Call backend API
  //     // await apiService.post('/avatar/clothing/unequip', { type });
  //   } catch (error) {
  //     console.error('Failed to unequip item:', error);
  //     BisetkaAlert({
  //       title: 'Error',
  //       message: 'Failed to unequip item. Please try again.',
  //     });
  //   }
  // };

  const visibleInventory = filterClothingForAvatar(
    inventory,
    baseAvatar?.gender,
    (baseAvatar as any)?.build,
  );
  const categoryItems = visibleInventory.filter((item) => item.type === selectedCategory);
  const currentlyEquipped = equipped[selectedCategory];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.gradient, { backgroundColor: '#1a1a2e' }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>My Wardrobe</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Avatar Preview */}
          <View style={styles.previewSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Avatar</Text>
              <TouchableOpacity 
                style={styles.changeAvatarButton}
                onPress={() => navigation.navigate('AvatarSelection')}
              >
                <Text style={styles.changeAvatarText}>Change</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.avatarContainer}>
              {baseAvatar ? (
                <View style={styles.avatarWrapper}>
                  <AvatarPreview
                    baseAvatar={baseAvatar}
                    equipped={equipped}
                    size={500}
                  />
                </View>
              ) : (
                <Text style={styles.noAvatarText}>No avatar selected</Text>
              )}
            </View>
          </View>

          {/* Category Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
            {CATEGORY_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.type}
                style={[styles.tab, selectedCategory === tab.type && styles.tabActive]}
                onPress={() => setSelectedCategory(tab.type)}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, selectedCategory === tab.type && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Currently Equipped */}
          {currentlyEquipped && (
            <View style={styles.equippedSection}>
              <Text style={styles.sectionTitle}>Currently Wearing</Text>
              <View style={styles.equippedCard}>
                <AssetImage source={currentlyEquipped.imageUrl} width={styles.equippedImage.width as any} height={styles.equippedImage.height as any} style={styles.equippedImage} />
                <View style={styles.equippedInfo}>
                  <Text style={styles.equippedName}>{currentlyEquipped.name}</Text>
                  <Text style={styles.equippedDesc}>{currentlyEquipped.description}</Text>
                </View>
                <TouchableOpacity
                  style={styles.unequipButton}
                  onPress={() => unequipItem(selectedCategory)}
                >
                  <Text style={styles.unequipText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Clothing Items */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>
              {categoryItems.length} {selectedCategory} items
            </Text>
            <View style={styles.itemsGrid}>
              {categoryItems.map((item) => {
                const isEquipped = equipped[item.type]?.id === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.itemCard, isEquipped && styles.itemCardEquipped]}
                    onPress={() => showTryOn(item)}
                    onLongPress={() => !isEquipped && equipItem(item)}
                  >
                    <View style={styles.itemImageWrapper}>
                      <AssetImage source={item.imageUrl} width="100%" height="100%" />
                    </View>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemHint}>Tap to preview</Text>
                    {isEquipped && (
                      <View style={styles.equippedBadge}>
                        <Text style={styles.equippedBadgeText}>✓ Equipped</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      <TryOnModal
        visible={tryOnModalVisible}
        onClose={() => setTryOnModalVisible(false)}
        onEquip={() => tryingOnItem && equipItem(tryingOnItem)}
        baseAvatar={baseAvatar}
        currentEquipped={equipped}
        tryingOnItem={tryingOnItem}
        isOwned={true}
      />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
  },
  previewSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  changeAvatarButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    minHeight: 300,
  },
  avatarWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noAvatarText: {
    color: '#666',
    fontSize: 16,
  },
  tabsContainer: {
    marginBottom: 24,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#4f46e5',
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#fff',
  },
  equippedSection: {
    marginBottom: 24,
  },
  equippedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  equippedImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  equippedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  equippedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  equippedDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  unequipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  unequipText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  itemsSection: {
    marginBottom: 24,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  itemCard: {
    width: (width - 52) / 2,
    margin: 6,
    backgroundColor: '#2a2d3a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemCardEquipped: {
    borderColor: '#4f46e5',
    backgroundColor: '#33364a',
  },
  itemImageWrapper: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  itemHint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  equippedBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#4f46e5',
    borderRadius: 12,
  },
  equippedBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
});

export default WardrobeScreen;
