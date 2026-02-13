import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import ChatPanel from '../components/ChatPanel';
import chatService from '../services/chat.service';
import { useAuth } from '../context/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import {colors, spacing, typography} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GlobalChat'>;

const GlobalChatScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGlobalChat();
  }, []);

  const loadGlobalChat = async () => {
    try {
      setLoading(true);
      const result = await chatService.getGlobalChat();
      setChatId(result.chatId);
    } catch (error) {
      console.error('Failed to load global chat:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (!chatId) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Failed to load global chat</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadGlobalChat}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={colors.gradients.primary}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🌍 Global Chat</Text>
        <View style={styles.placeholder} />
      </LinearGradient>
      
      <ChatPanel 
        chatId={chatId}
        chatType="global"
        currentUserId={user?.id || ''}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
  },
  backText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  errorText: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.huge,
  },
  retryButton: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignSelf: 'center',
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default GlobalChatScreen;
