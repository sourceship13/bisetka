import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ImageBackground,
  Animated,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
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
  gradient: string[];
  glowColor: string;
}

const POINT_PACKS: PointPack[] = [
  {
    id: 'starter',
    points: 500,
    price: 0.99,
    icon: 'diamond',
    gradient: ['#667eea', '#764ba2'],
    glowColor: '#667eea',
  },
  {
    id: 'value',
    points: 1500,
    price: 2.99,
    bonus: 300,
    popular: true,
    icon: 'diamond-stone',
    gradient: ['#f093fb', '#f5576c'],
    glowColor: '#f093fb',
  },
  {
    id: 'premium',
    points: 3500,
    price: 4.99,
    bonus: 1000,
    icon: 'treasure-chest',
    gradient: ['#fa709a', '#fee140'],
    glowColor: '#fa709a',
  },
  {
    id: 'mega',
    points: 10000,
    price: 9.99,
    bonus: 5000,
    icon: 'crown',
    gradient: ['#ffd89b', '#19547b'],
    glowColor: '#ffd89b',
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
        '🎉 Jackpot!',
        `You won ${purchaseResult.basePoints.toLocaleString()}${purchaseResult.bonusPoints ? ` + ${purchaseResult.bonusPoints.toLocaleString()} BONUS` : ''} points!\n\n💰 New balance: ${purchaseResult.newBalance.toLocaleString()}`
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
        activeOpacity={0.85}
        onPress={() => handlePurchase(pack)}
        disabled={isLoading}
        style={[
          styles.packContainer,
          pack.popular && styles.packContainerPopular,
        ]}>
        <LinearGradient
          colors={pack.gradient}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.packCard}>
          
          {/* Glow effect overlay */}
          <View style={[styles.glowOverlay, {backgroundColor: pack.glowColor, opacity: 0.15}]} />

          {pack.popular && (
            <View style={styles.popularBadge}>
              <LinearGradient
                colors={['#fbbf24', '#f59e0b']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.popularBadgeGradient}>
                <Icon name="star" size={12} color="#fff" />
                <Text style={styles.popularText}>BEST VALUE</Text>
              </LinearGradient>
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
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.15)']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.buyButtonGradient}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="cart" size={18} color="#fff" />
                    <Text style={styles.buyButtonText}>BUY NOW</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {pack.bonus && (
            <View style={styles.saveBadge}>
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.saveBadgeGradient}>
                <Text style={styles.saveText}>
                  {Math.round((pack.bonus / pack.points) * 100)}% MORE
                </Text>
              </LinearGradient>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}
        style={styles.backgroundGradient}>
        
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
              disabled={isSyncingProfile}>
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                style={styles.backButtonGradient}>
                <Icon name="arrow-left" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <View style={styles.headerTitleRow}>
                <Icon name="poker-chip" size={28} color="#fbbf24" />
                <Text style={styles.headerTitle}>Points Casino</Text>
              </View>
              <Text style={styles.headerSubtitle}>✨ Premium Packages ✨</Text>
            </View>

            <View style={styles.headerRight} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            
            {/* Promotional Banner */}
            <LinearGradient
              colors={['#ec4899', '#8b5cf6']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.promoBanner}>
              <View style={styles.promoContent}>
                <Icon name="sale" size={32} color="#fff" />
                <View style={styles.promoText}>
                  <Text style={styles.promoTitle}>🎰 SPECIAL OFFER</Text>
                  <Text style={styles.promoDescription}>
                    Buy any pack and get INSTANT bonus points!
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Point Packs Grid */}
            <View style={styles.packsGrid}>
              {POINT_PACKS.map(pack => renderPointPack(pack))}
            </View>

            {/* Features List */}
            <LinearGradient
              colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
              style={styles.featuresContainer}>
              <Text style={styles.featuresTitle}>💎 What You Get</Text>
              
              <View style={styles.featureItem}>
                <View style={styles.featureIconCircle}>
                  <Icon name="airplane-takeoff" size={20} color="#10b981" />
                </View>
                <Text style={styles.featureText}>Travel anywhere worldwide</Text>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconCircle}>
                  <Icon name="trophy-variant" size={20} color="#f59e0b" />
                </View>
                <Text style={styles.featureText}>Unlock exclusive achievements</Text>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconCircle}>
                  <Icon name="account-group" size={20} color="#6366f1" />
                </View>
                <Text style={styles.featureText}>Compete globally</Text>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconCircle}>
                  <Icon name="crown" size={20} color="#ef4444" />
                </View>
                <Text style={styles.featureText}>Dominate leaderboards</Text>
              </View>
            </LinearGradient>

            {/* Trust Badges */}
            <View style={styles.trustBadges}>
              <View style={styles.trustBadge}>
                <Icon name="shield-check" size={16} color="#10b981" />
                <Text style={styles.trustBadgeText}>Secure</Text>
              </View>
              <View style={styles.trustBadge}>
                <Icon name="flash" size={16} color="#f59e0b" />
                <Text style={styles.trustBadgeText}>Instant</Text>
              </View>
              <View style={styles.trustBadge}>
                <Icon name="credit-card" size={16} color="#6366f1" />
                <Text style={styles.trustBadgeText}>Safe</Text>
              </View>
            </View>

            {/* Footer Note */}
            <Text style={styles.footerNote}>
              🔒 256-bit encryption • 💳 All cards accepted • ⚡ Instant delivery
            </Text>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
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
    borderRadius: 22,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  promoBanner: {
    borderRadius: 20,
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
    borderRadius: 24,
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
    borderRadius: 999,
    overflow: 'hidden',
  },
  popularBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
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
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveBadgeGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  featuresContainer: {
    borderRadius: 20,
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
