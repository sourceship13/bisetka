import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BlurView } from '@react-native-community/blur';
import { Platform } from 'react-native';
import { BisetkaAlert } from '../../utils/BisetkaAlert';
import chatService from '../../services/chat.service';
import apiService from '../../services/api.service';
import useDeviceType from '../../hooks/useDeviceType';
import { useAuth } from '../../libs/hooks/useAuth';
import { resolveAvatar } from '../../utils/avatars';
import MessageActionSheet from '../MessageActionSheet';

type HomeGlobalChatProps = {
  onOpenFullChat: () => void;
  initialExpanded?: boolean;
};

type RecentMessage = {
  id?: string;
  sender_id?: string;
  username?: string;
  sender_username?: string;
  sender_avatar?: string;
  avatar_url?: string;
  content?: string;
  message?: string;
  deleted_at?: string | null;
};

const HomeGlobalChat = ({
  onOpenFullChat,
  initialExpanded = true,
}: HomeGlobalChatProps) => {
  const { isTablet } = useDeviceType();
  const { user } = useAuth();
  const isModerator = !!user?.isModerator;
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [chatExpanded, setChatExpanded] = useState(isTablet ? true : initialExpanded);
  const [chatId, setChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<RecentMessage | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);

  // Load block list once so blocked users' messages are hidden from the feed.
  useEffect(() => {
    let cancelled = false;
    apiService.getBlockedUsers()
      .then(res => {
        if (cancelled) return;
        setBlockedIds(new Set(res.blocks.map(b => b.blocked_id)));
      })
      .catch(() => { /* fail open */ });
    return () => { cancelled = true; };
  }, []);

  const visibleMessages = useMemo(
    () => recentMessages.filter(m =>
      !m.deleted_at && !(m.sender_id && blockedIds.has(m.sender_id))
    ),
    [recentMessages, blockedIds]
  );

  const ensureChatId = useCallback(async (): Promise<string | null> => {
    if (chatId) return chatId;
    try {
      const result = await chatService.getGlobalChat();
      setChatId(result.chatId);
      return result.chatId;
    } catch (error) {
      console.error('Failed to load global chat:', error);
      return null;
    }
  }, [chatId]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, []);

  const fetchRecentMessages = useCallback(
    async (expanded = false) => {
      try {
        const limit = expanded ? 50 : 3;
        const currentChatId = await ensureChatId();
        if (!currentChatId) {
          setRecentMessages([]);
          return;
        }
        const response = await chatService.getMessages(currentChatId, limit);
        if (response.messages) {
          setRecentMessages(response.messages);
          if (expanded) scrollToBottom();
          return;
        }
        setRecentMessages([]);
      } catch {
        setRecentMessages([]);
      }
    },
    [ensureChatId, scrollToBottom],
  );

  const loadGlobalChat = useCallback(async () => {
    await ensureChatId();
  }, [ensureChatId]);

  useFocusEffect(
    useCallback(() => {
      fetchRecentMessages(chatExpanded).catch(err =>
        console.warn('Failed to fetch chat messages:', err),
      );
      if (!chatId) {
        loadGlobalChat().catch(err =>
          console.warn('Failed to load chat ID:', err),
        );
      }
    }, [chatExpanded, chatId, fetchRecentMessages, loadGlobalChat]),
  );

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !chatId || sendingMessage) return;
    try {
      setSendingMessage(true);
      await chatService.postMessage(chatId, newMessage.trim());
      setNewMessage('');
      Keyboard.dismiss();
      await fetchRecentMessages(chatExpanded);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
      BisetkaAlert.error(
        'Failed to send',
        'Could not send your message. Please try again.',
      );
    } finally {
      setSendingMessage(false);
    }
  }, [chatExpanded, chatId, fetchRecentMessages, newMessage, scrollToBottom, sendingMessage]);

  const toggleChatExpanded = useCallback(() => {
    if (isTablet) return;
    const nextExpanded = !chatExpanded;
    setChatExpanded(nextExpanded);
    if (nextExpanded && !chatId) {
      loadGlobalChat().catch(err => console.warn('Failed to load chat ID:', err));
    }
    fetchRecentMessages(nextExpanded).catch(err =>
      console.warn('Failed to fetch chat messages:', err),
    );
  }, [isTablet, chatExpanded, chatId, fetchRecentMessages, loadGlobalChat]);

  const myAvatar = resolveAvatar(user?.avatar_url);

  const renderAvatar = (avatarUrl: string | null | undefined) => {
    const src = resolveAvatar(avatarUrl);
    if (src) {
      return <Image source={src} style={styles.avatarImage} resizeMode="contain" />;
    }
    return (
      <View style={styles.avatarFallback}>
        <Icon name="account" size={22} color="#cbd5e1" />
      </View>
    );
  };

  return (
    <View style={styles.globalChatContainer}>
      <View
        style={[styles.globalChatCard, chatExpanded && styles.globalChatCardExpanded]}>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType={Platform.OS === 'ios' ? 'ultraThinMaterialDark' : 'dark'}
          blurAmount={Platform.OS === 'ios' ? 24 : 18}
          reducedTransparencyFallbackColor="rgba(20, 9, 27, 0.45)"
        />
        <View pointerEvents="none" style={styles.glassTint} />
        {/* Header */}
        <View style={styles.globalChatHeader}>
          <View style={styles.globalChatTitleRow}>
            <Text style={styles.globalChatTitle}>Global Chat</Text>
            <View style={styles.liveBadge}>
              <Icon name="broadcast" size={12} color="#fff" />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {!isTablet && (
              <TouchableOpacity onPress={toggleChatExpanded} style={styles.iconBtn}>
                <Icon
                  name={chatExpanded ? 'chevron-down' : 'chevron-up'}
                  size={22}
                  color="#cbd5e1"
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onOpenFullChat} style={styles.iconBtn}>
              <Icon name="arrow-expand" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={chatScrollRef}
          style={[styles.chatPreview, chatExpanded && styles.chatPreviewExpanded]}
          contentContainerStyle={styles.chatScrollContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}>
          {visibleMessages.length > 0 ? (
            visibleMessages.map((msg, idx) => {
              const isMe = !!user?.id && msg.sender_id === user.id;
              const username = msg.sender_username || msg.username || (isMe ? 'Me' : 'Anonymous');
              const text = msg.content || msg.message || '';
              const avatarUrl = isMe ? user?.avatar_url : (msg.sender_avatar || msg.avatar_url);
              // Only rows for messages we have a real id for are long-pressable
              // (moderation needs an id to report/delete).
              const canLongPress = !!msg.id && !!msg.sender_id;

              if (isMe) {
                return (
                  <TouchableOpacity
                    key={`m-${idx}`}
                    activeOpacity={0.75}
                    onLongPress={canLongPress ? () => setSelectedMessage(msg) : undefined}
                    delayLongPress={350}
                    style={styles.rowMe}>
                    <View style={styles.bubbleColMe}>
                      <View style={[styles.bubble, styles.bubbleMe]}>
                        <Text style={styles.bubbleTextMe}>{text}</Text>
                      </View>
                      <Text style={styles.usernameLabelMe}>Me</Text>
                    </View>
                    <View style={styles.avatarWrap}>{renderAvatar(avatarUrl)}</View>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={`m-${idx}`}
                  activeOpacity={0.75}
                  onLongPress={canLongPress ? () => setSelectedMessage(msg) : undefined}
                  delayLongPress={350}
                  style={styles.rowOther}>
                  <View style={styles.avatarWrap}>{renderAvatar(avatarUrl)}</View>
                  <View style={styles.bubbleColOther}>
                    <View style={[styles.bubble, styles.bubbleOther]}>
                      <Text style={styles.bubbleTextOther}>{text}</Text>
                    </View>
                    <Text style={styles.usernameLabel}>{username}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.chatPreviewText}>💬 Players chatting worldwide...</Text>
              <Text style={styles.chatHint}>
                {chatExpanded ? 'No messages yet. Be the first!' : 'Tap to expand'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        {chatExpanded && (
          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Start typing..."
              placeholderTextColor="rgba(203, 213, 225, 0.55)"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity style={styles.inputIconBtn} activeOpacity={0.7}>
              <Icon name="paperclip" size={22} color="#e2e8f0" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || sendingMessage}
              style={styles.inputIconBtn}
              activeOpacity={0.7}>
              <Icon
                name="send-outline"
                size={24}
                color={!newMessage.trim() || sendingMessage ? 'rgba(226,232,240,0.4)' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        )}

        {!chatExpanded && (
          <View style={styles.chatQuickActions}>
            <Icon name="message-text" size={16} color="#94a3b8" />
            <Text style={styles.quickActionText}>
              Send a message • See who's online • Make friends
            </Text>
          </View>
        )}
      </View>

      {selectedMessage && chatId && selectedMessage.id && selectedMessage.sender_id && (
        <MessageActionSheet
          visible={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
          chatSystem="dm"
          chatId={chatId}
          messageId={selectedMessage.id}
          messageContent={selectedMessage.content || selectedMessage.message || ''}
          senderId={selectedMessage.sender_id}
          senderUsername={selectedMessage.sender_username || selectedMessage.username}
          isOwnMessage={selectedMessage.sender_id === user?.id}
          isModerator={isModerator}
          onMessageDeleted={(msgId) => {
            setRecentMessages(prev => prev.map(m =>
              m.id === msgId ? { ...m, deleted_at: new Date().toISOString() } : m
            ));
          }}
          onUserBlocked={(uid) => {
            setBlockedIds(prev => {
              const next = new Set(prev);
              next.add(uid);
              return next;
            });
          }}
        />
      )}
    </View>
  );
};

const AVATAR_SIZE = 34;

const styles = StyleSheet.create({
  globalChatContainer: {
    marginBottom: 8,
  },
  globalChatCard: {
    backgroundColor: 'transparent',
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginHorizontal: 12,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  globalChatCardExpanded: {
    minHeight: 260,
  },
  globalChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  globalChatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  globalChatTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 3,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.6,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },

  chatPreview: {
    marginBottom: 8,
    minHeight: 60,
    maxHeight: 130,
  },
  chatPreviewExpanded: {
    maxHeight: 220,
    flex: 1,
  },
  chatScrollContent: {
    flexGrow: 1,
    paddingVertical: 2,
  },

  // Message rows
  rowOther: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  rowMe: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(120, 110, 140, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleColOther: {
    flex: 1,
    alignItems: 'flex-start',
  },
  bubbleColMe: {
    flex: 1,
    alignItems: 'flex-end',
  },
  bubble: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 22,
    maxWidth: '100%',
  },
  bubbleOther: {
    backgroundColor: 'rgba(15, 10, 25, 0.85)',
    borderTopLeftRadius: 6,
  },
  bubbleMe: {
    backgroundColor: '#d8c8ff',
    borderTopRightRadius: 6,
  },
  bubbleTextOther: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
  bubbleTextMe: {
    fontSize: 13,
    color: '#1a1430',
    lineHeight: 18,
    fontWeight: '500',
  },
  usernameLabel: {
    marginTop: 2,
    marginLeft: 10,
    fontSize: 11,
    fontWeight: '700',
    color: '#9aa9d6',
  },
  usernameLabelMe: {
    marginTop: 2,
    marginRight: 10,
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  chatPreviewText: {
    fontSize: 13,
    color: '#e2e8f0',
    marginBottom: 4,
  },
  chatHint: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 2,
  },

  chatQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },

  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 10, 25, 0.85)',
    borderRadius: 26,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 2,
    gap: 2,
  },
  messageInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 8,
    maxHeight: 80,
  },
  inputIconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
});

export default HomeGlobalChat;
