import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import onlineUsersService, { OnlineUser } from '../services/onlineUsers.service';
import { resolveAvatar } from '../utils/avatars';
import { useAuth } from '../libs/hooks/useAuth';

interface OnlinePlayersListProps {
  onPlayerPress?: (user: OnlineUser) => void;
  maxPlayers?: number;
}

const OnlinePlayersList: React.FC<OnlinePlayersListProps> = ({
  onPlayerPress,
  maxPlayers = 50,
}) => {
  const { user: currentUser } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOnlineUsers = async () => {
    try {
      const response = await onlineUsersService.getOnlineUsers(maxPlayers);
      let users = response.users;
      // Always include the current logged-in user in the list
      if (currentUser && !users.some(u => u.id === currentUser.id)) {
        users = [{
          id: currentUser.id,
          username: currentUser.username || 'Me',
          avatar_url: currentUser.avatar_url || undefined,
          last_seen: new Date().toISOString(),
          is_online: true,
        }, ...users];
      }
      setOnlineUsers(users);
    } catch (error) {
      console.error('Failed to load online users:', error);
      // Set empty array on error to prevent crash
      setOnlineUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOnlineUsers();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadOnlineUsers();
    }, 30000);

    return () => clearInterval(interval);
  }, [maxPlayers]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOnlineUsers();
  };

  const renderPlayer = (user: OnlineUser) => {
    const avatarSource = resolveAvatar(user.avatar_url);
    
    return (
      <TouchableOpacity
        key={user.id}
        style={styles.playerCard}
        onPress={() => onPlayerPress?.(user)}
        activeOpacity={0.7}>
        <View style={styles.avatarContainer}>
          {avatarSource ? (
            <View style={styles.avatarClip}>
              <Image
                source={avatarSource}
                style={styles.avatar}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user.username.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.onlineIndicator} />
        </View>
        <Text style={styles.username} numberOfLines={1}>
          {user.username}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (onlineUsers.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No players online</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      {onlineUsers.map(renderPlayer)}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  playerCard: {
    alignItems: 'center',
    width: 80,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 90,
    height: 160,
    position: 'absolute',
    top: 25,
    left: -10,
  },
  avatarClip: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    overflow: 'hidden',
    backgroundColor: '#e1e1e1',
  },
  avatarPlaceholder: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  username: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OnlinePlayersList;
