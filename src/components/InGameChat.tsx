import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import chatService, { Message } from '../services/chat.service';
import chatSocketService from '../services/chatSocket.service';
import tokenService from '../services/token.service';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { socketService } from '../services/SocketService';

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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(300, SCREEN_WIDTH * 0.78);

const GIFTS = [
  { emoji: '🍌', label: 'Banana' },
  { emoji: '🍅', label: 'Tomato' },
  { emoji: '⭐', label: 'Star' },
  { emoji: '🪨', label: 'Rock' },
  { emoji: '💎', label: 'Diamond' },
  { emoji: '🌹', label: 'Rose' },
  { emoji: '🍎', label: 'Apple' },
  { emoji: '🎁', label: 'Gift' },
  { emoji: '🏆', label: 'Trophy' },
  { emoji: '🎯', label: 'Bullseye' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💰', label: 'Coins' },
  { emoji: '🎪', label: 'Confetti' },
  { emoji: '🌟', label: 'Glowing Star' },
  { emoji: '🎉', label: 'Party' },
];

const InGameChat: React.FC<InGameChatProps> = ({
  roomId,
  currentUserId,
  gameType,
  visible,
  opponentUsername,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastMsg, setToastMsg] = useState<{ sender: string; text: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(false);
  const [activeGift, setActiveGift] = useState<string | null>(null);
  const giftOverlayAnim = useRef(new Animated.Value(0)).current;
  const giftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showGiftOverlay = (emoji: string) => {
    if (giftTimer.current) clearTimeout(giftTimer.current);
    setActiveGift(emoji);
    giftOverlayAnim.setValue(0);
    Animated.spring(giftOverlayAnim, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 14,
      speed: 8,
    }).start();
    giftTimer.current = setTimeout(() => {
      Animated.timing(giftOverlayAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }).start(() => setActiveGift(null));
    }, 20000);
  };

  // ── Gift overlay — listen on move_made (proven relay path) ──────────────────
  useEffect(() => {
    if (!visible || !roomId) return;
    const socket = socketService.getSocket();
    if (!socket) return;
    const handleMoveMade = (data: { move?: { type?: string; emoji?: string } }) => {
      if (data?.move?.type === 'gift_overlay' && data.move.emoji) {
        showGiftOverlay(data.move.emoji);
      }
    };
    socket.on('move_made', handleMoveMade);
    return () => { socket.off('move_made', handleMoveMade); };
  }, [visible, roomId]);

  const showToast = (sender: string, text: string) => {
    // Cancel any pending hide
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({ sender, text });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMsg(null));
  };

  const toggleChat = () => {
    const opening = !isOpenRef.current;
    isOpenRef.current = opening;
    setIsOpen(opening);
    if (opening) setUnreadCount(0);
    Animated.spring(slideAnim, {
      toValue: opening ? 0 : -PANEL_WIDTH,
      useNativeDriver: true,
      bounciness: 0,
      speed: 16,
    }).start();
  };

  // ── Voice chat ─────────────────────────────────────────────────────────────
  const {
    callState,
    isMuted,
    isOpponentMuted,
    startCall,
    hangup,
    toggleMute,
    toggleOpponentMute,
  } = useVoiceChat(roomId, currentUserId, visible);

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

    // Real-time handler
    const handleNew = (msg: Message) => {
      console.log('[InGameChat] Received message via socket:', msg.id, msg.content);
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) {
          console.log('[InGameChat] Duplicate message, skipping:', msg.id);
          return prev;
        }
        console.log('[InGameChat] Adding new message to state');
        return [...prev, msg];
      });
      // Scroll to bottom when new message arrives
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      // Show gift overlay when the OPPONENT sends a gift (sender already sees it on tap)
      if (msg.sender_id !== currentUserId) {
        const giftMatch = GIFTS.find(
          g => msg.content.startsWith(g.emoji) && msg.content.includes('gifted')
        );
        if (giftMatch) showGiftOverlay(giftMatch.emoji);
      }
      // Badge + toast when panel is closed
      if (!isOpenRef.current) {
        setUnreadCount(prev => prev + 1);
        const sender = msg.sender_id === currentUserId
          ? 'You'
          : (msg.sender_username || opponentUsername || 'Player');
        showToast(sender, msg.content);
      }
    };

    chatSocketService.onMessage(chatId, handleNew);
    console.log('[InGameChat] Registered message handler for chat:', chatId);

    return () => {
      cancelled = true;
      chatSocketService.offMessage(chatId, handleNew);
      chatSocketService.leaveChat(chatId);
    };
  }, [chatId, currentUserId]);

  const handleGift = async (gift: { emoji: string; label: string }) => {
    setShowGiftPanel(false);
    showGiftOverlay(gift.emoji);
    // Relay to opponent via make_move → move_made pipeline (proven to work)
    const socket = socketService.getSocket();
    if (socket && roomId) {
      socket.emit('make_move', { roomId, userId: currentUserId, move: { type: 'gift_overlay', emoji: gift.emoji } });
    }
    const text = `${gift.emoji} gifted a ${gift.label}!`;
    // Single player: no chat room — show locally only
    if (!chatId) {
      const localMsg: Message = {
        id: `local-${Date.now()}`,
        content: text,
        sender_id: currentUserId || 'me',
        sender_username: 'You',
        created_at: new Date().toISOString(),
      } as Message;
      setMessages(prev => [...prev, localMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      return;
    }
    try {
      const { message } = await chatService.postMessage(chatId, text);
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      console.warn('[InGameChat] gift send error:', err);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !chatId) return;
    setInputText('');
    try {
      const { message } = await chatService.postMessage(chatId, text);
      // Add message locally for immediate display (socket will also broadcast it)
      setMessages(prev => {
        // Avoid duplicate if socket already delivered it
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      console.warn('[InGameChat] send error:', err);
      setInputText(text);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0]![0] + parts[1]![0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getProfileColor = (userId: string) => {
    // Generate consistent color based on user ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    const index = userId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === currentUserId;
    const senderName = isMe ? 'You' : (item.sender_username || opponentUsername || 'Player');
    const profileColor = getProfileColor(item.sender_id);

    return (
      <View style={styles.messageContainer}>
        {/* Profile Picture */}
        <View style={[styles.profilePic, { backgroundColor: profileColor }]}>
          <Text style={styles.initials}>{getInitials(senderName)}</Text>
        </View>

        {/* Message Content */}
        <View style={styles.messageContent}>
          <Text style={styles.senderName}>{senderName}</Text>
          <View style={styles.messageBar}>
            <Text style={styles.messageText} numberOfLines={2}>
              {item.content}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View
        style={[styles.slideWrapper, { transform: [{ translateX: slideAnim }] }]}
        pointerEvents="box-none"
      >
        {/* ── Chat panel ───────────────────────────────────────────── */}
        <View style={styles.panel} pointerEvents={isOpen ? 'auto' : 'none'}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>

        {/* Messages List */}
        <View style={styles.messagesWrapper}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            inverted={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={null}
          />
        </View>

        {/* ── Voice Chat Bar ────────────────────────────────────────────── */}
        <View style={styles.voiceBar}>
          {callState === 'idle' && (
            <TouchableOpacity style={styles.voiceStartBtn} onPress={startCall} activeOpacity={0.75}>
              <Text style={styles.voiceStartIcon}>🎙</Text>
              <Text style={styles.voiceStartLabel}>Voice chat</Text>
            </TouchableOpacity>
          )}

          {callState === 'connecting' && (
            <View style={styles.voiceActiveRow}>
              <ActivityIndicator size="small" color="#F5C518" style={{ marginRight: 8 }} />
              <Text style={styles.voiceStatusText}>Connecting…</Text>
              <TouchableOpacity style={[styles.voiceIconBtn, styles.voiceHangupBtn]} onPress={hangup}>
                <Text style={styles.voiceIconText}>📵</Text>
              </TouchableOpacity>
            </View>
          )}

          {callState === 'connected' && (
            <View style={styles.voiceActiveRow}>
              {/* Self mute */}
              <TouchableOpacity
                style={[styles.voiceIconBtn, isMuted && styles.voiceBtnMuted]}
                onPress={toggleMute}
                activeOpacity={0.75}>
                <Text style={styles.voiceIconText}>{isMuted ? '🔇' : '🎙'}</Text>
              </TouchableOpacity>

              {/* Status dot */}
              <View style={styles.voiceConnectedDot} />
              <Text style={styles.voiceStatusText}>Live</Text>

              {/* Opponent mute */}
              <TouchableOpacity
                style={[styles.voiceIconBtn, isOpponentMuted && styles.voiceBtnMuted]}
                onPress={toggleOpponentMute}
                activeOpacity={0.75}>
                <Text style={styles.voiceIconText}>{isOpponentMuted ? '🔕' : '🔊'}</Text>
              </TouchableOpacity>

              {/* Hang up */}
              <TouchableOpacity style={[styles.voiceIconBtn, styles.voiceHangupBtn]} onPress={hangup} activeOpacity={0.75}>
                <Text style={styles.voiceIconText}>📵</Text>
              </TouchableOpacity>
            </View>
          )}

          {callState === 'error' && (
            <View style={styles.voiceActiveRow}>
              <Text style={styles.voiceErrorText}>⚠ Could not connect</Text>
              <TouchableOpacity style={styles.voiceRetryBtn} onPress={startCall}>
                <Text style={styles.voiceRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Gift Panel — inline above input, visible when expanded */}
        {showGiftPanel && (
          <ScrollView
            style={styles.giftPanel}
            contentContainerStyle={styles.giftPanelContent}
            showsVerticalScrollIndicator={false}>
            {GIFTS.map(g => (
              <TouchableOpacity
                key={g.emoji}
                style={styles.giftItem}
                onPress={() => handleGift(g)}
                activeOpacity={0.7}>
                <Text style={styles.giftEmoji}>{g.emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Send Message"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              maxLength={500}
            />

            {/* Gift Arrow Button */}
            <TouchableOpacity
              style={styles.giftBtn}
              onPress={() => setShowGiftPanel(prev => !prev)}
              activeOpacity={0.75}>
              <Text style={styles.giftBtnIcon}>{showGiftPanel ? '▼' : '▲'}</Text>
            </TouchableOpacity>

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim()}>
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>

            {/* Menu Button */}
            <TouchableOpacity style={styles.menuBtn}>
              <Text style={styles.menuIcon}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>

      </KeyboardAvoidingView>
        </View>

        {/* ── Chat tab (always visible at left edge) ───────────────── */}
        <TouchableOpacity
          style={[styles.chatTab, unreadCount > 0 && !isOpen && styles.chatTabUnread]}
          onPress={toggleChat}
          activeOpacity={0.8}
        >
          {isOpen ? (
            <Text style={styles.chatTabClose}>✕</Text>
          ) : (
            <>
              <Text style={styles.chatTabLabel}>CHAT</Text>
              {unreadCount > 0 && (
                <View style={styles.chatTabBadge}>
                  <Text style={styles.chatTabBadgeText}>
                    {unreadCount > 9 ? '9+' : String(unreadCount)}
                  </Text>
                </View>
              )}
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* ── Gift overlay (both players, 20 s) ──────────────────── */}
      {activeGift && (
        <Animated.View
          style={[
            styles.giftOverlay,
            {
              opacity: giftOverlayAnim,
              transform: [
                {
                  scale: giftOverlayAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 1],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.giftOverlayEmoji}>{activeGift}</Text>
        </Animated.View>
      )}

      {/* ── Center-screen message toast ───────────────────────────── */}
      {toastMsg && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastAnim,
              transform: [{ scale: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastSender}>💬 Chat</Text>
          <Text style={styles.toastText} numberOfLines={2}>{toastMsg.text}</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 999,
  },
  toast: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 3,
    left: 40,
    right: 40,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 1100,
  },
  toastSender: {
    color: '#F5C518',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 19,
  },
  slideWrapper: {
    position: 'absolute',
    left: 0,
    bottom: 90,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  panel: {
    width: PANEL_WIDTH,
    backgroundColor: 'rgba(0,0,12,0.88)',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chatTab: {
    width: 28,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  chatTabUnread: {
    backgroundColor: 'rgba(59,130,246,0.8)',
  },
  chatTabLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    transform: [{ rotate: '-90deg' }],
    width: 56,
    textAlign: 'center',
  },
  chatTabClose: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  chatTabBadge: {
    position: 'absolute',
    top: 5,
    right: 3,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  chatTabBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  container: {
    width: '100%',
  },
  messagesWrapper: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    maxHeight: 240,
  },
  messageList: {
    justifyContent: 'flex-start',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  profilePic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  initials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  messageContent: {
    flex: 1,
  },
  senderName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  messageBar: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    maxWidth: PANEL_WIDTH - 80,
  },
  messageText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    lineHeight: 18,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    paddingTop: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 0,
    paddingRight: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  sendBtnDisabled: {
    opacity: 0.3,
  },
  sendIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  menuIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 2,
  },

  // ── Voice chat bar ─────────────────────────────────────────────────────────
  voiceBar: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minHeight: 42,
    justifyContent: 'center',
  },
  voiceStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(100, 100, 255, 0.25)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(150,150,255,0.35)',
  },
  voiceStartIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  voiceStartLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  voiceActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceStatusText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  voiceConnectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
    marginRight: 4,
  },
  voiceIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginRight: 8,
  },
  voiceBtnMuted: {
    backgroundColor: 'rgba(239,68,68,0.35)',
    borderColor: 'rgba(239,68,68,0.55)',
  },
  voiceHangupBtn: {
    backgroundColor: 'rgba(220,38,38,0.4)',
    borderColor: 'rgba(220,38,38,0.6)',
  },
  voiceIconText: {
    fontSize: 16,
  },
  voiceErrorText: {
    color: '#FCA5A5',
    fontSize: 13,
    flex: 1,
  },
  voiceRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  voiceRetryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Gift panel ─────────────────────────────────────────────────────────────
  giftDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  giftPanel: {
    maxHeight: 220,
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: 'rgba(10,10,20,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  giftPanelContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  giftItem: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftEmoji: {
    fontSize: 26,
  },
  giftBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  giftOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1050,
  },
  giftOverlayEmoji: {
    fontSize: 130,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  giftBtnIcon: {
    color: '#F5C518',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default InGameChat;
