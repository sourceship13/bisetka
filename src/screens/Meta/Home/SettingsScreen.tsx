import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Switch,
  Linking,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth} from '../../../libs/hooks/useAuth';
import {colors, spacing} from '../../../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import packageJson from '../../../../package.json';
import AppVersionFooter from '../../../components/global/AppVersionFooter';

const SOUND_KEY = '@bisetka_sound_enabled';
const HAPTIC_KEY = '@bisetka_haptic_enabled';

const SettingsScreen = ({navigation}: any) => {
  const {user, signOut} = useAuth();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SOUND_KEY).then(v => {
      if (v !== null) setSoundEnabled(v === 'true');
    });
    AsyncStorage.getItem(HAPTIC_KEY).then(v => {
      if (v !== null) setHapticEnabled(v === 'true');
    });
  }, []);

  const toggleSound = (val: boolean) => {
    setSoundEnabled(val);
    AsyncStorage.setItem(SOUND_KEY, String(val));
  };

  const toggleHaptic = (val: boolean) => {
    setHapticEnabled(val);
    AsyncStorage.setItem(HAPTIC_KEY, String(val));
  };

  const handleSignOut = () => {
    // Pop back to the root of the stack BEFORE clearing the user. If we sign
    // out while Settings is still the focused route, the navigator rewires
    // its routes (app stack → Login stack) with Settings still mounted and
    // the app crashes. Popping first guarantees we're on Home when the swap
    // happens.
    try {
      navigation.popToTop?.();
    } catch {
      // popToTop is a no-op on root — ignore.
    }
    setTimeout(() => {
      signOut();
    }, 0);
  };

  const handleOpenNotifSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const buildNumber = DeviceInfo.getBuildNumber();
  const appVersion = packageJson.version || DeviceInfo.getVersion();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />

      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Preferences */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <SettingRow
            icon="🔊"
            label="Sound Effects"
            trailing={
              <Switch
                value={soundEnabled}
                onValueChange={toggleSound}
                trackColor={{false: 'rgba(255,255,255,0.1)', true: '#6366f1'}}
                thumbColor="#fff"
              />
            }
          />
          <Divider />
          <SettingRow
            icon="📳"
            label="Haptic Feedback"
            trailing={
              <Switch
                value={hapticEnabled}
                onValueChange={toggleHaptic}
                trackColor={{false: 'rgba(255,255,255,0.1)', true: '#6366f1'}}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <TouchableOpacity onPress={handleOpenNotifSettings}>
            <SettingRow
              icon="🔔"
              label="Notification Settings"
              trailing={<Text style={styles.chevron}>›</Text>}
            />
          </TouchableOpacity>
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <SettingRow icon="👤" label={user?.username || 'Player'} trailing={null} />
          <Divider />
          <SettingRow icon="✉️" label={user?.email || 'No email'} trailing={null} />
        </View>

        {/* Actions */}
        <View style={styles.card}>
          <TouchableOpacity onPress={handleSignOut}>
            <SettingRow
              icon="🚪"
              label="Sign Out"
              trailing={<Text style={styles.chevron}>›</Text>}
              danger
            />
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <SettingRow icon="📱" label="Version" trailing={<Text style={styles.trailText}>{appVersion}</Text>} />
          <Divider />
          <SettingRow icon="🔨" label="Build" trailing={<Text style={styles.trailText}>{buildNumber}</Text>} />
          <Divider />
          <SettingRow icon="⚛️" label="React Native" trailing={<Text style={styles.trailText}>{packageJson.dependencies?.['react-native'] || '—'}</Text>} />
        </View>

        {/* Footer */}
        <AppVersionFooter containerStyle={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const SettingRow = ({
  icon,
  label,
  trailing,
  danger,
}: {
  icon: string;
  label: string;
  trailing: React.ReactNode;
  danger?: boolean;
}) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
    </View>
    {trailing}
  </View>
);

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.md,
  },
  card: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    fontSize: 20,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  dangerText: {
    color: colors.error.main,
  },
  chevron: {
    fontSize: 22,
    color: colors.text.tertiary,
    fontWeight: '300',
  },
  trailText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.primary,
    marginLeft: spacing.md + 32,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
});

export default SettingsScreen;
