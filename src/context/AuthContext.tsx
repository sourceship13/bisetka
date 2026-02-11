import React, {createContext, useState, useContext, useEffect} from 'react';
import AuthService from '../services/AuthService';
import apiService from '../services/api.service';
import {Platform, AppState, AppStateStatus} from 'react-native';
import {appleAuth} from '@invertase/react-native-apple-authentication';
import tokenService from '../services/token.service';
import type {User} from '../types/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName?: {givenName: string; familyName: string},
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapBackendUser = (user: User): User => ({
  ...user,
  // Ensure camelCase fallback if backend uses snake_case
  fullName: user.fullName || (user.full_name ? {givenName: user.full_name, familyName: null} : null),
});

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    tokenService.registerUserUpdater(nextUser => {
      if (isMounted) {
        setUser(nextUser ? mapBackendUser(nextUser) : null);
      }
    });

    const bootstrap = async () => {
      try {
        await tokenService.initialize();
        const storedUser = await tokenService.getStoredUser();
        if (storedUser && isMounted) {
          setUser(mapBackendUser(storedUser));
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
      });
    }

    // AppState listener: check token when app comes to foreground
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('📱 App resumed to foreground — checking token health...');
        try {
          await tokenService.checkAndRefreshIfNeeded();
        } catch (error) {
          console.warn('Token check on resume failed:', error);
        }
      }
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

  const signInWithApple = async () => {
    try {
      setIsLoading(true);

      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      const {identityToken, email, fullName} = appleAuthRequestResponse;

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
    } catch (error: any) {
      console.error('❌ Apple Sign In error:', error?.message || error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const backendResponse = await apiService.login({
        email,
        password,
      });

      await tokenService.storeSession(backendResponse);
      setUser(mapBackendUser(backendResponse.user));
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
    fullName?: {givenName: string; familyName: string},
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
    } catch (error: any) {
      console.error('❌ Email Sign Up error:', error?.message || error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await AuthService.signOut();
      await tokenService.clearSession();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signInWithApple,
        signInWithEmail,
        signUpWithEmail,
        signOut,
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
