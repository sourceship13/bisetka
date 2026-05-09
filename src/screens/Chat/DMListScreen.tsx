import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import chatService, { Chat } from '../../services/chat.service';
import { useAuth } from '../../libs/hooks/useAuth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import AVATARS, { resolveAvatar } from '../../utils/avatars';
import BottomTabBar from '../../components/global/BottomTabBar';

type Props = NativeStackScreenProps<RootStackParamList, 'DMList'>;

type FilterTab = 'all' | 'private' | 'group';

const formatTime = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const DMListScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const loadChats = useCallback(async () => {
    try {
      setLoading(true);
      const result = await chatService.getChats();
      // Exclude global chat from messages list
      const filtered = result.chats.filter(c => c.type !== 'global');
      setChats(filtered);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats]),
  );

  const handleChatPress = (chat: Chat) => {
    navigation.navigate('DMChat', {
      chatId: chat.id,
      chatName: chat.name || 'Direct Message',
    });
  };

  const filteredChats = useMemo(() => {
    let list = chats;
    if (filter === 'private') list = list.filter(c => c.type === 'direct');
    if (filter === 'group') list = list.filter(c => c.type === 'room');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.last_message_preview || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [chats, filter, search]);

  const renderChat = ({ item, index }: { item: Chat; index: number }) => {
    const isGroup = item.type === 'room';
    const avatar = resolveAvatar(item.avatar_url) || AVATARS[0].source;
    const time = formatTime(item.last_message_at);
    const unread = item.unread_count ?? 0;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.row}
        onPress={() => handleChatPress(item)}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarCircle}>
            <Image source={avatar} style={styles.avatarImg} resizeMode="contain" />
          </View>
          {isGroup && (
            <View style={styles.groupOverlay}>
              <View style={[styles.avatarCircle, styles.avatarCircleSmall]}>
                <Image
                  source={AVATARS[1]?.source || AVATARS[0].source}
                  style={styles.avatarImg}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.groupCount}>
                <Text style={styles.groupCountText}>+3</Text>
              </View>
            </View>
          )}
          {!isGroup && index === 0 && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.contentCol}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || 'Direct Message'}
          </Text>
          <Text style={styles.preview} numberOfLines={1}>
            {item.last_message_preview || 'Say hello 👋'}
          </Text>
        </View>

        <View style={styles.metaCol}>
          <Text style={styles.time}>{time || '—'}</Text>
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unread}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'private', label: 'Private chats' },
    { key: 'group', label: 'Group chats' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.topHeader}>
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

        {/* Filter tabs */}
        <View style={styles.tabsRow}>
          {TABS.map(tab => {
            const active = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.85}
                onPress={() => setFilter(tab.key)}
                style={[styles.tabBtn, active && styles.tabBtnActive]}>
                <Text
                  style={[styles.tabLabel, active && styles.tabLabelActive]}
                  numberOfLines={1}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Icon name="magnify" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : filteredChats.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a game and chat with other players
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredChats}
            keyExtractor={item => item.id}
            renderItem={renderChat}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
      <BottomTabBar active="Messages" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#100828',
  },
  safeArea: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(40, 22, 96, 0.55)',
    borderRadius: 22,
  },
  topHeaderTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
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
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  globeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 77, 255, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(99, 76, 222, 0.55)',
    borderColor: '#7c4dff',
  },
  tabLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 28,
    borderWidth: 1.2,
    borderColor: 'rgba(124, 77, 255, 0.5)',
    backgroundColor: 'rgba(20, 14, 60, 0.55)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 14,
    padding: 0,
  },
  listContent: {
    paddingBottom: 130,
    paddingTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrap: {
    width: 50,
    height: 50,
    position: 'relative',
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#100828',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  groupOverlay: {
    position: 'absolute',
    top: -4,
    left: 18,
  },
  groupCount: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#7c4dff',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#100828',
  },
  groupCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#100828',
  },
  contentCol: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  preview: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
  },
  metaCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  time: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(124, 77, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default DMListScreen;
