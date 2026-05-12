import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { useAuth } from '../../../libs/hooks/useAuth';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import apiConfig from '../../../libs/utils/api.utils';
import tokenService from '../../../services/token.service';
import { apiService } from '../../../services/api.service';
import bisetkaService, { Bisetka } from '../../../services/bisetka.service';
import { gameSessionsService } from '../../../services/gameSessions.service';

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

type GameMode = 'random' | 'ai' | 'private';
type TeamMode = 'hybrid' | 'full-multiplayer';

const TEAM_MODE_OPTIONS: Array<{
  id: TeamMode;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'hybrid',
    title: '1 Player + AI vs 1 Player + AI',
    subtitle: 'You + AI partner vs Opponent + AI partner',
  },
  {
    id: 'full-multiplayer',
    title: '2 Players vs 2 Players',
    subtitle: 'Full multiplayer — 4 human players in teams',
  },
];

const GAME_MODE_OPTIONS: Array<{
  id: GameMode;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'random',
    title: 'Random Match',
    subtitle: 'Find an opponent online',
  },
  {
    id: 'ai',
    title: 'Play vs AI',
    subtitle: 'Sharpen skills agains a computer',
  },
  {
    id: 'private',
    title: 'Private Mode',
    subtitle: 'Create your game or join a custom room',
  },
];

const GameInfoScreen: React.FC<Props> = ({ route, navigation }) => {
  const { gameType, gradient, bisetkaId, bisetkaName, preferredMode } = route.params;
  const { user } = useAuth();
  const [gameInfo, setGameInfo] = useState<GameInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRulesDetailed, setShowRulesDetailed] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>(preferredMode ?? 'ai');
  const isTeamGame = gameType === 'blot' || gameType === 'baazar-blot';
  const [selectedTeamMode, setSelectedTeamMode] = useState<TeamMode>('hybrid');
  const [bisetka, setBisetka] = useState<Bisetka | null>(null);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  useEffect(() => {
    fetchGameInfo();
    loadBisetka();
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
      if (!response.ok) throw new Error(`Failed to fetch game info`);
      const result = await response.json();
      if (result.success && result.data) setGameInfo(result.data);
      else throw new Error('Invalid response format');
    } catch (err: any) {
      setError(err.message || 'Failed to load game info');
    } finally {
      setLoading(false);
    }
  };

  const loadBisetka = async () => {
    try {
      const myBisetka = await bisetkaService.getMyBisetka();
      if (myBisetka) {
        setBisetka(myBisetka);
        return;
      }
      if (user?.bisetka) {
        setBisetka({
          id: user.bisetka.id,
          neighborhood_id: user.bisetka.id,
          neighborhood_name: user.bisetka.neighborhood,
          city: user.bisetka.city,
          country: user.bisetka.country,
          active_users: user.bisetka.active_users || 0,
          created_at: '',
          updated_at: '',
        });
      }
    } catch {
      /* non-fatal */
    }
  };

  // Pull win/draw/loss values from the configured prize structure (if any).
  const prizes = useMemo(() => {
    const result = { win: 0, draw: 0, loss: 0 };
    const modes = gameInfo?.pointAwards?.modes;
    if (!modes) return result;
    const firstKey = Object.keys(modes)[0];
    if (!firstKey) return result;
    const m = modes[firstKey];
    result.win = typeof m.win === 'number' ? m.win : 0;
    result.draw = typeof m.draw === 'number' ? m.draw : 0;
    result.loss = typeof m.loss === 'number' ? m.loss : 0;
    return result;
  }, [gameInfo]);

  const entryCost =
    gameInfo?.pointAwards?.entryCost || gameInfo?.entryCost || 50;

  const handlePlayNow = async () => {
    if (!gameInfo) return;
    const skipCheck = gameType === 'slots' || gameType === 'blackjack';

    if (!skipCheck) {
      try {
        setCheckingBalance(true);
        const fresh: any = await apiService.getProfile();
        const balance = Math.floor(fresh?.balance || 0);
        if (balance < entryCost) {
          setLiveBalance(balance);
          setShowPointsModal(true);
          return;
        }
      } catch {
        const cached = Math.floor((user as any)?.balance || 0);
        if (cached < entryCost) {
          setLiveBalance(cached);
          setShowPointsModal(true);
          return;
        }
      } finally {
        setCheckingBalance(false);
      }
    }

    if (skipCheck) {
      navigation.navigate(
        (gameType.charAt(0).toUpperCase() + gameType.slice(1)) as any,
        { bisetkaId, bisetkaName },
      );
      return;
    }

    // Blot / Baazar Blot already collected mode + team mode on this screen.
    // Skip GameModeScreen entirely and route directly — going through GameMode
    // adds an extra mount/unmount cycle that has been known to crash Fabric's
    // native view recycling on some devices.
    if (isTeamGame) {
      const userId = user?.id || 'guest';
      if (selectedMode === 'ai') {
        // Single-player blot vs AI — no server session needed.
        const target = gameType === 'baazar-blot' ? 'BaazarBlot' : 'Blot';
        navigation.navigate(target as any);
        return;
      }
      // Random / private → multiplayer screen, which manages the socket flow.
      const target =
        gameType === 'baazar-blot' ? 'MultiplayerBaazarBlot' : 'MultiplayerBlot';
      navigation.navigate(target as any, {
        userId,
        mode: selectedMode === 'private' ? 'private-create' : 'random',
        difficulty: 'medium',
        teamMode: selectedTeamMode,
      });
      return;
    }

    // Billiards / 8-ball / 9-ball — bypass GameModeScreen for the same reason
    // as blot. Going through GameMode does a navigation.reset which causes
    // Fabric's RCTComponentViewRegistry to throw "Attempt to recycle a mounted
    // view" on iOS. We create the session directly here and navigate straight
    // to BilliardsGame.
    const isBilliards =
      gameType === 'billiards' || gameType === '8-ball' || gameType === '9-ball';
    if (isBilliards) {
      try {
        let session: any;
        if (selectedMode === 'ai') {
          session = await gameSessionsService.createAiMatch(
            gameType as any,
            'medium',
            false,
          );
        } else if (selectedMode === 'private') {
          session = await gameSessionsService.createPrivateMatch(
            gameType as any,
          );
        } else {
          session = await gameSessionsService.createRandomMatch(
            gameType as any,
          );
        }
        navigation.navigate('BilliardsGame' as any, {
          session: {
            ...session,
            gameType,
            mode: selectedMode === 'private' ? 'private-create' : selectedMode,
            difficulty: session?.difficulty || 'medium',
          },
        });
      } catch (err: any) {
        BisetkaAlert.error(
          'Unable to start game',
          err?.message || 'Please try again.',
        );
      }
      return;
    }

    navigation.navigate('GameMode', {
      gameType: gameType as any,
      bisetkaId,
      bisetkaName,
      preferredMode: selectedMode,
      teamMode: isTeamGame ? selectedTeamMode : undefined,
    } as any);
  };

  const cityCountry = bisetka
    ? `${bisetka.city}, ${bisetka.country}`
    : bisetkaName || 'Unknown location';

  // Secondary info line — adapt per game while still being meaningful for all.
  const secondaryLine = useMemo(() => {
    if (!gameInfo) return '';
    const playersStr = `${bisetka?.active_users || 0} players`;
    const meta: string[] = [];
    if (gameType === 'nardi' || gameType === 'checkers') {
      meta.push(`${gameInfo.maxPlayers} kings`);
    } else if (gameType === 'chess') {
      meta.push('classic rules');
    } else if (gameInfo.categories?.length) {
      meta.push(gameInfo.categories[0]);
    } else {
      meta.push(`~${gameInfo.estimatedDuration} min`);
    }
    return `${playersStr}  •  ${meta[0]}`;
  }, [gameInfo, bisetka, gameType]);

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7c4dff" />
            <Text style={styles.loadingText}>Loading game info...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !gameInfo) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.centerContainer}>
            <Text style={{ fontSize: 48 }}>⚠️</Text>
            <Text style={styles.errorText}>{error || 'Game not found'}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={fetchGameInfo}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Header card */}
          <View style={styles.topHeader}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              activeOpacity={0.7}>
              <Icon name="chevron-left" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.topHeaderTitle}>{gameInfo.displayName}</Text>
            <View style={styles.topHeaderRight}>
              <TouchableOpacity
                onPress={() => navigation.navigate('PointsShop')}
                activeOpacity={0.85}>
                <View style={styles.pointsPill}>
                  <Text style={styles.pointsCoin}>🪙</Text>
                  <Text style={styles.pointsAmount}>
                    {Math.floor(user?.balance || 0).toLocaleString()}
                  </Text>
                  <View style={styles.pointsPlus}>
                    <Icon name="plus" size={11} color="#fff" />
                    <Text style={styles.pointsPlusText}>Get Points</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('GlobalView', { userId: user?.id })
                }
                style={styles.globeBtn}
                activeOpacity={0.85}>
                <Icon name="earth" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Location row */}
          <View style={styles.locationRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.locationLine}>
                <Icon name="map-marker" size={20} color="#fff" />
                <Text style={styles.locationText}>{cityCountry}</Text>
              </View>
              <Text style={styles.locationSubtext}>{secondaryLine}</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Travel')}
              activeOpacity={0.7}>
              <Text style={styles.changeLocation}>Change Location</Text>
            </TouchableOpacity>
          </View>

          {/* Rules Summary card */}
          <View style={styles.rulesCard}>
            <Text style={styles.cardTitle}>Rules Summary</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon name="account-multiple" size={20} color="#fff" />
                <Text style={styles.metaText}>
                  {gameInfo.minPlayers === gameInfo.maxPlayers
                    ? `${gameInfo.minPlayers} players`
                    : `${gameInfo.minPlayers}-${gameInfo.maxPlayers} players`}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Icon name="clock-outline" size={20} color="#fff" />
                <Text style={styles.metaText}>
                  ~{gameInfo.estimatedDuration} min
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Icon name="signal-cellular-2" size={20} color="#fff" />
                <Text style={styles.metaText}>{gameInfo.difficulty}</Text>
              </View>
            </View>
            <Text style={styles.rulesSummaryText}>
              {gameInfo.shortDescription || gameInfo.fullDescription}
            </Text>
            <TouchableOpacity
              onPress={() => setShowRulesDetailed(prev => !prev)}
              activeOpacity={0.7}
              style={styles.detailedRulesRow}>
              <Text style={styles.detailedRulesText}>Detailed Rules</Text>
              <Icon
                name={showRulesDetailed ? 'chevron-up' : 'chevron-down'}
                size={22}
                color="#a78bfa"
              />
            </TouchableOpacity>
            {showRulesDetailed && !!gameInfo.rules && (
              <View style={styles.detailedRulesBody}>
                {gameInfo.rules.split('\n').map((line, idx) => {
                  if (!line.trim()) return null;
                  if (line.startsWith('# ')) {
                    return (
                      <Text key={idx} style={styles.rulesH1}>
                        {line.replace('# ', '')}
                      </Text>
                    );
                  }
                  if (line.startsWith('## ')) {
                    return (
                      <Text key={idx} style={styles.rulesH2}>
                        {line.replace('## ', '')}
                      </Text>
                    );
                  }
                  if (line.startsWith('- ')) {
                    return (
                      <Text key={idx} style={styles.rulesBullet}>
                        • {line.replace('- ', '')}
                      </Text>
                    );
                  }
                  return (
                    <Text key={idx} style={styles.rulesBody}>
                      {line}
                    </Text>
                  );
                })}
              </View>
            )}
          </View>

          {/* Prize Structure */}
          <Text style={styles.sectionHeading}>Prize Structure</Text>
          <View style={styles.prizesRow}>
            <PrizeCard
              title="WIN"
              icon="🥇"
              points={prizes.win}
              color="#22c55e"
              showSign
            />
            <PrizeCard
              title="Draw"
              icon="🤝"
              points={prizes.draw}
              color="#fbbf24"
              showSign
            />
            <PrizeCard
              title="Loss"
              icon="🤝"
              points={prizes.loss}
              color="#ef4444"
              showSign={prizes.loss !== 0}
            />
          </View>

          {/* Team mode selection (Blot / Baazar Blot only) */}
          {isTeamGame && (
            <>
              <Text style={[styles.sectionHeading, styles.sectionHeadingCenter]}>
                Select Team Mode:
              </Text>
              <View style={{ paddingHorizontal: 16, gap: 12 }}>
                {TEAM_MODE_OPTIONS.map(opt => {
                  const active = selectedTeamMode === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => setSelectedTeamMode(opt.id)}
                      activeOpacity={0.85}
                      style={[
                        styles.modeRow,
                        active && styles.modeRowActive,
                      ]}>
                      <View
                        style={[
                          styles.radioOuter,
                          active && styles.radioOuterActive,
                        ]}>
                        {active && <View style={styles.radioInner} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modeTitle}>{opt.title}</Text>
                        <Text style={styles.modeSubtitle}>{opt.subtitle}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Mode selection */}
          <Text style={[styles.sectionHeading, styles.sectionHeadingCenter]}>
            Select Game Mode:
          </Text>
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {GAME_MODE_OPTIONS.filter(opt => gameType === 'blackjack' ? opt.id === 'ai' : true).map(opt => {
              const active = selectedMode === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setSelectedMode(opt.id)}
                  activeOpacity={0.85}
                  style={[
                    styles.modeRow,
                    active && styles.modeRowActive,
                  ]}>
                  <View
                    style={[
                      styles.radioOuter,
                      active && styles.radioOuterActive,
                    ]}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modeTitle}>{opt.title}</Text>
                    <Text style={styles.modeSubtitle}>{opt.subtitle}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Play Now footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handlePlayNow}
            disabled={checkingBalance}
            activeOpacity={0.85}
            style={styles.playBtnWrap}>
            <LinearGradient
              colors={['#fbbf24', '#f59e0b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playBtn}>
              {checkingBalance ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.playBtnText}>PLAY NOW</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Insufficient points modal */}
      <Modal
        visible={showPointsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPointsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>💰</Text>
            <Text style={styles.modalTitle}>Not Enough Points</Text>
            <Text style={styles.modalBody}>
              You need{' '}
              <Text style={styles.modalHighlight}>{entryCost} points</Text> to
              play {gameInfo.displayName}, but you only have{' '}
              <Text style={[styles.modalHighlight, { color: '#ef4444' }]}>
                {liveBalance ?? Math.floor((user as any)?.balance || 0)} points
              </Text>
              .
            </Text>
            <TouchableOpacity
              onPress={() => setShowPointsModal(false)}
              style={styles.modalDismiss}>
              <Text style={styles.modalDismissText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const PrizeCard: React.FC<{
  title: string;
  icon: string;
  points: number;
  color: string;
  showSign?: boolean;
}> = ({ title, icon, points, color, showSign }) => (
  <LinearGradient
    colors={['#7a6cf5', '#5b4ae0']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.prizeCard}>
    <Text style={styles.prizeIcon}>{icon}</Text>
    <Text style={styles.prizeLabel}>{title}</Text>
    <View style={styles.prizeValueRow}>
      <Text style={styles.prizeCoin}>🪙</Text>
      <Text style={[styles.prizeValue, { color }]}>
        {showSign && points > 0 ? '+ ' : showSign && points < 0 ? '- ' : ''}
        {Math.abs(points)}
      </Text>
    </View>
  </LinearGradient>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100828' },
  safeArea: { flex: 1 },
  scrollContent: { },

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
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f59e0b',
    marginLeft: 4,
    gap: 2,
  },
  pointsPlusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  globeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  /* Location row */
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  locationSubtext: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginTop: 6,
  },
  changeLocation: {
    color: '#fff',
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  /* Rules card */
  rulesCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 77, 255, 0.45)',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginBottom: 14,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rulesSummaryText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  detailedRulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailedRulesText: {
    color: '#a78bfa',
    fontSize: 16,
    fontWeight: '800',
  },
  detailedRulesBody: { marginTop: 12 },
  rulesH1: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 4,
  },
  rulesH2: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  rulesBullet: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 6,
  },
  rulesBody: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 20,
    marginVertical: 2,
  },

  /* Section heading */
  sectionHeading: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionHeadingCenter: {
    textAlign: 'center',
    marginHorizontal: 0,
  },

  /* Prizes */
  prizesRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  prizeCard: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'space-between',
  },
  prizeIcon: { fontSize: 38 },
  prizeLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    marginTop: 4,
  },
  prizeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  prizeCoin: { fontSize: 16 },
  prizeValue: { fontSize: 20, fontWeight: '900' },

  /* Modes */
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 77, 255, 0.35)',
    backgroundColor: 'transparent',
  },
  modeRowActive: {
    backgroundColor: 'rgba(40, 22, 96, 0.6)',
    borderColor: 'rgba(124, 77, 255, 0.65)',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#a78bfa',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#a78bfa',
  },
  modeTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },
  modeSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 40,
    backgroundColor: 'transparent',
  },
  playBtnWrap: {
    borderRadius: 999,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
    elevation: 12,
  },
  playBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    borderRadius: 999,
  },
  playBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 1.2,
  },

  /* Loading / error */
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: { color: '#fff', marginTop: 12 },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#7c4dff',
  },
  retryBtnText: { color: '#fff', fontWeight: '800' },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1a1240',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalIcon: { fontSize: 48 },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  modalBody: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  modalHighlight: { fontWeight: '800', color: '#fbbf24' },
  modalDismiss: {
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#7c4dff',
  },
  modalDismissText: { color: '#fff', fontWeight: '800' },
});

export default GameInfoScreen;
