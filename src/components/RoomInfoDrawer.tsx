import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { socketService } from '../services/SocketService';
import { resolveAvatar } from '../utils/avatars';

interface Player {
  userId: string | null;
  displayName: string;
  isAI: boolean;
  position?: number;
  team?: number;
  avatarUrl?: string | null;
}

interface Spectator {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface RoomInfo {
  roomId: string;
  playerCount: number;
  spectatorCount: number;
  players: Player[];
  spectators: Spectator[];
}

interface RoomInfoDrawerProps {
  roomId: string | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.72;

const RoomInfoDrawer: React.FC<RoomInfoDrawerProps> = ({ roomId }) => {
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(DRAWER_WIDTH));

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !roomId) return;

    const handler = (data: RoomInfo) => {
      if (data.roomId === roomId) setInfo(data);
    };
    socket.on('room_info_update', handler);
    // Request initial info
    socket.emit('get_room_info', { roomId });

    return () => {
      socket.off('room_info_update', handler);
    };
  }, [roomId]);

  const open = useCallback(() => {
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [slideAnim]);

  const close = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: DRAWER_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [slideAnim]);

  const playerCount = info?.playerCount ?? 0;
  const spectatorCount = info?.spectatorCount ?? 0;

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const renderPlayerItem = (item: Player, index: number) => {
    const avatarSource = item.avatarUrl ? resolveAvatar(item.avatarUrl) : null;
    const initials = item.isAI ? '🤖' : getInitials(item.displayName);
    const teamColor = item.team === 1 || item.team === 0 ? '#4ade80' : '#60a5fa';
    return (
      <View key={`p-${item.userId ?? index}`} style={styles.playerRow}>
        <View style={styles.avatarClip}>
          {!item.isAI && avatarSource ? (
            <Image source={avatarSource} style={styles.avatar} resizeMode="contain" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>{item.displayName}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {item.isAI && (
              <View style={[styles.badge, { backgroundColor: 'rgba(148,163,184,0.15)', borderColor: '#94a3b8' }]}>
                <Text style={[styles.badgeText, { color: '#94a3b8' }]}>AI</Text>
              </View>
            )}
            {item.team != null && (
              <View style={[styles.badge, { backgroundColor: teamColor + '22', borderColor: teamColor }]}>
                <Text style={[styles.badgeText, { color: teamColor }]}>Team {item.team}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderSpectatorItem = (item: Spectator, index: number) => {
    const avatarSource = item.avatarUrl ? resolveAvatar(item.avatarUrl) : null;
    const initials = getInitials(item.displayName);
    return (
      <View key={`s-${item.userId}-${index}`} style={styles.playerRow}>
        <View style={[styles.avatarClip, { borderColor: 'rgba(148,163,184,0.4)' }]}>
          {avatarSource ? (
            <Image source={avatarSource} style={styles.avatar} resizeMode="contain" />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: '#1e2a3a' }]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>{item.displayName}</Text>
          <Text style={styles.spectatorLabel}>👁 Spectating</Text>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Counter pill — always visible */}
      <TouchableOpacity style={styles.pill} onPress={open} activeOpacity={0.75}>
        <Text style={styles.pillText}>
          � {playerCount}  👁 {spectatorCount}
        </Text>
      </TouchableOpacity>

      {/* Drawer modal */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={close}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={close}
        />
        <Animated.View
          style={[
            styles.drawer,
            { transform: [{ translateX: slideAnim }] },
          ]}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Players</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Players section */}
            <Text style={styles.sectionTitle}>🎮 In Game ({playerCount})</Text>
            {(info?.players ?? []).map((item, i) => renderPlayerItem(item, i))}
            {playerCount === 0 && <Text style={styles.emptyText}>No players yet</Text>}

            {/* Spectators section */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>👁 Spectating ({spectatorCount})</Text>
            {spectatorCount === 0
              ? <Text style={styles.emptyText}>No spectators</Text>
              : (info?.spectators ?? []).map((item, i) => renderSpectatorItem(item, i))
            }
          </ScrollView>
        </Animated.View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: 'rgba(12,12,30,0.97)',
    paddingHorizontal: 18,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  drawerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  avatarClip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1e1e40',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    flexShrink: 0,
  },
  avatar: {
    width: 48,
    height: 48,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a55',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  playerInfo: {
    flex: 1,
    gap: 4,
  },
  playerName: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  spectatorLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    fontStyle: 'italic',
    marginLeft: 4,
    marginBottom: 8,
  },
});

export default RoomInfoDrawer;
