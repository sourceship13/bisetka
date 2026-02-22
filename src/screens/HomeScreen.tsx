import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../libs/hooks/useAuth';
import pushNotificationService from '../services/pushNotification.service';
import {iOSUIKit} from 'react-native-typography';
import {colors} from '../theme';
import packageJson from '../../package.json';

const {width} = Dimensions.get('window');
const CARD_WIDTH = (width - 42) / 2; // 2 columns with gap

// Game configurations with PushBird-style colors
const GAMES = [
  {
    id: 'blot',
    name: 'Blot',
    description: 'Classic card game',
    icon: '🃏',
    gradient: ['#6366f1', '#8b5cf6'],
    gameType: 'blot',
  },
  {
    id: 'baazar-blot',
    name: 'Baazar Blot',
    description: 'Fast variant',
    icon: '⚡',
    gradient: ['#ec4899', '#f472b6'],
    gameType: 'baazar-blot',
  },
  {
    id: 'poker',
    name: 'Poker',
    description: "Texas Hold'em",
    icon: '♠️',
    gradient: ['#10b981', '#34d399'],
    gameType: 'poker',
  },
  {
    id: 'chess',
    name: 'Chess',
    description: 'Strategy',
    icon: '♟️',
    gradient: ['#3b82f6', '#60a5fa'],
    gameType: 'chess',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    description: 'Quick matches',
    icon: '🔴',
    gradient: ['#f59e0b', '#fbbf24'],
    gameType: 'checkers',
  },
  {
    id: 'nardi',
    name: 'Nardi',
    description: 'Backgammon',
    icon: '🎲',
    gradient: ['#8b5cf6', '#a78bfa'],
    gameType: 'nardi',
  },
  {
    id: 'billiards',
    name: '8-Ball',
    description: 'Pool',
    icon: '🎱',
    gradient: ['#06b6d4', '#22d3ee'],
    gameType: 'billiards',
  },
  {
    id: '9-ball',
    name: '9-Ball',
    description: 'Race to 9',
    icon: '9️⃣',
    gradient: ['#f59e0b', '#fbbf24'],
    gameType: '9-ball',
  },
  {
    id: 'mrotsi',
    name: 'Mrotsi',
    description: 'Dice game',
    icon: '🎯',
    gradient: ['#14b8a6', '#2dd4bf'],
    gameType: 'mrotsi',
  },
  {
    id: 'slots',
    name: 'Slots',
    description: 'Arcade',
    icon: '🎰',
    gradient: ['#ef4444', '#f87171'],
    gameType: 'slots',
  },
] as const;

type GameConfig = (typeof GAMES)[number];

const HomeScreen = ({navigation}: any) => {
  const {user, signOut} = useAuth();

  // Ensure push permission is granted and the FCM token is registered.
  //
  // Race condition this prevents:
  //   1. App opens (already logged in) → silentInit fires but perm not yet granted → bails
  //   2. HomeScreen mounts → permission prompt → user taps Allow
  //   3. silentInit never re-runs (user object didn't change) → push_token stays NULL
  //
  // By always calling silentInit() at the end (after any prompt), we guarantee the
  // FCM token is sent to the backend even if the timing was off on login.
  useEffect(() => {
    const setupPush = async () => {
      const status = await pushNotificationService.checkPermission();

      if (status === 'undetermined' || status === 'denied') {
        // Give the UI a moment to settle before the system dialog appears
        await new Promise(resolve => setTimeout(resolve, 1500));
        await pushNotificationService.initialize();
      } else if (status === 'blocked') {
        // Previously denied — prompt user to enable manually in Settings
        Alert.alert(
          'Enable Notifications',
          'Turn on notifications in Settings to be notified when someone sends a message.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => pushNotificationService.openNotificationSettings(),
            },
          ],
        );
        // Still try silentInit in case they already enabled it in Settings
        // before opening the app this session.
      }

      // Always call silentInit regardless of the path above.
      // • If just granted above  → registers the FCM token now.
      // • If already granted     → re-registers / refreshes the token.
      // • If still blocked       → silentInit checks internally and returns early (no-op).
      await pushNotificationService.silentInit();
    };

    setupPush().catch(err =>
      console.warn('Push setup failed:', err)
    );
  }, []);

  const handleGamePress = (game: GameConfig) => {
    // Navigate to GameInfo screen first to show rules and points
    navigation.navigate('GameInfo', {
      gameType: game.gameType,
      gradient: game.gradient as unknown as string[],
    });
  };

  const renderGameCard = (game: GameConfig) => {
    const isComingSoon: boolean = 'comingSoon' in game && (game as any).comingSoon === true;

    return (
      <TouchableOpacity
        key={game.id}
        activeOpacity={0.85}
        disabled={isComingSoon}
        onPress={() => handleGamePress(game)}
        style={[styles.gameCardWrapper, isComingSoon && styles.cardDisabled]}>
        <LinearGradient
          colors={game.gradient as unknown as string[]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.gameCard}>
          <Text style={styles.gameIcon}>{game.icon}</Text>
          <Text style={styles.gameName}>{game.name}</Text>
          <Text style={styles.gameDescription}>{game.description}</Text>
          {isComingSoon && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Soon</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f23" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.header}>
          <View style={[styles.headerContent, {minHeight: 80  }]}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>
              {user?.username || 'Player'}! 👋
            </Text>
          </View>
          <TouchableOpacity onPress={() => signOut()} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Balance & Action Buttons */}
        <View style={styles.quickRow}>
          <View style={styles.balanceWrap}>
            <LinearGradient
              colors={['#10b981', '#34d399']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.balanceGrad}>
              <Text style={[styles.balanceLabel, iOSUIKit.bodyEmphasizedWhite]}>Points</Text>
              <Text style={styles.balanceAmount}>
                🏆 {(user as any)?.totalPoints?.toLocaleString() || '0'}
              </Text>
            </LinearGradient>
          </View>
          
          <View style={styles.actionBtns}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('GlobalChat')}
              style={styles.actionBtn}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.actionGrad}>
                <Text style={styles.actionIcon}>🌍</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => navigation.navigate('DMList')}
              style={styles.actionBtn}>
              <LinearGradient
                colors={['#ec4899', '#f472b6']}
                style={styles.actionGrad}>
                <Text style={styles.actionIcon}>💬</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => navigation.navigate('Leaderboard')}
              style={styles.actionBtn}>
              <LinearGradient
                colors={['#f59e0b', '#fbbf24']}
                style={styles.actionGrad}>
                <Text style={styles.actionIcon}>🏆</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => navigation.navigate('ChatRoomsList')}
              style={styles.actionBtn}>
              <LinearGradient
                colors={['#14b8a6', '#2dd4bf']}
                style={styles.actionGrad}>
                <Text style={styles.actionIcon}>🏠</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>🎮 Choose a Game</Text>
          <Text style={styles.sectionSub}>Pick your game</Text>
        </View>

        {/* Games Grid */}
        <View style={styles.gamesGrid}>
          {GAMES.map(game => renderGameCard(game))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>🇦🇲 Bisetka</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flex: 1,
    marginRight: 8,
  },
  welcomeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight:26,
    borderRadius: 14,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  quickRow: {
    marginHorizontal: 16,
    marginTop: 0,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  balanceWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceGrad: {
    flex:1,
    borderRadius: 14,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
    marginLeft:16
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',    
    color: '#fff',
    marginLeft:20
  },
  actionBtns: {
    flex: 1.5,
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  actionGrad: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 28,
  },
  sectionHead: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  sectionSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  gameCardWrapper: {
    width: CARD_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  gameCard: {
    padding: 2,
    minHeight: 130,
    justifyContent: 'center',

  },
  gameIcon: {
    fontSize: 36,
    marginBottom: 8,
    textAlign: 'center',
  },
  gameName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 3,
    margin:10,
    textAlign: 'center',
  },
  gameDescription: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    marginHorizontal:10
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
});

export default HomeScreen;
