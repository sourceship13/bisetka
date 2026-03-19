import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { socketService } from '../../../services/SocketService';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import Config from 'react-native-config';

const { width, height } = Dimensions.get('window');

// Mapbox imports (optional - will gracefully handle if not installed)
let MapboxGL: any = null;
try {
  MapboxGL = require('@rnmapbox/maps').default;
  MapboxGL?.setAccessToken(Config.MAPBOX_ACCESS_TOKEN || '');
} catch (e) {
  console.log('Mapbox not installed - showing setup instructions');
}

interface GameSession {
  id: string;
  gameType: string;
  playerCount: number;
  maxPlayers: number;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  roomName?: string;
}

const GAME_ICONS: Record<string, string> = {
  blot: '🃏',
  'baazar-blot': '⚡',
  checkers: '🔴',
  chess: '♟️',
  poker: '♠️',
  nardi: '🎲',
  billiards: '🎱',
  '9-ball': '9️⃣',
  mrotsi: '🎯',
  slots: '🎰',
};

const GlobalViewScreen = ({ navigation, route }: any) => {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);
  const [mapboxAvailable] = useState(!!MapboxGL);
  const userId = route?.params?.userId || 'guest';

  useEffect(() => {
    const socket = socketService.getSocket();
    console.log('🌍 GlobalView: Socket status:', {
      exists: !!socket,
      connected: socket?.connected,
      id: socket?.id,
    });
    
    if (!socket) {
      console.log('❌ Socket not connected');
      setLoading(false);
      // Don't show alert - just show empty state
      return;
    }

    // Set timeout in case backend doesn't respond
    const timeout = setTimeout(() => {
      console.log('⏱️ Global sessions request timed out - showing empty state');
      setLoading(false);
      setSessions([]);
    }, 5000); // 5 second timeout

    // Request global sessions
    console.log('📡 Requesting global sessions...');
    socket.emit('get_global_sessions');

    // Listen for session updates
    socket.on('global_sessions', (data: GameSession[]) => {
      console.log('📍 Received global sessions:', data?.length || 0);
      clearTimeout(timeout);
      setSessions(data || []);
      setLoading(false);
    });

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      if (socket.connected) {
        socket.emit('get_global_sessions');
      }
    }, 30000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      socket.off('global_sessions');
    };
  }, []);

  const handleSessionPress = (session: GameSession) => {
    setSelectedSession(session);
  };

  const handleJoinSession = (session: GameSession) => {
    navigation.navigate('ActiveRoomDetail', {
      dbSessionId: session.id,
      gameType: session.gameType,
    });
  };

  const renderMapView = () => {
    if (!mapboxAvailable) {
      return (
        <View style={styles.setupContainer}>
          <Icon name="earth-off" size={80} color="rgba(255,255,255,0.3)" />
          <Text style={styles.setupTitle}>Mapbox Not Installed</Text>
          <Text style={styles.setupText}>
            To enable the global map view, install Mapbox:
          </Text>
          <View style={styles.setupCode}>
            <Text style={styles.setupCodeText}>npm install @rnmapbox/maps</Text>
          </View>
          <Text style={styles.setupText}>
            See GLOBAL_VIEW_SETUP.md for full instructions
          </Text>
          <TouchableOpacity
            style={styles.setupButton}
            onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              style={styles.setupButtonGrad}>
              <Text style={styles.setupButtonText}>Go Back</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <MapboxGL.MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/dark-v11"
        projection="globe"
        zoomEnabled={true}
        rotateEnabled={true}
        pitchEnabled={true}>
        <MapboxGL.Camera
          zoomLevel={1}
          centerCoordinate={[0, 20]}
          animationMode="flyTo"
          animationDuration={2000}
        />

        {/* Render markers for each session */}
        {sessions.map((session) => (
          <MapboxGL.MarkerView
            key={session.id}
            id={session.id}
            coordinate={[session.longitude, session.latitude]}>
            <TouchableOpacity
              style={styles.marker}
              onPress={() => handleSessionPress(session)}>
              <LinearGradient
                colors={['#10b981', '#34d399']}
                style={styles.markerGrad}>
                <Text style={styles.markerIcon}>
                  {GAME_ICONS[session.gameType] || '🎮'}
                </Text>
                <Text style={styles.markerCount}>{session.playerCount}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </MapboxGL.MarkerView>
        ))}
      </MapboxGL.MapView>
    );
  };

  const renderSessionsList = () => (
    <View style={styles.listContainer}>
      <ScrollView style={styles.sessionsList}>
        {sessions.map((session) => (
          <TouchableOpacity
            key={session.id}
            style={styles.sessionCard}
            onPress={() => handleJoinSession(session)}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']}
              style={styles.sessionCardGrad}>
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionIcon}>
                  {GAME_ICONS[session.gameType] || '🎮'}
                </Text>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionName}>
                    {session.roomName || session.gameType.toUpperCase()}
                  </Text>
                  <Text style={styles.sessionLocation}>
                    📍 {session.city || 'Unknown'}, {session.country || 'World'}
                  </Text>
                </View>
                <View style={styles.sessionPlayers}>
                  <Text style={styles.playersText}>
                    {session.playerCount}/{session.maxPlayers}
                  </Text>
                  <Text style={styles.playersLabel}>Players</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderSessionDetail = () => {
    if (!selectedSession) return null;

    return (
      <View style={styles.detailOverlay}>
        <TouchableOpacity
          style={styles.detailBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedSession(null)}
        />
        <View style={styles.detailCard}>
          <LinearGradient
            colors={['#1f2937', '#111827']}
            style={styles.detailGrad}>
            <Text style={styles.detailIcon}>
              {GAME_ICONS[selectedSession.gameType] || '🎮'}
            </Text>
            <Text style={styles.detailTitle}>
              {selectedSession.roomName || selectedSession.gameType.toUpperCase()}
            </Text>
            <Text style={styles.detailLocation}>
              📍 {selectedSession.city || 'Unknown'}, {selectedSession.country || 'World'}
            </Text>
            <Text style={styles.detailPlayers}>
              👥 {selectedSession.playerCount}/{selectedSession.maxPlayers} Players
            </Text>
            <View style={styles.detailButtons}>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => handleJoinSession(selectedSession)}>
                <LinearGradient
                  colors={['#10b981', '#34d399']}
                  style={styles.detailBtnGrad}>
                  <Text style={styles.detailBtnText}>Join Game</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => setSelectedSession(null)}>
                <LinearGradient
                  colors={['#6b7280', '#9ca3af']}
                  style={styles.detailBtnGrad}>
                  <Text style={styles.detailBtnText}>Close</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading global sessions...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🌍 Global View</Text>
          <Text style={styles.headerSubtitle}>
            {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            const socket = socketService.getSocket();
            if (!socket || !socket.connected) {
              BisetkaAlert.error('Connection Error', 'Not connected to server');
              return;
            }
            setLoading(true);
            socket.emit('get_global_sessions');
            // Auto-stop loading after 5 seconds if no response
            setTimeout(() => {
              setLoading(false);
            }, 5000);
          }}>
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Map or List */}
      {mapboxAvailable ? (
        <>
          {renderMapView()}
          {sessions.length === 0 && (
            <View style={styles.emptyOverlay}>
              <Icon name="earth" size={60} color="rgba(255,255,255,0.4)" />
              <Text style={styles.emptyTitle}>No Active Sessions</Text>
              <Text style={styles.emptyText}>
                {!socketService.getSocket()?.connected
                  ? 'Connecting to server...'
                  : 'Be the first to start a global game!'}
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('GameSelection')}>
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6']}
                  style={styles.emptyButtonGrad}>
                  <Text style={styles.emptyButtonText}>Start a Game</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
          {renderSessionDetail()}
        </>
      ) : sessions.length > 0 ? (
        renderSessionsList()
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="earth" size={80} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>No Active Sessions</Text>
          <Text style={styles.emptyText}>
            {!socketService.getSocket()?.connected
              ? 'Connecting to server...'
              : 'Be the first to start a global game!'}
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('GameSelection')}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              style={styles.emptyButtonGrad}>
              <Text style={styles.emptyButtonText}>Start a Game</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0c29',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  markerGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIcon: {
    fontSize: 24,
  },
  markerCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  listContainer: {
    flex: 1,
  },
  sessionsList: {
    flex: 1,
    padding: 16,
  },
  sessionCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sessionCardGrad: {
    padding: 16,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  sessionLocation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  sessionPlayers: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  playersText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  playersLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  detailCard: {
    width: width * 0.85,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  detailGrad: {
    padding: 24,
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 60,
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  detailLocation: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  detailPlayers: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 20,
  },
  detailButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  detailBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  detailBtnGrad: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    pointerEvents: 'box-none',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGrad: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
  },
  setupText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  setupCode: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  setupCodeText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#10b981',
  },
  setupButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  setupButtonGrad: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  setupButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default GlobalViewScreen;
