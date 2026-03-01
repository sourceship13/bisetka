import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { apiConfig } from '../libs/utils/api.utils';

export interface GameMove {
  from: { row: number; col: number };
  to: { row: number; col: number };
}

export interface MultiplayerGameState {
  roomId: string;
  gameType: 'chess' | 'checkers' | 'blot' | 'nardi';
  myColor: 'white' | 'black';
  opponentId: string;
  currentTurn: 'white' | 'black';
  status: 'waiting' | 'active' | 'completed';
}

class SocketService {
  private socket: Socket | null = null;
  
  // Use apiConfig to get the correct server URL based on environment
  private getServerUrl(): string {
    // Use the same base URL as the API (handles local/staging/production automatically)
    const baseUrl = apiConfig.baseURL;
    console.log('🔌 Socket server URL from apiConfig:', baseUrl);
    return baseUrl;
  }
  
  private serverUrl: string = this.getServerUrl();

  connect(userId: string, token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      console.log('🔌 Attempting to connect to:', this.serverUrl);
      console.log('🔌 User ID:', userId);
      console.log('🔌 Token:', token ? 'present' : 'missing');
      
      if (this.socket?.connected) {
        console.log('✅ Already connected');
        resolve(true);
        return;
      }

      console.log('🔄 Creating new socket connection...');
      console.log('🔄 Socket.IO config:', {
        url: this.serverUrl,
        transports: ['websocket', 'polling'],
      });
      
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'], // Try both transports
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      // Set a timeout for authentication
      const authTimeout = setTimeout(() => {
        console.error('❌ Authentication timeout');
        reject(new Error('Authentication timeout'));
      }, 10000);

      this.socket.on('connect', () => {
        console.log('✅ Connected to server, sending authentication...');
        console.log('📤 Emitting authenticate event with userId:', userId, 'token length:', token?.length);
        this.socket?.emit('authenticate', { userId, token });
        console.log('📤 Authenticate event emitted');
      });

      this.socket.on('authenticated', (data: { success: boolean; error?: string }) => {
        console.log('📥 Received authenticated event:', JSON.stringify(data));
        clearTimeout(authTimeout);
        if (data.success) {
          console.log('✅ Authenticated successfully');
          resolve(true);
        } else {
          console.error('❌ Authentication failed - server rejected:', data.error);
          reject(new Error(data.error || 'Authentication failed'));
        }
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(authTimeout);
        console.error('❌ Connection error:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error type:', error.type);
        reject(error);
      });

      this.socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from server. Reason:', reason);
      });
      
      this.socket.on('connect_timeout', () => {
        console.error('❌ Connection timeout');
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Find a random opponent
  findMatch(gameType: string, userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      // Clear any stale listeners that could intercept our events
      this.socket.off('match_found');
      this.socket.off('room_joined');

      this.socket.emit('find_match', { gameType, userId });

      this.socket.once('match_found', (data) => {
        resolve(data);
      });

      this.socket.once('error', (error) => {
        reject(error);
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        reject(new Error('Matchmaking timeout'));
      }, 60000);
    });
  }

  // Cancel matchmaking
  cancelMatchmaking(userId: string) {
    this.socket?.emit('cancel_matchmaking', { userId });
  }

  // Create private room
  createPrivateRoom(gameType: string, userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('create_private_room', { gameType, userId });

      this.socket.once('room_created', (data) => {
        resolve(data);
      });

      this.socket.once('error', (error) => {
        reject(error);
      });
    });
  }

  // Join private room
  joinPrivateRoom(roomCode: string, userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      // Clear any stale listeners that could intercept our events
      this.socket.off('room_joined');
      this.socket.off('match_found');

      this.socket.emit('join_private_room', { roomCode, userId });

      this.socket.once('room_joined', (data) => {
        resolve(data);
      });

      this.socket.once('error', (error) => {
        reject(error);
      });
    });
  }

  // Make a move
  makeMove(roomId: string, userId: string, move: GameMove) {
    this.socket?.emit('make_move', { roomId, userId, move });
  }

  // Player ready
  playerReady(roomId: string, userId: string) {
    this.socket?.emit('player_ready', { roomId, userId });
  }

  // Resign
  resign(roomId: string, userId: string) {
    this.socket?.emit('resign', { roomId, userId });
  }

  // Event listeners
  onMatchmakingStatus(callback: (data: any) => void) {
    this.socket?.on('matchmaking_status', callback);
  }

  onOpponentJoined(callback: (data: any) => void) {
    this.socket?.on('opponent_joined', callback);
  }

  onGameStarted(callback: (data: any) => void) {
    this.socket?.on('game_started', callback);
  }

  onMoveMade(callback: (data: any) => void) {
    this.socket?.on('move_made', callback);
  }

  onGameEnded(callback: (data: any) => void) {
    this.socket?.on('game_ended', callback);
  }

  onOpponentDisconnected(callback: () => void) {
    this.socket?.on('opponent_disconnected', callback);
  }

  onError(callback: (error: any) => void) {
    this.socket?.on('error', callback);
  }

  // Remove listeners
  removeListener(event: string, callback?: any) {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  // Remove all listeners
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }

  // Get socket instance for custom events (e.g., chat rooms)
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const socketService = new SocketService();
