import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { colors } from '../../../theme';
import apiConfig from '../../../libs/utils/api.utils';
import tokenService from '../../../services/token.service';
import { BACKGROUND_ANIMATION_DURATION } from '@sentry/react-native/dist/js/feedback/FeedbackWidgetManager';

type Props = NativeStackScreenProps<RootStackParamList, 'GameInfo'>;

interface GameInfoData {
  gameType: string;
  displayName: string;
  shortDescription: string;
  fullDescription: string;
  rules: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedDuration: number;
  difficulty: string;
  categories: string[];
  entryCost: number;
  prizeMultiplier: number;
  pointAwards: {
    type: 'monetary' | 'config';
    entryCost: number;
    description?: string;
    examples?: Array<{ scenario: string; points: number }>;
    modes?: {
      [mode: string]: {
        entry?: number;
        win: number | null;
        draw: number | null;
        loss: number | null;
      };
    };
  };
}

const { width } = Dimensions.get('window');

const GameInfoScreen: React.FC<Props> = ({ route, navigation }) => {
  const { gameType, gradient } = route.params;
  const [gameInfo, setGameInfo] = useState<GameInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGameInfo();
  }, [gameType]);

  const fetchGameInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await tokenService.getAccessToken();
      const response = await fetch(`${apiConfig.apiURL}/game-info/${gameType}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch game info: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setGameInfo(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching game info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load game info');
      BisetkaAlert.error('Error', 'Failed to load game information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayNow = () => {
    // Solo games - navigate directly without game mode selection
    if (gameType === 'slots' || gameType === 'blackjack') {
      navigation.navigate(gameType.charAt(0).toUpperCase() + gameType.slice(1) as any);
      return;
    }
    
    // For other games, navigate to GameMode screen
    navigation.navigate('GameMode', { gameType: gameType as any });
  };

  const renderPointAwards = () => {
    if (!gameInfo?.pointAwards) return null;

    const { pointAwards } = gameInfo;
    const entryCost = pointAwards.entryCost || gameInfo.entryCost || 50;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 Entry Cost & Prizes</Text>
        
        {/* Entry Cost Card */}
        <View style={[styles.card, styles.entryCostCard]}>
          <View style={styles.entryCostHeader}>
            <Text style={styles.entryCostLabel}>Entry Cost</Text>
            <Text style={styles.entryCostValue}>-{entryCost} points</Text>
          </View>
          <Text style={styles.entryCostDescription}>
            Pay {entryCost} points to play. Win to earn prizes!
          </Text>
        </View>

        {/* Prize Structure */}
        {pointAwards.type === 'monetary' ? (
          <View style={[styles.card, styles.monetaryCard]}>
            <Text style={styles.monetaryDescription}>{pointAwards.description}</Text>
            
            {pointAwards.examples && (
              <View style={styles.examplesContainer}>
                <Text style={styles.examplesTitle}>Potential Rewards:</Text>
                {pointAwards.examples.map((example, index) => (
                  <View key={index} style={styles.exampleRow}>
                    <Text style={styles.exampleScenario}>{example.scenario}</Text>
                    <Text
                      style={[
                        styles.examplePoints,
                        example.points >= 0 ? styles.pointsPositive : styles.pointsNegative,
                      ]}>
                      {example.points >= 0 ? '+' : ''}
                      {example.points} pts
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : pointAwards.type === 'config' && pointAwards.modes ? (
          <View style={styles.card}>
            <Text style={styles.prizeTitle}>🏆 Prize Structure</Text>
            <View style={styles.prizesGrid}>
              {Object.entries(pointAwards.modes).slice(0, 1).map(([mode, points]) => (
                <React.Fragment key={mode}>
                  {points.win !== null && (
                    <View style={styles.prizeItem}>
                      <Text style={styles.prizeIcon}>🥇</Text>
                      <View style={styles.prizeTextContainer}>
                        <Text style={styles.prizeLabel}>Win</Text>
                        <Text style={[styles.prizeValue, styles.pointsPositive]}>
                          +{points.win} pts
                        </Text>
                      </View>
                    </View>
                  )}
                  {points.draw !== null && (
                    <View style={styles.prizeItem}>
                      <Text style={styles.prizeIcon}>🤝</Text>
                      <View style={styles.prizeTextContainer}>
                        <Text style={styles.prizeLabel}>Draw</Text>
                        <Text style={styles.prizeValue}>+{points.draw} pts</Text>
                        <Text style={styles.prizeSubtext}>(Entry refunded)</Text>
                      </View>
                    </View>
                  )}
                  {points.loss !== null && (
                    <View style={styles.prizeItem}>
                      <Text style={styles.prizeIcon}>😔</Text>
                      <View style={styles.prizeTextContainer}>
                        <Text style={styles.prizeLabel}>Loss</Text>
                        <Text style={[styles.prizeValue, styles.pointsNegative]}>
                          {points.loss} pts
                        </Text>
                        <Text style={styles.prizeSubtext}>(No prize)</Text>
                      </View>
                    </View>
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderRules = () => {
    if (!gameInfo?.rules) return null;

    // Simple markdown-like parsing for the rules
    const lines = gameInfo.rules.split('\n');
    const elements: React.ReactElement[] = [];
    
    lines.forEach((line, index) => {
      if (line.startsWith('# ')) {
        // H1 heading
        elements.push(
          <Text key={index} style={styles.rulesH1}>
            {line.replace('# ', '')}
          </Text>
        );
      } else if (line.startsWith('## ')) {
        // H2 heading
        elements.push(
          <Text key={index} style={styles.rulesH2}>
            {line.replace('## ', '')}
          </Text>
        );
      } else if (line.startsWith('- ')) {
        // Bullet point
        elements.push(
          <Text key={index} style={styles.rulesBullet}>
            • {line.replace('- ', '')}
          </Text>
        );
      } else if (line.trim() !== '') {
        // Regular paragraph
        elements.push(
          <Text key={index} style={styles.rulesText}>
            {line}
          </Text>
        );
      }
    });

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📖 Rules</Text>
        <View style={styles.rulesCard}>{elements}</View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading game info...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !gameInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error || 'Game not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchGameInfo}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={gradient || ['#6366f1', '#8b5cf6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}>
        <TouchableOpacity style={[styles.backButtonHeader]} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonIcon}>←</Text>
        </TouchableOpacity>
        <View style={[styles.headerContent]}>
          <Text style={styles.gameIconLarge}>{gameInfo.icon}</Text>
          <Text style={styles.gameTitle}>{gameInfo.displayName}</Text>
          <Text style={styles.gameSubtitle}>{gameInfo.shortDescription}</Text>
          
          <View style={styles.gameMetaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>👥</Text>
              <Text style={styles.metaText}>
                {gameInfo.minPlayers === gameInfo.maxPlayers
                  ? `${gameInfo.minPlayers} player${gameInfo.minPlayers > 1 ? 's' : ''}`
                  : `${gameInfo.minPlayers}-${gameInfo.maxPlayers} players`}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>⏱️</Text>
              <Text style={styles.metaText}>~{gameInfo.estimatedDuration} min</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📊</Text>
              <Text style={styles.metaText}>{gameInfo.difficulty}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{gameInfo.fullDescription}</Text>
        </View>

        {/* Point Awards */}
        {renderPointAwards()}

        {/* Rules */}
        {renderRules()}

        {/* Categories */}
        {gameInfo.categories && gameInfo.categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.categoriesContainer}>
              {gameInfo.categories.map((category, index) => (
                <View key={index} style={styles.categoryTag}>
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Play Button */}
      <View style={[styles.footer]}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayNow}
          activeOpacity={0.8}>
          <LinearGradient
            colors={gradient || ['#6366f1', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.playButtonGradient}>
            <Text style={styles.playButtonText}>Play Now</Text>
            <Text style={styles.playButtonSubtext}>
              Entry: {gameInfo.entryCost || 50} points
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  header: {
    borderRadius:12,
  },
  backButtonHeader: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '600',
  },
  headerContent: {
    alignItems: 'center',
    marginVertical:20,
    justifyContent:'center'
  },
  gameIconLarge: {
    fontSize: 80,
    marginBottom: 12,
  },
  gameTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  gameSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  gameMetaRow: {
    flexDirection: 'row',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIcon: {
    fontSize: 16,
  },
  metaText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  entryCostCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginBottom: 16,
  },
  entryCostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryCostLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  entryCostValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ef4444',
  },
  entryCostDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
  },
  monetaryCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  prizeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  prizesGrid: {
    gap: 16,
  },
  prizeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  prizeIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  prizeTextContainer: {
    flex: 1,
  },
  prizeLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  prizeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  prizeSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    fontStyle: 'italic',
  },
  monetaryDescription: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
    fontWeight: '500',
  },
  examplesContainer: {
    gap: 8,
  },
  examplesTitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  exampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  exampleScenario: {
    fontSize: 15,
    color: colors.text.primary,
    flex: 1,
  },
  examplePoints: {
    fontSize: 16,
    fontWeight: '700',
  },
  pointsPositive: {
    color: '#10b981',
  },
  pointsNegative: {
    color: '#ef4444',
  },
  modeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  pointsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  pointItem: {
    flex: 1,
    alignItems: 'center',
  },
  pointLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  pointValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  rulesCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
  },
  rulesH1: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  rulesH2: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
    marginBottom: 6,
  },
  rulesBullet: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginLeft: 8,
    marginBottom: 4,
  },
  rulesText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryTag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: 'rgba(15, 15, 35, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    height:100,
    justifyContent:'center'
  },
  playButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  playButtonGradient: {
    paddingVertical: 20,
    minHeight:100,
    borderRadius:12,
    alignItems: 'center',
  },
  playButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playButtonSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default GameInfoScreen;
