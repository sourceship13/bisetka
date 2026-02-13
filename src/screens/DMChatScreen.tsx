import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import ChatPanel from '../components/ChatPanel';
import { useAuth } from '../context/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import chatService from '../services/chat.service';

type Props = NativeStackScreenProps<RootStackParamList, 'DMChat'>;

const DMChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { chatId, chatName } = route.params;
  const { user } = useAuth();

  const handleNewMessage = async () => {
    // Mark as read when new message arrives
    try {
      await chatService.markRead(chatId);
    } catch (error) {
      console.warn('Failed to mark as read:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{chatName}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ChatPanel 
        chatId={chatId}
        chatType="direct"
        currentUserId={user?.id || ''}
        onNewMessage={handleNewMessage}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
});

export default DMChatScreen;
