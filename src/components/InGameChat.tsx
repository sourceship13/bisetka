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
  Image,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const flatListRef = useRef<FlatList>(null);

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
    };

    chatSocketService.onMessage(chatId, handleNew);
    console.log('[InGameChat] Registered message handler for chat:', chatId);

    return () => {
      cancelled = true;
      chatSocketService.offMessage(chatId, handleNew);
      chatSocketService.leaveChat(chatId);
    };
  }, [chatId, currentUserId]);

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
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  container: {
    width: '100%',
  },
  messagesWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    maxHeight: 260,
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
    backdropFilter: 'blur(10px)',
    maxWidth: SCREEN_WIDTH - 100,
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
});

export default InGameChat;
