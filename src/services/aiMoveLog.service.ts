/**
 * AI Move Logging Service
 * Frontend service for logging AI moves to the backend
 */

import apiConfig from '../libs/utils/api.utils';
import tokenService from './token.service';

// ============================================
// TYPES
// ============================================

export interface ChessAIMoveData {
  gameId: string;
  moveNumber: number;
  playerMove: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    piece: string;
    captured?: string;
  };
  aiMove: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    piece: string;
    captured?: string;
  };
  boardStateBefore?: any;
  boardStateAfter?: any;
  difficulty?: string;
  aiThinkTimeMs?: number;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isCastling?: boolean;
  isEnPassant?: boolean;
  isPromotion?: boolean;
  promotionPiece?: string;
}

export interface CheckersAIMoveData {
  gameId: string;
  moveNumber: number;
  playerMove: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    isJump?: boolean;
    captured?: Array<{ row: number; col: number }>;
  };
  aiMove: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    isJump?: boolean;
    captured?: Array<{ row: number; col: number }>;
  };
  boardStateBefore?: any;
  boardStateAfter?: any;
  difficulty?: string;
  playerPiecesRemaining?: number;
  aiPiecesRemaining?: number;
  wasKingMove?: boolean;
  wasMultiJump?: boolean;
}

export interface BlotAIMoveData {
  gameId: string;
  trickNumber: number;
  playerCard: {
    suit: string;
    rank: string;
    value: number;
  };
  aiCard: {
    suit: string;
    rank: string;
    value: number;
  };
  trickWinner?: 'player' | 'computer';
  trickPoints?: number;
  trumpSuit?: string;
  playerHandBefore?: any;
  aiHandBefore?: any;
  playerScoreAfter?: number;
  aiScoreAfter?: number;
  difficulty?: string;
}

export interface MrotsiAIMoveData {
  gameId: string;
  roundNumber: number;
  playerDice: number[];
  playerScore: number;
  aiDice: number[];
  aiScore: number;
  roundWinner?: 'player' | 'opponent' | 'tie';
  playerTotalScore?: number;
  aiTotalScore?: number;
  difficulty?: string;
}

export interface PokerAIMoveData {
  gameId: string;
  handNumber: number;
  gamePhase: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  playerAction: 'fold' | 'check' | 'call' | 'raise' | 'all_in';
  playerBetAmount?: number;
  aiActions: Array<{
    playerId: number;
    action: string;
    amount?: number;
  }>;
  communityCards?: any[];
  potSize?: number;
  playerChips?: number;
  playerCards?: any[];
  difficulty?: string;
}

export interface BilliardsAIMoveData {
  gameId: string;
  shotNumber: number;
  shooter: 'player' | 'ai';
  cuePosition?: { x: number; y: number };
  shotAngle?: number;
  shotPower?: number;
  targetBallNumber?: number;
  targetPocket?: string;
  ballsPocketed?: Array<{ number: number; type: string }>;
  wasScratch?: boolean;
  wasFoul?: boolean;
  foulReason?: string;
  turnContinues?: boolean;
  ballPositionsAfter?: any;
  gameVariant?: '8-ball' | '9-ball';
  difficulty?: string;
  playerType?: string;
  aiType?: string;
}

// ============================================
// SERVICE CLASS
// ============================================

class AIMoveLogService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${apiConfig.apiURL}/ai-moves`;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await tokenService.getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // ==========================================
  // CHESS
  // ==========================================
  async logChessMove(data: ChessAIMoveData): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/chess`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.warn('Failed to log chess AI move:', await response.text());
      }
    } catch (error) {
      console.warn('Error logging chess AI move:', error);
      // Don't throw - logging should not interrupt gameplay
    }
  }

  async getChessMoves(gameId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/chess/${gameId}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        return result.moves || [];
      }
      return [];
    } catch (error) {
      console.warn('Error fetching chess AI moves:', error);
      return [];
    }
  }

  // ==========================================
  // CHECKERS
  // ==========================================
  async logCheckersMove(data: CheckersAIMoveData): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/checkers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.warn('Failed to log checkers AI move:', await response.text());
      }
    } catch (error) {
      console.warn('Error logging checkers AI move:', error);
    }
  }

  async getCheckersMoves(gameId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/checkers/${gameId}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        return result.moves || [];
      }
      return [];
    } catch (error) {
      console.warn('Error fetching checkers AI moves:', error);
      return [];
    }
  }

  // ==========================================
  // BLOT
  // ==========================================
  async logBlotMove(data: BlotAIMoveData): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/blot`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.warn('Failed to log blot AI move:', await response.text());
      }
    } catch (error) {
      console.warn('Error logging blot AI move:', error);
    }
  }

  async getBlotMoves(gameId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/blot/${gameId}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        return result.moves || [];
      }
      return [];
    } catch (error) {
      console.warn('Error fetching blot AI moves:', error);
      return [];
    }
  }

  // ==========================================
  // MROTSI
  // ==========================================
  async logMrotsiMove(data: MrotsiAIMoveData): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/mrotsi`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.warn('Failed to log mrotsi AI move:', await response.text());
      }
    } catch (error) {
      console.warn('Error logging mrotsi AI move:', error);
    }
  }

  async getMrotsiMoves(gameId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/mrotsi/${gameId}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        return result.moves || [];
      }
      return [];
    } catch (error) {
      console.warn('Error fetching mrotsi AI moves:', error);
      return [];
    }
  }

  // ==========================================
  // POKER
  // ==========================================
  async logPokerMove(data: PokerAIMoveData): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/poker`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.warn('Failed to log poker AI move:', await response.text());
      }
    } catch (error) {
      console.warn('Error logging poker AI move:', error);
    }
  }

  async getPokerMoves(gameId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/poker/${gameId}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        return result.moves || [];
      }
      return [];
    } catch (error) {
      console.warn('Error fetching poker AI moves:', error);
      return [];
    }
  }

  // ==========================================
  // BILLIARDS
  // ==========================================
  async logBilliardsMove(data: BilliardsAIMoveData): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/billiards`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.warn('Failed to log billiards AI move:', await response.text());
      }
    } catch (error) {
      console.warn('Error logging billiards AI move:', error);
    }
  }

  async getBilliardsMoves(gameId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/billiards/${gameId}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        return result.moves || [];
      }
      return [];
    } catch (error) {
      console.warn('Error fetching billiards AI moves:', error);
      return [];
    }
  }

  // ==========================================
  // PLAYER STATS
  // ==========================================
  async getPlayerStats(gameType: 'chess' | 'checkers' | 'blot' | 'mrotsi' | 'poker' | 'billiards'): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/stats/${gameType}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        return result.stats;
      }
      return null;
    } catch (error) {
      console.warn('Error fetching player stats:', error);
      return null;
    }
  }
}

export const aiMoveLogService = new AIMoveLogService();
