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

type RoomNameCallback = (data: { roomId: string; dbSessionId?: string; roomName: string }) => void;

class SocketService {
  private socket: Socket | null = null;
  private roomNameCallbacks: Set<RoomNameCallback> = new Set();
  private roomNameListenerAttached = false;
  
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
        this.ensureRoomNameListener();
        this.ensureOnAnyRoomName();
        resolve(true);
        return;
      }

      console.log('🔄 Creating new socket connection...');
      console.log('🔄 Socket.IO config:', {
        url: this.serverUrl,
        transports: ['websocket'],
      });
      
      this.socket = io(this.serverUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      // onAny survives socket.removeAllListeners() — use it as the reliable
      // channel for room_name_updated so screen cleanup never kills it.
      this.ensureOnAnyRoomName();

      // Set a timeout for authentication
      const authTimeout = setTimeout(() => {
        console.error('❌ Authentication timeout');
        reject(new Error('Authentication timeout'));
      }, 10000);

      this.ensureRoomNameListener();

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
      this.roomNameListenerAttached = false;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Find a random opponent
  findMatch(gameType: string, userId: string, allowReplaceAI?: boolean): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      // Clear any stale listeners that could intercept our events
      this.socket.off('match_found');
      this.socket.off('room_joined');

      this.socket.emit('find_match', { gameType, userId, allowReplaceAI });

      this.socket.once('match_found', (data) => {
        resolve(data);
      });

      this.socket.once('error', (error) => {
        reject(new Error(error?.message || String(error) || 'Matchmaking failed'));
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
  createPrivateRoom(gameType: string, userId: string, desiredCode?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      // Clear any stale listeners from a previous call
      this.socket.off('room_created');
      this.socket.off('error');

      const timer = setTimeout(() => {
        this.socket?.off('room_created');
        this.socket?.off('error');
        reject(new Error('Room creation timed out'));
      }, 15000);

      this.socket.once('room_created', (data) => {
        clearTimeout(timer);
        this.socket?.off('error');
        resolve(data);
      });

      this.socket.once('error', (error) => {
        clearTimeout(timer);
        this.socket?.off('room_created');
        reject(new Error(error?.message || String(error) || 'Room creation failed'));
      });

      this.socket.emit('create_private_room', { gameType, userId, desiredCode });
    });
  }

  // Join private room
  joinPrivateRoom(roomCode: string, userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      // Clear stale listeners
      this.socket.off('room_joined');
      this.socket.off('match_found');
      this.socket.off('error');

      const timer = setTimeout(() => {
        this.socket?.off('room_joined');
        this.socket?.off('error');
        reject(new Error('Room not found or join timed out'));
      }, 10000);

      // Register listeners BEFORE emitting (avoids race condition)
      this.socket.once('room_joined', (data) => {
        clearTimeout(timer);
        this.socket?.off('error');
        resolve(data);
      });

      this.socket.once('error', (error) => {
        clearTimeout(timer);
        this.socket?.off('room_joined');
        reject(new Error(error?.message || String(error) || 'Failed to join room'));
      });

      this.socket.emit('join_private_room', { roomCode, userId });
    });
  }

  // Look up which game type owns a room code (works from any game screen)
  lookupRoomCode(roomCode: string): Promise<{ roomCode: string; roomId: string; gameType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.off('room_code_found');
      this.socket.off('room_code_not_found');

      const timer = setTimeout(() => {
        this.socket?.off('room_code_found');
        this.socket?.off('room_code_not_found');
        reject(new Error('Lookup timed out'));
      }, 5000);

      this.socket.once('room_code_found', (data) => {
        clearTimeout(timer);
        this.socket?.off('room_code_not_found');
        resolve(data);
      });

      this.socket.once('room_code_not_found', () => {
        clearTimeout(timer);
        this.socket?.off('room_code_found');
        reject(new Error('Room not found. Check your code and try again.'));
      });

      this.socket.emit('lookup_room_code', { roomCode });
    });
  }

  // Join a waiting room directly from the Active Rooms lobby
  joinRoomBySession(dbSessionId: string, userId: string): void {
    this.socket?.emit('join_room_by_session', { dbSessionId, userId });
  }

  // Spectate an in-progress room from the Active Rooms lobby
  spectateRoom(dbSessionId: string, userId: string, displayName?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }
      const timer = setTimeout(() => {
        this.socket?.off('spectate_started');
        reject(new Error('Spectate request timed out'));
      }, 10_000);
      this.socket.once('spectate_started', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      this.socket.emit('spectate_room', { dbSessionId, userId, displayName });
    });
  }

  // Replace an AI player in a Poker or Baazar Blot room
  replaceAiPlayer(dbSessionId: string, userId: string, displayName?: string): void {
    this.socket?.emit('replace_ai_player', { dbSessionId, userId, displayName });
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
    // Re-attach managed listeners that must survive screen cleanup
    this.roomNameListenerAttached = false;
    this.ensureRoomNameListener();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POKER MULTIPLAYER
  // ─────────────────────────────────────────────────────────────────────────

  joinPokerMatchmaking(userId: string, displayName: string, allowReplaceAI?: boolean): void {
    this.socket?.emit('join_poker_matchmaking', { userId, displayName, allowReplaceAI });
  }

  cancelPokerMatchmaking(userId: string): void {
    this.socket?.emit('cancel_poker_matchmaking', { userId });
  }

  createPokerPrivateRoom(userId: string, displayName: string): void {
    this.socket?.emit('create_poker_private_room', { userId, displayName });
  }

  joinPokerPrivateRoom(roomCode: string, userId: string, displayName: string): void {
    this.socket?.emit('join_poker_private_room', { roomCode, userId, displayName });
  }

  startPokerPrivateRoom(tableId: string, userId: string): void {
    this.socket?.emit('start_poker_private', { tableId, userId });
  }

  sendPokerAction(tableId: string, action: 'fold' | 'call' | 'raise' | 'check', amount?: number): void {
    this.socket?.emit('poker_action', { tableId, action, amount });
  }

  rejoinPoker(userId: string): void {
    this.socket?.emit('rejoin_poker', { userId });
  }

  onPokerJoined(cb: (data: { tableId: string; seatIndex: number }) => void) {
    this.socket?.on('poker_joined', cb);
  }

  onPokerRoomUpdate(cb: (data: any) => void) {
    this.socket?.on('poker_room_update', cb);
  }

  onPokerGameStarted(cb: (data: any) => void) {
    this.socket?.on('poker_game_started', cb);
  }

  onPokerPrivateCreated(cb: (data: { tableId: string; roomCode: string; seatIndex: number }) => void) {
    this.socket?.on('poker_private_created', cb);
  }

  onPokerStateUpdate(cb: (data: any) => void) {
    this.socket?.on('poker_state_update', cb);
  }

  onPokerHandResult(cb: (data: any) => void) {
    this.socket?.on('poker_hand_result', cb);
  }

  onPokerTurnTimeout(cb: (data: { tableId: string; seat: number; message: string }) => void) {
    this.socket?.on('poker_turn_timeout', cb);
  }

  onPokerPlayerDisconnected(cb: (data: { tableId: string; seat: number; displayName: string }) => void) {
    this.socket?.on('poker_player_disconnected', cb);
  }

  onPokerMatchmakingCancelled(cb: () => void) {
    this.socket?.on('poker_matchmaking_cancelled', cb);
  }

  offPokerEvents() {
    this.socket?.off('poker_joined');
    this.socket?.off('poker_private_created');
    this.socket?.off('poker_room_update');
    this.socket?.off('poker_game_started');
    this.socket?.off('poker_state_update');
    this.socket?.off('poker_hand_result');
    this.socket?.off('poker_turn_timeout');
    this.socket?.off('poker_player_disconnected');
    this.socket?.off('poker_matchmaking_cancelled');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ROOM NAMING
  // ─────────────────────────────────────────────────────────────────────────────

  /** Attach onAny handler for room_name_updated — survives removeAllListeners() */
  private ensureOnAnyRoomName(): void {
    if (!this.socket) return;
    if ((this.socket as any)._roomNameOnAnyAttached) return; // only once per socket instance
    this.socket.onAny((event: string, ...args: any[]) => {
      if (event === 'room_name_updated') {
        console.log('🏷️ [SocketService.onAny] room_name_updated =>', JSON.stringify(args[0]));
        this.roomNameCallbacks.forEach(cb => cb(args[0]));
      }
    });
    (this.socket as any)._roomNameOnAnyAttached = true;
  }

  /** Attach the global room_name_updated listener if not already attached */
  private ensureRoomNameListener(): void {
    if (!this.socket) return;
    // Remove only the previously-attached managed listener (not all listeners)
    const prev = (this as any)._managedRoomNameHandler;
    if (prev) this.socket.off('room_name_updated', prev);
    const handler = (data: any) => {
      console.log('🏷️ [SocketService] room_name_updated received:', JSON.stringify(data));
      this.roomNameCallbacks.forEach(cb => cb(data));
    };
    this.socket.on('room_name_updated', handler);
    (this as any)._managedRoomNameHandler = handler;
    this.roomNameListenerAttached = true;
    console.log('🏷️ [SocketService] room_name_updated listener attached, callbacks:', this.roomNameCallbacks.size);
  }

  setRoomName(roomId: string, roomName: string): void {
    console.log(`🏷️ [SocketService.setRoomName] roomId=${roomId} roomName=${roomName} socketConnected=${this.socket?.connected} socketId=${this.socket?.id}`);
    if (!this.socket?.connected) {
      console.warn('🏷️ [SocketService.setRoomName] Socket not connected! Cannot emit.');
      return;
    }
    this.socket.emit('set_room_name', { roomId, roomName });
    console.log('🏷️ [SocketService.setRoomName] Emitted set_room_name');
  }

  /** Subscribe to room name updates — survives reconnects */
  subscribeRoomName(cb: RoomNameCallback): () => void {
    this.roomNameCallbacks.add(cb);
    // Re-ensure listener is attached (might have been stripped by removeAllListeners or screen cleanup)
    this.ensureRoomNameListener();
    console.log(`🏷️ [SocketService] subscribeRoomName — now ${this.roomNameCallbacks.size} subscriber(s), socket=${this.socket?.id}`);
    return () => { this.roomNameCallbacks.delete(cb); };
  }

  /** @deprecated Use subscribeRoomName instead */
  onRoomNameUpdated(cb: (data: { roomId: string; roomName: string }) => void) {
    this.socket?.on('room_name_updated', cb);
  }

  /** @deprecated Use subscribeRoomName instead */
  offRoomNameUpdated() {
    this.socket?.off('room_name_updated');
  }

  onRoomClosed(cb: (data: { roomId: string; dbSessionId: string | null }) => void) {
    this.socket?.on('room_closed', cb);
  }

  offRoomClosed() {
    this.socket?.off('room_closed');
  }

  // ─────────────────────────────────────────────────────────────────────────

  // Get socket instance for custom events (e.g., chat rooms)
  getSocket(): Socket | null {
    return this.socket;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ROOM THEME  (broadcast card/board theme to all players + spectators)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tells the server to store the theme and broadcast it to every client in the room.
   */
  setRoomTheme(roomId: string, theme: any): void {
    this.socket?.emit('set_room_theme', { roomId, theme });
  }

  /**
   * Listen for theme changes pushed by the server.
   */
  onRoomThemeUpdated(handler: (data: { roomId: string; theme: any }) => void): void {
    this.socket?.on('room_theme_updated', handler);
  }

  offRoomThemeUpdated(): void {
    this.socket?.off('room_theme_updated');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VOICE CHAT SIGNALING  (relayed through the backend game socket)
  // ─────────────────────────────────────────────────────────────────────────

  emitVoiceOffer(roomId: string, sdp: any): void {
    this.socket?.emit('voice:offer', { roomId, sdp });
  }

  emitVoiceAnswer(roomId: string, sdp: any): void {
    this.socket?.emit('voice:answer', { roomId, sdp });
  }

  emitVoiceIceCandidate(roomId: string, candidate: any): void {
    this.socket?.emit('voice:ice-candidate', { roomId, candidate });
  }

  emitVoiceHangup(roomId: string): void {
    this.socket?.emit('voice:hangup', { roomId });
  }

  // ─────────────────────────────────────────────────────────────────────────
}

// Export singleton instance
export const socketService = new SocketService();
