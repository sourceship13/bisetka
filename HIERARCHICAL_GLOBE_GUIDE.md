# Hierarchical Globe Markers - Implementation Guide

## Visual Design

### Marker Hierarchy

**Level 1: Country Clusters (zoom level < 3)**
- Large circle with country flag emoji
- Shows total active Bisetkas in country
- Example: 🇺🇸 256 active

**Level 2: City Markers (zoom level 3-8)**
- Medium circles, color-coded by activity
- City name + active sessions count
- Example: "Houston • 42 active"

**Level 3: Neighborhood Markers (zoom level > 8)**
- Small pins, individual neighborhoods
- Game type icon + player count
- Example: "Montrose 🎲 (4/8)"

### Color Scheme

```typescript
const MARKER_COLORS = {
  nearest: '#10b981',      // Green - Your closest Bisetka
  high_activity: '#f59e0b', // Orange - 10+ active sessions
  medium: '#3b82f6',        // Blue - 3-9 sessions
  low: '#6b7280',           // Gray - 1-2 sessions
  empty: '#374151',         // Dark gray - No sessions
};
```

## Updated GlobalView Component

Add to `GlobalViewScreen.tsx`:

```typescript
import Geolocation from '@react-native-community/geolocation';

interface BisetkaLocation {
  id: string;
  neighborhood_name: string;
  city_name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  active_sessions: number;
  total_players: number;
  is_nearest?: boolean;
  distance_km?: number;
}

const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
const [nearestBisetka, setNearestBisetka] = useState<BisetkaLocation | null>(null);
const [zoomLevel, setZoomLevel] = useState(1);

// Get user's location on mount
useEffect(() => {
  Geolocation.getCurrentPosition(
    (position) => {
      const loc = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setUserLocation(loc);
      
      // Request nearest Bisetka
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('get_nearest_bisetka', loc);
        socket.on('nearest_bisetka', (data) => {
          setNearestBisetka(data.nearest);
        });
      }
    },
    (error) => console.log('Location error:', error),
    { enableHighAccuracy: false, timeout: 5000 }
  );
}, []);

// Group markers by zoom level
const getVisibleMarkers = () => {
  if (zoomLevel < 3) {
    // Show country clusters
    return groupByCountry(sessions);
  } else if (zoomLevel < 8) {
    // Show city markers
    return groupByCity(sessions);
  } else {
    // Show all neighborhoods
    return sessions;
  }
};

// Render marker with appropriate styling
const renderMarker = (bisetka: BisetkaLocation) => {
  const isNearest = nearestBisetka?.id === bisetka.id;
  const color = isNearest 
    ? MARKER_COLORS.nearest 
    : getActivityColor(bisetka.active_sessions);
  
  return (
    <MapboxGL.MarkerView
      key={bisetka.id}
      coordinate={[bisetka.longitude, bisetka.latitude]}>
      <TouchableOpacity
        style={[
          styles.marker,
          { borderColor: color, borderWidth: isNearest ? 3 : 2 }
        ]}
        onPress={() => handleMarkerPress(bisetka)}>
        <LinearGradient
          colors={isNearest ? ['#10b981', '#34d399'] : [color, color]}
          style={styles.markerGrad}>
          {isNearest && <Text style={styles.nearestBadge}>📍</Text>}
          <Text style={styles.markerIcon}>
            {GAME_ICONS[bisetka.gameType] || '🎮'}
          </Text>
          <Text style={styles.markerCount}>
            {bisetka.active_sessions}
          </Text>
          {isNearest && (
            <Text style={styles.distanceText}>
              {bisetka.distance_km?.toFixed(1)}km
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </MapboxGL.MarkerView>
  );
};
```

## Nearest Bisetka Banner

Add to the top of GlobalView screen:

```typescript
{nearestBisetka && (
  <View style={styles.nearestBanner}>
    <LinearGradient
      colors={['#10b981', '#059669']}
      style={styles.nearestGrad}>
      <View style={styles.nearestContent}>
        <Icon name="map-marker" size={24} color="#fff" />
        <View style={styles.nearestText}>
          <Text style={styles.nearestTitle}>Nearest Bisetka</Text>
          <Text style={styles.nearestLocation}>
            {nearestBisetka.neighborhood_name}, {nearestBisetka.city_name}
          </Text>
          <Text style={styles.nearestDistance}>
            {nearestBisetka.distance_km?.toFixed(1)}km away • {nearestBisetka.active_sessions} active
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.nearestButton}
        onPress={() => flyToNearest()}>
        <Text style={styles.nearestButtonText}>Go →</Text>
      </TouchableOpacity>
    </LinearGradient>
  </View>
)}

const flyToNearest = () => {
  if (!nearestBisetka) return;
  
  // Animate camera to nearest Bisetka
  cameraRef.current?.setCamera({
    centerCoordinate: [nearestBisetka.longitude, nearestBisetka.latitude],
    zoomLevel: 12,
    animationDuration: 2000,
  });
};
```

## Clustering for Dense Areas

```typescript
// When many markers are close together, show cluster
const getClusteredMarkers = (markers: BisetkaLocation[]) => {
  const clusters: Map<string, BisetkaLocation[]> = new Map();
  
  markers.forEach(marker => {
    // Group by 0.1 degree grid (~11km)
    const key = `${Math.floor(marker.latitude * 10)},${Math.floor(marker.longitude * 10)}`;
    
    if (!clusters.has(key)) {
      clusters.set(key, []);
    }
    clusters.get(key)!.push(marker);
  });
  
  return Array.from(clusters.values()).map(group => {
    if (group.length === 1) {
      return group[0];
    }
    
    // Create cluster marker
    return {
      id: `cluster-${group[0].id}`,
      latitude: group.reduce((sum, m) => sum + m.latitude, 0) / group.length,
      longitude: group.reduce((sum, m) => sum + m.longitude, 0) / group.length,
      active_sessions: group.reduce((sum, m) => sum + m.active_sessions, 0),
      cluster_size: group.length,
      members: group,
    };
  });
};
```

## Search / Autocomplete

```typescript
<TextInput
  style={styles.searchInput}
  placeholder="Search city or neighborhood..."
  value={searchQuery}
  onChangeText={setSearchQuery}
/>

{searchResults.map(result => (
  <TouchableOpacity
    key={result.id}
    style={styles.searchResult}
    onPress={() => {
      // Fly to selected location
      cameraRef.current?.setCamera({
        centerCoordinate: [result.longitude, result.latitude],
        zoomLevel: 10,
      });
      setSearchQuery('');
    }}>
    <Text style={styles.resultText}>
      {result.neighborhood_name}, {result.city_name}
    </Text>
    <Text style={styles.resultSessions}>
      {result.active_sessions} active
    </Text>
  </TouchableOpacity>
))}
```

---

**Implementation Checklist:**
- [ ] Run populate-locations.js script
- [ ] Create database tables & indexes
- [ ] Add API endpoints
- [ ] Update socket handlers
- [ ] Get user location permission
- [ ] Show nearest Bisetka banner
- [ ] Implement hierarchical markers
- [ ] Add search/autocomplete
- [ ] Test on real device with GPS
