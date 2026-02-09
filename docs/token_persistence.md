# Bisetka Token Persistence Overview

This document explains how the refreshed auth flow mirrors the NolimitSera pattern on both the backend and the React Native client.

## Backend Flow

1. **Refresh Token Storage**
   - Migration `008_create_refresh_tokens_table.sql` introduces a `refresh_tokens` table with `token`, `user_id`, `device_id`, `user_agent`, `ip_address`, `expires_at`, `revoked_at`, and indexes.
   - Every successful auth flow (register, login, Google, Apple) calls `authService.createSession()` which:
     - Generates a short-lived access token (JWT) for API calls.
     - Generates a long-lived refresh token (cryptographically random string), stores it in `refresh_tokens`, and returns it to the client.

2. **Session APIs**
   - `/auth/*` responses now include `{ token, refreshToken, user }`.
   - `/auth/refresh` accepts the refresh token + device metadata, verifies its validity, revokes the old row, creates a new session, and returns new tokens.
   - `AuthService.refreshSession()` handles rotation + revocation so compromised tokens can be invalidated via `revokeUserSessions()`.

## React Native Client Flow

1. **Token Service**
   - `src/services/token.service.ts` centralizes session storage.
   - **Access token** → stored in-memory + `AsyncStorage` for quick header injection.
   - **Refresh token** → stored in Keychain (primary) with an `AsyncStorage` backup for reliability.
   - **User payload** → cached in `AsyncStorage` to hydrate UI on app launch.

2. **AuthContext Integration**
   - On mount, `AuthContext` initializes `tokenService`, retrieves any stored session, and sets the user state so the UI jumps straight to the home screen if tokens exist.
   - Sign-in methods (Apple/email) call the backend, then invoke `tokenService.storeSession()` to persist both tokens + user before updating context.
   - Sign-out triggers `tokenService.clearSession()` which wipes AsyncStorage + Keychain caches.

3. **API Layer**
   - `api.service.ts` routes every request through a helper that:
     - Attaches `Authorization: Bearer <accessToken>` when `requireAuth` is true.
     - On 401 responses, transparently calls `tokenService.refreshSession()` which POSTs to `/auth/refresh`, stores the rotated tokens, and retries the original request.
     - Sends `x-device-id` headers + device info to match the backend metadata.

## User Experience

- First Apple sign-in hits `/auth/apple`, creating both tokens and caching them locally.
- Relaunching the app hydrates from storage and bypasses the login flow.
- If the access token expires mid-session, the client automatically refreshes and retries the call without user input.
- Revoking sessions server-side (or deleting the refresh row) forces the client to re-authenticate on the next refresh.

This end-to-end setup matches the working NolimitSera implementation, so behavior is consistent across projects.
