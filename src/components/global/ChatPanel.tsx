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
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import chatService, { Message } from '../../services/chat.service';
import chatSocketService from '../../services/chatSocket.service';

interface ChatPanelProps {
  chatId: string;
  chatType: 'global' | 'room' | 'direct';
  currentUserId: string;
  onNewMessage?: (message: Message) => void;
  keyboardAvoidingViewStyle?: any;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  chatId,
  chatType,
  currentUserId,
  onNewMessage,
  keyboardAvoidingViewStyle,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();

    chatSocketService.joinChat(chatId, currentUserId);

    const handleNewMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      if (onNewMessage) onNewMessage(message);
    };

    chatSocketService.onMessage(chatId, handleNewMessage);

    return () => {
      chatSocketService.offMessage(chatId, handleNewMessage);
      chatSocketService.leaveChat(chatId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const loadMessages = async () => {
    try {
      const result = await chatService.getMessages(chatId, 50);
      setMessages(result.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    try {
      const result = await chatService.postMessage(chatId, inputText.trim());
      setMessages(prev => [...prev, result.message]);
      setInputText('');
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      if (onNewMessage) onNewMessage(result.message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === currentUserId;
    const showName = chatType !== 'direct';
    const username =
      (item as any).sender_username ||
      (item as any).username ||
      (isMe ? 'Me' : 'Anonymous');
    return (
      <View
        style={[
          styles.row,
          isMe ? styles.rowMe : styles.rowOther,
        ]}>
        <View
          style={[
            styles.bubble,
            isMe ? styles.bubbleMe : styles.bubbleOther,
          ]}>
          <Text
            style={[
              styles.bubbleText,
              isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
            ]}>
            {item.content}
          </Text>
        </View>
        <View style={[styles.metaRow, isMe ? styles.metaRowMe : styles.metaRowOther]}>
          {showName && (
            <Text
              style={[
                styles.usernameLabel,
                isMe && styles.usernameLabelMe,
              ]}
              numberOfLines={1}>
              {username}
            </Text>
          )}
          <Text style={[styles.timestamp, isMe ? styles.timestampMe : styles.timestampOther]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, keyboardAvoidingViewStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
      />

      <View style={styles.inputWrap}>
        <View style={styles.inputPill}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType={Platform.OS === 'ios' ? 'ultraThinMaterialDark' : 'dark'}
            blurAmount={Platform.OS === 'ios' ? 24 : 18}
            reducedTransparencyFallbackColor="rgba(20, 14, 32, 0.55)"
          />
          <View style={styles.inputGlassTint} pointerEvents="none" />
          <TouchableOpacity style={styles.inputIconBtn} activeOpacity={0.7}>
            <Icon name="paperclip" size={20} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Start typing..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.7}>
            <Icon
              name="send"
              size={20}
              color={inputText.trim() ? '#d8c8ff' : 'rgba(255,255,255,0.4)'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messageList: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
  },
  row: {
    marginVertical: 5,
    maxWidth: '78%',
  },
  rowMe: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleOther: {
    backgroundColor: 'rgba(15,10,25,0.85)',
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bubbleMe: {
    backgroundColor: '#d8c8ff',
    borderBottomRightRadius: 6,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextOther: {
    color: '#ffffff',
  },
  bubbleTextMe: {
    color: '#1a1230',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 11,
  },
  timestampOther: {
    color: 'rgba(255,255,255,0.55)',
  },
  timestampMe: {
    color: 'rgba(255,255,255,0.6)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    paddingHorizontal: 6,
    gap: 6,
    maxWidth: '100%',
  },
  metaRowMe: {
    justifyContent: 'flex-end',
  },
  metaRowOther: {
    justifyContent: 'flex-start',
  },
  usernameLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(216, 200, 255, 0.95)',
    maxWidth: 160,
  },
  usernameLabelMe: {
    color: 'rgba(216, 200, 255, 0.95)',
  },
  inputWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 12,
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 4,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inputGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inputIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingHorizontal: 6,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 100,
  },
});

export default ChatPanel;
