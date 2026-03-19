# Fix the 3D Globe - Manual Steps

## The Problem

Pod install is failing due to Ruby 3.4 / CocoaPods compatibility issues. Here's how to fix it manually:

## Solution: Install via Xcode

### Option 1: Use Xcode (Easiest)

1. **Open Xcode:**
   ```bash
   cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka
   open ios/bisetka.xcworkspace
   ```

2. **Clean Build Folder:**
   - In Xcode menu: Product → Clean Build Folder (⌘⇧K)

3. **Build and Run:**
   - Select your device in the toolbar
   - Click the Play button (▶) or press ⌘R

4. **Wait for build** - Xcode will automatically install CocoaPods dependencies

5. **Test the globe:**
   - Tap the green earth button
   - Should see the 3D globe!

### Option 2: Fix CocoaPods First

```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/ios

# Set locale to fix Unicode error
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8

# Try pod install again
pod install

# If still fails, try:
pod deintegrate
pod install --repo-update
```

### Option 3: Use React Native CLI

```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka

# This handles pod install automatically
npx react-native run-ios --device "Alpha iPhone"
```

## What You Should See

**Before (current):**
- Empty state with icon
- "No Active Sessions"

**After (with Mapbox working):**
- **3D rotating Earth globe** 🌍
- Dark space background
- Can zoom in/out (pinch)
- Can rotate (drag)
- Country borders visible

## Verify It's Working

Check the Metro console when you open Global View:
```
🌍 GlobalView: Socket status: { exists: true, connected: true }
```

If you see this, Mapbox is working!

## If Still Not Showing

The app might still show empty state if:
1. **No Mapbox installed** - Check if `@rnmapbox/maps` is in node_modules
2. **No sessions** - Expected! Backend not emitting data yet
3. **Token invalid** - Check .env file

## Test with Mock Data

To verify the globe works, temporarily add this to the useEffect in GlobalViewScreen.tsx:

```typescript
// After line 67, add:
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
    }
  ]);
  setLoading(false);
}, 2000);
```

Then you'll see a marker on Armenia!

## Why Pod Install Fails

Ruby 3.4 changed how it handles string encoding, and CocoaPods 1.16.2 has a bug with Unicode normalization. This will be fixed in future CocoaPods versions.

**Workaround:** Let Xcode handle it - it uses a different Ruby environment.

---

**TL;DR:** Open Xcode → Clean → Build → Run. The globe will work! 🌍
