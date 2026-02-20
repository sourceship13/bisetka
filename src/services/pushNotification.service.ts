import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import tokenService from './token.service';
import { apiConfig } from '../libs/utils/api.utils';
import { getDeviceId } from '../libs/utils/deviceInfo';

class PushNotificationService {
  private hasPermission = false;

  /**
   * Request push notification permissions (iOS) and get FCM token
   */
  async initialize(): Promise<string | null> {
    try {
      // Request permission (iOS requires this, Android auto-grants)
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('❌ Push permission denied');
        return null;
      }

      this.hasPermission = true;
      console.log('✅ Push permission granted');

      // Get FCM token
      const token = await messaging().getToken();
      console.log('📲 FCM Token:', token);

      // Register token with backend
      await this.registerToken(token);

      // Listen for token refresh
      messaging().onTokenRefresh(async newToken => {
        console.log('🔄 FCM Token refreshed:', newToken);
        await this.registerToken(newToken);
      });

      // Setup message handlers
      this.setupMessageHandlers();

      return token;
    } catch (error) {
      console.error('❌ Push initialization failed:', error);
      return null;
    }
  }

  /**
   * Register FCM token with backend
   */
  private async registerToken(token: string): Promise<void> {
    try {
      const accessToken = await tokenService.getAccessToken();
      const deviceId = await getDeviceId();

      if (!accessToken) {
        console.warn('⚠️ No access token, skipping push token registration');
        return;
      }

      const response = await fetch(`${apiConfig.apiURL}/devices/push-token`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'x-device-id': deviceId,
        },
        body: JSON.stringify({ pushToken: token }),
      });

      if (response.ok) {
        console.log('✅ Push token registered with backend');
      } else {
        console.warn('⚠️ Push token registration failed:', response.status);
      }
    } catch (error) {
      console.error('❌ Push token registration error:', error);
    }
  }

  /**
   * Setup foreground and background message handlers
   */
  private setupMessageHandlers(): void {
    // Foreground messages
    messaging().onMessage(async remoteMessage => {
      console.log('📬 Foreground push received:', remoteMessage);
      
      // Display local notification when app is in foreground
      // You can show a custom in-app notification here
    });

    // Background/quit messages
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('📬 Background push received:', remoteMessage);
      // Handle background notification (update badge, etc.)
    });
  }

  /**
   * Get current FCM token
   */
  async getToken(): Promise<string | null> {
    try {
      if (!this.hasPermission) {
        await this.initialize();
      }
      return await messaging().getToken();
    } catch (error) {
      console.error('❌ Failed to get FCM token:', error);
      return null;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async checkPermission(): Promise<boolean> {
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
