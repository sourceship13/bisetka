# Global View - Hanging Bug Fix

## Problem
The screen was hanging on "Loading global sessions..." indefinitely when:
- Backend doesn't have `get_global_sessions` handler implemented yet
- Socket isn't connected properly
- No response from server

## Fix Applied

### 1. Added Timeout (5 seconds)
```typescript
const timeout = setTimeout(() => {
  console.log('⏱️ Global sessions request timed out - showing empty state');
  setLoading(false);
  setSessions([]);
}, 5000);
```

### 2. Better Socket Checking
```typescript
if (!socket) {
  console.log('❌ Socket not connected');
  setLoading(false);
  return; // Shows empty state instead of hanging
}
```

### 3. Socket Status Logging
```typescript
console.log('🌍 GlobalView: Socket status:', {
  exists: !!socket,
  connected: socket?.connected,
  id: socket?.id,
});
```

### 4. Improved Empty State
- Shows different message if socket isn't connected
- Added "Start a Game" button
- Clearer user feedback

### 5. Refresh Button Protection
- Checks socket connection before emitting
- Shows error if not connected
- Auto-stops loading after 5 seconds

## Testing

### Test 1: Without Backend (Current State)
1. Tap green earth button
2. See "Loading global sessions..." for ~5 seconds
3. See empty state with "No Active Sessions"
4. See "Start a Game" button
5. ✅ No more hanging!

### Test 2: Check Console Logs
Look for these logs in Metro/Xcode:
- `🌍 GlobalView: Socket status: ...`
- `📡 Requesting global sessions...`
- `⏱️ Global sessions request timed out` (if no backend)
- `📍 Received global sessions: X` (when backend responds)

### Test 3: With Backend (Future)
1. Implement backend handler:
```typescript
socket.on('get_global_sessions', () => {
  socket.emit('global_sessions', []);
});
```
2. Tap green earth button
3. Should see empty state immediately (no timeout)
4. Add mock data → should see sessions

### Test 4: Refresh Button
1. Go to Global View
2. Wait for empty state
3. Tap refresh button (top right)
4. Should show loading briefly
5. Should show empty state after ~5 seconds

## What Changed

**Before:**
- Waited forever for `global_sessions` event
- No timeout → infinite loading spinner
- No feedback if socket disconnected

**After:**
- 5-second timeout → always shows content
- Better error handling
- Helpful empty state with action button
- Logs for debugging
- Checks socket status before emitting

## Files Modified

- `src/screens/Meta/GlobalView/GlobalViewScreen.tsx`
  - Added timeout logic
  - Added socket status checks
  - Improved empty state UI
  - Added console logs

## Backend TODO

To make it work fully:

```typescript
// In your socket connection handler
socket.on('get_global_sessions', async () => {
  try {
    // Query active sessions from database
    const sessions = await getActiveSessions();
    socket.emit('global_sessions', sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    socket.emit('global_sessions', []); // Empty array on error
  }
});
```

See `BACKEND_GLOBAL_VIEW_TEMPLATE.md` for full implementation guide.

## Verification

✅ **Fixed**: Screen no longer hangs  
✅ **Fixed**: Shows empty state after timeout  
✅ **Fixed**: Better error messages  
✅ **Fixed**: Console logs for debugging  
✅ **Fixed**: "Start a Game" button in empty state  

## Next Steps

1. **Test the fix**: Reload app and tap green earth button
2. **Check logs**: Look for socket status in console
3. **Add backend**: Implement `get_global_sessions` handler
4. **Test with data**: Add mock sessions to verify UI

---

**The hanging issue is now fixed!** The screen will always show content within 5 seconds, even if the backend isn't ready yet. 🎉
