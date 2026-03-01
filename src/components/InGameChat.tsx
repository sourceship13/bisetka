import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import chatService, { Message } from '../services/chat.service';
import chatSocketService from '../services/chatSocket.service';
import tokenService from '../services/token.service';

interface InGameChatProps {
  /** The game room ID — used as the game session ID to get/create a chat */
  roomId: string;
  /** Current player's user ID */
  currentUserId: string;
  /** e.g. 'blot', 'chess', 'baazar-blot' */
  gameType: string;
  /** Only show the overlay when the game is actually in progress */
  visible: boolean;
  /** Display name of the opponent, shown in the panel header */
  opponentUsername?: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.46);

const InGameChat: React.FC<InGameChatProps> = ({
  roomId,
  currentUserId,
  gameType,
  visible,
  opponentUsername,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  // Start panel translated fully out of view (below screen)
  const panelAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const isOpenRef = useRef(false);

  // Sync ref with state for use inside socket callbacks
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // ── Step 1: Get/create chat room when game is active ──────────────────────
  useEffect(() => {
    if (!roomId || !visible) return;

    let cancelled = false;
    chatService
      .getOrCreateGameChat(roomId, gameType)
      .then(({ chatId: id }) => {
        if (!cancelled) setChatId(id);
      })
      .catch(err => console.warn('[InGameChat] getOrCreateGameChat failed:', err));

    return () => { cancelled = true; };
  }, [roomId, gameType, visible]);

  // ── Step 2: Connect socket + load history when chatId is ready ─────────────
  useEffect(() => {
    if (!chatId || !currentUserId) return;

    let cancelled = false;

    const setup = async () => {
      try {
        // Connect socket (no-op if already connected)
        const token = (await tokenService.getAccessToken()) || '';
        await chatSocketService.connect(currentUserId, token);
        if (cancelled) return;

        chatSocketService.joinChat(chatId, currentUserId);

        // Load recent message history
        const { messages: history } = await chatService.getMessages(chatId, 30);
        if (!cancelled) setMessages(history);
      } catch (err) {
        console.warn('[InGameChat] setup error:', err);
      }
    };

    setup();

    // Real-time handler — skip if message ID already in list (prevents
    // duplicates when postMessage + socket both deliver the same message)
    const handleNew = (msg: Message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (!isOpenRef.current) {
        setUnreadCount(prev => prev + 1);
      } else {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      }
    };

    chatSocketService.onMessage(chatId, handleNew);

    return () => {
      cancelled = true;
      chatSocketService.offMessage(chatId, handleNew);
      chatSocketService.leaveChat(chatId);
    };
  }, [chatId, currentUserId]);

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const openPanel = () => {
    setUnreadCount(0);
    setIsOpen(true);
    Animated.spring(panelAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 75,
      friction: 11,
    }).start(() => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 120);
    });
  };

  const closePanel = () => {
    Animated.spring(panelAnim, {
      toValue: PANEL_HEIGHT,
      useNativeDriver: true,
      tension: 75,
      friction: 11,
    }).start(() => setIsOpen(false));
  };

  const togglePanel = () => (isOpen ? closePanel() : openPanel());

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !chatId) return;
    setInputText('');
    try {
      await chatService.postMessage(chatId, text);
      // The socket broadcast will deliver the message via handleNew —
      // no manual append here to avoid duplicate keys.
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (err) {
      console.warn('[InGameChat] send error:', err);
      setInputText(text); // restore on failure
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === currentUserId;
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {!isMe && (
          <Text style={styles.senderName}>
            {item.sender_username || opponentUsername || 'Opponent'}
          </Text>
        )}
        <Text style={[styles.bubbleText, isMe ? styles.textMe : styles.textThem]}>
          {item.content}
        </Text>
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">

      {/* ── Sliding panel ───────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.panel, { transform: [{ translateY: panelAnim }] }]}
        pointerEvents={isOpen ? 'auto' : 'none'}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
          style={{ flex: 1 }}>

          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>💬 Game Chat</Text>
            {opponentUsername ? (
              <Text style={styles.panelSubtitle}>vs {opponentUsername}</Text>
            ) : null}
            <TouchableOpacity
              onPress={closePanel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No messages yet — say hi! 👋
              </Text>
            }
          />

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim()}>
              <Text style={styles.sendBtnText}>↑</Text>
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </Animated.View>

      {/* ── Floating toggle button ───────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={togglePanel}
        activeOpacity={0.8}>
        <Text style={styles.fabIcon}>💬</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : String(unreadCount)}
            </Text>
          </View>
        )}
      </TouchableOpacity>

    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_HEIGHT,
    backgroundColor: 'rgba(10, 10, 25, 0.93)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  panelTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  panelSubtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    marginRight: 10,
  },
  closeBtn: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  bubble: {
    maxWidth: '80%',
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 122, 255, 0.88)',
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  senderName: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textMe: {
    color: '#fff',
  },
  textThem: {
    color: 'rgba(255,255,255,0.9)',
  },
  timestamp: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: '#fff',
    fontSize: 15,
    maxHeight: 80,
  },
  sendBtn: {
    marginLeft: 8,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 92,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  fabIcon: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default InGameChat;
