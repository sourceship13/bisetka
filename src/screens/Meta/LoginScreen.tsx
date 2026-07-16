/**
 * LoginScreen
 *
 * Marketing-style sign-in screen: full-bleed Bisetka city background, framed
 * logo, tagline, and white pill buttons for Apple + Google. Email/password
 * sign-in is hidden in production; in __DEV__ a small toggle exposes the
 * test-user list so QA can sign in as any of the seeded accounts.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LogoWhite from '../../../assets/logo/logo-white.svg';
import { BisetkaAlert } from '../../utils/BisetkaAlert';
import { useAuth } from '../../libs/hooks/useAuth';
import AuthService from '../../services/AuthService';
import { useI18n } from '../../hooks/useI18n';

const BG = require('../../../assets/backgrounds/bisetka.png');

// Dev test users — password is "test123" for all. Only shown in __DEV__.
const DEV_TEST_USERS = [
  { email: 'testuser1@test.com',  name: 'Arin (Dev)' },
  { email: 'testuser2@test.com',  name: 'Alpha Player' },
  { email: 'testuser3@test.com',  name: 'Beta Tester' },
  { email: 'testuser4@test.com',  name: 'Card Shark' },
  { email: 'testuser5@test.com',  name: 'Pool Master' },
  { email: 'testuser6@test.com',  name: 'Chess Knight' },
  { email: 'testuser7@test.com',  name: 'Nardi Pro' },
  { email: 'testuser8@test.com',  name: 'Blot King' },
  { email: 'testuser9@test.com',  name: 'Rookie' },
  { email: 'testuser10@test.com', name: 'Guest' },
];
const DEV_PASSWORD = 'test123';

const LoginScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [showDevUsers, setShowDevUsers] = useState(false);
  const { signInWithApple, signInWithGoogle, signInWithEmail } = useAuth();
  const { translate } = useI18n();

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithApple();
    } catch (error: any) {
      BisetkaAlert.error(translate('common.error'), error?.message ?? translate('auth.signInWithApple'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error: any) {
      BisetkaAlert.error(translate('common.error'), error?.message ?? translate('auth.signInWithGoogle'));
    } finally {
      setLoading(false);
    }
  };

  const devLogin = async (email: string) => {
    try {
      setShowDevUsers(false);
      setLoading(true);
      await signInWithEmail(email, DEV_PASSWORD);
    } catch (error: any) {
      BisetkaAlert.error(translate('common.error'), error?.message ?? 'Dev login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      {/* Subtle vertical wash so the buttons + footer stay legible against the
          bright sunset clouds and the darker pavement at the bottom. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.20)', 'rgba(0,0,0,0.75)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.center}>
          <LogoWhite width={240} height={110} style={styles.logo} />
          <Text style={styles.tagline}>{translate('onboarding.welcome')}</Text>

          {AuthService.isAppleAuthAvailable() && (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              onPress={handleAppleSignIn}
              style={[styles.pillButton, loading && styles.disabled]}>
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Icon name="apple" size={22} color="#000" style={styles.pillIcon} />
                  <Text style={styles.pillText}>{translate('auth.signInWithApple')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={loading}
            onPress={handleGoogleSignIn}
            style={[styles.pillButton, loading && styles.disabled]}>
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Icon name="google" size={20} color="#4285F4" style={styles.pillIcon} />
                <Text style={[styles.pillText, styles.pillTextMuted]}>{translate('auth.signInWithGoogle')}</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.tos}>
            By continuing, you agree to our{' '}
            <Text style={styles.tosLink}>{translate('settings.terms')}</Text> and{' '}
            <Text style={styles.tosLink}>{translate('settings.privacy_policy')}</Text>.
          </Text>
        </View>

        {/* {__DEV__ && (
          <View style={styles.devSection}>
            <TouchableOpacity onPress={() => setShowDevUsers(s => !s)}>
              <Text style={styles.devToggle}>
                🧪 {showDevUsers ? translate('common.close') : 'Dev'} test users
              </Text>
            </TouchableOpacity>
            {showDevUsers && (
              <ScrollView style={styles.devList} nestedScrollEnabled>
                {DEV_TEST_USERS.map(u => (
                  <TouchableOpacity
                    key={u.email}
                    style={styles.devRow}
                    onPress={() => devLogin(u.email)}>
                    <Text style={styles.devName}>{u.name}</Text>
                    <Text style={styles.devEmail}>{u.email}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )} */}
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1, paddingHorizontal: 24 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 240,
    height: 110,
    marginBottom: 18,
  },
  tagline: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 36,
    letterSpacing: 0.2,
  },
  pillButton: {
    width: '100%',
    maxWidth: 360,
    height: 54,
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pillIcon: { marginRight: 10 },
  pillText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  pillTextMuted: { color: '#3c4043' },
  disabled: { opacity: 0.6 },
  tos: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    fontWeight: '600',
  },
  tosLink: { textDecorationLine: 'underline' },
  // DEV
  devSection: { paddingBottom: 8 },
  devToggle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 6,
  },
  devList: { maxHeight: 180, marginTop: 4 },
  devRow: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  devName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  devEmail: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
});

export default LoginScreen;
