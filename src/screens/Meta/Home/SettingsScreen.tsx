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
  Modal,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth} from '../../../libs/hooks/useAuth';
import {colors, spacing} from '../../../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import packageJson from '../../../../package.json';
import AppVersionFooter from '../../../components/global/AppVersionFooter';
import {useI18n} from '../../../hooks/useI18n';
import type { Language } from '../../../i18n/index';
import apiService from '../../../services/api.service';
import {BisetkaAlert} from '../../../utils/BisetkaAlert';

const SOUND_KEY = '@bisetka_sound_enabled';
const HAPTIC_KEY = '@bisetka_haptic_enabled';
// Note: Language preference stored in i18n system (LANGUAGE_KEY, SCRIPT_KEY)

const LANGUAGE_DISPLAY_NAMES: {[key: string]: string} = {
  'en': '🇺🇸 English',
  'ru': '🇷🇺 Русский',
  'hy': '🇦🇲 Հայերեն (Native)',
  'hy-latin': '🇦🇲 Hayeren (Latin)',
};

const SettingsScreen = ({navigation}: any) => {
  const {user, signOut} = useAuth();
  const {translate, translateWithParams, language, setLanguage, supportedLanguages} = useI18n();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [languageChangedTo, setLanguageChangedTo] = useState<Language | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleConfirmDeleteAccount = async () => {
    setDeleting(true);
    try {
      await apiService.deleteAccount();
      // Success: dismiss modal, pop to root, then sign out to clear session.
      // Same navigation-safety dance as handleSignOut: navigate FIRST, then
      // clear the user so the navigator can cleanly swap stacks.
      setShowDeleteConfirm(false);
      try {
        navigation.popToTop?.();
      } catch {
        // popToTop is a no-op on root — ignore.
      }
      setTimeout(() => {
        signOut();
      }, 0);
    } catch (error: any) {
      setDeleting(false);
      setShowDeleteConfirm(false);
      BisetkaAlert.error(
        translate('common.error'),
        error?.message ?? translate('settings.deleteAccountError'),
      );
    }
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
        <Text style={styles.headerTitle}>{translate('settings.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Preferences */}
        <Text style={styles.sectionTitle}>{translate('settings.title')}</Text>
        <View style={styles.card}>
          <SettingRow
            icon="🔊"
            label={translate('settings.sound')}
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
            label={translate('settings.notifications')}
            trailing={
              <Switch
                value={hapticEnabled}
                onValueChange={toggleHaptic}
                trackColor={{false: 'rgba(255,255,255,0.1)', true: '#6366f1'}}
                thumbColor="#fff"
              />
            }
          />
          <Divider />
          <TouchableOpacity onPress={() => setShowLanguageMenu(!showLanguageMenu)}>
            <SettingRow
              icon="🌐"
              label={translate('settings.language')}
              trailing={<Text style={styles.chevron}>›</Text>}
            />
          </TouchableOpacity>
          {showLanguageMenu && (
            <View>
              {supportedLanguages.map((lang) => {
                return (
                  <TouchableOpacity
                    key={lang}
                    onPress={async () => {
                      const changed = lang !== language;
                      await setLanguage(lang);
                      setShowLanguageMenu(false);
                      if (changed) setLanguageChangedTo(lang);
                    }}
                  >
                    <View style={styles.langOption}>
                      <Text style={[styles.langLabel, language === lang && styles.langLabelActive]}>
                        {LANGUAGE_DISPLAY_NAMES[lang] || lang}
                      </Text>
                      {language === lang && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>{translate('settings.account')}</Text>
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
              label={translate('common.logout')}
              trailing={<Text style={styles.chevron}>›</Text>}
              danger
            />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity onPress={() => setShowDeleteConfirm(true)}>
            <SettingRow
              icon="🗑️"
              label={translate('settings.deleteAccount')}
              trailing={<Text style={styles.chevron}>›</Text>}
              danger
            />
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>{translate('settings.aboutApp')}</Text>
        <View style={styles.card}>
          <SettingRow icon="📱" label={translate('common.version')} trailing={<Text style={styles.trailText}>{appVersion}</Text>} />
          <Divider />
          <SettingRow icon="🔨" label="Build" trailing={<Text style={styles.trailText}>{buildNumber}</Text>} />
          <Divider />
          <SettingRow icon="⚛️" label="React Native" trailing={<Text style={styles.trailText}>{packageJson.dependencies?.['react-native'] || '—'}</Text>} />
        </View>

        {/* Footer */}
        <AppVersionFooter containerStyle={styles.footer} />
      </ScrollView>

      <Modal
        visible={languageChangedTo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageChangedTo(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>🌐</Text>
            <Text style={styles.modalTitle}>{translate('settings.languageChanged')}</Text>
            <Text style={styles.modalMessage}>
              {translateWithParams('settings.languageChangedTo', {
                language: languageChangedTo
                  ? LANGUAGE_DISPLAY_NAMES[languageChangedTo] || languageChangedTo
                  : '',
              })}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setLanguageChangedTo(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalButtonText}>{translate('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Account confirmation */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setShowDeleteConfirm(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>⚠️</Text>
            <Text style={styles.modalTitle}>
              {translate('settings.deleteAccountConfirmTitle')}
            </Text>
            <Text style={styles.modalMessage}>
              {translate('settings.deleteAccountConfirmMessage')}
            </Text>
            <View style={styles.deleteButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteCancelButton]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                activeOpacity={0.85}
              >
                <Text style={styles.modalButtonText}>
                  {translate('settings.deleteAccountCancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteConfirmButton]}
                onPress={handleConfirmDeleteAccount}
                disabled={deleting}
                activeOpacity={0.85}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>
                    {translate('settings.deleteAccountConfirm')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginHorizontal: spacing.md,
    marginVertical: 4,
    borderRadius: 8,
  },
  langLabel: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  langLabelActive: {
    color: '#6366f1',
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '700',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.background.card,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButton: {
    alignSelf: 'stretch',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  deleteButtonRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
  },
  deleteCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
  },
});

export default SettingsScreen;
