import React, { useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BisetkaAlert } from '../../utils/BisetkaAlert';
import chatService from '../../services/chat.service';
import apiService from '../../services/api.service';
import useDeviceType from '../../hooks/useDeviceType';
import { getSpacing, getFontSize } from '../../theme/responsive';

type HomeGlobalChatProps = {
  onOpenFullChat: () => void;
  initialExpanded?: boolean;
};

type RecentMessage = {
  username?: string;
  sender_username?: string;
  content?: string;
  message?: string;
};

const HomeGlobalChat = ({
  onOpenFullChat,
  initialExpanded = true,
}: HomeGlobalChatProps) => {
  const { isTablet } = useDeviceType();
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  // On tablets, always expanded. On phones, controlled state
  const [chatExpanded, setChatExpanded] = useState(isTablet ? true : initialExpanded);
  const [chatId, setChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  const ensureChatId = useCallback(async (): Promise<string | null> => {
    if (chatId) {
      return chatId;
    }

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

          if (expanded) {
            scrollToBottom();
          }

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
    if (!newMessage.trim() || !chatId || sendingMessage) {
      return;
    }

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
    // On tablets, chat is always expanded - don't allow collapse
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

  return (
    <View style={styles.globalChatContainer}>
      <View
        style={[styles.globalChatCard, chatExpanded && styles.globalChatCardExpanded]}>
        <View style={styles.globalChatHeader}>
          <View style={styles.globalChatTitleRow}>
            <Icon name="earth" size={20} color="#10b981" />
            <Text style={styles.globalChatTitle}>Global Chat</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Only show collapse button on phones */}
            {!isTablet && (
              <TouchableOpacity onPress={toggleChatExpanded} style={styles.expandButton}>
                <Icon
                  name={chatExpanded ? 'chevron-down' : 'chevron-up'}
                  size={24}
                  color="#94a3b8"
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onOpenFullChat} style={styles.expandButton}>
              <Icon name="arrow-expand" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={chatScrollRef}
          style={[styles.chatPreview, chatExpanded && styles.chatPreviewExpanded]}
          contentContainerStyle={styles.chatScrollContent}
          showsVerticalScrollIndicator
          onContentSizeChange={scrollToBottom}>
          {recentMessages.length > 0 ? (
            <>
              {recentMessages.map((msg, idx) => (
                <View key={`${msg.sender_username || msg.username || 'anon'}-${idx}`} style={styles.messagePreview}>
                  <Text style={styles.messageUsername} numberOfLines={1}>
                    {msg.sender_username || msg.username || 'Anonymous'}
                  </Text>
                  <Text style={styles.messageText}>{msg.content || msg.message}</Text>
                </View>
              ))}
            </>
          ) : (
            <View>
              <Text style={styles.chatPreviewText}>💬 Players chatting worldwide...</Text>
              <Text style={styles.chatHint}>
                {chatExpanded ? 'No messages yet. Be the first!' : 'Tap to expand'}
              </Text>
            </View>
          )}
        </ScrollView>

        {chatExpanded && (
          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type a message..."
              placeholderTextColor="#64748b"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || sendingMessage}
              style={[
                styles.sendButton,
                (!newMessage.trim() || sendingMessage) && styles.sendButtonDisabled,
              ]}>
              <Icon
                name={sendingMessage ? 'loading' : 'send'}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        )}

        {!chatExpanded && (
          <View style={styles.chatQuickActions}>
            <Icon name="message-text" size={16} color="#64748b" />
            <Text style={styles.quickActionText}>
              Send a message • See who's online • Make friends
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  globalChatContainer: {
    marginTop: 16,
    marginBottom: 12,
  },
  globalChatCard: {
    backgroundColor:'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    margin:20,

  },
  globalChatCardExpanded: {
    minHeight: 400,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  globalChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  globalChatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  globalChatTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ef4444',
    letterSpacing: 0.5,
  },
  expandButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
  },
  chatPreview: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    minHeight: 60,
    maxHeight: 120,
  },
  chatPreviewExpanded: {
    maxHeight: 300,
    flex: 1,
  },
  chatScrollContent: {
    flexGrow: 1,
  },
  messagePreview: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  messageUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  chatPreviewText: {
    fontSize: 14,
    color: '#e2e8f0',
    marginBottom: 4,
  },
  chatHint: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 4,
  },
  chatQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 8,
    gap: 8,
  },
  messageInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
});

export default HomeGlobalChat;