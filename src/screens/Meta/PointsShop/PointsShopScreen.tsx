import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors, spacing} from '../../../theme';
import {BisetkaAlert} from '../../../utils/BisetkaAlert';
import {useAuth} from '../../../libs/hooks/useAuth';
import apiService from '../../../services/api.service';

interface PointPack {
  id: string;
  points: number;
  price: number;
  popular?: boolean;
  bonus?: number;
  icon: string;
  color: string[];
}

const POINT_PACKS: PointPack[] = [
  {
    id: 'starter',
    points: 500,
    price: 0.99,
    icon: 'package-variant',
    color: ['#3b82f6', '#2563eb'],
  },
  {
    id: 'value',
    points: 1500,
    price: 2.99,
    bonus: 300,
    popular: true,
    icon: 'package-variant-closed',
    color: ['#8b5cf6', '#7c3aed'],
  },
  {
    id: 'premium',
    points: 3500,
    price: 4.99,
    bonus: 1000,
    icon: 'treasure-chest',
    color: ['#f59e0b', '#d97706'],
  },
  {
    id: 'mega',
    points: 10000,
    price: 9.99,
    bonus: 5000,
    icon: 'crown',
    color: ['#ef4444', '#dc2626'],
  },
];

const PointsShopScreen = ({navigation}: any) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const {setUser, refreshUser} = useAuth();

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
      const purchaseResult = await apiService.purchasePoints(pack.id);
      syncUserBalance(purchaseResult.pointsAdded, purchaseResult.newBalance);
      setHasPurchased(true);
      setIsSyncingProfile(true);

      await refreshUser();

      BisetkaAlert.success(
        'Purchase Successful!',
        `You received ${purchaseResult.basePoints.toLocaleString()}${purchaseResult.bonusPoints ? ` + ${purchaseResult.bonusPoints.toLocaleString()} bonus` : ''} points!\n\nNew balance: ${purchaseResult.newBalance.toLocaleString()}`
      );
    } catch (error: any) {
      BisetkaAlert.error(
        'Purchase Failed',
        error?.message || 'Unable to complete your points purchase.'
      );
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
        activeOpacity={0.8}
        onPress={() => handlePurchase(pack)}
        disabled={isLoading}
        style={styles.packContainer}>
        <LinearGradient
          colors={pack.color}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={[styles.packCard, pack.popular && styles.packCardPopular]}>
          {pack.popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>MOST POPULAR</Text>
            </View>
          )}

          <View style={styles.packIcon}>
            <Icon name={pack.icon} size={48} color="#fff" />
          </View>

          <View style={styles.packInfo}>
            <Text style={styles.packPoints}>{pack.points.toLocaleString()}</Text>
            <Text style={styles.packPointsLabel}>Points</Text>

            {pack.bonus && (
              <View style={styles.bonusBadge}>
                <Icon name="plus-circle" size={16} color="#10b981" />
                <Text style={styles.bonusText}>+{pack.bonus} BONUS</Text>
              </View>
            )}
          </View>

          <View style={styles.packFooter}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceSymbol}>$</Text>
              <Text style={styles.priceAmount}>{pack.price.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={styles.buyButton}
              onPress={() => handlePurchase(pack)}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.buyButtonText}>Buy Now</Text>
                  <Icon name="arrow-right" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {pack.bonus && (
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>
                {Math.round((pack.bonus / pack.points) * 100)}% MORE
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={['#1e293b', '#0f172a']}
        style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          disabled={isSyncingProfile}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Points Shop</Text>
          <Text style={styles.headerSubtitle}>Power up your gameplay</Text>
        </View>

        <View style={styles.headerRight} />
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Info Banner */}
        <LinearGradient
          colors={['#6366f1', '#4f46e5']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.infoBanner}>
          <Icon name="information" size={24} color="#fff" />
          <View style={styles.infoBannerText}>
            <Text style={styles.infoBannerTitle}>What are points?</Text>
            <Text style={styles.infoBannerDescription}>
              Use points to travel between Bisetkas, unlock achievements, and compete on leaderboards!
            </Text>
          </View>
        </LinearGradient>

        {/* Point Packs Grid */}
        <View style={styles.packsGrid}>
          {POINT_PACKS.map(pack => renderPointPack(pack))}
        </View>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Why buy points?</Text>
          
          <View style={styles.featureItem}>
            <Icon name="airplane-takeoff" size={24} color="#10b981" />
            <Text style={styles.featureText}>Travel to any Bisetka worldwide</Text>
          </View>

          <View style={styles.featureItem}>
            <Icon name="trophy" size={24} color="#f59e0b" />
            <Text style={styles.featureText}>Unlock exclusive achievements</Text>
          </View>

          <View style={styles.featureItem}>
            <Icon name="account-multiple" size={24} color="#6366f1" />
            <Text style={styles.featureText}>Compete with players globally</Text>
          </View>

          <View style={styles.featureItem}>
            <Icon name="crown" size={24} color="#ef4444" />
            <Text style={styles.featureText}>Climb the leaderboards</Text>
          </View>
        </View>

        {/* Footer Note */}
        <Text style={styles.footerNote}>
          🔒 Secure payment • 💳 All major cards accepted • ✨ Instant delivery
        </Text>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  infoBannerText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  infoBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  infoBannerDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  packsGrid: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  packContainer: {
    marginBottom: spacing.sm,
  },
  packCard: {
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  packCardPopular: {
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  popularBadge: {
    position: 'absolute',
    top: 16,
    right: -30,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 40,
    paddingVertical: 6,
    transform: [{rotate: '45deg'}],
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: 1,
  },
  packIcon: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  packInfo: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  packPoints: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  packPointsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: spacing.xs,
  },
  bonusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    marginLeft: 4,
  },
  packFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceSymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    gap: 6,
  },
  buyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  saveBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#10b981',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  saveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  featuresContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  featureText: {
    fontSize: 15,
    color: colors.text.secondary,
    flex: 1,
  },
  footerNote: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PointsShopScreen;
