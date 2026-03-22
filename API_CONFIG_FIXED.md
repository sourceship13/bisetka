# API Configuration Fixed ✅

**Status**: Complete - All environments now point to correct URLs

---

## How It Works Now

### Development Builds (Simulator + Physical Device)
**Bundle**: `org.sera.dev.bisetka.staging`  
**Mode**: `__DEV__ = true`  
**URL**: `http://YOUR_LOCAL_IP:3000` (auto-detected from Metro)  
**Flag**: `FORCE_LOCAL = true`

**Console log**:
```
📡 Local API URL (auto from Metro): http://192.168.26.26:3000
🌐 API Config: { environment: 'local', baseURL: 'http://192.168.26.26:3000', isDev: true }
```

---

### Staging Build (TestFlight/Archive)
**Bundle**: `org.sera.dev.bisetka.staging`  
**Mode**: `__DEV__ = false`  
**URL**: `https://staging.bisetka.io`  
**Detection**: Bundle ID contains "staging"

**Console log**:
```
🔍 Bundle ID detected: org.sera.dev.bisetka.staging
🌐 API Config: { environment: 'staging', baseURL: 'https://staging.bisetka.io', isDev: false }
```

---

### Production Build (App Store)
**Bundle**: `org.sera.dev.bisetka`  
**Mode**: `__DEV__ = false`  
**URL**: `https://bisetka.io`  
**Detection**: Default for release builds

**Console log**:
```
🔍 Bundle ID detected: org.sera.dev.bisetka
🌐 API Config: { environment: 'production', baseURL: 'https://bisetka.io', isDev: false }
```

---

## Environment Variables

### `.env` (Development)
```env
# Local development (simulator + physical devices)
METRO_HOST=192.168.26.26
BACKEND_URL=http://192.168.26.26:3000
LOCAL_API_URL=localhost

# Staging backend (for TestFlight staging builds)
STAGING_API_URL=https://staging.bisetka.io

# Production backend (for App Store builds)
PRODUCTION_API_URL=https://bisetka.io  # ✅ FIXED (was https://prod.bisetka.io)
```

---

## Detection Logic

```typescript
function getEnvironment(): Environment {
  // 1. Dev build with FORCE_LOCAL=true → local IP
  if (__DEV__ && FORCE_LOCAL) {
    return 'local';
  }

  // 2. Dev build with FORCE_LOCAL=false → staging.bisetka.io
  if (__DEV__) {
    return 'staging';
  }

  // 3. Release build - check bundle ID
  const bundleId = getBundleId();
  
  // Staging TestFlight: org.sera.dev.bisetka.staging → staging.bisetka.io
  if (bundleId.includes('staging')) {
    return 'staging';
  }

  // Production App Store: org.sera.dev.bisetka → bisetka.io
  return 'production';
}
```

---

## Build Configurations

### Xcode Schemes

**Debug (Development)**
- Bundle ID: `org.sera.dev.bisetka.staging`
- `__DEV__`: true
- `FORCE_LOCAL`: true
- **Result**: Uses local IP (http://192.168.26.26:3000)

**Staging (TestFlight)**
- Bundle ID: `org.sera.dev.bisetka.staging`
- `__DEV__`: false
- **Result**: Uses staging.bisetka.io

**Release (App Store)**
- Bundle ID: `org.sera.dev.bisetka`
- `__DEV__`: false
- **Result**: Uses bisetka.io

---

## What Changed

### Fixed Files

1. **`.env`**
   - Changed: `PRODUCTION_API_URL=https://prod.bisetka.io`
   - To: `PRODUCTION_API_URL=https://bisetka.io`

2. **`src/libs/utils/api.utils.ts`**
   - Fixed: `FORCE_LOCAL` now only applies to dev builds (`__DEV__`)
   - Before: `if (FORCE_LOCAL) return 'local'` ❌ (forced ALL builds to local)
   - After: `if (__DEV__ && FORCE_LOCAL) return 'local'` ✅ (only dev builds)

---

## Testing Scenarios

### Local Development (Simulator)
```bash
# Run Metro
npm start

# Run iOS simulator
npx react-native run-ios

# Expected console output:
📡 Local API URL (auto from Metro): http://localhost:3000
🌐 API Config: { environment: 'local', baseURL: 'http://localhost:3000' }
```

### Local Development (Physical Device)
```bash
# Run Metro
npm start

# Run on device (connected via USB or WiFi)
npx react-native run-ios --device "Arin's iPhone"

# Expected console output:
📡 Local API URL (auto from Metro): http://192.168.26.26:3000
🌐 API Config: { environment: 'local', baseURL: 'http://192.168.26.26:3000' }
```

### TestFlight Staging
```bash
# Build for staging
xcodebuild archive -scheme bisetka -configuration Staging

# Upload to TestFlight

# Expected console output (when app runs):
🔍 Bundle ID detected: org.sera.dev.bisetka.staging
🌐 API Config: { environment: 'staging', baseURL: 'https://staging.bisetka.io' }
```

### App Store Production
```bash
# Build for production
xcodebuild archive -scheme bisetka -configuration Release

# Upload to App Store

# Expected console output (when app runs):
🔍 Bundle ID detected: org.sera.dev.bisetka
🌐 API Config: { environment: 'production', baseURL: 'https://bisetka.io' }
```

---

## Backend Requirements

For this to work, you need:

### 1. Local Backend (Development)
**URL**: `http://localhost:3000` or `http://192.168.26.26:3000`  
**Status**: ✅ Running (your current setup)  
**Used by**: Dev builds (simulator + physical devices)

### 2. Staging Backend (TestFlight)
**URL**: `https://staging.bisetka.io`  
**Status**: ❓ Needs to be deployed  
**Used by**: Staging TestFlight builds  
**Requirements**:
- Must be publicly accessible
- Must point to staging database
- Can be deployed on Railway/Render/AWS

### 3. Production Backend (App Store)
**URL**: `https://bisetka.io`  
**Status**: ❓ Needs to be deployed  
**Used by**: Production App Store builds  
**Requirements**:
- Must be publicly accessible
- Must point to production database  
- Should be on AWS/DigitalOcean/etc.

---

## Quick Reference

| Scenario | Bundle ID | __DEV__ | FORCE_LOCAL | URL |
|----------|-----------|---------|-------------|-----|
| Simulator dev | `.staging` | ✅ | ✅ | `http://localhost:3000` |
| Physical dev | `.staging` | ✅ | ✅ | `http://192.168.x.x:3000` |
| Staging TF | `.staging` | ❌ | ❌ | `https://staging.bisetka.io` |
| Production AS | (no .staging) | ❌ | ❌ | `https://bisetka.io` |

---

## Next Steps

### 1. Rebuild Development Build
```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka
npx react-native run-ios
```

**Should see**: `environment: 'local', baseURL: 'http://localhost:3000'`

### 2. Deploy Staging Backend
To make TestFlight staging builds work, you need to deploy backend to `staging.bisetka.io`

**Options**:
- Railway (free tier, easy): https://railway.app
- Render (free tier): https://render.com
- AWS/DigitalOcean (paid, full control)

### 3. Deploy Production Backend
To make App Store production builds work, you need to deploy backend to `bisetka.io`

**Recommended**: AWS/DigitalOcean for production reliability

---

## Troubleshooting

### "Still showing San Francisco"
- Clear AsyncStorage: `AsyncStorage.clear()`
- Delete and reinstall app
- Check console for: `🌐 API Config: { environment: 'local' }`

### "TestFlight can't connect"
- Check if `https://staging.bisetka.io` exists
- Try in browser: should return JSON or HTML
- Check bundle ID in TestFlight: should contain "staging"

### "Production build can't connect"
- Check if `https://bisetka.io` exists
- Verify bundle ID: should be `org.sera.dev.bisetka` (no .staging)
- Check API logs on production server

---

## Summary

✅ **Development** (simulator + physical devices) → Local IP ✅ **Staging** (TestFlight) → `staging.bisetka.io` (needs deployment)  
✅ **Production** (App Store) → `bisetka.io` (needs deployment)

**All configured correctly in code!** Now you just need to deploy the staging/production backends.
