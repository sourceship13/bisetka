# Global View - Quick Start Guide

## ✅ What's Already Done

1. **Frontend Screen**: `GlobalViewScreen.tsx` - fully functional
2. **Navigation**: Green earth button added to home screen (first icon)
3. **Fallback UI**: Works without Mapbox (shows list view)
4. **Socket Integration**: Ready to receive `global_sessions` events

## 🚀 To See It In Action (3 Steps)

### Step 1: Navigate to Global View

1. Open the app
2. Tap the **green earth icon** (top right, first button)
3. You'll see either:
   - Map view (if Mapbox installed)
   - List view (if Mapbox not installed)
   - Empty state (if no sessions)

### Step 2: Install Mapbox (Optional but Recommended)

```bash
cd bisetka
npm install @rnmapbox/maps
```

Get a free token: https://account.mapbox.com/

Add to `.env`:
```
MAPBOX_ACCESS_TOKEN=pk.your_token_here
```

**iOS**: Add to `ios/bisetka/Info.plist`:
```xml
<key>MGLMapboxAccessToken</key>
<string>$(MAPBOX_ACCESS_TOKEN)</string>
```

**Android**: Add to `android/app/build.gradle`:
```gradle
resValue "string", "mapbox_access_token", System.getenv("MAPBOX_ACCESS_TOKEN") ?: ""
```

Rebuild:
```bash
cd ios && pod install && cd ..
npm run ios
```

### Step 3: Add Backend Support

Emit mock data to test the UI:

```typescript
// In your socket connection handler
socket.emit('global_sessions', [
  {
    id: 'test-1',
    gameType: 'nardi',
    playerCount: 2,
    maxPlayers: 4,
    latitude: 40.7128,
    longitude: -74.0060,
    city: 'New York',
    country: 'USA',
    roomName: 'NYC Nardi Night'
  },
  {
    id: 'test-2',
    gameType: 'chess',
    playerCount: 1,
    maxPlayers: 2,
    latitude: 51.5074,
    longitude: -0.1278,
    city: 'London',
    country: 'UK',
    roomName: 'London Chess Club'
  },
  {
    id: 'test-3',
    gameType: 'blot',
    playerCount: 3,
    maxPlayers: 4,
    latitude: 40.4093,
    longitude: 49.8671,
    city: 'Baku',
    country: 'Azerbaijan',
    roomName: 'Baku Blot League'
  }
]);
```

## 🎮 What Users See

### With Mapbox Installed:
- Interactive 3D globe
- Glowing green markers for each session
- Game icon + player count on markers
- Tap marker → see details → join game
- Zoom in/out, rotate, fly to locations

### Without Mapbox:
- Scrollable list of sessions
- Same information (game, location, players)
- Tap card → join game directly
- Shows "Mapbox not installed" instructions

### No Sessions:
- Empty state with earth icon
- "No Active Sessions" message
- Encourages user to create first game

## 🔧 Testing Checklist

- [ ] Green earth button visible on home screen
- [ ] Tapping button navigates to Global View
- [ ] Screen loads without crashing
- [ ] Back button returns to home
- [ ] Refresh button works (icon in header)
- [ ] Session count displays correctly
- [ ] Markers appear on map (if Mapbox + sessions)
- [ ] Tapping marker shows detail popup
- [ ] Join button navigates to game room
- [ ] Empty state shows when no sessions
- [ ] List view works without Mapbox

## 🐛 Troubleshooting

**"Property 'POINT_WIDTH' doesn't exist"**
- Already fixed in `NardiScreen.tsx`
- Clear cache: `watchman watch-del-all`

**"Cannot find module '@rnmapbox/maps'"**
- Expected if not installed yet
- Screen falls back to list view gracefully
- Install Mapbox when ready

**No sessions showing**
- Backend hasn't emitted `global_sessions` yet
- Add mock data (see Step 3 above)
- Check socket connection in logs

**Map is black/blank**
- Mapbox token missing or invalid
- Check `.env` file
- Verify token at https://account.mapbox.com/

## 📱 User Flow

```
Home Screen
  ↓ (tap green earth)
Global View Screen
  ↓ (see live sessions on globe)
Tap Marker
  ↓ (popup appears)
Tap "Join Game"
  ↓
Active Room Detail Screen
  ↓
Game starts!
```

## 🌍 Future Enhancements

- [ ] Filter by game type
- [ ] Filter by player count
- [ ] Show session age (created X minutes ago)
- [ ] Clustering for dense areas
- [ ] Search by location/city
- [ ] "Near Me" button
- [ ] Favorite locations
- [ ] Session notifications for specific cities

---

**Ready to test?** Just reload the app and tap that green earth button! 🌍🎮
