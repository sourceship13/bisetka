import React, {createContext, useState, useContext, useEffect} from 'react';
import AuthService, {AppleAuthResponse} from '../services/AuthService';
import {Platform} from 'react-native';
import appleAuth from '@invertase/react-native-apple-authentication';

interface User {
  id: string;
  email: string | null;
  fullName: {
    givenName: string | null;
    familyName: string | null;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithApple: () => Promise<void>;
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
      const listener = appleAuth.onCredentialRevoked(async () => {
        console.warn('Apple credentials revoked');
        setUser(null);
        // TODO: Clear stored user data
      });

      return () => {
        listener.remove();
      };
    }
  }, []);

  const signInWithApple = async () => {
    try {
      setIsLoading(true);
      const response: AppleAuthResponse =
        await AuthService.signInWithApple();

      // Create user object
      const newUser: User = {
        id: response.user,
        email: response.email,
        fullName: response.fullName,
      };

      setUser(newUser);

      // TODO: Store user data securely (AsyncStorage, SecureStore, etc.)
      // TODO: Send identityToken to your backend for verification
      console.log('Apple Sign In successful:', newUser);
    } catch (error: any) {
      console.error('Apple Sign In error:', error.message);
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
