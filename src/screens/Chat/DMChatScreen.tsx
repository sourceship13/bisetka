import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AraratBackground from '../../components/AraratBackground';
import ChatPanel from '../../components/global/ChatPanel';
import { useAuth } from '../../libs/hooks/useAuth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import chatService from '../../services/chat.service';
import AVATARS, { resolveAvatar } from '../../utils/avatars';

type Props = NativeStackScreenProps<RootStackParamList, 'DMChat'>;

const DMChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { chatId, chatName, avatarUrl, isOnline } = route.params;
  const { user } = useAuth();

  const handleNewMessage = async () => {
    try {
      await chatService.markRead(chatId);
    } catch (error) {
      console.warn('Failed to mark as read:', error);
    }
  };

  const avatarSource = resolveAvatar(avatarUrl) || AVATARS[0].source;

  return (
    <View style={styles.container}>
      <AraratBackground overlayOpacity={0.55} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Top blurred header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIconBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topHeaderTitle}>Messages</Text>
          <View style={styles.topHeaderRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('PointsShop')}
              activeOpacity={0.85}>
              <View style={styles.pointsPill}>
                <Text style={styles.pointsCoin}>🪙</Text>
                <Text style={styles.pointsAmount}>
                  {Math.floor(user?.balance || 0).toLocaleString()}
                </Text>
                <View style={styles.pointsPlus}>
                  <Icon name="plus" size={12} color="#fff" />
                  <Text style={styles.pointsPlusText}>Get Points</Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('GlobalView', { userId: user?.id })
              }
              style={styles.globeBtn}
              activeOpacity={0.85}>
              <Icon name="earth" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Purple contact gradient strip */}
        <View
          style={styles.contactBar}>
          <View style={styles.contactAvatarWrap}>
            <View style={styles.contactAvatar}>
              <Image source={avatarSource} style={styles.avatarImg} resizeMode="contain" />
            </View>
            {isOnline !== false && <View style={styles.onlineDot} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactName} numberOfLines={1}>
              {chatName}
            </Text>
            <Text style={styles.contactSubtitle}>
              {isOnline === false ? 'Offline' : 'Online'}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7}>
            <Icon name="dots-vertical" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ChatPanel
          chatId={chatId}
          chatType="direct"
          currentUserId={user?.id || ''}
          onNewMessage={handleNewMessage}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0716',
  },
  safeArea: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(8, 6, 24, 0.78)',
    borderRadius: 18,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 4,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 14, 60, 0.95)',
    borderWidth: 1.5,
    borderColor: '#7c4dff',
    gap: 6,
  },
  pointsCoin: { fontSize: 16 },
  pointsAmount: { color: '#fff', fontWeight: '800', fontSize: 14 },
  pointsPlus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f59e0b',
    marginLeft: 4,
    gap: 2,
  },
  pointsPlusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  globeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    backgroundColor: '#6f5cf2',
  },
  contactAvatarWrap: {
    width: 44,
    height: 44,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3ddc84',
    borderWidth: 2,
    borderColor: '#3a2f8f',
  },
  contactName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  contactSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
});

export default DMChatScreen;
