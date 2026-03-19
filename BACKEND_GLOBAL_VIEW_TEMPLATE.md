# Backend: Global View Socket Integration

## Required Socket Events

Add these socket event handlers to your backend (Node.js/Socket.io):

### 1. Get Global Sessions

```typescript
socket.on('get_global_sessions', async () => {
  try {
    // Query active game sessions from your database
    const sessions = await db.query(`
      SELECT 
        gs.id,
        gs.game_type as "gameType",
        COUNT(gsp.user_id) as "playerCount",
        gs.max_players as "maxPlayers",
        gs.latitude,
        gs.longitude,
        gs.city,
        gs.country,
        gs.room_name as "roomName"
      FROM game_sessions gs
      LEFT JOIN game_session_players gsp ON gs.id = gsp.session_id
      WHERE gs.status = 'active'
        AND gs.is_public = true
        AND gs.latitude IS NOT NULL
        AND gs.longitude IS NOT NULL
      GROUP BY gs.id
      ORDER BY gs.created_at DESC
    `);

    // Emit back to requesting client
    socket.emit('global_sessions', sessions);
  } catch (error) {
    console.error('Error fetching global sessions:', error);
    socket.emit('global_sessions', []);
  }
});
```

### 2. Broadcast Session Updates

When a session is created/updated/ended, broadcast to all connected clients:

```typescript
// When session is created
io.emit('global_sessions_update', {
  action: 'created',
  session: newSession
});

// When player joins/leaves
io.emit('global_sessions_update', {
  action: 'updated',
  session: updatedSession
});

// When session ends
io.emit('global_sessions_update', {
  action: 'ended',
  sessionId: sessionId
});
```

### 3. Client-side Listener (Already Implemented)

The GlobalView screen automatically:
- Requests sessions on mount
- Listens for real-time updates
- Refreshes every 30 seconds
- Updates markers on the map

## Database Schema (Example)

```sql
-- Add location columns to game_sessions table
ALTER TABLE game_sessions
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8),
ADD COLUMN city VARCHAR(100),
ADD COLUMN country VARCHAR(100),
ADD COLUMN is_public BOOLEAN DEFAULT true;

-- Create index for location queries
CREATE INDEX idx_game_sessions_location 
ON game_sessions(latitude, longitude, status);
```

## Getting Player Location

### Option 1: IP Geolocation (Simple)

```typescript
import geoip from 'geoip-lite';

function getLocationFromIP(ip: string) {
  const geo = geoip.lookup(ip);
  return {
    latitude: geo?.ll?.[0] || null,
    longitude: geo?.ll?.[1] || null,
    city: geo?.city || null,
    country: geo?.country || null,
  };
}

// When creating session
const location = getLocationFromIP(socket.handshake.address);
```

### Option 2: Client GPS (More Accurate)

Client sends location when creating session:

```typescript
// Client-side (React Native)
import Geolocation from '@react-native-community/geolocation';

Geolocation.getCurrentPosition(
  (position) => {
    socket.emit('create_session', {
      gameType: 'nardi',
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
  },
  (error) => console.error('Location error:', error),
  { enableHighAccuracy: false, timeout: 5000 }
);
```

### Option 3: Hybrid Approach (Best)

```typescript
// Use GPS if available, fallback to IP
async function getSessionLocation(clientLocation?: { lat: number; lng: number }, ip?: string) {
  if (clientLocation) {
    return {
      latitude: clientLocation.lat,
      longitude: clientLocation.lng,
      // Reverse geocode to get city/country
      ...(await reverseGeocode(clientLocation.lat, clientLocation.lng))
    };
  }
  
  // Fallback to IP geolocation
  return getLocationFromIP(ip);
}
```

## Privacy Considerations

1. **Public Sessions Only**: Only show sessions marked as `is_public`
2. **Approximate Location**: Round coordinates to ~1km precision
3. **Opt-out**: Allow users to disable location sharing
4. **Clear UI**: Show indicator when location is being used

```typescript
// Round to ~1km precision (2 decimal places)
function approximateLocation(lat: number, lng: number) {
  return {
    latitude: Math.round(lat * 100) / 100,
    longitude: Math.round(lng * 100) / 100,
  };
}
```

## Testing Without Backend

The screen works without backend changes:
- Shows empty state when no sessions
- Shows "Mapbox not installed" message if Mapbox isn't set up
- Falls back to list view if map unavailable

## Next Steps

1. Install Mapbox: `npm install @rnmapbox/maps`
2. Get Mapbox token: https://account.mapbox.com/
3. Add to `.env`: `MAPBOX_ACCESS_TOKEN=pk.xxx`
4. Implement backend socket handlers
5. Test with mock location data
6. Deploy and monitor usage

---

**Questions?** Check the Socket.io docs or existing session handlers in your backend.
