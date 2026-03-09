import React, {useRef, useEffect, useCallback, useMemo} from 'react';
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
import AVATARS, {resolveAvatar} from '../utils/avatars';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;
const EDGE_WIDTH = 40;
const SWIPE_THRESHOLD = DRAWER_WIDTH * 0.3;

interface HomeDrawerProps {
  visible: boolean;
  onClose: () => void;
  onOpen: () => void;
  onNavigate: (screen: string) => void;
}

const MENU_ITEMS = [
  {key: 'Home', icon: '🏠', label: 'Home', gradient: ['#10b981', '#34d399']},
  {key: 'Profile', icon: '👤', label: 'Profile', gradient: ['#6366f1', '#8b5cf6']},
  {key: 'Store', icon: '🛍️', label: 'Store', gradient: ['#f59e0b', '#fbbf24']},
  {key: 'Settings', icon: '⚙️', label: 'Settings', gradient: ['#64748b', '#94a3b8']},
];

const HomeDrawer: React.FC<HomeDrawerProps> = ({visible, onClose, onOpen, onNavigate}) => {
  const {user} = useAuth();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const visibleRef = useRef(visible);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);

  useEffect(() => { visibleRef.current = visible; }, [visible]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

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

  useEffect(() => {
    if (visible) {
      animateOpen();
    } else {
      animateClose();
    }
  }, [visible, animateOpen, animateClose]);

  // Edge swipe to open — uses refs so closures never go stale
  const edgePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (_, gs) =>
          !visibleRef.current && gs.x0 < EDGE_WIDTH,
        onMoveShouldSetPanResponder: (_, gs) =>
          !visibleRef.current &&
          gs.x0 < EDGE_WIDTH &&
          gs.dx > 8 &&
          Math.abs(gs.dy) < gs.dx,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gs) => {
          const x = Math.min(0, Math.max(-DRAWER_WIDTH, gs.dx - DRAWER_WIDTH));
          translateX.setValue(x);
          overlayOpacity.setValue(
            Math.max(0, (DRAWER_WIDTH + x) / DRAWER_WIDTH),
          );
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dx > SWIPE_THRESHOLD || gs.vx > 0.5) {
            onOpenRef.current();
            animateOpen();
          } else {
            animateClose();
          }
        },
      }),
    [translateX, overlayOpacity, animateOpen, animateClose],
  );

  // Drag to close (on drawer panel) — capture phase so children don't steal the gesture
  const drawerPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_, gs) =>
          visibleRef.current &&
          gs.dx < -10 &&
          Math.abs(gs.dy) < Math.abs(gs.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gs) => {
          const x = Math.min(0, Math.max(-DRAWER_WIDTH, gs.dx));
          translateX.setValue(x);
          overlayOpacity.setValue(
            Math.max(0, (DRAWER_WIDTH + x) / DRAWER_WIDTH),
          );
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dx < -SWIPE_THRESHOLD || gs.vx < -0.5) {
            onCloseRef.current();
            animateClose();
          } else {
            animateOpen();
          }
        },
      }),
    [translateX, overlayOpacity, animateOpen, animateClose],
  );

  const displayName =
    user?.full_name ||
    [user?.fullName?.givenName, user?.fullName?.familyName].filter(Boolean).join(' ') ||
    user?.username ||
    'Player';

  const avatarSource = resolveAvatar(user?.avatar_url);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Invisible edge swipe zone — always captures touches */}
      <View
        style={styles.edgeZone}
        pointerEvents="auto"
        {...edgePan.panHandlers}
      />

      {/* Overlay — only when drawer is open */}
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
  edgeZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: EDGE_WIDTH,
    zIndex: 10,
    elevation: 10,
  },
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
    flex:1,


    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 24,
  },
  avatarWrap: {
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
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
    flex:1,
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
