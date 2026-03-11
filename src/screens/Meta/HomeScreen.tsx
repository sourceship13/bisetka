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
} from 'react-native';
import { BisetkaAlert } from '../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../libs/hooks/useAuth';
import apiService from '../../services/api.service';
import pushNotificationService from '../../services/pushNotification.service';
import { iOSUIKit } from 'react-native-typography';
import { colors } from '../../theme';
import packageJson from '../../../package.json';
import { useNavigation, DrawerActions } from '@react-navigation/native';

const bisetkaBackground = require('../../../assets/backgrounds/bisetka.png');

const HomeScreen = ({ navigation }: any) => {
  const { user, signOut, refreshUser } = useAuth();
  const drawerNav = useNavigation();

  // Refresh profile data and upsert device info every time HomeScreen mounts
  useEffect(() => {
    refreshUser().catch(err => console.warn('Profile refresh failed:', err));

    apiService
      .upsertDeviceData()
      .catch(err => console.warn('Device data upsert failed:', err));
  }, []);

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
        BisetkaAlert.alert(
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

    setupPush().catch(err => console.warn('Push setup failed:', err));
  }, []);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={bisetkaBackground}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <LinearGradient
              // colors={['#6366f1', '#8b5cf6']}
              colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.9)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.header}
            >
              <TouchableOpacity
                onPress={() => drawerNav.dispatch(DrawerActions.openDrawer())}
                style={styles.hamburgerBtn}
              >
                <Text style={styles.hamburgerText}>☰</Text>
              </TouchableOpacity>
              <View style={[styles.headerContent, { minHeight: 80 }]}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>
                  {user?.username || 'Player'}! 👋
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => signOut()}
                style={styles.logoutBtn}
              >
                <Text style={styles.logoutText}>Log Out</Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* Balance & Action Buttons */}
            <View style={styles.quickRow}>
              <View style={styles.balanceWrap}>
                <LinearGradient
                  // colors={['#10b981', '#34d399']}
                  colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.9)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.balanceGrad}
                >
                  <Text
                    style={[styles.balanceLabel, iOSUIKit.bodyEmphasizedWhite]}
                  >
                    Points
                  </Text>
                  <Text style={styles.balanceAmount}>
                    🏆 {(user as any)?.totalPoints?.toLocaleString() || '0'}
                  </Text>
                </LinearGradient>
              </View>

              <View style={styles.actionBtns}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('GlobalChat')}
                  style={styles.actionBtn}
                >
                  <LinearGradient
                    // colors={['#6366f1', '#8b5cf6']}
                    colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.9)']}
                    style={styles.actionGrad}
                  >
                    <Text style={styles.actionIcon}>🌍</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('DMList')}
                  style={styles.actionBtn}
                >
                  <LinearGradient
                    // colors={['#ec4899', '#f472b6']}
                    colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.9)']}
                    style={styles.actionGrad}
                  >
                    <Text style={styles.actionIcon}>💬</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('Leaderboard')}
                  style={styles.actionBtn}
                >
                  <LinearGradient
                    colors={['#f59e0b', '#fbbf24']}
                    style={styles.actionGrad}
                  >
                    <Text style={styles.actionIcon}>🏆</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('ChatRoomsList')}
                  style={styles.actionBtn}
                >
                  <LinearGradient
                    colors={['#14b8a6', '#2dd4bf']}
                    style={styles.actionGrad}
                  >
                    <Text style={styles.actionIcon}>🏠</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Active Rooms Button */}
            <View style={styles.activeRoomsContainer}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ActiveRooms')}
                style={styles.activeRoomsButton}
                activeOpacity={0.85}
              >
                <View
                  style={styles.activeRoomsGradient}
                >
                  {/* <View style={[styles.activeRoomsContent]}> */}
                  {/* <View style={styles.activeRoomsLeft}>
                  <Text style={styles.activeRoomsIcon}>🎮</Text>
                </View> */}
                  <View style={{ flex: 1, padding: 10 }}>
                    <Text style={styles.activeRoomsTitle}>Active Rooms</Text>
                    <Text style={styles.activeRoomsSubtitle}>
                      Watch or join multiplayer games
                    </Text>
                  </View>
                  <Text style={styles.activeRoomsArrow}>→</Text>
                  {/* </View> */}
</View>
              </TouchableOpacity>
            </View>

            {/* Section Title */}
            <TouchableOpacity
              onPress={() => navigation.navigate('GameSelection')}
              activeOpacity={0.85}
              style={styles.sectionHeadWrapper}
            >
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadContent}>
                  <Text style={styles.sectionTitle}>🎮 Choose a Game</Text>
                  <Text style={styles.sectionSub}>Pick your game</Text>
                </View>
                <Text style={styles.sectionArrow}>→</Text>
              </View>
            </TouchableOpacity>

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
    marginRight: 26,
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
    alignItems: 'center',
  },
  balanceWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceGrad: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
    marginLeft: 16,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    color: '#fff',
    marginLeft: 20,
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
    shadowOffset: { width: 0, height: 3 },
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
  activeRoomsButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  activeRoomsGradient: {
    paddingVertical: 0,
    paddingHorizontal: 0,
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
  sectionArrow: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
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
});

export default HomeScreen;
