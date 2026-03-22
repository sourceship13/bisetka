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
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import bisetkaService from '../../../services/bisetka.service';
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
  status: string;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  roomName?: string;
  hostUsername?: string;
  guestUsername?: string;
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
  bisetka: '🏘️', // Bisetka neighborhood icon
};

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const GlobalViewScreen = ({ navigation }: any) => {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);
  const [mapboxAvailable] = useState(!!MapboxGL);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestBisetka, setNearestBisetka] = useState<GameSession | null>(null);

  const loadBisetkas = async (options?: {
    showLoader?: boolean;
    showError?: boolean;
  }) => {
    if (options?.showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      console.log('🌍 [GlobalView] Loading Bisetkas...');
      const bisetkas = await bisetkaService.getGlobeBisetkas();
      console.log('🌍 [GlobalView] Received Bisetkas:', bisetkas.length);

      const allSessions = bisetkas
        .map(b => ({
          ...b,
          lat: Number(b.lat),
          lng: Number(b.lng),
        }))
        .filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lng))
        .map(b => ({
          id: b.id,
          gameType: 'bisetka',
          playerCount: b.active_users,
          maxPlayers: 100,
          status: b.active_users > 0 ? 'active' : 'idle',
          latitude: b.lat,
          longitude: b.lng,
          city: b.city,
          country: b.country,
          roomName: b.neighborhood_name,
          hostUsername:
            b.active_users > 0
              ? `${b.active_users} ${b.active_users === 1 ? 'player' : 'players'}`
              : 'No active players yet',
          guestUsername: undefined,
        }));

      console.log('🌍 [GlobalView] Created sessions:', allSessions.length);
      console.log('🌍 [GlobalView] First session:', allSessions[0]);
      setSessions(allSessions);

      if (userLocation && allSessions.length > 0) {
        let nearest = allSessions[0];
        let minDistance = Infinity;

        for (const session of allSessions) {
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            session.latitude,
            session.longitude
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearest = session;
          }
        }

        setNearestBisetka(nearest);
        setSelectedSession(current => current ?? nearest);
        console.log(`🏘️ Nearest Bisetka: ${nearest.roomName}, ${nearest.city} (${minDistance.toFixed(1)} km away)`);
      } else {
        setNearestBisetka(null);
        setSelectedSession(null);
      }
    } catch (error: any) {
      console.warn('Failed to load Bisetkas', error);
      if (options?.showError) {
        BisetkaAlert.error(
          'Global View Unavailable',
          error?.message || 'Unable to load Bisetka locations right now.',
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Get user's current location
  useEffect(() => {
    const getUserLocation = async () => {
      try {
        const Geolocation = require('@react-native-community/geolocation').default;
        Geolocation.getCurrentPosition(
          (position: any) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setUserLocation(location);
            console.log('📍 User location:', location);
          },
          (error: any) => {
            console.warn('Failed to get user location:', error);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      } catch (error) {
        console.warn('Geolocation not available:', error);
      }
    };

    getUserLocation();
  }, []);

  useEffect(() => {
    void loadBisetkas({showLoader: true});

    const interval = setInterval(() => {
      void loadBisetkas();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [userLocation]);

  const handleSessionPress = (session: GameSession) => {
    // Navigate to BisetkaDetail screen to show Kings and leaderboard
    navigation.navigate('BisetkaDetail', {
      bisetkaId: session.id,
      bisetkaName: session.roomName || 'Unknown',
      city: session.city || 'Unknown',
      country: session.country || 'World',
    });
  };

  const handleJoinSession = (session: GameSession) => {
    // Same as handleSessionPress - go to BisetkaDetail
    handleSessionPress(session);
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

    // Center camera on nearest Bisetka if available, but allow free movement
    const cameraCoordinate = nearestBisetka
      ? [nearestBisetka.longitude, nearestBisetka.latitude]
      : [0, 20];
    const cameraZoom = nearestBisetka ? 8 : 2; // Zoom out a bit more to see surrounding Bisetkas

    return (
      <MapboxGL.MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/dark-v11"
        projection="globe"
        zoomEnabled={true}
        scrollEnabled={true}
        rotateEnabled={true}
        pitchEnabled={true}
        compassEnabled={true}
        scaleBarEnabled={false}>
        <MapboxGL.Camera
          zoomLevel={cameraZoom}
          centerCoordinate={cameraCoordinate}
          animationMode="easeTo"
          animationDuration={1500}
          minZoomLevel={1}
          maxZoomLevel={18}
        />

        {/* Render markers for each Bisetka */}
        {sessions.map((session) => {
          const isNearest = nearestBisetka && session.id === nearestBisetka.id;
          return (
            <MapboxGL.MarkerView
              key={session.id}
              id={session.id}
              coordinate={[session.longitude, session.latitude]}>
              <TouchableOpacity
                style={styles.marker}
                onPress={() => handleSessionPress(session)}>
                <LinearGradient
                  colors={isNearest ? ['#f59e0b', '#fbbf24'] : ['#10b981', '#34d399']}
                  style={[styles.markerGrad, isNearest && styles.markerGradNearest]}>
                  <Text style={styles.markerIcon}>
                    {isNearest ? '📍' : GAME_ICONS[session.gameType] || '🏘️'}
                  </Text>
                  <Text style={styles.markerCount}>{session.playerCount}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </MapboxGL.MarkerView>
          );
        })}
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
                  <Text style={styles.sessionHost}>
                    {session.hostUsername
                      ? `Host: ${session.hostUsername}`
                      : 'Host location'}
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
            <Text style={styles.detailHost}>
              {selectedSession.hostUsername
                ? `Host: ${selectedSession.hostUsername}`
                : 'Host location available'}
            </Text>
            {!!selectedSession.guestUsername && (
              <Text style={styles.detailHost}>
                Guest: {selectedSession.guestUsername}
              </Text>
            )}
            <View style={styles.detailButtons}>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => handleJoinSession(selectedSession)}>
                <View style={{backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 8, alignItems: 'center'}}>
                  <Text style={styles.detailBtnText}>Join Game</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => setSelectedSession(null)}>
                <View style={{backgroundColor: '#6b7280', paddingVertical: 14, borderRadius: 8, alignItems: 'center'}}>
                  <Text style={styles.detailBtnText}>Close</Text>
                </View>
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
        <Text style={styles.loadingText}>Loading Bisetka locations...</Text>
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
            {sessions.length} {sessions.length === 1 ? 'Bisetka location' : 'Bisetka locations'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={async () => {
            await loadBisetkas({ showError: true });
          }}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="refresh" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Map or List */}
      {mapboxAvailable ? (
        <>
          {renderMapView()}
          {sessions.length === 0 && (
            <View style={styles.emptyOverlay}>
              {/* <Icon name="earth" size={60} color="rgba(255,255,255,0.4)" />
              <Text style={styles.emptyTitle}>No Active Sessions</Text>
              <Text style={styles.emptyText}>
                No active rooms with saved location data yet.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('GameSelection')}>
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6']}
                  style={styles.emptyButtonGrad}>
                  <Text style={styles.emptyButtonText}>Start a Game</Text>
                </LinearGradient>
              </TouchableOpacity> */}
            </View>
          )}
          {renderSessionDetail()}
        </>
      ) : sessions.length > 0 ? (
        renderSessionsList()
      ) : (
        <View style={styles.emptyContainer}>
          {/* <Icon name="earth" size={80} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>No Active Sessions</Text>
          <Text style={styles.emptyText}>
            No active rooms with saved location data yet.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('GameSelection')}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              style={styles.emptyButtonGrad}>
              <Text style={styles.emptyButtonText}>Start a Game</Text>
            </LinearGradient>
          </TouchableOpacity> */}
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
  markerGradNearest: {
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 12,
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
  sessionHost: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
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
    margin:20,
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
    marginBottom: 6,
  },
  detailHost: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
  },
  detailButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    margin:20,
  },
  detailBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  detailBtnGrad: {
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
