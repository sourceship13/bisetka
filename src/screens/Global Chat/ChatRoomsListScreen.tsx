import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useI18n } from '../../hooks/useI18n';
import { BisetkaAlert } from '../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import chatRoomService, { ChatRoom } from '../../services/chatRoom.service';
import { useAuth } from '../../libs/hooks/useAuth';

const ChatRoomsListScreen = ({ navigation }: any) => {
  const { translate } = useI18n();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const { rooms: allRooms } = await chatRoomService.getAllRooms();
      const { rooms: myRooms } = await chatRoomService.getMyRooms();

      // Combine and deduplicate
      const roomMap = new Map();
      [...myRooms, ...allRooms].forEach(room => roomMap.set(room.id, room));
      setRooms(Array.from(roomMap.values()));
    } catch (error) {
      console.error('Failed to load rooms:', error);
      BisetkaAlert.error('Error', 'Failed to load chat rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      BisetkaAlert.error('Error', 'Please enter a room name');
      return;
    }

    try {
      setCreating(true);
      const { room } = await chatRoomService.createRoom(
        roomName.trim(),
        roomDescription.trim() || undefined,
      );
      BisetkaAlert.success('Success', `Room created! Share code: ${room.share_code}`);
      setShowCreateModal(false);
      setRoomName('');
      setRoomDescription('');
      loadRooms();
      navigation.navigate('ChatRoom', { roomId: room.id });
    } catch (error: any) {
      BisetkaAlert.error('Error', error.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!shareCode.trim()) {
      BisetkaAlert.error('Error', 'Please enter a share code');
      return;
    }

    try {
      const { room } = await chatRoomService.joinRoomByCode(
        shareCode.trim().toUpperCase(),
      );
      BisetkaAlert.success('Success', `Joined ${room.name}!`);
      setShowJoinModal(false);
      setShareCode('');
      loadRooms();
      navigation.navigate('ChatRoom', { roomId: room.id });
    } catch (error: any) {
      BisetkaAlert.error('Error', error.message || 'Failed to join room');
    }
  };

  const handleRoomPress = async (room: ChatRoom) => {
    try {
      await chatRoomService.joinRoom(room.id);
      navigation.navigate('ChatRoom', { roomId: room.id });
    } catch (error) {
      BisetkaAlert.error('Error', 'Failed to join room');
    }
  };

  const handleShareRoom = async (room: ChatRoom) => {
    try {
      await Share.share({
        message: `Join my chat room "${room.name}"!\nShare Code: ${room.share_code}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const renderRoom = ({ item }: { item: ChatRoom }) => (
    <TouchableOpacity
      onPress={() => handleRoomPress(item)}
      style={styles.roomCard}
    >
      <View style={[styles.roomGradient, { backgroundColor: '#1f2937' }]}>
        <View style={styles.roomHeader}>
          <Text style={styles.roomName}>{item.name}</Text>
          <TouchableOpacity
            onPress={() => handleShareRoom(item)}
            style={styles.shareBtn}
          >
            <Text style={styles.shareIcon}>🔗</Text>
          </TouchableOpacity>
        </View>

        {item.description && (
          <Text style={styles.roomDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.roomStats}>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statText}>{item.member_count} members</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>🟢</Text>
            <Text style={styles.statText}>{item.online_count} online</Text>
          </View>
        </View>

        <Text style={styles.shareCode}>Code: {item.share_code}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading chat rooms...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Chat Rooms</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={styles.createBtn}
        >
          <View style={[styles.btnGradient, { backgroundColor: '#10b981' }]}>
            <Text style={styles.btnText}>+ Create Room</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowJoinModal(true)}
          style={styles.joinBtn}
        >
          <View style={[styles.btnGradient, { backgroundColor: '#6366f1' }]}>
            <Text style={styles.btnText}>Join by Code</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 10 }}>
        <FlatList
          data={rooms}
          keyExtractor={item => item.id}
          renderItem={renderRoom}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No chat rooms yet</Text>
              <Text style={styles.emptySubtext}>
                Create one to get started!
              </Text>
            </View>
          }
          refreshing={loading}
          onRefresh={loadRooms}
        />
      </View>
      {/* Create Room Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Chat Room</Text>

            <TextInput
              style={styles.input}
              placeholder="Room Name"
              placeholderTextColor={colors.text.tertiary}
              value={roomName}
              onChangeText={setRoomName}
              maxLength={50}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={roomDescription}
              onChangeText={setRoomDescription}
              multiline
              maxLength={200}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreateRoom}
                style={styles.modalCreateBtn}
                disabled={creating}
              >
                <View style={[styles.modalBtnGradient, { backgroundColor: '#10b981' }]}>
                  <Text style={styles.modalCreateText}>
                    {creating ? 'Creating...' : 'Create'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join by Code Modal */}
      <Modal visible={showJoinModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Chat Room</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter Share Code"
              placeholderTextColor={colors.text.tertiary}
              value={shareCode}
              onChangeText={setShareCode}
              autoCapitalize="characters"
              maxLength={20}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setShowJoinModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleJoinByCode}
                style={styles.modalCreateBtn}
              >
                <View style={[styles.modalBtnGradient, { backgroundColor: '#6366f1' }]}>
                  <Text style={styles.modalCreateText}>Join</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.secondary,
    flex: 1,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  actionRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  createBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  joinBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    flex:1,
    borderRadius:12
  },
  btnText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  roomCard: {
    marginBottom: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
  },
  roomGradient: {
    padding: spacing.md,
    borderRadius: 12,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    flex: 1,
  },
  shareBtn: {
    padding: spacing.sm,
  },
  shareIcon: {
    fontSize: 20,
  },
  roomDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  roomStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 14,
  },
  statText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  shareCode: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontFamily: 'monospace',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 3,
  },
  emptyText: {
    fontSize: 18,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.xl,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
  },
  modalCancelText: {
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalCreateBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalBtnGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCreateText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChatRoomsListScreen;
