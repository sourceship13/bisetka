import React, {createContext, useState, useContext, useEffect} from 'react';
import AuthService, {AppleAuthResponse} from '../services/AuthService';
import apiService from '../services/api.service';
import {Platform} from 'react-native';
import {appleAuth} from '@invertase/react-native-apple-authentication';

interface User {
  id: string;
  email: string | null;
  fullName?: {
    givenName: string | null;
    familyName: string | null;
  };
  token?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName?: {givenName: string; familyName: string}) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user was previously signed in
    // TODO: Load user from AsyncStorage or secure storage
    setIsLoading(false);

    // Set up credential revoked listener for iOS
    if (Platform.OS === 'ios' && AuthService.isAppleAuthAvailable()) {
      const unsubscribe = appleAuth.onCredentialRevoked(async () => {
        console.warn('Apple credentials revoked');
        setUser(null);
        // TODO: Clear stored user data
      });

      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
  }, []);

  const signInWithApple = async () => {
    try {
      setIsLoading(true);
      
      // Perform Apple Sign In request
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      // Get the identity token
      const { identityToken, email, fullName } = appleAuthRequestResponse;

      if (!identityToken) {
        throw new Error('No identity token returned');
      }

      console.log('🍎 Apple Sign In successful, sending to backend...');
      console.log('Identity token:', identityToken);
      console.log('Email:', email);
      console.log('Full name:', fullName);

      // Send to your backend
      const backendResponse = await apiService.appleSignIn({
        idToken: identityToken,
        email: email,
        fullName: fullName ? `${fullName.givenName} ${fullName.familyName}` : undefined,
      });

      // Set user from backend response
      const newUser: User = {
        id: backendResponse.user.id,
        email: backendResponse.user.email,
        fullName: backendResponse.user.fullName,
        token: backendResponse.token,
      };

      setUser(newUser);

      // TODO: Store user data and token securely (AsyncStorage, SecureStore, etc.)
      console.log('✅ Backend authentication successful:', newUser);
    } catch (error: any) {
      console.error('❌ Apple Sign In error:', error.message || error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log('📧 Email Sign In, sending to backend...');

      const backendResponse = await apiService.login({
        email,
        password,
      });

      const newUser: User = {
        id: backendResponse.user.id,
        email: backendResponse.user.email,
        fullName: backendResponse.user.fullName,
        token: backendResponse.token,
      };

      setUser(newUser);
      console.log('✅ Email Sign In successful:', newUser);
    } catch (error: any) {
      console.error('❌ Email Sign In error:', error.message || error);
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
      console.log('📝 Email Sign Up, sending to backend...');

      const backendResponse = await apiService.register({
        email,
        password,
        fullName,
      });

      const newUser: User = {
        id: backendResponse.user.id,
        email: backendResponse.user.email,
        fullName: backendResponse.user.fullName,
        token: backendResponse.token,
      };

      setUser(newUser);
      console.log('✅ Email Sign Up successful:', newUser);
    } catch (error: any) {
      console.error('❌ Email Sign Up error:', error.message || error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await AuthService.signOut();
      setUser(null);
      // TODO: Clear stored user data
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
