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
    return {
      'Authorization': `Bearer ${token}`,
      'x-device-id': deviceId,
      'Content-Type': 'application/json',
    };
  }

  // Get or create global chat
  async getGlobalChat(): Promise<{ chatId: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/chat/global`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error('Failed to get global chat');
    return response.json();
  }

  // List user's chats (DMs + rooms)
  async getChats(): Promise<{ chats: Chat[] }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error('Failed to get chats');
    return response.json();
  }

  // Start or get existing DM
  async startDM(targetUserId: string): Promise<{ chatId: string; isNew: boolean }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/dm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: targetUserId }),
    });
    if (!response.ok) throw new Error('Failed to start DM');
    return response.json();
  }

  // Get messages for a chat
  async getMessages(chatId: string, limit = 50, before?: string): Promise<{ messages: Message[] }> {
    const headers = await this.getAuthHeaders();
    let url = `${this.baseUrl}/chat/${chatId}/messages?limit=${limit}`;
    if (before) {
      url += `&before=${before}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error('Failed to get messages');
    return response.json();
  }

  // Post a message
  async postMessage(chatId: string, content: string, type = 'text', mediaUrl?: string, replyToId?: string): Promise<{ message: Message }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/chat/${chatId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, type, mediaUrl, replyToId }),
    });
    if (!response.ok) throw new Error('Failed to post message');
    return response.json();
  }

  // Mark chat as read (DM read receipts)
  async markRead(chatId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/chat/${chatId}/read`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) throw new Error('Failed to mark as read');
  }

  // Join a chat room
  async joinChat(chatId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/chat/${chatId}/join`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) throw new Error('Failed to join chat');
  }

  // Leave a chat room
  async leaveChat(chatId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/chat/${chatId}/leave`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) throw new Error('Failed to leave chat');
  }
}

export const chatService = new ChatService();
export default chatService;
