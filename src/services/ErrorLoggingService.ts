import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { getBaseURL } from '../libs/utils/api.utils';

interface ErrorLog {
  deviceId: string;
  errorMessage: string;
  errorStack?: string;
  errorName?: string;
  errorCode?: string;
  componentName?: string;
  screenName?: string;
  action?: string;
  platform: 'ios' | 'android';
  osVersion?: string;
  appVersion?: string;
  deviceModel?: string;
  endpoint?: string;
  httpStatus?: number;
  metadata?: Record<string, any>;
  occurredAt?: Date;
  severity?: 'error' | 'warning' | 'fatal';
  isHandled?: boolean;
}

class ErrorLoggingService {
  private static instance: ErrorLoggingService;
  private deviceId: string = '';
  private errorQueue: ErrorLog[] = [];
  private isInitialized: boolean = false;
  private userId?: number;

  private constructor() {}

  static getInstance(): ErrorLoggingService {
    if (!ErrorLoggingService.instance) {
      ErrorLoggingService.instance = new ErrorLoggingService();
    }
    return ErrorLoggingService.instance;
  }

  /**
   * Initialize the error logging service
   */
  async initialize(userId?: number): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.deviceId = await DeviceInfo.getUniqueId();
      this.userId = userId;
      this.isInitialized = true;

      // Set up global error handler
      this.setupGlobalErrorHandler();

      // Flush any queued errors
      await this.flushErrorQueue();

      console.log('✅ Error logging service initialized');
    } catch (error) {
      console.error('Failed to initialize error logging:', error);
    }
  }

  /**
   * Set the current user ID
   */
  setUserId(userId?: number): void {
    this.userId = userId;
  }

  /**
   * Setup global error handler to catch unhandled errors
   */
  private setupGlobalErrorHandler(): void {
    // React Native global error handler
    const defaultHandler = ErrorUtils.getGlobalHandler();
    
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      this.logError({
        error,
        severity: isFatal ? 'fatal' : 'error',
        isHandled: false,
        metadata: { isFatal },
      });

      // Call the default handler
      if (defaultHandler) {
        defaultHandler(error, isFatal);
      }
    });

    // Promise rejection handler
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id: string, error: Error) => {
        this.logError({
          error,
          errorName: 'UnhandledPromiseRejection',
          severity: 'error',
          isHandled: false,
        });
      },
    });
  }

  /**
   * Log an error to the backend
   */
  async logError(params: {
    error: Error;
    componentName?: string;
    screenName?: string;
    action?: string;
    endpoint?: string;
    httpStatus?: number;
    metadata?: Record<string, any>;
    severity?: 'error' | 'warning' | 'fatal';
    isHandled?: boolean;
  }): Promise<void> {
    try {
      const {
        error,
        componentName,
        screenName,
        action,
        endpoint,
        httpStatus,
        metadata,
        severity = 'error',
        isHandled = true,
      } = params;

      const errorLog: ErrorLog = {
        deviceId: this.deviceId,
        errorMessage: error.message,
        errorStack: error.stack,
        errorName: error.name,
        errorCode: (error as any).code,
        componentName,
        screenName,
        action,
        platform: Platform.OS as 'ios' | 'android',
        osVersion: Platform.Version.toString(),
        appVersion: DeviceInfo.getVersion(),
        deviceModel: await DeviceInfo.getDeviceId(),
        endpoint,
        httpStatus,
        metadata: {
          ...metadata,
          userId: this.userId,
        },
        occurredAt: new Date(),
        severity,
        isHandled,
      };

      // Try to send immediately
      await this.sendError(errorLog);
    } catch (err) {
      console.error('Failed to log error:', err);
      // Queue for later if sending fails
      this.errorQueue.push(params as any);
    }
  }

  /**
   * Log a custom message (for non-Error objects)
   */
  async logMessage(params: {
    message: string;
    name?: string;
    componentName?: string;
    screenName?: string;
    action?: string;
    metadata?: Record<string, any>;
    severity?: 'error' | 'warning' | 'fatal';
  }): Promise<void> {
    const error = new Error(params.message);
    error.name = params.name || 'CustomError';

    await this.logError({
      error,
      componentName: params.componentName,
      screenName: params.screenName,
      action: params.action,
      metadata: params.metadata,
      severity: params.severity,
      isHandled: true,
    });
  }

  /**
   * Log a network error
   */
  async logNetworkError(params: {
    endpoint: string;
    method: string;
    error: Error;
    httpStatus?: number;
    responseData?: any;
    requestData?: any;
  }): Promise<void> {
    await this.logError({
      error: params.error,
      endpoint: params.endpoint,
      httpStatus: params.httpStatus,
      action: `${params.method} ${params.endpoint}`,
      metadata: {
        requestData: params.requestData,
        responseData: params.responseData,
      },
      severity: 'error',
    });
  }

  /**
   * Send error to backend
   */
  private async sendError(errorLog: ErrorLog): Promise<void> {
    const baseURL = getBaseURL();
    const url = `${baseURL}/api/errors/log`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorLog),
    });

    if (!response.ok) {
      throw new Error(`Failed to send error: ${response.status}`);
    }
  }

  /**
   * Flush queued errors
   */
  private async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    try {
      const baseURL = getBaseURL();
      const url = `${baseURL}/api/errors/batch`;

      const errors = [...this.errorQueue];
      this.errorQueue = [];

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ errors }),
      });

      console.log(`✅ Flushed ${errors.length} queued errors`);
    } catch (error) {
      console.error('Failed to flush error queue:', error);
    }
  }

  /**
   * Get error statistics (for admin/debug screens)
   */
  async getErrorStats(
    startDate?: Date,
    endDate?: Date,
    platform?: 'ios' | 'android'
  ): Promise<any> {
    const baseURL = getBaseURL();
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    if (platform) params.append('platform', platform);

    const url = `${baseURL}/api/errors/stats?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch error stats');
    }

    return response.json();
  }
}

// Export singleton instance
export const errorLogger = ErrorLoggingService.getInstance();

// Export convenience functions
export const logError = (params: Parameters<typeof errorLogger.logError>[0]) =>
  errorLogger.logError(params);

export const logMessage = (params: Parameters<typeof errorLogger.logMessage>[0]) =>
  errorLogger.logMessage(params);

export const logNetworkError = (params: Parameters<typeof errorLogger.logNetworkError>[0]) =>
  errorLogger.logNetworkError(params);
