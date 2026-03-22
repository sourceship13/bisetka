import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
  Platform,
  ImageBackground,
  Image,
} from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../../../libs/hooks/useAuth';
import apiService from '../../../services/api.service';
import pushNotificationService from '../../../services/pushNotification.service';
import {iOSUIKit} from 'react-native-typography';
import {colors} from '../../../theme';
import packageJson from '../../../../package.json';
import {useNavigation, DrawerActions, useFocusEffect} from '@react-navigation/native';
import OnlinePlayersList from '../../../components/OnlinePlayersList';
import AVATARS, {resolveAvatar} from '../../../utils/avatars';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { socketService } from '../../../services/SocketService';
import tokenService from '../../../services/token.service';
import useBisetkaLocation from '../../../hooks/useBisetkaLocation';

const bisetkaBackground = require('../../../../assets/backgrounds/bisetka.png');

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
    id: 'checkers',
    name: 'Checkers',
    description: 'Quick matches',
    icon: '🔴',
    gradient: ['#f59e0b', '#fbbf24'],
    gameType: 'checkers',
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
    id: 'poker',
    name: 'Poker',
    description: "Texas Hold'em",
    icon: '♠️',
    gradient: ['#10b981', '#34d399'],
    gameType: 'poker',
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
  const {user, signOut, refreshUser} = useAuth();
  const drawerNav = useNavigation();

  // Auto-connect to local Bisetka based on GPS location
  const {
    location,
    neighborhood,
    bisetka,
    loading: bisetkaLoading,
    error: bisetkaError,
    refreshLocation,
  } = useBisetkaLocation();

  // Log Bisetka connection
  useEffect(() => {
    if (bisetka) {
      console.log(`🏘️ Connected to Bisetka: ${bisetka.neighborhood_name}, ${bisetka.city} (${bisetka.active_users} active users)`);
    }
    if (bisetkaError) {
      console.warn('⚠️ Bisetka connection error:', bisetkaError);
    }
  }, [bisetka, bisetkaError]);

  // Refresh profile data and upsert device info every time HomeScreen mounts
  useEffect(() => {
    refreshUser().catch(err =>
      console.warn('Profile refresh failed:', err)
    );

    apiService.upsertDeviceData().catch(err =>
      console.warn('Device data upsert failed:', err)
    );
  }, []);

  // Refresh user data every time screen gains focus (e.g., returning from a game)
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 HomeScreen gained focus - refreshing user data');
      refreshUser().catch(err =>
        console.warn('Focus refresh failed:', err)
      );
    }, [refreshUser])
  );

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
        await new Promise<void>(resolve => setTimeout(resolve, 1500));
        await pushNotificationService.initialize();
      } else if (status === 'blocked') {
        // Previously denied — prompt user to enable manually in Settings
        BisetkaAlert.alert(
          'Enable Notifications',
          'Turn on notifications in Settings to be notified when someone sends a message.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: async () => {
                await pushNotificationService.openNotificationSettings();
              },
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

  // Connect to Socket.IO for presence tracking
  useEffect(() => {
    if (!user?.id) return;

    const connectSocket = async () => {
      try {
        const token = await tokenService.getAccessToken() || 'temp-token';
        if (!socketService.isConnected()) {
          await socketService.connect(user.id, token);
          console.log('✅ Socket connected for presence tracking');
        }
      } catch (error) {
        console.warn('Failed to connect socket for presence:', error);
      }
    };

    connectSocket();

    // Heartbeat: Update presence every 1 minute to stay online
    const heartbeat = setInterval(() => {
      if (socketService.isConnected()) {
        socketService.getSocket()?.emit('presence_heartbeat', { userId: user.id });
      }
    }, 60 * 1000); // 1 minute

    return () => {
      clearInterval(heartbeat);
    };
    // Note: We don't disconnect on unmount because the socket should remain 
    // connected while the app is open to track online presence
  }, [user?.id]);

  const avatarSource = resolveAvatar(user?.avatar_url);

  const handleGamePress = (game: GameConfig) => {
    // Navigate to GameInfo screen first to show rules and points
    navigation.navigate('GameInfo', {
      gameType: game.gameType,
      gradient: game.gradient as unknown as string[],
    });
  };

  const handleNearestBisetkaPress = () => {
    if (bisetkaError) {
      refreshLocation();
      return;
    }

    // If we have a valid Bisetka connection, go directly to BisetkaDetail
    // Otherwise, show the GlobalView to explore all Bisetkas
    if (bisetka && neighborhood) {
      navigation.navigate('BisetkaDetail', {
        bisetkaId: bisetka.id,
        bisetkaName: bisetka.neighborhood_name,
        city: bisetka.city,
        country: neighborhood.country,
      });
    } else {
      navigation.navigate('GlobalView', { userId: user?.id });
    }
  };

  const renderNearestBisetkaCard = () => {
    const hasNearestBisetka = Boolean(bisetka && neighborhood);

    let title = 'Closest Bisetka';
    let subtitle = 'Checking which Bisetka you are physically closest to.';
    let metaText = location
      ? `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`
      : 'Using your device location';
    let pillText = 'Locating';
    let actionText = 'View Map';

    if (bisetkaLoading) {
      subtitle = 'Getting your location and matching you with the nearest neighborhood.';
    } else if (bisetkaError) {
      subtitle = bisetkaError;
      metaText = 'Tap to retry location lookup';
      pillText = 'Retry';
      actionText = 'Retry';
    } else if (hasNearestBisetka) {
      title = `${bisetka!.neighborhood_name}, ${bisetka!.city}`;
      subtitle = 'Tap to choose a game and start playing';
      metaText = `${neighborhood!.city}, ${neighborhood!.country}`;
      pillText = `${bisetka!.active_users} active`;
      actionText = '🎮 Play Games';
    }

    return (
      <View style={styles.closestBisetkaContainer}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleNearestBisetkaPress}
          style={styles.closestBisetkaButton}>
          <LinearGradient
            colors={
              hasNearestBisetka 
                ? ['rgba(0, 0 , 0, 0.75)', 'rgba(100, 92, 222, 0.65)']
                : ['rgba(0, 0, 0, 0.72)', 'rgba(18, 52, 46, 0.72)']
            }
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.closestBisetkaGradient}>
            <View style={styles.closestBisetkaIconWrap}>
              <Icon 
                name={hasNearestBisetka ? "controller-classic" : "map-marker-radius"} 
                size={hasNearestBisetka ? 32 : 26} 
                color="#ffffff" 
              />
            </View>

            <View style={styles.closestBisetkaContent}>
              <Text style={styles.closestBisetkaEyebrow}>Nearest To You</Text>
              <Text style={styles.closestBisetkaTitle}>{title}</Text>
              <Text style={styles.closestBisetkaSubtitle}>{subtitle}</Text>
              <Text style={styles.closestBisetkaMeta}>{metaText}</Text>
            </View>

            <View style={styles.closestBisetkaSide}>
              {pillText && (
                <View style={styles.closestBisetkaPill}>
                  <Text style={styles.closestBisetkaPillText}>{pillText}</Text>
                </View>
              )}
              <View style={styles.actionButton}>
                <Text style={styles.actionButtonText}>{actionText}</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
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
    <View style={styles.container}>
      <ImageBackground
        source={bisetkaBackground}
        style={styles.backgroundImage}
        resizeMode="cover">
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          // colors={['#6366f1', '#8b5cf6']}
          colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.6)']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.header}>
          <TouchableOpacity onPress={() => drawerNav.dispatch(DrawerActions.openDrawer())} style={styles.hamburgerBtn}>
            <Text style={styles.hamburgerText}>☰</Text>
          </TouchableOpacity>
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

        {/* Avatar + Action Buttons + Points */}
        <View style={styles.quickRow}>
          {/* Left 1/3 — Avatar */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.avatarCol}
            activeOpacity={0.85}>
            <Image
              source={avatarSource || AVATARS[0].source}
              style={styles.homeAvatarImg}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* Right 2/3 — buttons row + points row */}
          <View style={styles.rightCol}>
            {/* Row 1: 2 icon buttons */}
            <View style={styles.actionBtns}>
              <TouchableOpacity
                onPress={() => navigation.navigate('GlobalView', { userId: user?.id })}
                style={styles.actionBtn}>
                <LinearGradient
                  colors={['rgba(16, 185, 129, 0.7)', 'rgba(52, 211, 153, 0.7)']}
                  style={styles.actionGrad}>
                  <Icon name="earth" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('GlobalChat')}
                style={styles.actionBtn}>
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.6)']}
                  style={styles.actionGrad}>
                  <Icon name="forum" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('DMList')}
                style={styles.actionBtn}>
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.6)']}
                  style={styles.actionGrad}>
                  <Icon name="message" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('Leaderboard')}
                style={styles.actionBtn}>
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.6)']}
                  style={styles.actionGrad}>
                  <Icon name="trophy" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('ChatRoomsList')}
                style={styles.actionBtn}>
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.6)']}
                  style={styles.actionGrad}>
                  <Icon name="door-open" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Row 2: Points + Leaderboard + ChatRooms */}
            <View style={styles.bottomRow}>
              <LinearGradient
                colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.6)']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.balanceGrad}>
                <Text style={[styles.balanceLabel, iOSUIKit.bodyEmphasizedWhite]}>Points 🏆 </Text>
                <Text style={styles.balanceAmount}>
                  {Math.floor(user?.balance || 0).toLocaleString()}
                </Text>
              </LinearGradient>

              <TouchableOpacity
                onPress={() => navigation.navigate('Wardrobe')}
                style={styles.placeholderBtn}
                activeOpacity={0.85}>
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.6)']}
                  style={styles.actionGrad}>
                  <Icon name="hanger" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('ClothingStore')}
                style={styles.placeholderBtn}
                activeOpacity={0.85}>
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.6)']}
                  style={styles.actionGrad}>
                  <Icon name="shopping" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {renderNearestBisetkaCard()}

        {/* Active Rooms Button */}
        {/* <View style={styles.activeRoomsContainer}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ActiveRooms')}
            style={styles.activeRoomsButton}
            activeOpacity={0.85}>
            <LinearGradient
              // colors={['#ec4899', '#f472b6']}
                            colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.6)']}

              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeRoomsGradient}>
                <View style={{flex:1, padding:10,}}>
                    <Text style={styles.activeRoomsTitle}>Active Rooms</Text>
                    <Text style={styles.activeRoomsSubtitle}>
                      Watch or join multiplayer games
                    </Text>
                  </View>
                <Text style={styles.activeRoomsArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View> */}
        {/* Online Players */}
        <View style={styles.onlinePlayersContainer}>
          <View style={styles.onlinePlayersHeader}>
            <Text style={styles.onlinePlayersTitle}>🟢 Online Players</Text>
          </View>
          <OnlinePlayersList maxPlayers={20} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>🇦🇲 Bisetka</Text>
        </View>
      </ScrollView>
        </SafeAreaView>
      </ImageBackground>



    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
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
  hamburgerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: 10,
  },
  hamburgerText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '600',
  },
  quickRow: {
    marginHorizontal: 16,
    marginTop: 0,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  avatarCol: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeAvatarImg: {
    width: '100%',
    height: 120,
  },
  rightCol: {
    flex: 2,
    flexDirection: 'column',
    gap: 8,
  },
  balanceGrad: {
    flex: 2,
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
    flexDirection: 'row',
    gap: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 8,
  },
  placeholderBtn: {
    flex: 1,
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
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
  activeRoomsContainer: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  closestBisetkaContainer: {
    marginTop: 10,
  },
  closestBisetkaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
  },
  closestBisetkaGradient: {
    minHeight: 110,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closestBisetkaIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  closestBisetkaContent: {
    flex: 1,
    paddingRight: 10,
  },
  closestBisetkaEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 4,
  },
  closestBisetkaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  closestBisetkaSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.86)',
    marginTop: 4,
    lineHeight: 17,
  },
  closestBisetkaMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    marginTop: 6,
  },
  closestBisetkaSide: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 72,
  },
  closestBisetkaPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  closestBisetkaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  closestBisetkaArrow: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
  },
  actionButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  activeRoomsButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  activeRoomsGradient: {

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
    borderRadius: 16,
  },
  activeRoomsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeRoomsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  activeRoomsIcon: {
    fontSize: 32,
  },
  activeRoomsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',

  },
  activeRoomsSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  activeRoomsArrow: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
  },
  onlinePlayersContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  onlinePlayersHeader: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  onlinePlayersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  sectionHeadWrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionHead: {
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeadContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  sectionSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  sectionArrow: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
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
    marginTop: 0,
    marginBottom: 0,
    paddingBottom: 0,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
  avatarSection: {
    marginTop: 30,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  avatarButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  avatarButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  avatarButtonGradient: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  avatarButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  avatarButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

});

export default HomeScreen;
