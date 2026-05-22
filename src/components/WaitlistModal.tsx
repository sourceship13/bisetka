import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';


interface WaitlistPlayer {
  id: string;
  username: string;
  queue_position: number;
  wants_to_play_winner: boolean;
  joined_queue_at: string;
}

interface WaitlistModalProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  gameType: string;
  onJoinWaitlist?: () => void;
  onLeaveWaitlist?: () => void;
  isUserInWaitlist?: boolean;
}

const WaitlistModal: React.FC<WaitlistModalProps> = ({
  visible,
  onClose,
  roomId,
  gameType,
  onJoinWaitlist,
  onLeaveWaitlist,
  isUserInWaitlist = false,
}) => {
  const [waitlist, setWaitlist] = useState<WaitlistPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadWaitlist();
    }
  }, [visible, roomId]);

  const loadWaitlist = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch(`${API_BASE_URL}/game-rooms/${roomId}/waitlist`);
      // const data = await response.json();
      // setWaitlist(data.waitlist);

      // Mock data
      const mockWaitlist: WaitlistPlayer[] = [
        {
          id: '1',
          username: 'Player123',
          queue_position: 1,
          wants_to_play_winner: true,
          joined_queue_at: new Date().toISOString(),
        },
        {
          id: '2',
          username: 'ProGamer99',
          queue_position: 2,
          wants_to_play_winner: true,
          joined_queue_at: new Date().toISOString(),
        },
        {
          id: '3',
          username: 'ChallengerX',
          queue_position: 3,
          wants_to_play_winner: false,
          joined_queue_at: new Date().toISOString(),
        },
      ];
      
      setWaitlist(mockWaitlist);
    } catch (error) {
      console.error('Failed to load waitlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderWaitlistItem = ({ item }: { item: WaitlistPlayer }) => (
    <View style={styles.waitlistItem}>
      <View style={styles.positionBadge}>
        <Text style={styles.positionText}>{item.queue_position}</Text>
      </View>
      
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.username}</Text>
        {item.wants_to_play_winner && (
          <Text style={styles.challengeLabel}>🏆 Challenge Winner</Text>
        )}
      </View>
      
      {item.queue_position === 1 && (
        <View style={styles.nextBadge}>
          <Text style={styles.nextText}>Next</Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>⏳</Text>
      <Text style={styles.emptyText}>Waitlist is empty</Text>
      <Text style={styles.emptySubtext}>Be the first to join!</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: '#6366f1' }]}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Player Waitlist</Text>
              <Text style={styles.headerSubtitle}>
                {waitlist.length} {waitlist.length === 1 ? 'player' : 'players'} waiting
              </Text>
            </View>
            
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Waitlist */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Loading waitlist...</Text>
            </View>
          ) : (
            <FlatList
              data={waitlist}
              renderItem={renderWaitlistItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmpty}
            />
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {isUserInWaitlist ? (
              <TouchableOpacity
                style={styles.leaveButton}
                onPress={onLeaveWaitlist}
                activeOpacity={0.8}>
                <View style={[styles.buttonGradient, { backgroundColor: '#ef4444' }]}>
                  <Text style={styles.buttonText}>Leave Waitlist</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.joinButton}
                onPress={onJoinWaitlist}
                activeOpacity={0.8}>
                <View style={[styles.buttonGradient, { backgroundColor: '#10b981' }]}>
                  <Text style={styles.buttonText}>Join Waitlist</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
  },
  listContent: {
    padding: 16,
  },
  waitlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f3460',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  positionBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  positionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  challengeLabel: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '600',
  },
  nextBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  nextText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
  },
  actionButtons: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  joinButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  leaveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default WaitlistModal;
