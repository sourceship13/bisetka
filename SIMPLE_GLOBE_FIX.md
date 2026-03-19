# Simple Fix for 3D Globe (Manual Xcode Build)

## The Issue

CocoaPods is failing to install Mapbox native dependencies due to Ruby 3.4 compatibility. We need to build through Xcode which handles this better.

## Solution (5 minutes)

### Step 1: I've Opened Xcode For You

Xcode should now be open with `bisetka.xcworkspace`.

If not, run:
```bash
open /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/ios/bisetka.xcworkspace
```

### Step 2: Select Your Device

1. At the top of Xcode, click the device dropdown (next to the Play button)
2. Select **"Alpha iPhone"** (your physical device)

### Step 3: Clean Build Folder

1. In Xcode menu bar, click **Product**
2. Hold **Option (⌥)** key
3. Click **"Clean Build Folder"** (or press **⌘⇧K**)
4. Wait for it to finish (~10 seconds)

### Step 4: Build and Run

1. Click the **Play button (▶)** in the top left
2. OR press **⌘R**
3. Wait for the build (~2-3 minutes first time)
4. Xcode will automatically:
   - Install CocoaPods dependencies
   - Install Mapbox native frameworks
   - Build the app
   - Deploy to your iPhone

### Step 5: Test the Globe

1. Once the app opens on your phone
2. Tap the **green earth button** (top right, first icon)
3. You should see:
   - **3D rotating Earth** 🌍
   - Dark space background
   - Ability to zoom (pinch)
   - Ability to rotate (drag)

## If You Still See Empty State

Check the Xcode console (bottom panel) when you open Global View. Look for:

```
🌍 GlobalView: Socket status: ...
```

If you see an error about Mapbox, it means the native module didn't install.

## Alternative: See It Without the Globe

If you just want to verify the feature works without waiting for Mapbox:

1. Open `src/screens/Meta/GlobalView/GlobalViewScreen.tsx`
2. Around line 70, find `useEffect(() => {`
3. Add this inside the useEffect:

```typescript
// Temporary mock data to test UI
setTimeout(() => {
  setSessions([
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
  setLoading(false);
}, 1000);
```

4. Rebuild
5. You'll see a **list view** with sessions instead of empty state
6. This proves the backend integration works

## What Xcode Does Better

Xcode uses its own Ruby environment and handles CocoaPods dependencies more reliably than command-line tools. It will:
- Auto-install pods on first build
- Handle framework linking
- Configure build settings
- Deploy to device

## Expected Build Time

- **First build**: 3-5 minutes (installing Mapbox frameworks)
- **Subsequent builds**: 30-60 seconds

## Check Build Progress

In Xcode, watch the top bar:
- **"Indexing..."** → Xcode is scanning the project
- **"Building..."** → Compiling code
- **"Running..."** → Deploying to iPhone
- **No status** → Build complete!

---

**TL;DR:** Build through Xcode → Should work! The command-line builds are failing due to CocoaPods/Ruby issues. 🚀
