import { apiConfig } from '../libs/utils/api.utils';
import { getDeviceId } from '../libs/utils/deviceInfo';
import tokenService from './token.service';

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'system' | 'game_invite';
  media_url?: string;
  reply_to_id?: string;
  created_at: string;
  sender_username?: string;
  sender_avatar?: string;
}

export interface Chat {
  id: string;
  type: 'global' | 'room' | 'direct';
  name: string | null;
  avatar_url?: string;
  last_message_at: string;
  last_message_preview?: string;
  unread_count?: number;
}

class ChatService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = apiConfig.apiURL;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await tokenService.getAccessToken();
    const deviceId = await getDeviceId();
    console.log('🔑 Auth token present:', !!token, 'Token starts with:', token?.substring(0, 20));
    return {
      'Authorization': `Bearer ${token}`,
      'x-device-id': deviceId,
      'Content-Type': 'application/json',
    };
  }

  // Helper to make authenticated requests with automatic token refresh on 401
  private async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    let headers = await this.getAuthHeaders();
    let response = await fetch(url, { ...options, headers });
    
    // If 401, try refreshing the token and retry once
    if (response.status === 401) {
      console.log('🔄 Got 401, attempting token refresh...');
      try {
        await tokenService.refreshSession();
        headers = await this.getAuthHeaders();
        response = await fetch(url, { ...options, headers });
        console.log('✅ Retry after refresh:', response.status);
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        // Clear invalid session - user needs to re-login
        await tokenService.clearSession();
        throw new Error('Session expired. Please sign in again.');
      }
    }
    
    return response;
  }

  // Get or create global chat
  async getGlobalChat(): Promise<{ chatId: string }> {
    console.log('🔍 Fetching global chat from:', `${this.baseUrl}/chat/global`);
    const response = await this.authenticatedFetch(`${this.baseUrl}/chat/global`, {
      method: 'GET',
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Global chat error:', response.status, errorText);
      throw new Error(`Failed to get global chat: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  // List user's chats (DMs + rooms)
  async getChats(): Promise<{ chats: Chat[] }> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/chat`, {
      method: 'GET',
    });
    if (!response.ok) throw new Error('Failed to get chats');
    return response.json();
  }

  // Start or get existing DM
  async startDM(targetUserId: string): Promise<{ chatId: string; isNew: boolean }> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/dm`, {
      method: 'POST',
      body: JSON.stringify({ userId: targetUserId }),
    });
    if (!response.ok) throw new Error('Failed to start DM');
    return response.json();
  }

  // Get messages for a chat
  async getMessages(chatId: string, limit = 50, before?: string): Promise<{ messages: Message[] }> {
    let url = `${this.baseUrl}/chat/${chatId}/messages?limit=${limit}`;
    if (before) {
      url += `&before=${before}`;
    }
    const response = await this.authenticatedFetch(url, {
      method: 'GET',
    });
    if (!response.ok) throw new Error('Failed to get messages');
    return response.json();
  }

  // Post a message
  async postMessage(chatId: string, content: string, type = 'text', mediaUrl?: string, replyToId?: string): Promise<{ message: Message }> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/chat/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type, mediaUrl, replyToId }),
    });
    if (!response.ok) throw new Error('Failed to post message');
    return response.json();
  }

  // Mark chat as read (DM read receipts)
  async markRead(chatId: string): Promise<void> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/chat/${chatId}/read`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to mark as read');
  }

  // Get or create a chat room tied to a game session (idempotent — safe to call by both players)
  async getOrCreateGameChat(gameSessionId: string, gameType: string): Promise<{ chatId: string }> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/chat/game-session`, {
      method: 'POST',
      body: JSON.stringify({ gameSessionId, gameType }),
    });
    if (!response.ok) throw new Error('Failed to get or create game chat');
    return response.json();
  }

  // Join a chat room
  async joinChat(chatId: string): Promise<void> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/chat/${chatId}/join`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to join chat');
  }

  // Leave a chat room
  async leaveChat(chatId: string): Promise<void> {
    const response = await this.authenticatedFetch(`${this.baseUrl}/chat/${chatId}/leave`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to leave chat');
  }
}

export const chatService = new ChatService();
export default chatService;
