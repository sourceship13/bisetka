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
import {useAuth} from '../context/AuthContext';
import AuthService from '../services/AuthService';

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.content}>
          <Text style={styles.title}>Bisetka</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />
          </View>

          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {AuthService.isAppleAuthAvailable() && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.appleButton}
                onPress={handleAppleSignIn}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.appleButtonIcon}></Text>
                    <Text style={styles.appleButtonText}>
                      Sign in with Apple
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.forgotPassword}>
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
                      style={styles.devUserButton}
                      onPress={() => fillDevCredentials(user.email)}>
                      <Text style={styles.devUserName}>{user.name}</Text>
                      <Text style={styles.devUserEmail}>{user.email}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  appleButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  appleButtonIcon: {
    fontSize: 20,
    color: '#fff',
    marginRight: 8,
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 14,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    color: '#666',
    fontSize: 14,
  },
  signupLink: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // DEV MODE STYLES
  devSection: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  devToggle: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  devToggleText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '600',
  },
  devUserList: {
    marginTop: 12,
    maxHeight: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
  },
  devHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  devPassword: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#e9ecef',
    color: '#495057',
  },
  devUserButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  devUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
  },
  devUserEmail: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
});

export default LoginScreen;
