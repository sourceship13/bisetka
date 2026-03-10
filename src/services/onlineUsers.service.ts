import tokenService from './token.service';
import { apiConfig } from '../libs/utils/api.utils';

export interface OnlineUser {
  id: string;
  username: string;
  avatar_url?: string;
  last_seen: string;
  is_online: boolean;
}

export interface OnlineUsersResponse {
  users: OnlineUser[];
  count: number;
}

class OnlineUsersService {
  /**
   * Get list of currently online users
   */
  async getOnlineUsers(limit: number = 50): Promise<OnlineUsersResponse> {
    const token = await tokenService.getAccessToken();
    
    const response = await fetch(`${apiConfig.apiURL}/users/online?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch online users: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get count of online users
   */
  async getOnlineUserCount(): Promise<number> {
    const token = await tokenService.getAccessToken();
    
    const response = await fetch(`${apiConfig.apiURL}/users/online/count`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch online user count: ${response.statusText}`);
    }

    const data = await response.json();
    return data.count;
  }

  /**
   * Update current user's presence (heartbeat)
   */
  async updatePresence(): Promise<void> {
    const token = await tokenService.getAccessToken();
    
    const response = await fetch(`${apiConfig.apiURL}/users/presence`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to update presence: ${response.statusText}`);
    }
  }

  /**
   * Get specific user's presence
   */
  async getUserPresence(userId: string): Promise<{ is_online: boolean; last_seen: string }> {
    const token = await tokenService.getAccessToken();
    
    const response = await fetch(`${apiConfig.apiURL}/users/presence/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user presence: ${response.statusText}`);
    }

    return response.json();
  }
}

export default new OnlineUsersService();
