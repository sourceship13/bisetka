import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { BisetkaAlert } from '../utils/BisetkaAlert';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { socketService } from '../services/SocketService';
import tokenService from '../services/token.service';
import DynamicCard from '../components/DynamicCard';
import { CardType } from '../components/Card';
import InGameChat from '../components/InGameChat';
import GameToolbar from '../components/GameToolbar';
import CardCustomizationModal from '../components/CardCustomizationModal';
import CardHandFan from '../components/CardHandFan';
import type { CardTheme } from '../components/CardCustomizationModal';

const { width: SW } = Dimensions.get('window');

const SUIT_ICON: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};
const SUIT_NAME: Record<string, string> = {
  hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs', spades: 'Spades',
};
const SUIT_COLOR: Record<string, string> = {
  hearts: '#e74c3c', diamonds: '#e74c3c', clubs: '#ecf0f1', spades: '#ecf0f1',
};

interface GamePlayer {
  id: string;
  socketId: string;
  ready: boolean;
  isAI: boolean;
  team: 1 | 2;
  position: number;
}

interface BaazarGameState {
  phase: 'bidding' | 'playing' | 'scoring';
  currentPlayer: number;
  dealer: number;
  trump: string | null;
  playerHands: CardType[][];
  currentBid: number;
  bidderPlayer: number | null;
  bidderTeam: 1 | 2 | null;
  passedPlayers: number[];
  currentTrick: { playerPosition: number; card: CardType }[];
  completedTricks: any[];
  scores: { team1: number; team2: number };
  gameScore: { team1: number; team2: number };
  targetScore: number;
  lastRoundResult?: {
    team1Raw: number; team2Raw: number;
    team1Final: number; team2Final: number;
    bid: number; biddingTeam: number; madeBid: boolean;
  } | null;
}

const MultiplayerBaazarBlotScreen = ({ navigation, route }: any) => {
  const userId = route.params?.userId || 'test-user-' + Math.random().toString(36).substr(2, 9);
  const teamMode: 'hybrid' | 'full-multiplayer' = route.params?.teamMode ?? 'hybrid';
  
  const [gameMode, setGameMode] = useState<'menu' | 'matchmaking' | 'game'>('menu');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [myPosition, setMyPosition] = useState<number>(-1);
  const [myTeam, setMyTeam] = useState<1 | 2>(1);
  const [gameState, setGameState] = useState<BaazarGameState | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [pendingBidLevel, setPendingBidLevel] = useState<number>(9);
  const [pendingBidSuit, setPendingBidSuit] = useState<string>('hearts'); // pre-select hearts so Make Bid is always ready
  const [showCustomization, setShowCustomization] = useState(false);
  const [customTheme, setCustomTheme] = useState<CardTheme | undefined>(undefined);

  // Ensure socket is connected before operations
  const ensureSocketConnected = async (): Promise<boolean> => {
    try {
      if (!socketService.isConnected()) {
        console.log('🔌 Socket not connected, connecting now...');
        const token = await tokenService.getAccessToken();
        if (!token) {
          console.error('❌ No token available for authentication');
          return false;
        }

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
          
          socketService.connect(userId, token);
          
          socketService.getSocket()?.once('authenticated', () => {
            clearTimeout(timeout);
            console.log('✅ Socket authenticated');
            resolve();
          });

          socketService.getSocket()?.once('connect_error', (error) => {
            clearTimeout(timeout);
            console.error('❌ Socket connection error:', error);
            reject(error);
          });
        });
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to ensure socket connection:', error);
      return false;
    }
  };

  useEffect(() => {
    const setupSocketListeners = async () => {
      const connected = await ensureSocketConnected();
      if (!connected) {
        BisetkaAlert.error('Connection Error', 'Failed to connect to multiplayer server');
        return;
      }

      const socket = socketService.getSocket();
      if (!socket) return;

      // Baazar Blot matchmaking events
      socket.on('baazar_match_found', (data: { 
        roomId: string; 
        players: GamePlayer[]; 
        myPosition: number;
        myTeam: 1 | 2;
      }) => {
        console.log('🎲 Baazar match found:', data);
        setRoomId(data.roomId);
        setPlayers(data.players);
        setMyPosition(data.myPosition);
        setMyTeam(data.myTeam);
        setGameMode('game');
        setIsConnecting(false);

        // Automatically mark player as ready
        socket.emit('baazar_player_ready', {
          roomId: data.roomId,
          userId
        });
      });

      socket.on('baazar_game_started', (data: { 
        roomId?: string;
        players: GamePlayer[]; 
        gameState: BaazarGameState 
      }) => {
        console.log('🚀 Baazar game started:', data);
        setGameState(data.gameState);
        setPlayers(data.players);
        setGameMode('game');
        setIsConnecting(false);

        // Set roomId if we missed baazar_match_found
        if (data.roomId) {
          setRoomId(prev => prev || data.roomId!);
        }

        // If myPosition wasn't set (missed baazar_match_found), derive it from userId
        setMyPosition(prev => {
          if (prev >= 0) return prev; // already set
          const me = data.players.find(p => p.id === userId);
          return me ? me.position : 0;
        });
        setMyTeam(prev => {
          if (prev) return prev;
          const me = data.players.find(p => p.id === userId);
          return me ? me.team : 1;
        });
      });

      socket.on('baazar_bid_made', (data: { 
        playerPosition: number;
        bid: { level: number; suit: string } | null;
        pass: boolean;
        gameState: BaazarGameState;
        currentPlayer: number;
      }) => {
        console.log('💰 Bid made:', data);
        // Merge data.currentPlayer into gameState — gameState.currentPlayer is
        // initialized to 0 and only room.currentPlayer is updated server-side.
        setGameState(prev => ({ ...data.gameState, currentPlayer: data.currentPlayer }));
        // Clamp bid level to at least currentBid+1 for the next turn
        setPendingBidLevel(prev => Math.max(prev, (data.gameState.currentBid || 8) + 1));
      });

      socket.on('baazar_card_played', (data: { 
        playerPosition: number;
        card: CardType;
        gameState: BaazarGameState;
        currentPlayer: number;
      }) => {
        console.log('🃏 Card played:', data);
        setGameState({ ...data.gameState, currentPlayer: data.currentPlayer });
        setSelectedCard(null);
      });

      socket.on('baazar_game_ended', (data: { 
        winningTeam: 1 | 2;
        finalScore: { team1: number; team2: number };
      }) => {
        console.log('🎮 Game ended:', data);
        BisetkaAlert.alert(
          'Game Over!',
          `Team ${data.winningTeam} wins!\nFinal Score:\nTeam 1: ${data.finalScore.team1}\nTeam 2: ${data.finalScore.team2}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      });

      socket.on('error', (error: { message: string }) => {
        console.error('❌ Socket error:', error);
        BisetkaAlert.error('Error', error.message);
      });
    };

    setupSocketListeners();

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('baazar_match_found');
        socket.off('baazar_game_started');
        socket.off('baazar_bid_made');
        socket.off('baazar_card_played');
        socket.off('baazar_game_ended');
        socket.off('error');
      }
    };
  }, [userId, navigation]);

  const handleFindMatch = async () => {
    const connected = await ensureSocketConnected();
    if (!connected) {
      BisetkaAlert.error('Connection Error', 'Failed to connect to server');
      return;
    }

    setIsConnecting(true);
    setGameMode('matchmaking');

    const socket = socketService.getSocket();
    if (socket) {
      if (teamMode === 'full-multiplayer') {
        socket.emit('find_baazar_teams_match', { userId });
        console.log('🔍 Joined Baazar Blot 2v2 (all-human) matchmaking queue');
      } else {
        // hybrid: 1 human + AI partners per side
        socket.emit('find_baazar_match', { userId });
        console.log('🔍 Joined Baazar Blot hybrid (1+AI vs 1+AI) matchmaking queue');
      }
    }
  };

  const handleCancelMatchmaking = () => {
    const socket = socketService.getSocket();
    if (socket) {
      if (teamMode === 'full-multiplayer') {
        socket.emit('cancel_baazar_teams_match', { userId });
      } else {
        socket.emit('cancel_baazar_match', { userId });
      }
      console.log('❌ Cancelled matchmaking');
    }
    setIsConnecting(false);
    setGameMode('menu');
  };

  const handleMakeBid = () => {
    if (!roomId || !gameState) return;
    const suit = pendingBidSuit || 'hearts';
    const minLevel = (gameState.currentBid || 8) + 1;
    const level = Math.max(pendingBidLevel, minLevel);

    const socket = socketService.getSocket();
    if (socket) {
      console.log(`💰 Sending bid: level=${level} suit=${suit} roomId=${roomId} userId=${userId}`);
      socket.emit('baazar_make_bid', {
        roomId,
        userId,
        bid: { level, suit }
      });
    }
  };

  const handlePass = () => {
    if (!roomId || !gameState) return;

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('baazar_make_bid', {
        roomId,
        userId,
        pass: true
      });
    }
  };

  const handlePlayCard = (card: CardType) => {
    if (!roomId || !gameState || gameState.currentPlayer !== myPosition) return;

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('baazar_play_card', {
        roomId,
        userId,
        card
      });
    }
  };

  const renderMenu = () => (
    <ImageBackground
      source={require('../../assets/blot/park-background.png')}
      style={styles.bg}
      resizeMode="cover">
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,40,0,0.72)']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <GameToolbar
          title="Bazaar Blot"
          onBack={() => navigation.goBack()}
          backgroundColor="transparent"
        />
        <View style={styles.menuBody}>
          <Text style={styles.bigTitle}>🃏 Bazaar Blot</Text>
          <Text style={styles.subtitle}>Multiplayer – 4 Player Team Game</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>👥 You + Teammate vs 2 Opponents</Text>
            <Text style={styles.infoText}>🤖 AI players fill empty spots</Text>
            <Text style={styles.infoText}>🎯 First to 301 points wins!</Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleFindMatch}>
            <Text style={styles.primaryBtnText}>Find Match</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );

  const renderMatchmaking = () => (
    <ImageBackground
      source={require('../../assets/blot/park-background.png')}
      style={styles.bg}
      resizeMode="cover">
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,40,0,0.72)']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <GameToolbar
          title="Bazaar Blot"
          onBack={handleCancelMatchmaking}
          backgroundColor="transparent"
        />
        <View style={styles.menuBody}>
          <Text style={styles.bigTitle}>🔍 Finding Match…</Text>

          <ActivityIndicator size="large" color="#FFD700" style={{ marginVertical: 40 }} />

          <Text style={styles.statusText}>Looking for players…</Text>
          <Text style={styles.infoText}>Minimum 2 real players required</Text>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelMatchmaking}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );

  const renderBiddingPhase = () => {
    const isMyTurn = gameState?.currentPlayer === myPosition;
    const iHavePassed = gameState?.passedPlayers?.includes(myPosition) ?? false;
    const myHand = gameState?.playerHands[myPosition] || [];
    const currentPlayerInfo = players.find(p => p.position === gameState?.currentPlayer);
    const currentPlayerLabel = currentPlayerInfo
      ? (currentPlayerInfo.isAI ? `CPU (T${currentPlayerInfo.team})` : `P${currentPlayerInfo.position} (T${currentPlayerInfo.team})`)
      : `Player ${gameState?.currentPlayer}`;
    const currentBid = gameState?.currentBid || 0;
    const hasBid = gameState?.bidderPlayer !== null && gameState?.bidderPlayer !== undefined;
    const minBid = hasBid ? Math.min(currentBid + 1, 16) : 8;
    const displayLevel = Math.max(pendingBidLevel, minBid);

    return (
      <View style={styles.centeredSection}>
        <Text style={styles.sectionTitle}>🃏 Bazaar Blot</Text>

        {hasBid ? (
          <View style={styles.bidStatusRow}>
            <Text style={styles.bidStatusText}>
              T{gameState?.bidderTeam} bid{' '}
            </Text>
            <Text style={[styles.bidStatusValue, { color: gameState?.trump ? SUIT_COLOR[gameState.trump] : '#fff' }]}>
              {currentBid} {gameState?.trump ? SUIT_ICON[gameState.trump] : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.bidStatusText}>No bids yet</Text>
        )}

        {gameState?.lastRoundResult && (
          <View style={styles.lastRoundRow}>
            <Text style={styles.lastRoundLabel}>Last round</Text>
            <Text style={styles.lastRoundDetail}>
              T1: {gameState.lastRoundResult.team1Raw}→{gameState.lastRoundResult.team1Final}{'  '}
              T2: {gameState.lastRoundResult.team2Raw}→{gameState.lastRoundResult.team2Final}{'  '}
              (Bid {gameState.lastRoundResult.bid} T{gameState.lastRoundResult.biddingTeam}{' '}
              {gameState.lastRoundResult.madeBid ? '✅' : '❌'})
            </Text>
          </View>
        )}

        {iHavePassed ? (
          <View style={styles.waitingBox}>
            <Text style={[styles.waitingText, { color: '#ff6b6b' }]}>You passed ✗</Text>
            <ActivityIndicator size="small" color="#555" style={{ marginTop: 6 }} />
            <Text style={styles.waitingText}>Waiting for {currentPlayerLabel}…</Text>
          </View>
        ) : isMyTurn ? (
          <>
            <Text style={styles.yourTurnLabel}>Your turn to bid</Text>

            <View style={styles.bidLevelRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setPendingBidLevel(l => Math.max(minBid, l - 1))}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.bidLevelValue}>{displayLevel}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setPendingBidLevel(l => Math.min(16, l + 1))}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.suitRow}>
              {(['hearts', 'diamonds', 'clubs', 'spades'] as const).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.suitChip, pendingBidSuit === s && styles.suitChipSelected]}
                  onPress={() => setPendingBidSuit(s)}>
                  <Text style={[styles.suitChipIcon, { color: SUIT_COLOR[s] }]}>
                    {SUIT_ICON[s]}
                  </Text>
                  <Text style={styles.suitChipLabel}>{SUIT_NAME[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.bidActionRow}>
              <TouchableOpacity
                style={[styles.bidActionBtn, styles.bidBtnGreen, displayLevel <= currentBid && styles.bidBtnDisabled]}
                onPress={handleMakeBid}
                disabled={displayLevel <= currentBid}>
                <Text style={styles.bidActionBtnText}>Bid {displayLevel} {SUIT_ICON[pendingBidSuit || 'hearts']}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bidActionBtn, styles.bidBtnRed]}
                onPress={handlePass}>
                <Text style={styles.bidActionBtnText}>Pass</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.waitingText}>
            Waiting for {currentPlayerLabel}…
          </Text>
        )}

        <View style={styles.handSection}>
          {myHand.length > 0 && (
            <>
              <Text style={styles.handLabel}>Your Hand</Text>
              <CardHandFan
                cards={myHand}
                maxWidth={SW - 32}
                renderCard={(card, idx) => (
                  <DynamicCard
                    key={`${card.suit}-${card.rank}-${idx}`}
                    card={card}
                    theme={customTheme}
                    size="medium"
                  />
                )}
              />
            </>
          )}
        </View>

        <View style={styles.scoreReminder}>
          <Text style={styles.scoreReminderText}>
            T1: {gameState?.gameScore.team1}{'  |  '}T2: {gameState?.gameScore.team2}
            {'  |  '}Target: {gameState?.targetScore}
          </Text>
        </View>
      </View>
    );
  };

  const computeCurrentRoundPoints = () => {
    if (!gameState) return { team1: 0, team2: 0 };
    const rankPts: Record<string, number> = { '7':0,'8':0,'9':0,'J':2,'Q':3,'K':4,'10':10,'A':11 };
    const trumpPts: Record<string, number> = { '7':0,'8':0,'9':14,'J':20,'Q':3,'K':4,'10':10,'A':11 };
    let t1 = 0, t2 = 0;
    for (const trick of (gameState.completedTricks || [])) {
      for (const play of trick) {
        const pts = play.card.suit === gameState.trump
          ? trumpPts[play.card.rank] ?? 0
          : rankPts[play.card.rank] ?? 0;
        const pl = players.find(p => p.position === play.playerPosition);
        if (pl?.team === 1) t1 += pts; else t2 += pts;
      }
    }
    return { team1: t1, team2: t2 };
  };

  const trickCardForPlayer = (pos: number): CardType | null =>
    (gameState?.currentTrick ?? []).find(c => c.playerPosition === pos)?.card ?? null;

  const playerLabelForPos = (pos: number): string => {
    const info = players.find(p => p.position === pos);
    if (!info) return `P${pos}`;
    return info.isAI ? `CPU (T${info.team})` : `P${pos} (T${info.team})`;
  };

  const renderPlayingPhase = () => {
    const isMyTurn = gameState?.currentPlayer === myPosition;
    const myHand = gameState?.playerHands[myPosition] || [];
    const currentPlayerInfo = players.find(p => p.position === gameState?.currentPlayer);
    const currentPlayerLabel = currentPlayerInfo
      ? (currentPlayerInfo.isAI ? `CPU (T${currentPlayerInfo.team})` : `P${currentPlayerInfo.position} (T${currentPlayerInfo.team})`)
      : `Player ${gameState?.currentPlayer}`;

    const topPos   = (myPosition + 2) % 4;
    const rightPos = (myPosition + 1) % 4;
    const leftPos  = (myPosition + 3) % 4;
    const trump = gameState?.trump;

    const rp = computeCurrentRoundPoints();
    const biddingTeam = gameState?.bidderTeam;
    const bid = gameState?.currentBid ?? 0;
    const biddingTeamPoints = biddingTeam === 1 ? rp.team1 : rp.team2;
    const onTrack = biddingTeamPoints >= bid;

    return (
      <View style={styles.playingLayout}>
        {/* Score bar */}
        <View style={styles.scoreBar}>
          <Text style={styles.scoreBarText}>
            {'🔵 T1: '}
            {(gameState?.gameScore.team1 ?? 0) + rp.team1}
            {'   🔴 T2: '}
            {(gameState?.gameScore.team2 ?? 0) + rp.team2}
            {'   🎯 '}
            {gameState?.targetScore}
          </Text>
          {trump && (
            <View style={styles.trumpBadge}>
              <Text style={styles.trumpBadgeText}>
                {'Trump: '}
                <Text style={{ color: SUIT_COLOR[trump] }}>{SUIT_ICON[trump]}</Text>
                {'  Bid: '}
                {gameState?.currentBid}
                {gameState?.lastRoundResult && !gameState?.lastRoundResult.madeBid ? ' ❌' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Whose turn */}
        <View style={[styles.turnIndicator, { backgroundColor: isMyTurn ? 'rgba(46,125,50,0.6)' : 'rgba(26,26,58,0.6)' }]}>
          {isMyTurn
            ? <Text style={styles.yourTurnLabel}>⭐ Your turn – tap a card to play</Text>
            : <Text style={styles.waitingText}>⏳ Waiting for {currentPlayerLabel}…</Text>
          }
        </View>

        {/* Card table */}
        <View style={styles.tableWrapper}>
          <ImageBackground
            source={require('../../assets/blot/card-table.png')}
            style={styles.tableImage}
            imageStyle={styles.tableImageStyle}>
            <View style={styles.trickArea}>
              <View style={[styles.trickSlot, styles.trickSlotTop]}>
                <Text style={styles.trickPlayerName}>{playerLabelForPos(topPos)}</Text>
                {trickCardForPlayer(topPos) && (
                  <DynamicCard card={trickCardForPlayer(topPos)!} theme={customTheme} size="small" />
                )}
              </View>
              <View style={[styles.trickSlot, styles.trickSlotLeft]}>
                <Text style={styles.trickPlayerName}>{playerLabelForPos(leftPos)}</Text>
                {trickCardForPlayer(leftPos) && (
                  <DynamicCard card={trickCardForPlayer(leftPos)!} theme={customTheme} size="small" />
                )}
              </View>
              <View style={[styles.trickSlot, styles.trickSlotRight]}>
                <Text style={styles.trickPlayerName}>{playerLabelForPos(rightPos)}</Text>
                {trickCardForPlayer(rightPos) && (
                  <DynamicCard card={trickCardForPlayer(rightPos)!} theme={customTheme} size="small" />
                )}
              </View>
              <View style={[styles.trickSlot, styles.trickSlotBottom]}>
                {trickCardForPlayer(myPosition) && (
                  <DynamicCard card={trickCardForPlayer(myPosition)!} theme={customTheme} size="small" />
                )}
                <Text style={styles.trickPlayerName}>You (T{myTeam})</Text>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Player's hand */}
        <View style={styles.handSection}>
          {isMyTurn ? (
            <Text style={styles.handLabel}>Your turn ↓</Text>
          ) : (
            <Text style={styles.handLabelWait}>Waiting…</Text>
          )}
          <CardHandFan
            cards={myHand}
            maxWidth={SW - 32}
            renderCard={(card, idx) => {
              return (
                <TouchableOpacity
                  key={`${card.suit}-${card.rank}-${idx}`}
                  onPress={() => {
                    if (isMyTurn) {
                      setSelectedCard(card);
                      handlePlayCard(card);
                    }
                  }}
                  style={[
                    styles.cardWrapper,
                    !isMyTurn ? styles.cardDimmed : styles.cardLegal,
                    selectedCard === card && styles.selectedCard,
                  ]}>
                  <DynamicCard card={card} theme={customTheme} size="medium" />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    );
  };

  const renderGame = () => {
    if (!gameState) {
      return (
        <ImageBackground
          source={require('../../assets/blot/park-background.png')}
          style={styles.bg}
          resizeMode="cover">
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'rgba(0,40,0,0.72)']}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={styles.safe}>
            <GameToolbar
              title="Bazaar Blot"
              onBack={() => navigation.goBack()}
              backgroundColor="transparent"
              rightElement={
                <TouchableOpacity onPress={() => setShowCustomization(true)}>
                  <Text style={{ color: '#FFD700', fontSize: 13, fontWeight: '700' }}>🎨 Cards</Text>
                </TouchableOpacity>
              }
            />
            <View style={styles.centeredSection}>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.waitingText}>Waiting for game to start…</Text>
            </View>
          </SafeAreaView>
        </ImageBackground>
      );
    }

    return (
      <ImageBackground
        source={require('../../assets/blot/park-background.png')}
        style={styles.bg}
        resizeMode="cover">
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,40,0,0.72)']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe}>
          <GameToolbar
            title="Bazaar Blot"
            onBack={() => navigation.goBack()}
            backgroundColor="transparent"
            rightElement={
              <TouchableOpacity onPress={() => setShowCustomization(true)}>
                <Text style={{ color: '#FFD700', fontSize: 13, fontWeight: '700' }}>🎨 Cards</Text>
              </TouchableOpacity>
            }
          />

          {/* Players strip */}
          <View style={styles.playersStrip}>
            {players.filter(p => p != null).map((player, idx) => {
              const hasPassed = gameState.passedPlayers?.includes(player.position);
              return (
                <View
                  key={idx}
                  style={[
                    styles.playerChip,
                    player.position === myPosition && styles.playerChipMe,
                    gameState.currentPlayer === player.position && styles.playerChipActive,
                    hasPassed && { opacity: 0.4 }
                  ]}>
                  <Text style={[styles.playerChipText, { color: player.isAI ? '#ff9500' : '#fff' }]}>
                    {player.isAI ? '🤖' : '👤'} {player.isAI ? 'CPU' : 'P' + player.position} (T{player.team}){hasPassed ? ' ✗' : ''}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.body}>
            {gameState.phase === 'bidding' && renderBiddingPhase()}
            {gameState.phase === 'playing' && renderPlayingPhase()}
          </View>

          {/* In-game chat overlay */}
          <InGameChat
            roomId={roomId || ''}
            currentUserId={userId}
            gameType="baazar-blot"
            visible={!!(roomId)}
          />
        </SafeAreaView>
      </ImageBackground>
    );
  };

  if (gameMode === 'menu') return (
    <>
      {renderMenu()}
      <CardCustomizationModal
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onSave={(theme: CardTheme) => setCustomTheme(theme)}
        currentTheme={customTheme}
      />
    </>
  );
  if (gameMode === 'matchmaking') return renderMatchmaking();
  if (gameMode === 'game') return (
    <>
      {renderGame()}
      <CardCustomizationModal
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onSave={(theme: CardTheme) => setCustomTheme(theme)}
        currentTheme={customTheme}
      />
    </>
  );

  return null;
};

const styles = StyleSheet.create({
  // ── Root layout ────────────────────────────────────────────────────────
  bg: { flex: 1 },
  safe: { flex: 1 },
  body: { flex: 1 },

  // ── Menu / matchmaking ─────────────────────────────────────────────────
  menuBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bigTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 24,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 20,
    marginBottom: 32,
    width: '100%',
  },
  infoText: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 14,
    alignItems: 'center',
    minWidth: 200,
  },
  primaryBtnText: { fontSize: 17, fontWeight: 'bold', color: '#0A3622' },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 40,
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
    minWidth: 200,
  },
  secondaryBtnText: { color: '#FFD700', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusText: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },

  // ── Players strip ──────────────────────────────────────────────────────
  playersStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 6,
  },
  playerChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  playerChipMe: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderColor: '#FFD700',
  },
  playerChipActive: {
    borderColor: '#4caf50',
    borderWidth: 2,
  },
  playerChipText: { fontSize: 12, fontWeight: '600' },

  // ── Bidding phase ──────────────────────────────────────────────────────
  centeredSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 16,
  },
  bidStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  bidStatusText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bidStatusValue: { fontSize: 20, fontWeight: 'bold' },
  yourTurnLabel: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
  },
  bidLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  stepBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#fff', fontSize: 26, fontWeight: '700', lineHeight: 30 },
  bidLevelValue: {
    color: '#FFD700',
    fontSize: 36,
    fontWeight: 'bold',
    minWidth: 48,
    textAlign: 'center',
  },
  suitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  suitChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 70,
  },
  suitChipSelected: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.18)',
  },
  suitChipIcon: { fontSize: 26 },
  suitChipLabel: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 2 },
  bidActionRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  bidActionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
  },
  bidBtnGreen: { backgroundColor: '#2e7d32', borderColor: '#4caf50' },
  bidBtnRed: { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  bidBtnDisabled: { opacity: 0.4 },
  bidActionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  waitingBox: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  waitingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  lastRoundRow: {
    marginTop: 6,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 6,
    width: '100%',
  },
  lastRoundLabel: {
    color: '#888',
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  lastRoundDetail: {
    color: '#ccc',
    fontSize: 11,
    textAlign: 'center',
  },
  handSection: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 12,
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  handLabel: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  handLabelWait: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  scoreReminder: { alignItems: 'center', marginTop: 12 },
  scoreReminderText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

  // ── Playing phase ──────────────────────────────────────────────────────
  playingLayout: { flex: 1, maxHeight: 620 },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scoreBarText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  trumpBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trumpBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  turnIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  tableWrapper: { flex: 1, marginHorizontal: 8, marginVertical: 4 },
  tableImage: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  tableImageStyle: { borderRadius: 16 },
  trickArea: { flex: 1, position: 'relative' },
  trickSlot: { position: 'absolute', alignItems: 'center' },
  trickSlotTop: { top: 10, left: 0, right: 0, alignItems: 'center' },
  trickSlotBottom: { bottom: 10, left: 0, right: 0, alignItems: 'center' },
  trickSlotLeft: { left: 10, top: '35%' },
  trickSlotRight: { right: 10, top: '35%' },
  trickPlayerName: { color: '#fff', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  cardWrapper: { borderRadius: 6 },
  cardLegal: { opacity: 1, transform: [{ translateY: -4 }] },
  cardDimmed: { opacity: 0.45 },
  selectedCard: { transform: [{ translateY: -10 }] },
});

export default MultiplayerBaazarBlotScreen;
