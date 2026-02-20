import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {colors, spacing} from '../theme';
import chatRoomService, {ChatRoom, ChatRoomMessage, ChatRoomMember} from '../services/chatRoom.service';
import {useAuth} from '../libs/hooks/useAuth';
import {socketService} from '../services/SocketService';

const ChatRoomScreen = ({route, navigation}: any) => {
  const {roomId} = route.params;
  const {user} = useAuth();
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatRoomMessage[]>([]);
  const [members, setMembers] = useState<ChatRoomMember[]>([]);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    loadRoomData();
    setupSocketListeners();

    return () => {
      cleanupSocketListeners();
    };
  }, [roomId]);

  const loadRoomData = async () => {
    try {
      const [roomData, messagesData, membersData] = await Promise.all([
        chatRoomService.getRoomById(roomId),
        chatRoomService.getMessages(roomId),
        chatRoomService.getRoomMembers(roomId),
      ]);

      setRoom(roomData.room);
      setMessages(messagesData.messages);
      setMembers(membersData.members);
    } catch (error) {
      console.error('Failed to load room data:', error);
      Alert.alert('Error', 'Failed to load chat room');
      navigation.goBack();
    }
  };

  const setupSocketListeners = () => {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Join the chat room
    socket.emit('join_chat_room', { roomId, userId: user?.id });

    // Listen for new messages
    socket.on('new_chat_room_message', (data: { roomId: string; message: ChatRoomMessage }) => {
      if (data.roomId === roomId) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    // Listen for typing indicators
    socket.on('user_typing', (data: { userId: string; isTyping: boolean }) => {
      if (data.isTyping) {
        setTypingUsers(prev => [...new Set([...prev, data.userId])]);
      } else {
        setTypingUsers(prev => prev.filter(id => id !== data.userId));
      }
    });

    // Listen for user join/leave
    socket.on('user_joined_room', () => {
      loadMembers();
    });

    socket.on('user_left_room', () => {
      loadMembers();
    });
  };

  const cleanupSocketListeners = () => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('leave_chat_room', { roomId, userId: user?.id });
    socket.off('new_chat_room_message');
    socket.off('user_typing');
    socket.off('user_joined_room');
    socket.off('user_left_room');
  };

  const loadMembers = async () => {
    try {
      const { members: membersData } = await chatRoomService.getRoomMembers(roomId);
      setMembers(membersData);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const tempMessage: ChatRoomMessage = {
      id: Date.now().toString(),
      room_id: roomId,
      user_id: user?.id || '',
      username: user?.username || '',
      avatar_url: user?.avatar_url || undefined,
      message: inputText.trim(),
      message_type: 'text',
      is_edited: false,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    handleTyping(false);

    try {
      const { message } = await chatRoomService.sendMessage(roomId, inputText.trim());
      
      // Replace temp message with real one
      setMessages(prev => prev.map(msg => msg.id === tempMessage.id ? message : msg));
      
      // Emit via socket for real-time delivery
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('chat_room_message', { roomId, message });
      }

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleTyping = (isTyping: boolean) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('chat_room_typing', { roomId, userId: user?.id, isTyping });

    if (isTyping) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => handleTyping(false), 3000);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (text.length === 1) handleTyping(true);
  };

  const handleShareRoom = async () => {
    if (!room) return;
    try {
      await Share.share({
        message: `Join my chat room "${room.name}"!\nShare Code: ${room.share_code}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const renderMessage = ({item}: {item: ChatRoomMessage}) => {
    const isMe = item.user_id === user?.id;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        {!isMe && (
          <Text style={styles.senderName}>{item.username}</Text>
        )}
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {item.message}
        </Text>
        <Text style={styles.timestamp}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  const renderMember = ({item}: {item: ChatRoomMember}) => (
    <View style={styles.memberItem}>
      <View style={[styles.statusDot, item.is_online && styles.statusOnline]} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.username}</Text>
        <Text style={styles.memberRole}>{item.role}</Text>
      </View>
      {item.is_typing && <Text style={styles.typingIndicator}>⌨️</Text>}
    </View>
  );

  const typingText = typingUsers.length > 0 
    ? members
        .filter(m => typingUsers.includes(m.user_id) && m.user_id !== user?.id)
        .map(m => m.username)
        .slice(0, 3)
        .join(', ') + ' ' + (typingUsers.length === 1 ? 'is' : 'are') + ' typing...'
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.roomName}>{room?.name || 'Loading...'}</Text>
          <Text style={styles.memberCount}>
            {members.filter(m => m.is_online).length} online • {members.length} members
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowMembers(!showMembers)} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>👥</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShareRoom} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>🔗</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Messages */}
        <View style={styles.messagesContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />

          {typingText && (
            <View style={styles.typingContainer}>
              <Text style={styles.typingText}>{typingText}</Text>
            </View>
          )}
        </View>

        {/* Members Sidebar */}
        {showMembers && (
          <View style={styles.membersContainer}>
            <Text style={styles.membersTitle}>Members</Text>
            <FlatList
              data={members}
              keyExtractor={item => item.id}
              renderItem={renderMember}
              contentContainerStyle={styles.membersList}
            />
          </View>
        )}
      </View>

      {/* Input */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.text.tertiary}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}>
            <LinearGradient
              colors={inputText.trim() ? ['#10b981', '#34d399'] : ['#374151', '#4b5563']}
              style={styles.sendGradient}>
              <Text style={styles.sendButtonText}>Send</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.secondary,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    fontSize: 24,
    color: colors.primary,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  memberCount: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerBtn: {
    padding: spacing.sm,
  },
  headerBtnText: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.sm,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#10b981',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background.secondary,
  },
  senderName: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: colors.text.primary,
  },
  timestamp: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  typingContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  typingText: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  membersContainer: {
    width: 200,
    backgroundColor: colors.background.secondary,
    borderLeftWidth: 1,
    borderLeftColor: colors.background.tertiary,
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.tertiary,
  },
  membersList: {
    padding: spacing.sm,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.tertiary,
    marginRight: spacing.sm,
  },
  statusOnline: {
    backgroundColor: '#10b981',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    color: colors.text.primary,
  },
  memberRole: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  typingIndicator: {
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.background.tertiary,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text.primary,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ChatRoomScreen;
