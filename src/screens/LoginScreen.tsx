import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../context/AuthContext';
import AuthService from '../services/AuthService';
import {colors, spacing, typography} from '../theme';

// Dev test users - password is "test123" for all
const DEV_TEST_USERS = [
  {email: 'testuser1@test.com', name: 'Arin (Dev)', username: 'dev_arin'},
  {email: 'testuser2@test.com', name: 'Alpha Player', username: 'player_alpha'},
  {email: 'testuser3@test.com', name: 'Beta Tester', username: 'player_beta'},
  {email: 'testuser4@test.com', name: 'Card Shark', username: 'card_shark'},
  {email: 'testuser5@test.com', name: 'Pool Master', username: 'pool_master'},
  {email: 'testuser6@test.com', name: 'Chess Knight', username: 'chess_knight'},
  {email: 'testuser7@test.com', name: 'Nardi Pro', username: 'nardi_pro'},
  {email: 'testuser8@test.com', name: 'Blot King', username: 'blot_king'},
  {email: 'testuser9@test.com', name: 'Rookie', username: 'rookie_player'},
  {email: 'testuser10@test.com', name: 'Guest', username: 'guest_tester'},
];
const DEV_PASSWORD = 'test123';

const LoginScreen = ({navigation}: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDevUsers, setShowDevUsers] = useState(false);
  const {signInWithApple, signInWithEmail} = useAuth();

  // Quick fill dev credentials
  const fillDevCredentials = (userEmail: string) => {
    setEmail(userEmail);
    setPassword(DEV_PASSWORD);
    setShowDevUsers(false);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmail(email, password);
      // Navigation happens automatically when user state changes
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Please check your credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithApple();
      // Navigation happens automatically when user state changes
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary, colors.background.tertiary]}
      style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <View style={styles.content}>
            <View style={styles.headerSection}>
              <Text style={styles.logo}>🎮</Text>
              <Text style={styles.title}>Bisetka</Text>
              <Text style={styles.subtitle}>Armenian Gaming Platform</Text>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>📧 Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.input.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>🔒 Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.input.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              onPress={handleLogin}>
              <LinearGradient
                colors={colors.gradients.primary}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={[styles.loginButton, loading && styles.buttonDisabled]}>
                {loading ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

          {AuthService.isAppleAuthAvailable() && (
            <>
              <View style={styles.orContainer}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={loading}
                onPress={handleAppleSignIn}>
                <View style={styles.appleButton}>
                  <Text style={styles.appleButtonText}>🍎  Sign in with Apple</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.forgotPasswordContainer}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* DEV MODE: Quick login with test users */}
          {__DEV__ && (
            <View style={styles.devSection}>
              <TouchableOpacity
                style={styles.devToggle}
                onPress={() => setShowDevUsers(!showDevUsers)}>
                <Text style={styles.devToggleText}>
                  🧪 {showDevUsers ? 'Hide' : 'Show'} Dev Test Users
                </Text>
              </TouchableOpacity>

              {showDevUsers && (
                <ScrollView style={styles.devUserList} nestedScrollEnabled>
                  <Text style={styles.devHint}>
                    Password for all: <Text style={styles.devPassword}>{DEV_PASSWORD}</Text>
                  </Text>
                  {DEV_TEST_USERS.map((user, idx) => (
                    <TouchableOpacity
                      key={user.email}
                      activeOpacity={0.85}
                      onPress={() => fillDevCredentials(user.email)}>
                      <LinearGradient
                        colors={colors.gradients.secondary}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 0}}
                        style={styles.devUserButton}>
                        <Text style={styles.devUserName}>{user.name}</Text>
                        <Text style={styles.devUserEmail}>{user.email}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.huge,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing.xl,
  },
  inputWrapper: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.input.background,
    borderRadius: 12,
    padding: spacing.lg,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.input.border,
  },
  loginButton: {
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.secondary,
  },
  orText: {
    marginHorizontal: spacing.lg,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  appleButton: {
    backgroundColor: colors.button.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  appleButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  forgotPasswordText: {
    color: colors.accent,
    fontSize: typography.fontSize.sm,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.md
  },
  signupLink: {
    color: colors.accent,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  // DEV MODE STYLES
  devSection: {
    marginTop: spacing.xxxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.secondary,
  },
  devToggle: {
    backgroundColor: colors.warning.light,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning.main,
  },
  devToggleText: {
    color: colors.warning.dark,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  devUserList: {
    marginTop: spacing.md,
    maxHeight: 200,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: spacing.sm,
  },
  devHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  devPassword: {
    fontWeight: typography.fontWeight.semibold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.text.primary,
  },
  devUserButton: {
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
  },
  devUserName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: '#000',
  },
  devUserEmail: {
    fontSize: typography.fontSize.md,
    color: '#000',
    marginTop: 2,
  },
});

export default LoginScreen;
