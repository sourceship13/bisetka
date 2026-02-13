import { io, Socket } from 'socket.io-client';
import { apiConfig } from '../libs/utils/api.utils';
import { Message } from './chat.service';

type ChatMessageHandler = (message: Message) => void;
type TypingHandler = (userId: string, isTyping: boolean) => void;
type ReadHandler = (chatId: string, userId: string) => void;

class ChatSocketService {
  private socket: Socket | null = null;
  private messageHandlers: Map<string, ChatMessageHandler[]> = new Map();
  private typingHandlers: Map<string, TypingHandler[]> = new Map();
  private readHandlers: ReadHandler[] = [];
  private connected = false;

  connect(userId: string, token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(true);
        return;
      }

      console.log('💬 Connecting to chat socket:', apiConfig.baseURL);

      this.socket = io(apiConfig.baseURL, {
        transports: ['websocket', 'polling'],
        auth: { userId, token },
      });

      this.socket.on('connect', () => {
        console.log('✅ Chat socket connected');
        this.connected = true;
        this.setupEventListeners();
        resolve(true);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Chat socket connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Chat socket disconnected');
        this.connected = false;
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.messageHandlers.clear();
      this.typingHandlers.clear();
      this.readHandlers = [];
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // New message received
    this.socket.on('chat:message', (data: { message: Message }) => {
      const handlers = this.messageHandlers.get(data.message.chat_id) || [];
      handlers.forEach(handler => handler(data.message));
    });

    // Typing indicator
    this.socket.on('chat:typing', (data: { chatId: string; userId: string; isTyping: boolean }) => {
      const handlers = this.typingHandlers.get(data.chatId) || [];
      handlers.forEach(handler => handler(data.userId, data.isTyping));
    });

    // Read receipt (DM only)
    this.socket.on('chat:read', (data: { chatId: string; userId: string }) => {
      this.readHandlers.forEach(handler => handler(data.chatId, data.userId));
    });

    // Error
    this.socket.on('chat:error', (data: { message: string }) => {
      console.error('💬 Chat error:', data.message);
    });
  }

  // Join a chat room
  joinChat(chatId: string, userId: string) {
    if (!this.socket) return;
    this.socket.emit('chat:join', { chatId, userId });
  }

  // Leave a chat room
  leaveChat(chatId: string) {
    if (!this.socket) return;
    this.socket.emit('chat:leave', { chatId });
  }

  // Send typing indicator
  sendTyping(chatId: string, userId: string, isTyping: boolean) {
    if (!this.socket) return;
    this.socket.emit('chat:typing', { chatId, userId, isTyping });
  }

  // Send read receipt (DM only)
  sendRead(chatId: string, userId: string) {
    if (!this.socket) return;
    this.socket.emit('chat:read', { chatId, userId });
  }

  // Register handler for new messages in a chat
  onMessage(chatId: string, handler: ChatMessageHandler) {
    const handlers = this.messageHandlers.get(chatId) || [];
    handlers.push(handler);
    this.messageHandlers.set(chatId, handlers);
  }

  // Unregister message handler
  offMessage(chatId: string, handler: ChatMessageHandler) {
    const handlers = this.messageHandlers.get(chatId) || [];
    const filtered = handlers.filter(h => h !== handler);
    this.messageHandlers.set(chatId, filtered);
  }

  // Register handler for typing indicator
  onTyping(chatId: string, handler: TypingHandler) {
    const handlers = this.typingHandlers.get(chatId) || [];
    handlers.push(handler);
    this.typingHandlers.set(chatId, handlers);
  }

  // Register handler for read receipts
  onRead(handler: ReadHandler) {
    this.readHandlers.push(handler);
  }
}

export const chatSocketService = new ChatSocketService();
export default chatSocketService;
