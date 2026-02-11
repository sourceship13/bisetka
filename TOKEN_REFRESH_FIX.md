# Token Refresh Fix — 401 Error After 15 Minutes

## Problem
Users were getting 401 errors after ~15 minutes of inactivity, requiring them to sign out and back in. This was caused by the access token expiring without automatic renewal.

## Root Cause
- **Access token lifetime:** 15 minutes (configured in backend `ACCESS_TOKEN_TTL`)
- **Refresh token lifetime:** 30 days
- **Issue:** Frontend had refresh logic (`tokenService.refreshSession()`) but it was **reactive-only** — it only tried to refresh **after** getting a 401 error
- When apps sit idle in the background or users leave and come back 20+ minutes later, the token was already expired

## Solution Implemented

### 1. **Proactive Token Refresh** ✅
- Decodes the JWT access token to extract expiration time (`exp` claim)
- Schedules automatic refresh **3 minutes before expiration** (at 12-minute mark for 15-min tokens)
- Eliminates the "expired → 401 → refresh → retry" dance for active users
- Runs automatically in the background via `setTimeout`

**Code:** `token.service.ts` — added `scheduleProactiveRefresh()` method

### 2. **Refresh on App Resume/Foreground** ✅
- **On app launch:** `tokenService.initialize()` checks if the token is expired or will expire in the next minute and refreshes immediately if needed
- **On app foreground:** `AppState` listener in `AuthContext` calls `checkAndRefreshIfNeeded()` whenever the app comes to the foreground (user returns from background, unlocks device, switches back from another app)
- If token expires in next 2 minutes → refreshes immediately
- Prevents 401 errors when users return to the app after leaving it idle or backgrounded

**Code:**
- `token.service.ts` — added `checkAndRefreshIfNeeded()` method
- `AuthContext.tsx` — added `AppState.addEventListener('change')` listener

### 3. **Smarter Error Handling** ✅
- **Before:** Any refresh failure → immediate session clear → user logged out
- **Now:**
  - `401`/`403` from `/auth/refresh` → invalid/expired refresh token → **log user out** (correct behavior)
  - `5xx`, network errors, timeouts → **don't clear session**, just log warning and retry on next request
  - Prevents logging users out due to temporary network issues or backend hiccups

**Code:** `token.service.ts` — updated `refreshSession()` to only clear session on auth errors, not network errors

### 4. **Better 401 Retry Flow** ✅
- When API request gets 401:
  1. Try to refresh token
  2. If refresh succeeds → retry the original request
  3. If refresh fails → return "Session expired" error with proper message
  4. Frontend can now detect `SESSION_EXPIRED` code and show appropriate UI

**Code:** `api.service.ts` — wrapped `refreshSession()` call in try/catch with better error message

## Testing

### What to Test
1. **Normal usage:** Use app for 10+ minutes → token should refresh automatically at 12-minute mark (check console for `🔄 Proactively refreshing token...`)
2. **App backgrounded:** Use app, switch to another app for 15+ minutes, switch back → should refresh when app comes to foreground
3. **Device locked:** Use app, lock device for 20+ minutes, unlock and open app → should refresh on foreground
4. **App killed and reopened:** Force quit app, wait 20+ minutes, reopen → should refresh on initialize
5. **Expired refresh token:** Wait 30+ days (or manually expire the refresh token in DB) → should log user out cleanly with "Session expired" message
6. **Network error during refresh:** Disconnect network mid-refresh → should retry on next request, not log out

### How to Monitor
- Check console logs for:
  - `🔄 Proactively refreshing token...` (scheduled refresh)
  - `🔄 Token expired or expiring soon, refreshing on init...` (resume refresh)
  - `✅ Token refreshed, retrying request` (successful reactive refresh)
  - `❌ Token refresh failed:` + reason

## Configuration

### Backend (`.env` or `auth.service.ts`)
```bash
ACCESS_TOKEN_TTL=15m          # How long access tokens are valid
REFRESH_TOKEN_TTL_DAYS=30     # How long refresh tokens are valid
```

### Frontend (`token.service.ts`)
```typescript
const refreshAt = this.tokenExpiresAt - 3 * 60 * 1000;  // Refresh 3 min before expiry
```

Adjust the `3 * 60 * 1000` (3 minutes) if you want a different refresh window. Recommended: 20-30% of token lifetime.

## Files Changed
- `bisetka/src/services/token.service.ts` — added proactive refresh scheduler, AppState foreground check, smarter error handling
- `bisetka/src/services/api.service.ts` — improved 401 retry flow with error wrapping
- `bisetka/src/context/AuthContext.tsx` — added AppState listener to trigger token check on foreground

## Result
✅ Users can stay logged in indefinitely (up to 30 days) without manual re-authentication  
✅ 401 errors eliminated for active/returning users  
✅ Graceful "Session expired" message only when refresh token actually expires  
✅ No unexpected logouts from network hiccups  
