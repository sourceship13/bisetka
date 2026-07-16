import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AuthService from '../../services/AuthService';
import apiService from '../../services/api.service';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In (called once at module load)
// webClientId:  GCP → APIs & Services → Credentials → Web client (auto created by Google Service)
// iosClientId:  GCP → APIs & Services → Credentials → iOS OAuth client for this app
//               Also set REVERSED_CLIENT_ID as a URL scheme in ios/bisetka/Info.plist
GoogleSignin.configure({
  webClientId: '378583720606-h0fk22ojpusud1i2p1a6jnf9f8hrkntb.apps.googleusercontent.com',
  iosClientId: '230284145137-56mvnb2b6r7isv8qckfu40ed0a3t2h9u.apps.googleusercontent.com',
  offlineAccess: true,
});
import AsyncStorage from '@react-native-async-storage/async-storage';
import tokenService from '../../services/token.service';
import { registerDevice } from '../utils/deviceInfo';
import { apiConfig } from '../utils/api.utils';
import * as Sentry from '@sentry/react-native';
import pushNotificationService from '../../services/pushNotification.service';
import bisetkaStorageService from '../../services/bisetkaStorage.service';
import type { User } from '../../types/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName?: { givenName: string; familyName: string },
  ) => Promise<void>;
  signOut: (logoutAll?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapBackendUser = (user: User): User => ({
  ...user,
  fullName: user.fullName || (user.full_name ? { givenName: user.full_name, familyName: null } : null),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistBisetkaFromUser = async (nextUser: User | null) => {
    if (!nextUser?.bisetka) {
      return;
    }

    await bisetkaStorageService.storeBisetka({
      id: nextUser.bisetka.id,
      neighborhood: nextUser.bisetka.neighborhood,
      city: nextUser.bisetka.city,
      country: nextUser.bisetka.country,
      active_users: nextUser.bisetka.active_users,
      source: 'ip',
    });
  };

  // App state reference for background/foreground handling
  const appState = useRef(AppState.currentState);
  const isHandlingAppStateChange = useRef(false);

  // Helper to wait for storage to be ready
  const waitForStorageReady = async (): Promise<void> => {
    const MAX_WAIT_TIME = 2000;
    const CHECK_INTERVAL = 100;
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT_TIME) {
      try {
        await AsyncStorage.getItem('_storage_ready_test');
        return;
      } catch (error) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), CHECK_INTERVAL));
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    tokenService.registerUserUpdater(nextUser => {
      if (isMounted) {
        setUser(nextUser ? mapBackendUser(nextUser) : null);
      }
    });

    const bootstrap = async () => {
      try {
        await waitForStorageReady();
        await tokenService.initialize();
        const storedUser = await tokenService.getStoredUser();
        
        if (storedUser && isMounted) {
          setUser(mapBackendUser(storedUser));
          
          // Try to refresh from server
          try {
            const freshUser = await apiService.getProfile();
            await persistBisetkaFromUser(freshUser);
            if (isMounted) {
              setUser(mapBackendUser(freshUser));
            }
          } catch (error: any) {
            // 404 = the cached token belongs to a user that no longer exists
            // on this backend (e.g. backend URL switched). Clear the stale
            // session so the app drops back to the sign-in screen instead of
            // looping with a dead token.
            if (
              error?.status === 404 ||
              error?.status === 401 ||
              error?.code === 'SESSION_EXPIRED'
            ) {
              console.warn(
                '⚠️ getProfile rejected (',
                error?.status,
                error?.code,
                ') — clearing stale session',
              );
              try { await tokenService.clearSession(); } catch (_) {}
              if (isMounted) setUser(null);
            } else {
              console.warn('⚠️ Using cached user, server refresh failed:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth state', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    bootstrap();

    let unsubscribe: (() => void) | undefined;
    if (Platform.OS === 'ios' && AuthService.isAppleAuthAvailable()) {
      unsubscribe = appleAuth.onCredentialRevoked(async () => {
        console.warn('Apple credentials revoked');
        await tokenService.clearSession();
        // chatSocketService.disconnect();
        setUser(null);
      });
    }

    // Enhanced AppState listener with robust background handling
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (isHandlingAppStateChange.current) {
        return;
      }

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        isHandlingAppStateChange.current = true;

        try {
          console.log('📱 App resumed to foreground — checking auth...');

          await waitForStorageReady();
          await new Promise<void>(resolve => setTimeout(() => resolve(), 250));

          const accessToken = await tokenService.getAccessToken();
          const refreshToken = await tokenService.getRefreshToken();

          // If no tokens at all, force logout
          if (!accessToken && !refreshToken) {
            console.warn('⚠️ No tokens found on resume — forcing logout');
            await tokenService.clearSession();
            // chatSocketService.disconnect();
            if (isMounted) setUser(null);
            return;
          }

          // Try to refresh if needed
          try {
            await tokenService.checkAndRefreshIfNeeded();
          } catch (error) {
            console.error('❌ Token check failed on resume:', error);
            await tokenService.clearSession();
            // chatSocketService.disconnect();
            if (isMounted) setUser(null);
            return;
          }

          // Refresh user data
          if (user) {
            refreshUser().catch(err => console.error('Failed to refresh user:', err));
          }

          // Re-run push init on every foreground resume.
          // This is the key case: user went to Settings, enabled notifications,
          // came back to the app — silentInit now sees GRANTED and registers the token.
          pushNotificationService.silentInit().catch(err =>
            console.warn('Push silentInit on resume failed:', err)
          );
        } finally {
          setTimeout(() => {
            isHandlingAppStateChange.current = false;
          }, 1000);
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      isMounted = false;
      tokenService.registerUserUpdater(undefined);
      if (unsubscribe) {
        unsubscribe();
      }
      appStateSubscription.remove();
    };
  }, []);

  // Sync user to Sentry
  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email || undefined,
        username: user.username || user.email || undefined,
      });
      
      // Re-register FCM token if permission was already granted (does NOT prompt)
      pushNotificationService.silentInit().catch(err =>
        console.warn('Push silent init failed:', err)
      );
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  const signInWithApple = async () => {
    try {
      setIsLoading(true);

      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      const { identityToken, email, fullName } = appleAuthRequestResponse;

      if (!identityToken) {
        throw new Error('No identity token returned');
      }

      const backendResponse = await apiService.appleSignIn({
        idToken: identityToken,
        email,
        fullName: fullName ? `${fullName.givenName} ${fullName.familyName}` : undefined,
      });

      await tokenService.storeSession(backendResponse);
      setUser(mapBackendUser(backendResponse.user));

      // Store Bisetka info from login response (IP-based)
      if (backendResponse.bisetka) {
        await bisetkaStorageService.storeBisetka({
          id: backendResponse.bisetka.id,
          neighborhood: backendResponse.bisetka.neighborhood,
          city: backendResponse.bisetka.city,
          country: backendResponse.bisetka.country,
          active_users: backendResponse.bisetka.active_users,
          source: 'ip',
        });
        console.log(`🏘️ Connected to Bisetka: ${backendResponse.bisetka.neighborhood}, ${backendResponse.bisetka.city}`);
      }

      registerDevice(apiConfig.apiURL, backendResponse.token).catch(err =>
        console.warn('Device registration failed:', err)
      );

      // chatSocketService.connect(backendResponse.user.id, backendResponse.token).catch(err =>
      //   console.warn('Chat socket connection failed:', err)
      // );
    } catch (error: any) {
      console.error('❌ Apple Sign In error:', error?.message || error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (response.type !== 'success') {
        // User cancelled
        return;
      }

      const { idToken } = response.data;
      if (!idToken) {
        throw new Error('No ID token returned from Google');
      }

      const { user: googleUser } = response.data;
      const backendResponse = await apiService.googleSignIn({
        idToken,
        user: {
          email: googleUser.email,
          name: googleUser.name || googleUser.email,
          photo: googleUser.photo || undefined,
        },
      });

      await tokenService.storeSession(backendResponse);
      setUser(mapBackendUser(backendResponse.user));

      if (backendResponse.bisetka) {
        await bisetkaStorageService.storeBisetka({
          id: backendResponse.bisetka.id,
          neighborhood: backendResponse.bisetka.neighborhood,
          city: backendResponse.bisetka.city,
          country: backendResponse.bisetka.country,
          active_users: backendResponse.bisetka.active_users,
          source: 'ip',
        });
        console.log(`🏘️ Connected to Bisetka: ${backendResponse.bisetka.neighborhood}, ${backendResponse.bisetka.city}`);
      }

      registerDevice(apiConfig.apiURL, backendResponse.token).catch(err =>
        console.warn('Device registration failed:', err)
      );
    } catch (error: any) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        return; // User cancelled, not an error
      }
      console.error('❌ Google Sign In error:', error?.message || error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const backendResponse = await apiService.login({ email, password });

      await tokenService.storeSession(backendResponse);
      setUser(mapBackendUser(backendResponse.user));

      // Store Bisetka info from login response (IP-based or GPS-based)
      if (backendResponse.bisetka) {
        await bisetkaStorageService.storeBisetka({
          id: backendResponse.bisetka.id,
          neighborhood: backendResponse.bisetka.neighborhood,
          city: backendResponse.bisetka.city,
          country: backendResponse.bisetka.country,
          active_users: backendResponse.bisetka.active_users,
          source: 'ip', // Backend used IP geolocation (or GPS if provided by frontend)
        });
        console.log(`🏘️ Connected to Bisetka: ${backendResponse.bisetka.neighborhood}, ${backendResponse.bisetka.city}`);
      }

      registerDevice(apiConfig.apiURL, backendResponse.token).catch(err =>
        console.warn('Device registration failed:', err)
      );

      // chatSocketService.connect(backendResponse.user.id, backendResponse.token).catch(err =>
      //   console.warn('Chat socket connection failed:', err)
      // );
    } catch (error: any) {
      console.error('❌ Email Sign In error:', error?.message || error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName?: { givenName: string; familyName: string },
  ) => {
    try {
      setIsLoading(true);

      const backendResponse = await apiService.register({
        email,
        password,
        fullName,
      });

      await tokenService.storeSession(backendResponse);
      setUser(mapBackendUser(backendResponse.user));

      if (backendResponse.bisetka) {
        await bisetkaStorageService.storeBisetka({
          id: backendResponse.bisetka.id,
          neighborhood: backendResponse.bisetka.neighborhood,
          city: backendResponse.bisetka.city,
          country: backendResponse.bisetka.country,
          active_users: backendResponse.bisetka.active_users,
          source: 'ip',
        });
      }

      registerDevice(apiConfig.apiURL, backendResponse.token).catch(err =>
        console.warn('Device registration failed:', err)
      );

      // chatSocketService.connect(backendResponse.user.id, backendResponse.token).catch(err =>
      //   console.warn('Chat socket connection failed:', err)
      // );
    } catch (error: any) {
      console.error('❌ Email Sign Up error:', error?.message || error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (logoutAll: boolean = false) => {
    // NOTE: do NOT flip `isLoading` here. AppNavigator renders a full-screen
    // spinner branch when `isLoading` is true, which would unmount the entire
    // authenticated stack BEFORE we clear `user` — any focused screen
    // (Settings, Profile, etc.) gets torn down with native handles still
    // alive and crashes the app. By only setting `user = null` we trigger a
    // single clean swap from the app stack to the Login stack.
    try {
      // TODO: Call backend to revoke all sessions if logoutAll is true
      await AuthService.signOut();
      await tokenService.clearSession();
      await bisetkaStorageService.clearBisetka(); // Clear stored Bisetka
      // chatSocketService.disconnect();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      console.log('🔄 [refreshUser] Fetching fresh user profile...');
      const freshUser = await apiService.getProfile();
      console.log('🔄 [refreshUser] Fresh user data:', {
        username: freshUser.username,
        bisetka: freshUser.bisetka,
      });
      await persistBisetkaFromUser(freshUser);
      setUser(mapBackendUser(freshUser));
      console.log('✅ [refreshUser] User context updated successfully');
    } catch (error: any) {
      console.error('❌ [refreshUser] Error refreshing user:', error);

      // If the server says the user doesn't exist (stale token), clear the session
      if (error?.status === 404 || error?.message?.includes('404')) {
        console.warn('⚠️  refreshUser: user not found on server, clearing session');
        await AuthService.signOut();
        await tokenService.clearSession();
        setUser(null);
        return;
      }

      const accessToken = await tokenService.getAccessToken();
      if (!accessToken) {
        setUser(null);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        setUser,
        user,
        isLoading,
        isAuthenticated: !!user,
        signInWithApple,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
