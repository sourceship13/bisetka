import {appleAuth} from '@invertase/react-native-apple-authentication';
import {Platform} from 'react-native';

export interface AppleAuthResponse {
  user: string;
  email: string | null;
  fullName: {
    givenName: string | null;
    familyName: string | null;
  };
  identityToken: string;
  authorizationCode: string;
}

class AuthService {
  /**
   * Check if Apple Sign In is available on this device
   */
  isAppleAuthAvailable(): boolean {
    if (Platform.OS !== 'ios') {
      return false;
    }
    return appleAuth.isSupported;
  }

  /**
   * Perform Apple Sign In
   */
  async signInWithApple(): Promise<AppleAuthResponse> {
    try {
      // Start the sign-in request
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      // Get the credential state
      const credentialState = await appleAuth.getCredentialStateForUser(
        appleAuthRequestResponse.user,
      );

      // Verify the credential state
      if (credentialState === appleAuth.State.AUTHORIZED) {
        return {
          user: appleAuthRequestResponse.user,
          email: appleAuthRequestResponse.email,
          fullName: {
            givenName: appleAuthRequestResponse.fullName?.givenName || null,
            familyName: appleAuthRequestResponse.fullName?.familyName || null,
          },
          identityToken: appleAuthRequestResponse.identityToken || '',
          authorizationCode: appleAuthRequestResponse.authorizationCode || '',
        };
      } else {
        throw new Error('Apple Sign In failed: Invalid credential state');
      }
    } catch (error: any) {
      if (error.code === appleAuth.Error.CANCELED) {
        throw new Error('User canceled Apple Sign In');
      }
      throw new Error(`Apple Sign In failed: ${error.message}`);
    }
  }

  /**
   * Sign out (revoke Apple credentials if needed)
   */
  async signOut(): Promise<void> {
    // TODO: Implement sign out logic
    // Clear tokens, user data, etc.
    console.log('User signed out');
  }

  /**
   * Verify if user credentials are still valid
   */
  async verifyAppleCredentials(userId: string): Promise<boolean> {
    try {
      const credentialState = await appleAuth.getCredentialStateForUser(
        userId,
      );
      return credentialState === appleAuth.State.AUTHORIZED;
    } catch (error) {
      console.error('Failed to verify Apple credentials:', error);
      return false;
    }
  }
}

export default new AuthService();
