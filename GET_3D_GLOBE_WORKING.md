# Get the 3D Globe Working - 2 Minute Setup

## ✅ What I've Already Done For You

1. ✅ Installed Mapbox: `npm install @rnmapbox/maps`
2. ✅ Configured iOS Info.plist
3. ✅ Added MAPBOX_ACCESS_TOKEN to .env (placeholder)
4. ✅ Running pod install...

## 🔑 What You Need To Do (2 minutes)

### Step 1: Get Your FREE Mapbox Token

1. Go to: **https://account.mapbox.com/auth/signup/**
2. Sign up with email (takes 30 seconds)
3. Once logged in, you'll see your **Default public token**
4. It looks like: `pk.eyJ1IjoieW91cnVzZXJuYW1lIiwi...` (starts with `pk.`)
5. Copy it!

### Step 2: Add Token to .env

1. Open `bisetka/.env`
2. Find this line:
   ```
   MAPBOX_ACCESS_TOKEN=YOUR_TOKEN_HERE
   ```
3. Replace `YOUR_TOKEN_HERE` with your actual token:
   ```
   MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwi...
   ```
4. Save the file

### Step 3: Rebuild and Run

```bash
# Make sure you're in the bisetka folder
cd bisetka

# Clean build (optional but recommended)
cd ios && xcodebuild clean && cd ..

# Run on your device
npm run ios:physical

# OR run on simulator
npm run ios
```

### Step 4: See the Globe! 🌍

1. App opens
2. Tap the **green earth button** (top right, first icon)
3. See the beautiful 3D interactive globe!
4. Zoom in/out with pinch
5. Rotate by dragging
6. Tap markers to see game sessions

## 🐛 Troubleshooting

**"Map is black/blank"**
- Token is invalid or expired
- Check `.env` file - make sure token is correct
- Make sure token starts with `pk.`

**"Still seeing empty state"**
- Did you rebuild the app after adding the token?
- Try: `cd ios && xcodebuild clean && cd .. && npm run ios`

**"Module not found: @rnmapbox/maps"**
- Run: `npm install @rnmapbox/maps`
- Run: `cd ios && pod install && cd ..`
- Rebuild app

**"Pod install failed"**
- Run: `cd ios && pod deintegrate && pod install && cd ..`
- Make sure you have CocoaPods installed: `gem install cocoapods`

## 📸 What You'll See

### Before (current):
- Empty state icon
- "No Active Sessions"
- Just a plain screen

### After (with token):
- **Rotating 3D Earth globe** 🌍
- Dark space background
- Smooth zoom/pan gestures
- Country borders and labels
- Game markers when sessions exist

## 🎮 Testing With Mock Data

To see markers on the globe, add this to your backend socket handler:

```typescript
socket.emit('global_sessions', [
  {
    id: 'test-1',
    gameType: 'nardi',
    playerCount: 2,
    maxPlayers: 4,
    latitude: 40.1872,
    longitude: 44.5152,
    city: 'Yerevan',
    country: 'Armenia',
    roomName: 'Yerevan Nardi Night'
  },
  {
    id: 'test-2',
    gameType: 'chess',
    playerCount: 1,
    maxPlayers: 2,
    latitude: 40.7128,
    longitude: -74.0060,
    city: 'New York',
    country: 'USA',
    roomName: 'NYC Chess Club'
  }
]);
```

Then you'll see glowing green markers on those cities!

## 💰 Cost

**FREE!** Mapbox has a generous free tier:
- 50,000 map loads per month
- 100,000 tile requests per month
- More than enough for development and testing

## ⏱️ Total Time

- Get token: 1 minute
- Add to .env: 30 seconds  
- Rebuild app: 2-3 minutes
- **Total: ~5 minutes to see the 3D globe!**

## 📚 More Info

- Mapbox GL Native: https://docs.mapbox.com/ios/maps/guides/
- React Native Mapbox: https://github.com/rnmapbox/maps
- Getting started: https://docs.mapbox.com/help/getting-started/

---

**Questions?** Check the console logs when you tap the earth button. You'll see:
- `🌍 GlobalView: Socket status: ...`
- `📡 Requesting global sessions...`
- Any Mapbox errors

**Ready to see that 3D globe?** Get your token and rebuild! 🚀🌍
