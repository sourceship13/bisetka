import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Animated,
  Dimensions,
} from 'react-native';
import { socketService } from '../services/SocketService';

interface Player {
  userId: string | null;
  displayName: string;
  isAI: boolean;
  position?: number;
  team?: number;
}

interface Spectator {
  userId: string;
  displayName: string;
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

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={styles.listItem}>
      <Text style={styles.listIcon}>{item.isAI ? '🤖' : '👤'}</Text>
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{item.displayName}</Text>
        {item.team != null && (
          <Text style={styles.listSub}>Team {item.team}</Text>
        )}
      </View>
    </View>
  );

  const renderSpectator = ({ item }: { item: Spectator }) => (
    <View style={styles.listItem}>
      <Text style={styles.listIcon}>👁️</Text>
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{item.displayName}</Text>
      </View>
    </View>
  );

  return (
    <>
      {/* Counter pill — always visible */}
      <TouchableOpacity style={styles.pill} onPress={open} activeOpacity={0.75}>
        <Text style={styles.pillText}>
          👤 {playerCount}  👁️ {spectatorCount}
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
          <Text style={styles.drawerTitle}>Room Info</Text>

          {/* Players section */}
          <Text style={styles.sectionTitle}>
            Players ({playerCount})
          </Text>
          <FlatList
            data={info?.players ?? []}
            keyExtractor={(item, i) => `p-${item.userId ?? i}`}
            renderItem={renderPlayer}
            style={styles.list}
            scrollEnabled={false}
          />

          {/* Spectators section */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            Spectators ({spectatorCount})
          </Text>
          {spectatorCount === 0 ? (
            <Text style={styles.emptyText}>No spectators</Text>
          ) : (
            <FlatList
              data={info?.spectators ?? []}
              keyExtractor={(item, i) => `s-${item.userId}-${i}`}
              renderItem={renderSpectator}
              style={styles.list}
              scrollEnabled={false}
            />
          )}
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
    backgroundColor: '#1a1a2e',
    paddingTop: 60,
    paddingHorizontal: 20,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  drawerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  list: {
    flexGrow: 0,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  listIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '500',
  },
  listSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 1,
  },
  emptyText: {
    color: '#475569',
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default RoomInfoDrawer;
