import '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import {
  checkNotifications,
  requestNotifications,
  openSettings,
  RESULTS,
} from 'react-native-permissions';
import tokenService from './token.service';
import { apiConfig } from '../libs/utils/api.utils';
import { registerDevice } from '../libs/utils/deviceInfo';

export type NotificationPermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'blocked';

class PushNotificationService {
  private hasPermission = false;
  /** Prevents duplicate onTokenRefresh and message handler setups */
  private listenersSetUp = false;

  /** Set up onTokenRefresh + message handlers exactly once. */
  private setupListeners(): void {
    if (this.listenersSetUp) return;
    this.listenersSetUp = true;

    // Keep push token fresh — register whenever Firebase rotates it
    messaging().onTokenRefresh(async newToken => {
      console.log('🔄 FCM Token refreshed:', newToken);
      await this.registerToken(newToken);
    });

    this.setupMessageHandlers();
    console.log('📡 Push listeners set up');
  }

  /**
   * Silent init — only registers the FCM token if permission was already granted.
   * Safe to call on every login. Does NOT prompt the user.
   */
  async silentInit(): Promise<void> {
    try {
      console.log('🔍 [silentInit] START');

      const { status } = await checkNotifications();
      console.log('🔍 [silentInit] permission status:', status);
      const enabled = status === RESULTS.GRANTED || status === RESULTS.LIMITED;

      if (!enabled) {
        console.log('ℹ️ [silentInit] not granted — status:', status, '— aborting');
        return;
      }

      this.hasPermission = true;
      console.log('🔍 [silentInit] permission OK, calling registerDeviceForRemoteMessages...');

      // iOS requires APNs registration before getToken() returns anything.
      // Idempotent on iOS, no-op on Android.
      await messaging().registerDeviceForRemoteMessages();
      console.log('🔍 [silentInit] registerDeviceForRemoteMessages done');

      const token = await messaging().getToken();
      console.log('📲 [silentInit] FCM Token:', token ?? '⚠️ NULL');

      if (!token) {
        console.warn('⚠️ [silentInit] getToken() returned null — check Firebase/APNs config');
        return;
      }

      console.log('🔍 [silentInit] registering token with backend...');
      await this.registerToken(token);

      this.setupListeners();
      console.log('✅ [silentInit] DONE');
    } catch (error: any) {
      console.warn('⚠️ [silentInit] CAUGHT ERROR:', error?.message ?? error);
      // Silently ignore Firebase-not-initialized errors (native rebuild needed)
      if (error?.message?.includes('initializeApp') || error?.message?.includes('DEFAULT')) {
        console.log('ℹ️ Firebase not initialized yet — skipping push init until rebuild');
      }
    }
  }

  /**
   * Check current notification permission status without prompting.
   */
  async checkPermission(): Promise<NotificationPermissionStatus> {
    try {
      const { status } = await checkNotifications();
      switch (status) {
        case RESULTS.GRANTED:
        case RESULTS.LIMITED:
          return 'granted';
        case RESULTS.BLOCKED:
          return 'blocked';
        case RESULTS.DENIED:
          return 'denied';
        default:
          return 'undetermined';
      }
    } catch (error) {
      console.warn('⚠️ Permission check failed:', error);
      return 'undetermined';
    }
  }

  /**
   * Open device Settings so the user can manually enable notifications.
   */
  async openNotificationSettings(): Promise<void> {
    await openSettings();
  }

  /**
   * Request push notification permission using react-native-permissions, then
   * obtain the FCM token if granted.
   *
   * Returns:
   *  - 'granted'     → permission granted (FCM token registered in background)
   *  - 'blocked'     → previously denied; user must go to Settings
   *  - null          → user denied on this prompt
   */
  async initialize(): Promise<'granted' | 'blocked' | null> {
    // ── Step 1: Permission ─────────────────────────────────────────────────
    // This is the only step that shows UI. Fail loud if it errors.
    let status: string;
    try {
      const check = await checkNotifications();
      status = check.status;
      console.log('🔔 Notification permission status (before request):', status);

      if (status === RESULTS.DENIED) {
        const result = await requestNotifications(['alert', 'sound', 'badge']);
        status = result.status;
        console.log('🔔 Notification permission status (after request):', status);
      }
    } catch (error: any) {
      console.error('❌ Permission check/request failed:', error);
      return null;
    }

    if (status === RESULTS.BLOCKED) {
      console.log('🚫 Notifications blocked — user must enable in Settings');
      return 'blocked';
    }

    const enabled = status === RESULTS.GRANTED || status === RESULTS.LIMITED;
    if (!enabled) {
      console.log('❌ Push permission denied');
      return null;
    }

    // Permission was granted — tell the UI immediately.
    this.hasPermission = true;
    console.log('✅ Push permission granted');

    // ── Step 2: FCM token ──────────────────────────────────────────────────
    // Best-effort — a failure here (Firebase misconfigured, network, etc.)
    // must NOT override the successful permission grant shown to the user.
    try {
      // iOS requires APNs registration before getToken() returns anything.
      // Idempotent on iOS, no-op on Android.
      await messaging().registerDeviceForRemoteMessages();
      const token = await messaging().getToken();
      console.log('📲 FCM Token:', token ?? '⚠️ NULL');
      if (token) {
        await this.registerToken(token);
      }
      this.setupListeners();
    } catch (error: any) {
      // Log the real error so it's visible in Metro/device logs,
      // but don't surface it to the user — permission was already granted.
      console.warn('⚠️ FCM token fetch failed (non-fatal):', error?.message ?? error);
    }

    return 'granted';
  }

  /**
   * Register (or update) FCM token with backend.
   *
   * Uses POST /devices/register (upsert) so the device row is created if it
   * does not exist yet. The old PUT /devices/push-token was an UPDATE-only
   * query that silently did nothing when there was no existing device row.
   */
  private async registerToken(token: string): Promise<void> {
    try {
      const accessToken = await tokenService.getAccessToken();

      if (!accessToken) {
        console.warn('⚠️ No access token, skipping push token registration');
        return;
      }

      // registerDevice does POST /devices/register which upserts the row
      // and stores the push token in one atomic operation.
      await registerDevice(apiConfig.apiURL, accessToken, token);
      console.log('✅ FCM token registered with backend (upsert)');
    } catch (error) {
      console.error('❌ Push token registration error:', error);
    }
  }

  // ── In-app notification banner ────────────────────────────────────────────
  /** Components can subscribe to receive foreground push payloads. */
  private foregroundListeners: Array<(title: string, body: string, data?: Record<string, string>) => void> = [];

  /**
   * Register a callback that fires whenever a push arrives while the app
   * is in the foreground.  Returns an unsubscribe function.
   */
  onForegroundMessage(
    cb: (title: string, body: string, data?: Record<string, string>) => void
  ): () => void {
    this.foregroundListeners.push(cb);
    return () => {
      this.foregroundListeners = this.foregroundListeners.filter(l => l !== cb);
    };
  }

  private emitForeground(title: string, body: string, data?: Record<string, string>) {
    this.foregroundListeners.forEach(cb => cb(title, body, data));
  }

  /**
   * Setup foreground and background message handlers
   */
  private setupMessageHandlers(): void {
    // Foreground messages — FCM/APNs won't show a banner automatically
    // when the app is in the foreground, so we emit to our own banner.
    messaging().onMessage(async remoteMessage => {
      console.log('📬 Foreground push received:', JSON.stringify(remoteMessage, null, 2));
      const title = remoteMessage.notification?.title ?? remoteMessage.data?.title ?? 'New message';
      const body  = remoteMessage.notification?.body  ?? remoteMessage.data?.body  ?? '';
      const data  = remoteMessage.data as Record<string, string> | undefined;
      this.emitForeground(title, body, data);
    });

    // Background / quit — the OS handles the banner; we just log.
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('📬 Background push received:', remoteMessage.notification?.title);
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
   * Check if notifications are currently enabled (quick boolean for internal use)
   */
  async isEnabled(): Promise<boolean> {
    const status = await this.checkPermission();
    return status === 'granted';
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
