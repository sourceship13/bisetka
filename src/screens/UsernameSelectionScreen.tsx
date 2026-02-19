import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import apiService from '../services/api.service';
import {colors, spacing, typography} from '../theme';
import {useAuth} from '../context/AuthContext';
import tokenService from '../services/token.service';

interface UsernameSelectionScreenProps {
  navigation: any;
}

const UsernameSelectionScreen: React.FC<UsernameSelectionScreenProps> = ({
  navigation,
}) => {
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const {user, setUser} = useAuth();

  // Debounced username check
  useEffect(() => {
    if (username.length < 3) {
      setAvailable(null);
      setMessage('');
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setChecking(true);
        const result = await apiService.checkUsername(username);
        setAvailable(result.available);
        setMessage(result.message);
      } catch (error) {
        console.error('Error checking username:', error);
        setMessage('Error checking availability');
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSubmit = async () => {
    if (!available) {
      Alert.alert('Invalid Username', message || 'Please choose an available username');
      return;
    }

    try {
      setSubmitting(true);
      console.log('🚀 Submitting username:', username);
      const response = await apiService.updateUsername(username);
      console.log('✅ Username update response:', response);
      
      // Update user in context and clear the needsUsernameSelection flag
      const updatedUser = {...response.user, needsUsernameSelection: false};
      setUser(updatedUser);
      
      Alert.alert('Success', 'Username updated successfully!', [
        {text: 'OK', onPress: () => navigation.replace('Home')},
      ]);
    } catch (error: any) {
      console.error('❌ Username update error:', error);
      Alert.alert('Error', error.message || 'Failed to update username');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = () => {
    if (checking) return '⏳';
    if (available === true) return '✅';
    if (available === false) return '❌';
    return '🔤';
  };

  const getStatusColor = () => {
    if (available === true) return colors.success.main;
    if (available === false) return colors.error.main;
    return colors.text.secondary;
  };

  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary]}
      style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <View style={styles.content}>
            <View style={styles.headerSection}>
              <Text style={styles.logo}>👋</Text>
              <Text style={styles.title}>Choose Your Username</Text>
              <Text style={styles.subtitle}>
                Pick a unique username to get started
              </Text>
            </View>

            <View style={styles.inputSection}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Username</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter username"
                    placeholderTextColor={colors.text.tertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                  />
                  <View style={styles.statusIcon}>
                    <Text style={styles.statusIconText}>{getStatusIcon()}</Text>
                  </View>
                </View>
                
                {username.length >= 3 && (
                  <Text style={[styles.statusText, {color: getStatusColor()}]}>
                    {message}
                  </Text>
                )}
                
                <Text style={styles.helpText}>
                  3-20 characters • Letters, numbers, and underscores only
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!available || submitting) && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!available || submitting}
                activeOpacity={0.8}>
                <LinearGradient
                  colors={
                    available && !submitting
                      ? ['#667eea', '#764ba2']
                      : [colors.text.tertiary, colors.text.tertiary]
                  }
                  style={styles.submitButtonGradient}>
                  {submitting ? (
                    <ActivityIndicator color={colors.text.primary} />
                  ) : (
                    <Text style={styles.submitButtonText}>Continue</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                You can change this later in your profile settings
              </Text>
            </View>
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
  inputSection: {
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.input.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.input.border,
    paddingRight: spacing.md,
  },
  input: {
    flex: 1,
    padding: spacing.lg,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  statusIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconText: {
    fontSize: 20,
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  helpText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  submitButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});

export default UsernameSelectionScreen;
