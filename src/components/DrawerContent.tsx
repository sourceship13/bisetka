import React from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';

import AppVersionFooter from './global/AppVersionFooter';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../libs/hooks/useAuth';
import {colors, spacing} from '../theme';
import AVATARS, {resolveAvatar} from '../utils/avatars';

const MENU_ITEMS = [
  {key: 'Home', icon: '🏠', label: 'Home', gradient: ['#10b981', '#34d399'] as const},
  {key: 'Profile', icon: '👤', label: 'Profile', gradient: ['#6366f1', '#8b5cf6'] as const},
  {key: 'DMList', icon: '💬', label: 'Messages', gradient: ['#3b82f6', '#60a5fa'] as const},
  {key: 'Achievements', icon: '🏆', label: 'Achievements', gradient: ['#f59e0b', '#fbbf24'] as const},
  {key: 'Store', icon: '🛍️', label: 'Store', gradient: ['#f59e0b', '#fbbf24'] as const},
  {key: 'Settings', icon: '⚙️', label: 'Settings', gradient: ['#64748b', '#94a3b8'] as const},
  {key: 'Photosphere', icon: '📸', label: 'Photosphere', gradient: ['#ec4899', '#f472b6'] as const},
];

const DrawerContent = (props: any) => {
  const {user} = useAuth();
  const {navigation} = props;

  const displayName =
    user?.full_name ||
    [user?.fullName?.givenName, user?.fullName?.familyName]
      .filter(Boolean)
      .join(' ') ||
    user?.username ||
    'Player';

  const avatarSource = resolveAvatar(user?.avatar_url);

  return (
    <View style={styles.container}>
      {/* User header */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.userHeader}>
        <View style={styles.avatarWrap}>
          {avatarSource ? (
            <Image source={avatarSource} style={styles.avatar} />
          ) : (
            <Image source={AVATARS[0].source} style={styles.avatar} />
          )}
        </View>
        <Text style={styles.drawerName}>{displayName}</Text>
        {user?.username && (
          <Text style={styles.drawerUsername}>@{user.username}</Text>
        )}
      </LinearGradient>

      {/* Menu items */}
      <View style={styles.menuList}>
        {MENU_ITEMS.map(item => (
          <TouchableOpacity
            key={item.key}
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              navigation.closeDrawer();
              if (item.key !== 'Home') {
                navigation.navigate(item.key);
              }
            }}>
            <LinearGradient
              colors={[...item.gradient]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.menuIconWrap}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
            </LinearGradient>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer */}
      <AppVersionFooter containerStyle={styles.footer} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  userHeader: {
    flex:1,
    paddingVertical: 40,
    borderRadius:20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 140,
    resizeMode: 'contain',
  },
  drawerName: {
    marginVertical:6,
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  drawerUsername: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  menuList: {
    flex:3,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.primary,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 20,
  },
  menuLabel: {
    flex: 1,
    marginLeft: 14,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  menuChevron: {
    fontSize: 22,
    color: colors.text.tertiary,
    fontWeight: '300',
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
});

export default DrawerContent;
