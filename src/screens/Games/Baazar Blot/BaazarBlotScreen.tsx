import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import { gameResultService } from '../../../services/gameResult.service';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  Animated,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { apiService } from '../../../services/api.service';
import { v4 as uuidv4 } from 'uuid';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../libs/hooks/useAuth';
import { useAchievements } from '../../../contexts/AchievementContext';
import { resolveAvatar } from '../../../utils/avatars';
import { SafeAreaView } from 'react-native-safe-area-context';
import Photosphere360Background from '../../../components/Photosphere360Background';
import {type AR3DOverlayHandle} from '../../../components/AR3DOverlay';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import { CardType, Suit } from '../../../components/Card';
import DynamicCard from '../../../components/DynamicCard';
import CardCustomizationModal from '../../../components/global/GameCustomizationModal';
import CardHandFan from '../../../components/CardHandFan';
import { RiffleDealAnimation } from '../../../components/RiffleDealAnimation';
import type { CardTheme } from '../../../components/global/GameCustomizationModal';
import {
  BaazarGameState,
  BidLevel,
  GameTarget,
  initializeBaazarGame,
  startNewRound,
  canPlayCard,
  determineTrickWinner,
  calculateBaazarRound,
  calculateRunningScore,
  detectBeloteTeam,
  chooseAICard,
  chooseAIBid,
  findSequences,
} from '../../../game/baazarBlotLogic';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';

const SUIT_ICON: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};
const SUIT_NAME: Record<string, string> = {
  hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs', spades: 'Spades',
};
const SUIT_COLOR: Record<string, string> = {
  hearts: '#e74c3c', diamonds: '#e74c3c', clubs: '#ecf0f1', spades: '#ecf0f1',
};

const TOTAL_PLAYERS = 4;
const { width: SW } = Dimensions.get('window');
const GAME_TYPE = 'baazar-blot';

const BaazarBlotScreen = ({ navigation }: any) => {
  const [gameState, setGameState] = useState<BaazarGameState | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [customTheme, setCustomTheme] = useState<CardTheme | undefined>(undefined);
  const [pendingBidLevel, setPendingBidLevel] = useState<BidLevel>(9);
  const [pendingBidSuit, setPendingBidSuit] = useState<Suit | null>(null);
  const [isResolvingTrick, setIsResolvingTrick] = useState(false);
  const [showDealAnimation, setShowDealAnimation] = useState(false);
  const pendingDealAnimRef = useRef(false);
  const resolutionInProgressRef = useRef(false);
  const resolutionStartTimeRef = useRef<number>(0);
  const dealtHandsRef = useRef<{ team: 1 | 2; hand: CardType[] }[]>([]);
  const prevPhaseRef = useRef<string | null>(null);
  const [entryDeducted, setEntryDeducted] = useState(false);
  const [prizeAwarded, setPrizeAwarded] = useState(false);
  const gameIdRef = useRef<string>(uuidv4());

  const { refreshOnGameEnd } = useGameEndRefresh(undefined, GAME_TYPE);

  // Load saved theme from storage on mount
  useEffect(() => {
    AsyncStorage.getItem('baazar_card_theme').then((stored) => {
      if (stored) {
        try { setCustomTheme(JSON.parse(stored)); } catch {}
      }
    });
  }, []);

  // Entry fee & prize logic
  // Deduct entry when game starts
  useEffect(() => {
    if (gameState && !entryDeducted) {
      handleGameStart();
    }
  }, [gameState, entryDeducted]);

  // Award prize when game ends
  useEffect(() => {
    if (gameState?.phase === 'gameEnd' && !prizeAwarded) {
      const winner = gameState.gameScore.team1 >= gameState.targetScore ? 1 : 2;
      const didWin = winner === 1; // Team 1 includes player 0 (you)
      handleGameEnd(didWin);
    }
  }, [gameState?.phase, prizeAwarded]);

  const handleSaveTheme = (theme: CardTheme) => {
    const urls = [theme.boardImage, theme.backgroundImage].filter(Boolean) as string[];
    if (urls.length > 0) {
      Promise.all(urls.map(url => Image.prefetch(url).catch(() => {})))
        .then(() => {
          setCustomTheme({...theme});
          AsyncStorage.setItem('baazar_card_theme', JSON.stringify(theme));
        });
    } else {
      setCustomTheme({...theme});
      AsyncStorage.setItem('baazar_card_theme', JSON.stringify(theme));
    }
  };

  const [showBackground, setShowBackground] = useState(true);
  const [showBlur, setShowBlur] = useState(true);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [arEnabled, setArEnabled] = useState(false);
  const arOverlayRef = useRef<AR3DOverlayHandle>(null);
  const [showPanel, setShowPanel] = useState(false);
  const panelAnim = useRef(new Animated.Value(0)).current;
  const toolbarExpanded = useSharedValue(false);
  const { user: currentUser, refreshUser } = useAuth();
  const { showAchievements } = useAchievements();

  // Entry fee deduction handler
  const handleGameStart = async () => {
    if (entryDeducted || !currentUser?.id) return;

    try {
      console.log('💰 Deducting baazar blot entry fee...');
      const result = await apiService.deductEntry(GAME_TYPE, gameIdRef.current);
      
      if (result.success) {
        console.log(`✅ Entry deducted: -50 points. Balance: ${result.newBalance}`);
        setEntryDeducted(true);
        refreshUser().catch(console.error);
      } else {
        console.error('❌ Insufficient points:', result.error);
        Alert.alert('Insufficient Points', result.error || 'You need 50 points to play baazar blot.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error: any) {
      console.error('❌ Entry deduction error:', error);
      Alert.alert('Error', 'Failed to deduct entry fee.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  };

  // Prize award handler
  const handleGameEnd = async (didWin: boolean) => {
    if (prizeAwarded || !currentUser?.id) return;

    try {
      const result = didWin ? 'win' : 'loss';
      console.log(`🏆 Awarding prize and logging game for ${result}...`);
      
      const prizeResult = await apiService.awardPrizeAndLog(
        GAME_TYPE,
        result,
        'ai',
        {
          gameId: gameIdRef.current,
          playerScore: didWin ? 1 : 0,
        }
      );
      
      if (prizeResult.success) {
        console.log(`✅ ${prizeResult.message}`);
        setPrizeAwarded(true);
        if (prizeResult.unlockedAchievements?.length > 0) {
          showAchievements(prizeResult.unlockedAchievements);
        }
        refreshUser().catch(console.error);
        
        if (didWin) {
          setTimeout(() => {
            Alert.alert('🏆 Victory!', `You won ${prizeResult.prize} points!\n\nNew balance: ${prizeResult.newBalance} points`);
          }, 2000);
        }
      }
    } catch (error: any) {
      console.error('❌ Prize award error:', error);
    }
  };
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const togglePanel = () => {
    const toValue = showPanel ? 0 : 1;
    setShowPanel(!showPanel);
    Animated.spring(panelAnim, {
      toValue,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Player positions (circular around table)
  const playerPositions = Array.from({ length: 4 }, (_, i) => {
    const centerX = screenWidth / 2;
    const centerY = screenHeight * 0.45;
    const radius = Math.min(screenWidth, screenHeight) * 0.25;
    const angle = (i / 4) * Math.PI * 2;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  // Relative offsets from deck center for RiffleDealAnimation
  const dealerCenterX = screenWidth / 2;
  const dealerCenterY = screenHeight / 2;
  const dealAnimPlayerPositions = [
    { x: 0, y: screenHeight * 0.28 },          // Player 0 – bottom (you)
    { x: screenWidth * 0.34, y: 0 },           // Player 1 – right
    { x: 0, y: -screenHeight * 0.28 },         // Player 2 – top (opponent)
    { x: -screenWidth * 0.34, y: 0 },          // Player 3 – left
  ];

  const startGame = useCallback((target: GameTarget) => {
    gameIdRef.current = uuidv4();
    setEntryDeducted(false);
    setPrizeAwarded(false);
    const gs = initializeBaazarGame(target);
    dealtHandsRef.current = gs.players.map(p => ({ team: p.team, hand: [...p.hand] }));
    setGameState(gs);
    setPendingBidLevel(9);
    setPendingBidSuit(null);
  }, []);





  // Trigger deal animation when entering bidding (cards were just dealt)
  useEffect(() => {
    if (gameState?.phase === 'bidding') {
      pendingDealAnimRef.current = true;
    }
    prevPhaseRef.current = gameState?.phase ?? null;
  }, [gameState?.phase]);

  const handleBiddingLayout = useCallback(() => {
    if (pendingDealAnimRef.current) {
      pendingDealAnimRef.current = false;
      setShowDealAnimation(true);
    }
  }, []);

  // Kept for layout measurement; no longer triggers deal animation
  const handlePlayingLayout = useCallback(() => {}, []);

  // AI bidding
  useEffect(() => {
    if (!gameState || gameState.phase !== 'bidding') return;
    if (gameState.currentPlayer === 0) return;

    const timer = setTimeout(() => {
      setGameState(prev => {
        if (!prev || prev.phase !== 'bidding' || prev.currentPlayer === 0) return prev;
        const player = prev.players[prev.currentPlayer];
        const result = chooseAIBid(player, prev.currentBid, prev.passedPlayers);

        if (result) {
          const nextPlayer = (prev.currentPlayer + 1) % TOTAL_PLAYERS;
          return {
            ...prev,
            currentBid: result.bid,
            bidderPlayer: prev.currentPlayer,
            bidderTeam: player.team,
            trump: result.suit,
            passedPlayers: [],
            currentPlayer: nextPlayer,
          };
        } else {
          const newPassed = [...prev.passedPlayers, prev.currentPlayer];
          const nextPlayer = (prev.currentPlayer + 1) % TOTAL_PLAYERS;

          if (prev.bidderPlayer === null && newPassed.length >= TOTAL_PLAYERS) {
            const gs = startNewRound(prev);
            dealtHandsRef.current = gs.players.map(p => ({ team: p.team, hand: [...p.hand] }));
            return gs;
          }

          if (prev.bidderPlayer !== null) {
            const nonBidderPassed = newPassed.filter(id => id !== prev.bidderPlayer);
            if (nonBidderPassed.length >= 3) {
              const beloteTeam = detectBeloteTeam(prev.players, prev.trump);
              return {
                ...prev,
                passedPlayers: newPassed,
                phase: 'playing',
                takerTeam: prev.bidderTeam,
                beloteTeam,
                currentPlayer: (prev.dealer + 1) % TOTAL_PLAYERS,
              };
            }
          }

          return { ...prev, passedPlayers: newPassed, currentPlayer: nextPlayer };
        }
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [gameState?.phase, gameState?.currentPlayer]);

  // AI playing
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;
    if (gameState.currentPlayer === 0) return;
    if (isResolvingTrick) return; // Don't play during trick resolution
    if (showDealAnimation) return; // Don't play during deal animation

    const timer = setTimeout(() => {
      setGameState(prev => {
        if (!prev || prev.phase !== 'playing' || prev.currentPlayer === 0) return prev;
        const player = prev.players[prev.currentPlayer];
        
        // Ensure player has valid cards
        if (!player.hand || player.hand.length === 0) return prev;
        
        const card = chooseAICard(player, prev.currentTrick, prev.trump, prev.players);
        
        // Ensure AI selected a valid card
        if (!card || !card.suit || !card.rank) return prev;
        
        return applyCardPlay(prev, prev.currentPlayer, card, dealtHandsRef.current);
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [gameState?.phase, gameState?.currentPlayer, gameState?.currentTrick, isResolvingTrick, showDealAnimation]);

  const applyCardPlay = (
    prev: BaazarGameState,
    playerId: number,
    card: CardType,
    originalHands: { team: 1 | 2; hand: CardType[] }[],
  ): BaazarGameState => {
    const newPlayers = prev.players.map(p => {
      // Clean up hand for all players to remove any undefined cards
      const cleanHand = p.hand.filter(c => c && c.suit && c.rank);
      
      if (p.id === playerId) {
        // Remove the played card from this player's hand
        return { 
          ...p, 
          hand: cleanHand.filter(c => !(c.suit === card.suit && c.rank === card.rank))
        };
      }
      
      return { ...p, hand: cleanHand };
    });
    const newTrick = {
      cards: [...prev.currentTrick.cards, { playerId, card }],
      winner: null as number | null,
    };

    // When 4th card is played, keep it visible but don't resolve yet
    // The useEffect will handle the delay and resolution
    if (newTrick.cards.length < TOTAL_PLAYERS) {
      return {
        ...prev,
        players: newPlayers,
        currentTrick: newTrick,
        currentPlayer: (playerId + 1) % TOTAL_PLAYERS,
      };
    }

    // 4th card played - show all cards but don't resolve yet
    return {
      ...prev,
      players: newPlayers,
      currentTrick: newTrick,
      currentPlayer: (playerId + 1) % TOTAL_PLAYERS, // Will be overwritten after delay
    };
  };

  // Resolve completed trick after delay
  const resolveTrick = useCallback((
    prev: BaazarGameState,
    originalHands: { team: 1 | 2; hand: CardType[] }[],
  ): BaazarGameState => {
    if (prev.currentTrick.cards.length < TOTAL_PLAYERS) return prev;

    const newTrick = prev.currentTrick;
    const leadSuit = newTrick.cards[0].card.suit;
    const winnerId = determineTrickWinner(newTrick, prev.trump, leadSuit);
    const completedTrick = { ...newTrick, winner: winnerId };
    const newCompleted = [...prev.completedTricks, completedTrick];
    const runningScore = calculateRunningScore(newCompleted, prev.players, prev.trump);

    if (newCompleted.length < 8) {
      return {
        ...prev,
        currentTrick: { cards: [], winner: null },
        completedTricks: newCompleted,
        lastTrickWinner: winnerId,
        currentPlayer: winnerId,
        scores: runningScore,
      };
    }

    const result = calculateBaazarRound(
      newCompleted, prev.players, prev.trump,
      prev.takerTeam, prev.currentBid,
      prev.contracted, prev.recontracted, prev.kapuyt,
      prev.beloteTeam, originalHands,
    );

    const newGameScore = {
      team1: prev.gameScore.team1 + result.team1,
      team2: prev.gameScore.team2 + result.team2,
    };

    const gameOver =
      newGameScore.team1 >= prev.targetScore ||
      newGameScore.team2 >= prev.targetScore;

    if (gameOver) {
      const winner = newGameScore.team1 >= prev.targetScore ? 1 : 2;
      gameResultService.recordGameResult({
        gameType: GAME_TYPE,
        result: winner === 1 ? 'win' : 'loss',
        score: newGameScore.team1,
        opponentScore: newGameScore.team2,
      } as any).catch(() => {});
      refreshOnGameEnd?.();
    }

    return {
      ...prev,
      currentTrick: { cards: [], winner: null },
      completedTricks: newCompleted,
      lastTrickWinner: winnerId,
      currentPlayer: winnerId,
      scores: runningScore,
      gameScore: newGameScore,
      phase: gameOver ? 'gameEnd' : 'roundEnd',
      roundMessage: result.message,
    };
  }, [refreshOnGameEnd]);

  // Auto-resolve trick after 2-second delay when 4 cards are played
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;
    
    // Safety check: if we're truly stuck (4 cards on board for more than 5 seconds), force reset
    if (resolutionInProgressRef.current && gameState.currentTrick.cards.length === TOTAL_PLAYERS) {
      const elapsed = Date.now() - resolutionStartTimeRef.current;
      if (elapsed > 5000) {
        console.warn('Resolution stuck, forcing trick resolution');
        // Force the resolution to happen immediately
        setGameState(prev => {
          if (!prev || prev.phase !== 'playing') return prev;
          return resolveTrick(prev, dealtHandsRef.current);
        });
        setTimeout(() => {
          setIsResolvingTrick(false);
          resolutionInProgressRef.current = false;
        }, 500);
        return;
      }
    }
    
    if (gameState.currentTrick.cards.length !== TOTAL_PLAYERS) return;
    
    // Prevent multiple simultaneous resolutions
    if (resolutionInProgressRef.current) return;
    
    // Mark as resolving to prevent AI from playing immediately
    resolutionInProgressRef.current = true;
    resolutionStartTimeRef.current = Date.now();
    setIsResolvingTrick(true);

    const resolveTimer = setTimeout(() => {
      setGameState(prev => {
        if (!prev || prev.phase !== 'playing') return prev;
        if (prev.currentTrick.cards.length !== TOTAL_PLAYERS) return prev;
        return resolveTrick(prev, dealtHandsRef.current);
      });
      
      // Allow next trick to start after a brief pause to show empty board
      setTimeout(() => {
        setIsResolvingTrick(false);
        resolutionInProgressRef.current = false;
      }, 500);
    }, 2000); // 2 second delay

    return () => {
      clearTimeout(resolveTimer);
      // Don't reset state here - let the timer complete naturally
    };
  }, [gameState?.currentTrick.cards.length, gameState?.phase, resolveTrick]);

  const handleBid = useCallback(() => {
    if (!pendingBidSuit) return;
    setGameState(prev => {
      if (!prev || prev.phase !== 'bidding' || prev.currentPlayer !== 0) return prev;
      if (pendingBidLevel <= prev.currentBid) return prev;
      return {
        ...prev,
        currentBid: pendingBidLevel,
        bidderPlayer: 0,
        bidderTeam: prev.players[0].team,
        trump: pendingBidSuit,
        passedPlayers: [],
        currentPlayer: 1,
      };
    });
    setPendingBidSuit(null);
  }, [pendingBidLevel, pendingBidSuit]);

  const handlePass = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.phase !== 'bidding' || prev.currentPlayer !== 0) return prev;
      const newPassed = [...prev.passedPlayers, 0];
      const nextPlayer = 1;

      if (prev.bidderPlayer === null && newPassed.length >= TOTAL_PLAYERS) {
        const gs = startNewRound(prev);
        dealtHandsRef.current = gs.players.map(p => ({ team: p.team, hand: [...p.hand] }));
        return gs;
      }

      if (prev.bidderPlayer !== null) {
        const nonBidderPassed = newPassed.filter(id => id !== prev.bidderPlayer);
        if (nonBidderPassed.length >= 3) {
          const beloteTeam = detectBeloteTeam(prev.players, prev.trump);
          return {
            ...prev,
            passedPlayers: newPassed,
            phase: 'playing',
            takerTeam: prev.bidderTeam,
            beloteTeam,
            currentPlayer: (prev.dealer + 1) % TOTAL_PLAYERS,
          };
        }
      }

      return { ...prev, passedPlayers: newPassed, currentPlayer: nextPlayer };
    });
  }, []);

  const handleContra = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.phase !== 'bidding') return prev;
      if (prev.bidderTeam === prev.players[0].team || prev.contracted) return prev;
      const beloteTeam = detectBeloteTeam(prev.players, prev.trump);
      return {
        ...prev,
        contracted: true,
        phase: 'playing',
        takerTeam: prev.bidderTeam,
        beloteTeam,
        currentPlayer: (prev.dealer + 1) % TOTAL_PLAYERS,
      };
    });
  }, []);

  const handleRecontra = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.phase !== 'bidding' || !prev.contracted) return prev;
      if (prev.bidderTeam !== prev.players[0].team) return prev;
      const beloteTeam = detectBeloteTeam(prev.players, prev.trump);
      return {
        ...prev,
        recontracted: true,
        phase: 'playing',
        takerTeam: prev.bidderTeam,
        beloteTeam,
        currentPlayer: (prev.dealer + 1) % TOTAL_PLAYERS,
      };
    });
  }, []);

  const handleKapuyt = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.phase !== 'bidding') return prev;
      const beloteTeam = detectBeloteTeam(prev.players, prev.trump);
      return {
        ...prev,
        kapuyt: true,
        bidderPlayer: 0,
        bidderTeam: prev.players[0].team,
        takerTeam: prev.players[0].team,
        beloteTeam,
        phase: 'playing',
        currentPlayer: (prev.dealer + 1) % TOTAL_PLAYERS,
      };
    });
  }, []);

  const handlePlayCard = useCallback((card: CardType) => {
    // Don't allow playing during trick resolution
    if (isResolvingTrick) return;
    
    setGameState(prev => {
      if (!prev || prev.phase !== 'playing' || prev.currentPlayer !== 0) return prev;
      const player = prev.players[0];
      if (!canPlayCard(card, player.hand, prev.currentTrick, prev.trump)) return prev;
      return applyCardPlay(prev, 0, card, dealtHandsRef.current);
    });
  }, [isResolvingTrick]);

  const handleNewRound = useCallback(() => {
    setGameState(prev => {
      if (!prev) return prev;
      const gs = startNewRound(prev);
      dealtHandsRef.current = gs.players.map(p => ({ team: p.team, hand: [...p.hand] }));
      return gs;
    });
    setPendingBidLevel(9);
    setPendingBidSuit(null);
  }, []);

  const handleNewGame = useCallback(() => setGameState(null), []);

  const suitColor = (s: Suit | null) => (s ? SUIT_COLOR[s] : '#fff');
  const playerName = (id: number) => gameState?.players[id]?.name ?? `P${id}`;
  const trickCardForPlayer = (pid: number) =>
    gameState?.currentTrick.cards.find(c => c.playerId === pid)?.card ?? null;

  // ── Setup ────────────────────────────────────────────────────────────────
  const renderSetup = () => (
    <View style={styles.centeredSection}>
      <Text style={styles.bigTitle}>🃏 Bazaar Blot</Text>
      <Text style={styles.subtitle}>Choose target score</Text>
      <View style={styles.targetButtons}>
        {([101, 201, 301] as GameTarget[]).map(t => (
          <TouchableOpacity key={t} style={styles.targetBtn} onPress={() => startGame(t)}>
            <Text style={styles.targetBtnText}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ── Bidding ──────────────────────────────────────────────────────────────
  const renderBidding = () => {
    if (!gameState) return null;
    const isMyTurn = gameState.currentPlayer === 0;
    const hasBid = gameState.bidderPlayer !== null;
    const minBid: BidLevel = hasBid
      ? (Math.min(gameState.currentBid + 1, 16) as BidLevel)
      : 8;
    const isBidderSameTeam = gameState.bidderTeam === gameState.players[0].team;
    const canContra = hasBid && !gameState.contracted && !isBidderSameTeam;
    const canRecontra = gameState.contracted && isBidderSameTeam;

    return (
      <View style={styles.centeredSection} onLayout={handleBiddingLayout}>
        <Text style={styles.sectionTitle}>🃏 Bazaar Blot</Text>

        {hasBid ? (
          <View style={styles.bidStatusRow}>
            <Text style={styles.bidStatusText}>{playerName(gameState.bidderPlayer!)} bid </Text>
            <Text style={[styles.bidStatusValue, { color: suitColor(gameState.trump) }]}>
              {gameState.currentBid} {gameState.trump ? SUIT_ICON[gameState.trump] : ''}
            </Text>
            {gameState.contracted && <Text style={styles.contraBadge}> CONTRA</Text>}
          </View>
        ) : (
          <Text style={styles.bidStatusText}>No bids yet</Text>
        )}

        {isMyTurn ? (
          <>
            <Text style={styles.yourTurnLabel}>Your turn to bid</Text>

            <View style={styles.bidLevelRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setPendingBidLevel(l => Math.max(minBid, l - 1) as BidLevel)}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.bidLevelValue}>{pendingBidLevel}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setPendingBidLevel(l => Math.min(16, l + 1) as BidLevel)}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.suitRow}>
              {(['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]).map(s => (
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
                style={[
                  styles.bidActionBtn,
                  styles.bidBtnGreen,
                  (!pendingBidSuit || pendingBidLevel <= gameState.currentBid) &&
                    styles.bidBtnDisabled,
                ]}
                onPress={handleBid}
                disabled={!pendingBidSuit || pendingBidLevel <= gameState.currentBid}>
                <Text style={styles.bidActionBtnText}>Bid {pendingBidLevel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bidActionBtn, styles.bidBtnRed]}
                onPress={handlePass}>
                <Text style={styles.bidActionBtnText}>Pass</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.specialBidRow}>
              {canContra && (
                <TouchableOpacity
                  style={[styles.specialBtn, styles.specialContra]}
                  onPress={handleContra}>
                  <Text style={styles.specialBtnText}>Contra</Text>
                </TouchableOpacity>
              )}
              {canRecontra && (
                <TouchableOpacity
                  style={[styles.specialBtn, styles.specialRecontra]}
                  onPress={handleRecontra}>
                  <Text style={styles.specialBtnText}>Rekurenti</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.specialBtn, styles.specialKapuyt]}
                onPress={handleKapuyt}>
                <Text style={styles.specialBtnText}>Kapuyt</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.waitingText}>
            Waiting for {playerName(gameState.currentPlayer)}…
          </Text>
        )}

        <View style={styles.scoreBoard}>
          <View style={styles.teamScore}>
            <Text style={styles.teamLabel}>Team 1</Text>
            <Text style={styles.score}>{gameState.gameScore.team1}</Text>
          </View>
          {gameState.trump && (
            <View style={styles.trumpDisplay}>
              <Text style={styles.trumpLabel}>Trump</Text>
              <Text style={styles.trumpSuit}>
                {SUIT_ICON[gameState.trump]}
              </Text>
            </View>
          )}
          <View style={styles.teamScore}>
            <Text style={styles.teamLabel}>Team 2</Text>
            <Text style={styles.score}>{gameState.gameScore.team2}</Text>
          </View>
        </View>
        <Text style={styles.targetText}>Target: {gameState.targetScore}</Text>
      </View>
    );
  };

  // ── Playing ──────────────────────────────────────────────────────────────
  const renderPlaying = () => {
    if (!gameState) return null;
    const myPlayer = gameState.players[0];
    const { trump } = gameState;
    const { width, height } = Dimensions.get('window');
    const TABLE_SIZE = Math.min(width - 32, height * 0.5);

    return (
      <>
        <View style={styles.playArea} onLayout={handlePlayingLayout}>
          <Text style={styles.currentPlayerText}>
            {gameState.currentPlayer === 0
              ? '★ Your Turn (Team 1)'
              : `${playerName(gameState.currentPlayer)}'s Turn (Team ${
                  gameState.players[gameState.currentPlayer].team
                })`}
          </Text>

          <View
            style={[
              styles.tableContainer,
              { width: TABLE_SIZE, height: TABLE_SIZE },
            ]}
          >
            {showBackground ? (
              <ImageBackground
                source={customTheme?.boardImage ? { uri: customTheme.boardImage } : require('../../../../assets/blot/card-table.png')}
                style={styles.cardTable}
                imageStyle={{ borderRadius: 16 }}
              >
                <View style={styles.trickArea}>
                  <View style={[styles.cardPlaceholder, styles.trickSlotTop]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotBottom]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotLeft]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotRight]} />
                </View>
                {gameState.currentTrick.cards.length > 0 && (() => {
                  const ledSuit = gameState.currentTrick.cards[0].card.suit;
                  const positionStyle: Record<number, object> = {
                    0: styles.trickSlotBottom, 1: styles.trickSlotRight,
                    2: styles.trickSlotTop, 3: styles.trickSlotLeft,
                  };
                  return (
                    <View style={styles.trickArea}>
                      <View style={styles.ledSuitBadge}>
                        <Text style={[styles.ledSuitIcon, { color: SUIT_COLOR[ledSuit] }]}>{SUIT_ICON[ledSuit]}</Text>
                        <Text style={styles.ledSuitLabel}>Led: {SUIT_NAME[ledSuit]}</Text>
                      </View>
                      {gameState.currentTrick.cards
                        .filter(cardPlay => cardPlay && cardPlay.card && cardPlay.card.suit)
                        .map((cardPlay, idx) => (
                        <View key={idx} style={[styles.trickSlot, positionStyle[cardPlay.playerId] ?? styles.trickSlotTop]}>
                          <DynamicCard card={cardPlay.card} theme={customTheme} size="small" />
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </ImageBackground>
            ) : (
              <View style={styles.cardTable}>
                <View style={styles.trickArea}>
                  <View style={[styles.cardPlaceholder, styles.trickSlotTop]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotBottom]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotLeft]} />
                  <View style={[styles.cardPlaceholder, styles.trickSlotRight]} />
                </View>
                {gameState.currentTrick.cards.length > 0 && (() => {
                  const ledSuit = gameState.currentTrick.cards[0].card.suit;
                  const positionStyle: Record<number, object> = {
                    0: styles.trickSlotBottom, 1: styles.trickSlotRight,
                    2: styles.trickSlotTop, 3: styles.trickSlotLeft,
                  };
                  return (
                    <View style={styles.trickArea}>
                      <View style={styles.ledSuitBadge}>
                        <Text style={[styles.ledSuitIcon, { color: SUIT_COLOR[ledSuit] }]}>{SUIT_ICON[ledSuit]}</Text>
                        <Text style={styles.ledSuitLabel}>Led: {SUIT_NAME[ledSuit]}</Text>
                      </View>
                      {gameState.currentTrick.cards
                        .filter(cardPlay => cardPlay && cardPlay.card && cardPlay.card.suit)
                        .map((cardPlay, idx) => (
                        <View key={idx} style={[styles.trickSlot, positionStyle[cardPlay.playerId] ?? styles.trickSlotTop]}>
                          <DynamicCard card={cardPlay.card} theme={customTheme} size="small" />
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            )}
          </View>
        </View>

        <View style={styles.handContainer}>
          <Text style={styles.handLabel}>Your Hand:</Text>
          <CardHandFan
            cards={myPlayer.hand.filter(c => c && c.suit && c.rank)}
            renderCard={(card, idx) => {
              const legal = canPlayCard(
                card,
                myPlayer.hand,
                gameState.currentTrick,
                trump,
              );
              const isMyTurn = gameState.currentPlayer === 0 && !isResolvingTrick;
              const canPlay = legal && isMyTurn;
              return (
                <TouchableOpacity
                  key={`${card.suit}-${card.rank}-${idx}`}
                  onPress={() => canPlay && handlePlayCard(card)}
                  style={[
                    styles.cardWrapper,
                    !canPlay ? styles.cardDimmed : styles.cardLegal,
                  ]}
                  disabled={!canPlay}
                >
                  <DynamicCard card={card} theme={customTheme} size="medium" />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </>
    );
  };

  // ── Round End ────────────────────────────────────────────────────────────
  const renderRoundEnd = () => {
    if (!gameState) return null;
    const t1Seqs = findSequences(
      dealtHandsRef.current.filter(h => h.team === 1).flatMap(h => h.hand),
      1,
    );
    const t2Seqs = findSequences(
      dealtHandsRef.current.filter(h => h.team === 2).flatMap(h => h.hand),
      2,
    );
    const seqLabel = (seqs: ReturnType<typeof findSequences>) =>
      seqs.length === 0
        ? 'none'
        : seqs
            .map(s => {
              const name =
                s.length >= 5 ? 'Quint' : s.length === 4 ? 'Quart' : 'Terz';
              return `${name}(${s.highRank}${SUIT_ICON[s.suit]}) +${s.points}`;
            })
            .join(', ');

    return (
      <View style={styles.centeredSection}>
        <Text style={styles.bigTitle}>Round Over</Text>
        <Text style={styles.roundMsg}>{gameState.roundMessage}</Text>

        <View style={styles.scoreTable}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Team 1 (round):</Text>
            <Text style={styles.scoreValue}>{gameState.scores.team1}</Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Team 2 (round):</Text>
            <Text style={styles.scoreValue}>{gameState.scores.team2}</Text>
          </View>
          <View style={[styles.scoreRow, styles.scoreRowTotal]}>
            <Text style={styles.scoreLabel}>Game total:</Text>
            <Text style={styles.scoreValue}>
              T1 {gameState.gameScore.team1} — T2 {gameState.gameScore.team2}
            </Text>
          </View>
        </View>

        {(t1Seqs.length > 0 || t2Seqs.length > 0) && (
          <View style={styles.seqBox}>
            <Text style={styles.seqTitle}>Sequences</Text>
            <Text style={styles.seqText}>Team 1: {seqLabel(t1Seqs)}</Text>
            <Text style={styles.seqText}>Team 2: {seqLabel(t2Seqs)}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.primaryBtn} onPress={handleNewRound}>
          <Text style={styles.primaryBtnText}>Next Round</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Game End ─────────────────────────────────────────────────────────────
  const renderGameEnd = () => {
    if (!gameState) return null;
    const winner = gameState.gameScore.team1 > gameState.gameScore.team2 ? 1 : 2;
    const isWin = winner === 1;
    return (
      <View style={styles.centeredSection}>
        <Text style={styles.bigTitle}>{isWin ? '🏆 You Win!' : '😔 You Lose'}</Text>
        <Text style={styles.gameEndWinner}>{isWin ? 'Team 1 wins!' : 'Team 2 wins!'}</Text>
        <Text style={styles.gameEndScore}>
          {gameState.gameScore.team1} — {gameState.gameScore.team2}
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleNewGame}>
          <Text style={styles.primaryBtnText}>New Game</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    if (!gameState) return renderSetup();
    switch (gameState.phase) {
      case 'bidding':  return renderBidding();
      case 'playing':  return renderPlaying();
      case 'roundEnd': return renderRoundEnd();
      case 'gameEnd':  return renderGameEnd();
      default:         return renderSetup();
    }
  };

  return (
    <View style={styles.bg}>
      <Photosphere360Background overlayOpacity={showBlur ? 0.65 : 0.3} arEnabled={arEnabled} arOverlayRef={arOverlayRef} />
      <SafeAreaView style={styles.safe}>
        <View>
          <GameToolbar
            title="Bazaar Blot"
            onBack={() => navigation.goBack()}
            backgroundColor="transparent"
            rightElement={
              <TouchableOpacity
                onPress={() => { toolbarExpanded.value = !toolbarExpanded.value; }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.editRoomButton}
              >
                <ReAnimated.Text style={[styles.editRoomIcon, chevronStyle]}>⌄</ReAnimated.Text>
              </TouchableOpacity>
            }
          />
          <ExpandableView isExpanded={toolbarExpanded} viewKey="baazarToolbarControls" duration={300}>
            <GameToolbarControls
              buttons={[
                { icon: '🎨', onPress: () => setShowCustomization(true) },
                { icon: showBlur ? '🌫️' : '✨', onPress: () => setShowBlur(!showBlur) },
                { icon: showBackground ? '🖼️' : '🔲', onPress: () => setShowBackground(!showBackground) },
                { icon: arEnabled ? '🥽' : '🎮', onPress: () => setArEnabled(!arEnabled) },
                { icon: showMusicPlayer ? '🎵' : '🎶', onPress: () => setShowMusicPlayer(s => !s) },
                { icon: '👥', onPress: togglePanel },
              ]}
            />
          </ExpandableView>
        </View>

        {gameState && (
          <View style={styles.scoreBoard}>
            <View style={styles.teamScore}>
              <Text style={styles.teamLabel}>Team 1</Text>
              <Text style={styles.score}>{gameState.gameScore.team1 || 0}</Text>
              {gameState.phase === 'playing' && (
                <Text style={styles.roundScore}>
                  {gameState.scores?.team1 || 0} this round
                </Text>
              )}
            </View>
            {gameState.trump && (
              <View style={styles.trumpDisplay}>
                <Text style={styles.trumpLabel}>Trump</Text>
                <Text style={styles.trumpSuit}>{SUIT_ICON[gameState.trump]}</Text>
              </View>
            )}
            <View style={styles.teamScore}>
              <Text style={styles.teamLabel}>Team 2</Text>
              <Text style={styles.score}>{gameState.gameScore.team2 || 0}</Text>
              {gameState.phase === 'playing' && (
                <Text style={styles.roundScore}>
                  {gameState.scores?.team2 || 0} this round
                </Text>
              )}
            </View>
          </View>
        )}
        
        <View style={styles.body}>{renderContent()}</View>
      </SafeAreaView>

      <RiffleDealAnimation
        visible={showDealAnimation}
        playerPositions={dealAnimPlayerPositions}
        dealerPosition={{ x: dealerCenterX, y: dealerCenterY }}
        cardsPerPlayer={8}
        theme={customTheme as any}
        onComplete={() => setShowDealAnimation(false)}
      />

      <CardCustomizationModal
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onSave={handleSaveTheme}
        currentTheme={customTheme}
      />

      {/* Players side panel */}
      {showPanel && (
        <TouchableOpacity
          style={styles.panelBackdrop}
          activeOpacity={1}
          onPress={togglePanel}
        />
      )}
      <Animated.View
        style={[
          styles.sidePanel,
          {
            transform: [
              {
                translateX: panelAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [280, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={showPanel ? 'auto' : 'none'}
      >
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Players</Text>
          <TouchableOpacity onPress={togglePanel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.panelClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.panelContent}>
          <Text style={styles.panelSectionTitle}>🎮 In Game</Text>
          {gameState?.players.map((player, idx) => {
            const isCurrentTurn = gameState.currentPlayer === idx;
            const isYou = idx === 0;
            const avatarSource = isYou ? resolveAvatar(currentUser?.avatar_url ?? null) : null;
            const initials = player.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
            const teamColor = player.team === 1 ? '#4caf50' : '#e91e63';
            return (
              <View key={idx} style={[styles.panelPlayerRow, isCurrentTurn && styles.panelPlayerRowActive]}>
                <View style={styles.panelAvatarClip}>
                  {avatarSource ? (
                    <Image source={avatarSource} style={styles.panelAvatar} resizeMode="contain" />
                  ) : (
                    <View style={styles.panelAvatarPlaceholder}>
                      <Text style={styles.panelAvatarInitials}>{initials}</Text>
                    </View>
                  )}
                  {isCurrentTurn && <View style={styles.panelTurnDot} />}
                </View>
                <View style={styles.panelPlayerInfo}>
                  <Text style={styles.panelPlayerName}>
                    {isYou ? (currentUser?.username ?? 'You') : player.name}
                    {isYou ? ' (You)' : ' (AI)'}
                  </Text>
                  <View style={[styles.panelTeamBadge, { backgroundColor: teamColor + '33', borderColor: teamColor }]}>
                    <Text style={[styles.panelTeamText, { color: teamColor }]}>Team {player.team}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
      <SyncedYouTubePlayer roomId={null} visible={showMusicPlayer} />
      {arEnabled && (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={() => arOverlayRef.current?.recenter()}
          hitSlop={{top:12,bottom:12,left:12,right:12}}
          activeOpacity={0.7}>
          <Text style={styles.recenterIcon}>⊕</Text>
          <Text style={styles.recenterLabel}>Re-center</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },
  body: { flex: 1 },
  centeredSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  bigTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 16,
  },
  targetButtons: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  targetBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  targetBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
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
  contraBadge: { color: '#FF6B35', fontSize: 14, fontWeight: 'bold', marginLeft: 6 },
  yourTurnLabel: { color: '#FFD700', fontSize: 16, fontWeight: '700', marginBottom: 14 },
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
  specialBidRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  specialBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, borderWidth: 2 },
  specialContra: { backgroundColor: 'rgba(180,40,40,0.5)', borderColor: '#FF6B35' },
  specialRecontra: { backgroundColor: 'rgba(40,40,180,0.5)', borderColor: '#64B5F6' },
  specialKapuyt: { backgroundColor: 'rgba(100,0,100,0.5)', borderColor: '#CE93D8' },
  specialBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  waitingText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 20,
  },
  scoreBoard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'transparent',
    marginVertical: 12,
  },
  teamScore: {
    flex: 1,
    alignItems: 'center',
  },
  teamLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  score: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  roundScore: {
    fontSize: 12,
    color: '#90EE90',
  },
  trumpDisplay: {
    flex: 1,
    maxWidth: 70,
    maxHeight: 98,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 92, 63, 0.9)',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  trumpLabel: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 4,
  },
  trumpSuit: {
    fontSize: 32,
  },
  bidInfo: {
    fontSize: 10,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  targetText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 8,
  },
  playArea: {
    flex: 2,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  cardTable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPlayerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  trickArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledSuitBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  ledSuitIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  ledSuitLabel: {
    fontSize: 11,
    color: '#ccc',
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  cardPlaceholder: {
    position: 'absolute',
    width: 90,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  trickSlot: {
    position: 'absolute',
    alignItems: 'center',
  },
  trickSlotTop: {
    top: 25,
    left: '50%',
    marginLeft: -45,
    alignItems: 'center',
  },
  trickSlotBottom: {
    bottom: 25,
    left: '50%',
    marginLeft: -45,
    alignItems: 'center',
  },
  trickSlotLeft: {
    left: 35,
    top: '50%',
    marginTop: -60,
    transform: [{ rotate: '90deg' }],
  },
  trickSlotRight: {
    right: 35,
    top: '50%',
    marginTop: -60,
    transform: [{ rotate: '90deg' }],
  },
  handContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  handLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  cardWrapper: { borderRadius: 6 },
  cardLegal: { opacity: 1, transform: [{ translateY: -4 }] },
  cardDimmed: { opacity: 0.45 },
  roundMsg: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: SW - 48,
  },
  scoreTable: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  scoreRowTotal: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  scoreLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
  scoreValue: { color: '#FFD700', fontSize: 15, fontWeight: '700' },
  seqBox: {
    backgroundColor: 'rgba(0,50,100,0.4)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(100,180,255,0.3)',
  },
  seqTitle: { color: '#64B5F6', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  seqText: { color: '#fff', fontSize: 13, marginBottom: 2 },
  gameEndWinner: { fontSize: 26, fontWeight: 'bold', color: '#90EE90', marginBottom: 10 },
  gameEndScore: { fontSize: 20, color: '#fff', marginBottom: 32 },
  primaryBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 17, fontWeight: 'bold', color: '#0A3622' },
  editRoomButton: { padding: 6, borderRadius: 8 },
  editRoomIcon: { fontSize: 22, color: '#FFD700' },
  toolbarControls: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 3,
    flexWrap: 'wrap',
    alignSelf: 'flex-end',
  },
  panelBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sidePanel: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: 270,
    backgroundColor: 'rgba(12,12,30,0.97)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 20,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  panelTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  panelClose: { fontSize: 18, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  panelContent: { padding: 16 },
  panelSectionTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  panelPlayerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  panelPlayerRowActive: { backgroundColor: 'rgba(255,215,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  panelAvatarClip: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: '#1e1e40', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  panelAvatar: { width: 50, height: 50 },
  panelAvatarPlaceholder: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a2a55' },
  panelAvatarInitials: { color: '#fff', fontSize: 16, fontWeight: '700' },
  panelTurnDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFD700', borderWidth: 2, borderColor: 'rgba(12,12,30,0.97)' },
  panelPlayerInfo: { flex: 1, gap: 5 },
  panelPlayerName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  panelTeamBadge: { alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  panelTeamText: { fontSize: 11, fontWeight: '700' },
  recenterBtn: { position:'absolute', bottom:90, alignSelf:'center', left:'50%', transform:[{translateX:-54}], flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(0,0,0,0.35)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)', borderRadius:24, paddingHorizontal:18, paddingVertical:10 },
  recenterIcon: { fontSize:20, color:'#fff' },
  recenterLabel: { fontSize:13, color:'#fff', fontWeight:'600', letterSpacing:0.3 },
});

export default BaazarBlotScreen;
