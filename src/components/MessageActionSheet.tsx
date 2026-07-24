/**
 * MessageActionSheet
 *
 * Long-press action sheet for chat messages. Shows:
 *   - Report (any user, opens reason picker)
 *   - Block user (any user, only for other users' messages)
 *   - Delete message (moderator only)
 *
 * Reusable across every chat surface (DM, room, in-game).
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import apiService from '../services/api.service';
import { BisetkaAlert } from '../utils/BisetkaAlert';

export type ChatSystem = 'dm' | 'room';

export interface MessageActionSheetProps {
  visible: boolean;
  onClose: () => void;
  chatSystem: ChatSystem;
  chatId: string;
  messageId: string;
  messageContent: string;
  senderId: string;
  senderUsername?: string;
  isOwnMessage: boolean;
  isModerator: boolean;
  /** Called after successful moderator delete so the caller can update UI. */
  onMessageDeleted?: (messageId: string) => void;
  /** Called after successful block so the caller can hide sender's messages. */
  onUserBlocked?: (userId: string) => void;
}

const REPORT_REASONS: { key: string; label: string }[] = [
  { key: 'spam', label: 'Spam or scam' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate_speech', label: 'Hate speech' },
  { key: 'sexual', label: 'Sexual content' },
  { key: 'threat', label: 'Threats or violence' },
  { key: 'self_harm', label: 'Self-harm' },
  { key: 'impersonation', label: 'Impersonation' },
  { key: 'other', label: 'Something else' },
];

const MessageActionSheet: React.FC<MessageActionSheetProps> = ({
  visible,
  onClose,
  chatSystem,
  chatId,
  messageId,
  messageContent,
  senderId,
  senderUsername,
  isOwnMessage,
  isModerator,
  onMessageDeleted,
  onUserBlocked,
}) => {
  const [mode, setMode] = useState<'menu' | 'report'>('menu');
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setMode('menu');
    onClose();
  };

  const handleReport = async (reason: string) => {
    setBusy(true);
    try {
      await apiService.reportMessage({
        chatSystem,
        chatId,
        messageId,
        reason,
        reportedUserId: senderId,
      });
      // Hide the reported message from this user's own feed immediately
      // (moderator still decides what to do with it globally). Reuses the
      // same "message deleted" callback the caller uses to hide moderator
      // deletions locally.
      onMessageDeleted?.(messageId);
      BisetkaAlert.success(
        'Reported',
        'Thanks — our moderators will review this message. It has been hidden from your feed.'
      );
      close();
    } catch (e: any) {
      BisetkaAlert.error('Report failed', e?.message ?? 'Could not submit report.');
    } finally {
      setBusy(false);
    }
  };

  const handleBlock = async () => {
    setBusy(true);
    try {
      await apiService.blockUser(senderId);
      onUserBlocked?.(senderId);
      BisetkaAlert.success('Blocked', `You will no longer see messages from ${senderUsername || 'this user'}.`);
      close();
    } catch (e: any) {
      BisetkaAlert.error('Block failed', e?.message ?? 'Could not block user.');
    } finally {
      setBusy(false);
    }
  };

  const handleModeratorDelete = async () => {
    setBusy(true);
    try {
      await apiService.moderatorDeleteMessage(chatSystem, messageId);
      onMessageDeleted?.(messageId);
      BisetkaAlert.success('Deleted', 'Message removed.');
      close();
    } catch (e: any) {
      BisetkaAlert.error('Delete failed', e?.message ?? 'Could not delete message.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {mode === 'menu' && (
            <>
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Message</Text>
                <Text style={styles.previewText} numberOfLines={3}>
                  {messageContent}
                </Text>
                {senderUsername && (
                  <Text style={styles.previewMeta}>— {senderUsername}</Text>
                )}
              </View>

              {!isOwnMessage && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setMode('report')}
                  disabled={busy}
                  activeOpacity={0.85}>
                  <Text style={styles.actionIcon}>🚩</Text>
                  <Text style={styles.actionText}>Report message</Text>
                </TouchableOpacity>
              )}

              {!isOwnMessage && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleBlock}
                  disabled={busy}
                  activeOpacity={0.85}>
                  <Text style={styles.actionIcon}>🚫</Text>
                  <Text style={styles.actionText}>Block user</Text>
                </TouchableOpacity>
              )}

              {isModerator && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.destructiveBtn]}
                  onPress={handleModeratorDelete}
                  disabled={busy}
                  activeOpacity={0.85}>
                  <Text style={styles.actionIcon}>🗑️</Text>
                  <Text style={[styles.actionText, styles.destructiveText]}>
                    Delete message (moderator)
                  </Text>
                </TouchableOpacity>
              )}

              {busy && <ActivityIndicator style={{ marginTop: 10 }} color="#fff" />}

              <TouchableOpacity style={styles.cancelBtn} onPress={close} disabled={busy}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'report' && (
            <>
              <Text style={styles.title}>Report message</Text>
              <Text style={styles.subtitle}>Choose a reason</Text>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {REPORT_REASONS.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={styles.reasonBtn}
                    onPress={() => handleReport(r.key)}
                    disabled={busy}
                    activeOpacity={0.85}>
                    <Text style={styles.reasonText}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {busy && <ActivityIndicator style={{ marginTop: 8 }} color="#fff" />}
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setMode('menu')}
                disabled={busy}>
                <Text style={styles.cancelText}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 28,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  previewLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  previewText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  previewMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  destructiveBtn: { backgroundColor: 'rgba(220,38,38,0.15)' },
  actionIcon: { fontSize: 18, marginRight: 12 },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  destructiveText: { color: '#fecaca' },
  reasonBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  reasonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default MessageActionSheet;
