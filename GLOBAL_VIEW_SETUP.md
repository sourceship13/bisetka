# Global View Setup Guide

## Installation

```bash
cd bisetka
npm install @rnmapbox/maps
```

## Mapbox Token Setup

1. Create a free account at https://account.mapbox.com/
2. Get your **Public Access Token** from the dashboard
3. Add to your `.env` file:

```env
MAPBOX_ACCESS_TOKEN=pk.your_token_here
```

## iOS Configuration

Edit `ios/bisetka/Info.plist`:

```xml
<key>MGLMapboxAccessToken</key>
<string>$(MAPBOX_ACCESS_TOKEN)</string>
```

## Android Configuration

Edit `android/app/build.gradle`:

```gradle
defaultConfig {
    // ... existing config
    resValue "string", "mapbox_access_token", System.getenv("MAPBOX_ACCESS_TOKEN") ?: ""
}
```

## Features

- **3D Globe View**: Zoomable, rotatable globe
- **Live Game Sessions**: See active games around the world
- **Location-Based**: Find nearby bisetka sessions
- **Player Counts**: See how many players in each session
- **Tap to Join**: Tap a marker to view and join a session

## API Integration

The screen expects this socket.io event:

```typescript
socket.on('global_sessions', (sessions: Array<{
  id: string;
  gameType: string;
  playerCount: number;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}>));
```

Backend should emit `global_sessions` when:
- Client connects
- New session is created
- Session ends
- Player joins/leaves
