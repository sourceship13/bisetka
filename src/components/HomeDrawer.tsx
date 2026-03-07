import React, {useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Dimensions,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../libs/hooks/useAuth';
import {colors, spacing} from '../theme';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;
const EDGE_WIDTH = 25; // swipe zone from left edge
const SWIPE_THRESHOLD = DRAWER_WIDTH * 0.3;

interface HomeDrawerProps {
  visible: boolean;
  onClose: () => void;
  onOpen: () => void;
  onNavigate: (screen: string) => void;
}

const MENU_ITEMS = [
  {key: 'Profile', icon: '👤', label: 'Profile', gradient: ['#6366f1', '#8b5cf6']},
  {key: 'Settings', icon: '⚙️', label: 'Settings', gradient: ['#64748b', '#94a3b8']},
];

const HomeDrawer: React.FC<HomeDrawerProps> = ({visible, onClose, onOpen, onNavigate}) => {
  const {user} = useAuth();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const animateOpen = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 200,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, overlayOpacity]);

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: -DRAWER_WIDTH,
        useNativeDriver: true,
        damping: 22,
        stiffness: 200,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, overlayOpacity]);

  // Animate on visible prop change (hamburger button)
  useEffect(() => {
    if (visible) {
      animateOpen();
    } else {
      animateClose();
    }
  }, [visible, animateOpen, animateClose]);

  // Edge swipe to open
  const edgePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => !visibleRef.current && gs.x0 < EDGE_WIDTH,
      onMoveShouldSetPanResponder: (_, gs) =>
        !visibleRef.current && gs.x0 < EDGE_WIDTH && gs.dx > 10 && Math.abs(gs.dy) < gs.dx,
      onPanResponderMove: (_, gs) => {
        const x = Math.min(0, Math.max(-DRAWER_WIDTH, gs.dx - DRAWER_WIDTH));
        translateX.setValue(x);
        overlayOpacity.setValue(Math.max(0, (DRAWER_WIDTH + x) / DRAWER_WIDTH));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD || gs.vx > 0.5) {
          onOpen();
          animateOpen();
        } else {
          animateClose();
        }
      },
    }),
  ).current;

  // Drag to close (on drawer panel)
  const drawerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        visibleRef.current && gs.dx < -10 && Math.abs(gs.dy) < Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        const x = Math.min(0, Math.max(-DRAWER_WIDTH, gs.dx));
        translateX.setValue(x);
        overlayOpacity.setValue(Math.max(0, (DRAWER_WIDTH + x) / DRAWER_WIDTH));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD || gs.vx < -0.5) {
          onClose();
          animateClose();
        } else {
          animateOpen();
        }
      },
    }),
  ).current;

  const displayName =
    user?.full_name ||
    [user?.fullName?.givenName, user?.fullName?.familyName].filter(Boolean).join(' ') ||
    user?.username ||
    'Player';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" {...edgePan.panHandlers}>
      {/* Overlay */}
      {visible && (
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.overlay, {opacity: overlayOpacity}]} />
        </TouchableWithoutFeedback>
      )}

      {/* Drawer panel */}
      <Animated.View
        style={[styles.drawer, {transform: [{translateX}]}]}
        {...drawerPan.panHandlers}>
        {/* User header */}
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.userHeader}>
          <View style={styles.avatarWrap}>
            {user?.avatar_url ? (
              <Image source={{uri: user.avatar_url}} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(user?.username || 'P')[0].toUpperCase()}
                </Text>
              </View>
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
                onClose();
                onNavigate(item.key);
              }}>
              <LinearGradient
                colors={item.gradient}
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
        <View style={styles.footer}>
          <Text style={styles.footerText}>🇦🇲 Bisetka</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.background.primary,
    shadowColor: '#000',
    shadowOffset: {width: 4, height: 0},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  userHeader: {
    paddingTop: 60,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 24,
  },
  avatarWrap: {
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  drawerName: {
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
    marginTop: spacing.lg,
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
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
});

export default HomeDrawer;
