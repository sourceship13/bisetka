import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GameToolbar from '../../components/global/GameToolbar';
import { BisetkaAlert } from '../../utils/BisetkaAlert';
import { useAuth } from '../../libs/hooks/useAuth';
import { apiConfig } from '../../libs/utils/api.utils';
import tokenService from '../../services/token.service';
import { socketService } from '../../services/SocketService';

// Game type to multiplayer screen name mapping
const GAME_SCREENS: Record<string, string> = {
  blot: 'MultiplayerBlot',
  'baazar-blot': 'MultiplayerBaazarBlot',
  chess: 'MultiplayerChess',
  checkers: 'MultiplayerCheckers',
  poker: 'PokerRoom',
  nardi: 'Nardi',
  billiards: 'BilliardsGame',
  '9-ball': 'BilliardsGame',
  mrotsi: 'MultiplayerMrotsi',
};

// Game type to emoji mapping
const GAME_ICONS: Record<string, string> = {
  blot: '🃏',
  'baazar-blot': '⚡',
  chess: '♟️',
  checkers: '🔴',
  poker: '♠️',
  nardi: '🎲',
  billiards: '🎱',
  '9-ball': '9️⃣',
  mrotsi: '🎯',
};

// Game type to gradient mapping (from HomeScreen)
const GAME_GRADIENTS: Record<string, string[]> = {
  blot: ['#6366f1', '#8b5cf6'],
  'baazar-blot': ['#ec4899', '#f472b6'],
  chess: ['#3b82f6', '#60a5fa'],
  checkers: ['#f59e0b', '#fbbf24'],
  poker: ['#10b981', '#34d399'],
  nardi: ['#8b5cf6', '#a78bfa'],
  billiards: ['#06b6d4', '#22d3ee'],
  '9-ball': ['#f59e0b', '#fbbf24'],
  mrotsi: ['#14b8a6', '#2dd4bf'],
};

interface GameRoom {
  id: string;
  game_type: string;
  room_name: string;
  host_username: string;
  status: 'waiting' | 'in_progress' | 'finished';
  active_players: number;
  max_players: number;
  active_spectators: number;
  waitlist_count: number;
  player1_username: string | null;
  player2_username: string | null;
  player3_username: string | null;
  player4_username: string | null;
  created_at: string;
  last_activity_at: string;
  allow_replace_ai?: boolean;
}

const ActiveRoomsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Room naming state
  const [myRoomName, setMyRoomName] = useState('');
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadRooms();
    loadMySession();

    // Live room name updates
    socketService.onRoomNameUpdated(({ roomId, roomName, dbSessionId }: any) => {
      setRooms(prev =>
        prev.map(r =>
          r.id === roomId || r.id === dbSessionId
            ? { ...r, room_name: roomName }
            : r,
        ),
      );
      // Keep the host's own name input in sync
      setMySessionId(prev => {
        if (prev === roomId || prev === dbSessionId) setMyRoomName(roomName);
        return prev;
      });
    });

    // Remove rooms the instant they close
    socketService.onRoomClosed(({ roomId, dbSessionId }: any) => {
      setRooms(prev => prev.filter(r => r.id !== roomId && r.id !== dbSessionId));
    });

    return () => {
      socketService.offRoomNameUpdated();
      socketService.offRoomClosed();
    };
  }, []);

  const loadMySession = async () => {
    try {
      const token = await tokenService.getAccessToken();
      if (!token) return;
      const res = await fetch(`${apiConfig.apiURL}/games/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const sessions: any[] = data.sessions || [];
      const hosted = sessions.find(
        (s: any) =>
          s.host_user_id === user?.id &&
          ['waiting', 'queued', 'active'].includes(s.status),
      );
      if (hosted) {
        setMySessionId(hosted.id);
        setMyRoomName(hosted.room_name || '');
      }
    } catch {
      // no-op — room naming is optional
    }
  };

  const loadRooms = async () => {
    try {
      setLoading(true);
      const token = await tokenService.getAccessToken();
      const response = await fetch(`${apiConfig.apiURL}/games/all-active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to load rooms');
      const data = await response.json();
      // Deduplicate by id in case DB has stale duplicate rows
      const seen = new Set<string>();
      const deduped = (data.rooms || []).filter((r: GameRoom) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
      setRooms(deduped);
    } catch (error) {
      console.error('Failed to load rooms:', error);
      BisetkaAlert.error('Error', 'Failed to load active rooms. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRooms();
    loadMySession();
  };

  const saveRoomName = async () => {
    Keyboard.dismiss();
    const trimmed = myRoomName.trim();
    if (!trimmed) {
      BisetkaAlert.error('Invalid Name', 'Please enter a room name first.');
      return;
    }
    setSavingName(true);
    try {
      if (mySessionId) {
        // Persist via REST
        const token = await tokenService.getAccessToken();
        const res = await fetch(
          `${apiConfig.apiURL}/games/session/${mySessionId}/name`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ roomName: trimmed }),
          },
        );
        if (!res.ok) throw new Error('Failed to save');
      }
      // Also broadcast via socket so everyone in the room sees the update live
      if (mySessionId) {
        socketService.setRoomName(mySessionId, trimmed);
      }
      BisetkaAlert.success('Saved', `Room renamed to "${trimmed}"`);
      // Update the card in the list directly — no re-fetch needed
      if (mySessionId) {
        setRooms(prev =>
          prev.map(r => (r.id === mySessionId ? { ...r, room_name: trimmed } : r)),
        );
      }
    } catch {
      BisetkaAlert.error('Error', 'Could not save room name. Try again.');
    } finally {
      setSavingName(false);
    }
  };

  // Game types where an AI player can be replaced by a human
  const AI_REPLACEABLE_TYPES = ['poker', 'baazar-blot', 'blot'];

  const buildNavParams = (room: GameRoom, mode: string) => {
    const base = { dbSessionId: room.id, mode };
    switch (room.game_type) {
      case 'chess':
      case 'checkers':
        return { ...base, userId: user?.id };
      case 'poker':
        return {
          ...base,
          session: { userId: user?.id, displayName: user?.username ?? 'Player' },
          gameType: 'poker',
        };
      case 'baazar-blot':
        return {
          ...base,
          userId: user?.id,
          session: { userId: user?.id, displayName: user?.username ?? 'Player' },
          gameType: 'baazar-blot',
        };
      default:
        // blot, nardi, billiards, 9-ball, mrotsi
        return {
          ...base,
          userId: user?.id,
          session: { userId: user?.id, id: user?.id, displayName: user?.username ?? 'Player' },
          gameType: room.game_type,
        };
    }
  };

  const navigateToGame = (room: GameRoom, mode: string) => {
    const screenName = GAME_SCREENS[room.game_type];
    if (!screenName) {
      BisetkaAlert.error('Error', `Unknown game type: ${room.game_type}`);
      return;
    }
    navigation.navigate(screenName, buildNavParams(room, mode));
  };

  const handleJoinRoom = (room: GameRoom) => {
    const roomDisplayName =
      room.room_name ||
      room.game_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) +
        ' Room';

    const canReplaceAI = AI_REPLACEABLE_TYPES.includes(room.game_type) && room.allow_replace_ai;

    if (canReplaceAI) {
      // Poker / Baazar-Blot always have AI slots (both waiting and in-progress)
      // — always offer Replace AI or Watch; never auto-join-from-lobby
      BisetkaAlert.alert(
        roomDisplayName,
        'What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: '👁️ Watch',
            onPress: () => navigateToGame(room, 'spectate'),
          },
          {
            text: '🤖→👤 Replace AI',
            onPress: () => navigateToGame(room, 'replace-ai'),
          },
        ],
      );
      return;
    }

    if (AI_REPLACEABLE_TYPES.includes(room.game_type) && !room.allow_replace_ai) {
      // AI-replaceable game but host disabled joining — only allow spectating
      BisetkaAlert.alert(
        roomDisplayName,
        'This game is closed to new players. You can watch the game.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: '👁️ Watch',
            onPress: () => navigateToGame(room, 'spectate'),
          },
        ],
      );
      return;
    }

    if (room.status === 'waiting') {
      // One open human seat — join directly as player 2
      navigateToGame(room, 'join-from-lobby');
      return;
    }

    // In-progress, non-AI game → spectate
    navigateToGame(room, 'spectate');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting':
        return { text: 'Waiting', color: '#f59e0b' };
      case 'in_progress':
        return { text: 'Live', color: '#10b981' };
      case 'finished':
        return { text: 'Finished', color: '#6b7280' };
      default:
        return { text: status, color: '#6b7280' };
    }
  };

  const formatPlayerList = (room: GameRoom): string => {
    const players = [
      room.player1_username,
      room.player2_username,
      room.player3_username,
      room.player4_username,
    ].filter(Boolean);
    
    if (players.length === 0) return 'No players yet';
    if (players.length <= 2) return players.join(' vs ');
    return `${players[0]} +${players.length - 1} others`;
  };

  const renderRoomCard = ({ item: room }: { item: GameRoom }) => {
    const statusBadge = getStatusBadge(room.status);
    const gradient = GAME_GRADIENTS[room.game_type] || ['#6366f1', '#8b5cf6'];
    const icon = GAME_ICONS[room.game_type] || '🎮';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleJoinRoom(room)}
        style={styles.roomCard}>
        <LinearGradient
          colors={gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.roomGradient}>
          
          {/* Header */}
          <View style={styles.roomHeader}>
            <View style={styles.roomTitleRow}>
              <Text style={styles.gameIcon}>{icon}</Text>
              <View style={styles.roomTitleContainer}>
                <Text style={styles.roomName} numberOfLines={1}>
                  {room.room_name ||
                    room.game_type
                      .replace(/-/g, ' ')
                      .replace(/\b\w/g, l => l.toUpperCase()) + ' Room'}
                </Text>
                <Text style={styles.gameTypeName}>
                  {room.game_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </View>
            </View>
            
            <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
              <Text style={styles.statusText}>{statusBadge.text}</Text>
            </View>
          </View>

          {/* Players */}
          <View style={styles.playersSection}>
            <Text style={styles.playersLabel}>Playing:</Text>
            <Text style={styles.playersText} numberOfLines={1}>
              {formatPlayerList(room)}
            </Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={styles.statText}>
                {room.active_players}/{room.max_players}
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>👁️</Text>
              <Text style={styles.statText}>{room.active_spectators}</Text>
            </View>
            
            {room.waitlist_count > 0 && (
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>⏳</Text>
                <Text style={styles.statText}>{room.waitlist_count}</Text>
              </View>
            )}

            {AI_REPLACEABLE_TYPES.includes(room.game_type) && !room.allow_replace_ai && (
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>🔒</Text>
                <Text style={styles.statText}>Closed</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.roomFooter}>
            <Text style={styles.hostText}>Host: {room.host_username}</Text>
            <Text style={styles.joinPrompt}>
              {room.status === 'waiting' ? '➕ Join Game' : '👁️ Watch'}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🎮</Text>
      <Text style={styles.emptyTitle}>No Active Rooms</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to create a multiplayer game!
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <GameToolbar
        title="Active Rooms"
        onBack={() => navigation.goBack()}
        backgroundColor="#0f0f23"
      />

      {/* ── Room Naming Bar ───────────────────────────────────────────── */}
      <View style={styles.namingBar}>
        <TouchableOpacity
          style={styles.pencilBtn}
          onPress={() => inputRef.current?.focus()}
          activeOpacity={0.7}>
          <Text style={styles.pencilIcon}>✏️</Text>
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={[styles.roomNameInput, inputFocused && styles.roomNameInputFocused]}
          value={myRoomName}
          onChangeText={setMyRoomName}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Name your room…"
          placeholderTextColor="#4b5563"
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={saveRoomName}
        />
        <TouchableOpacity
          style={[styles.saveBtn, savingName && styles.saveBtnDisabled]}
          onPress={saveRoomName}
          disabled={savingName}
          activeOpacity={0.8}>
          {savingName ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading rooms...</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          renderItem={renderRoomCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366f1"
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  // ── Room Naming Bar ──────────────────────────────────────────────────────
  namingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#1a1a35',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2d55',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  pencilBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pencilIcon: {
    fontSize: 18,
  },
  roomNameInput: {
    flex: 1,
    height: 40,
    color: '#e2e8f0',
    fontSize: 15,
    paddingHorizontal: 8,
  },
  roomNameInputFocused: {
    color: '#fff',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 52,
  },
  saveBtnDisabled: {
    backgroundColor: '#4b50b8',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  // ── Rest of screen ───────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  roomCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  roomGradient: {
    padding: 16,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  gameIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  roomTitleContainer: {
    flex: 1,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  gameTypeName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  playersSection: {
    marginBottom: 12,
  },
  playersLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
    fontWeight: '600',
  },
  playersText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    fontSize: 16,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hostText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  joinPrompt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export default ActiveRoomsScreen;
