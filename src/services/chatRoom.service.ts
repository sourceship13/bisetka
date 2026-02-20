import apiConfig from '../libs/utils/api.utils';
import tokenService from './token.service';

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  creator_username: string;
  share_code: string;
  is_private: boolean;
  max_members: number;
  member_count: number;
  online_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatRoomMember {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  last_seen: string;
  is_online: boolean;
  is_typing: boolean;
  message_count: number;
}

export interface ChatRoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  message: string;
  message_type: 'text' | 'system' | 'image' | 'file';
  metadata?: any;
  is_edited: boolean;
  edited_at?: string;
  created_at: string;
}

class ChatRoomService {
  private async getAuthToken(): Promise<string | null> {
    return await tokenService.getAccessToken();
  }

  private async getHeaders() {
    const token = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async createRoom(name: string, description?: string, isPrivate: boolean = false): Promise<{ room: ChatRoom }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/create`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ name, description, isPrivate }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create room');
    }

    return response.json();
  }

  async getAllRooms(): Promise<{ rooms: ChatRoom[] }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/all`, {
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch rooms');
    }

    return response.json();
  }

  async getMyRooms(): Promise<{ rooms: ChatRoom[] }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/my-rooms`, {
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch my rooms');
    }

    return response.json();
  }

  async getRoomById(roomId: string): Promise<{ room: ChatRoom }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/${roomId}`, {
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch room');
    }

    return response.json();
  }

  async joinRoomByCode(shareCode: string): Promise<{ room: ChatRoom; membership: any }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/join-by-code`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ shareCode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to join room');
    }

    return response.json();
  }

  async joinRoom(roomId: string): Promise<{ membership: any }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/${roomId}/join`, {
      method: 'POST',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to join room');
    }

    return response.json();
  }

  async leaveRoom(roomId: string): Promise<{ message: string }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/${roomId}/leave`, {
      method: 'POST',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to leave room');
    }

    return response.json();
  }

  async getRoomMembers(roomId: string): Promise<{ members: ChatRoomMember[] }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/${roomId}/members`, {
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch members');
    }

    return response.json();
  }

  async getMessages(roomId: string, limit: number = 50): Promise<{ messages: ChatRoomMessage[] }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/${roomId}/messages?limit=${limit}`, {
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }

    return response.json();
  }

  async sendMessage(roomId: string, message: string): Promise<{ message: ChatRoomMessage }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/${roomId}/messages`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  }

  async deleteRoom(roomId: string): Promise<{ message: string }> {
    const response = await fetch(`${apiConfig.apiURL}/chat-rooms/${roomId}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete room');
    }

    return response.json();
  }
}

export default new ChatRoomService();
