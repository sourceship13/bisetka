import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import { gameResultService } from '../../../services/gameResult.service';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  Dimensions,
  Animated,
  ScrollView,
  PanResponder,
  Alert,
} from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../libs/hooks/useAuth';
import { resolveAvatar } from '../../../utils/avatars';
import { getCardImage, getCardBackImage } from '../../../data/cardsNew';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import AraratBackground from '../../../components/AraratBackground';
import AR3DOverlay, {type AR3DOverlayHandle, type ARCard} from '../../../components/AR3DOverlay';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import GamePlayerOverlay from '../../../components/GamePlayerOverlay';
import { CardType, Suit } from '../../../components/Card';
import RiffleDealAnimation from '../../../components/RiffleDealAnimation';
import CardCustomizationModal from '../../../components/global/GameCustomizationModal';
import CardHandFan from '../../../components/CardHandFan';
import type { CardTheme } from '../../../components/global/GameCustomizationModal';
import {
  GameState,
  initializeGame,
  canPlayCard,
  determineTrickWinner,
  calculateRoundScore,
  calculateRunningScore,
  detectBeloteTeam,
  chooseAICard,
  chooseAIBid,
  dealCards,
  sortHandForDisplay,
} from '../../../game/blotLogic';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';
import InGameChat from '../../../components/InGameChat';
import { playCardFlipSound } from '../../../utils/nardiSound';
import apiService from '../../../services/api.service';
import { v4 as uuidv4 } from 'uuid';

const SUIT_ICON: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};
const SUIT_NAME: Record<string, string> = {
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
  spades: 'Spades',
};
const SUIT_COLOR: Record<string, string> = {
  hearts: '#e74c3c',
  diamonds: '#e74c3c',
  clubs: '#1a1a1a',
  spades: '#1a1a1a',
};

const BlotScreen = ({ navigation }: any) => {
  const [targetScore, setTargetScore] = useState<number | null>(null); // 101, 201, or 301
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [showRiffleDealAnimation, setShowRiffleDealAnimation] = useState(false);
  const [showBiddingModal, setShowBiddingModal] = useState(false);
  const isRoundTransitioningRef = useRef(false);
  const prevPhaseRef = useRef<string | null>(null);
  const boardReadyRef = useRef(false);
  const [customTheme, setCustomTheme] = useState<CardTheme | undefined>(
    undefined,
  );

  // Handle score selection and start game (defined later, after deductBlotEntry is in scope)

  // Trigger initial deal animation only after the game board is laid out
  const handleBoardLayout = useCallback(() => {
    if (!boardReadyRef.current && gameState) {
      boardReadyRef.current = true;
      isRoundTransitioningRef.current = true;
      setShowRiffleDealAnimation(true);
    }
  }, [gameState]);

  // Track phase transitions (deal animation handled by mount effect and redeal logic)
  useEffect(() => {
    if (!gameState) return;
    prevPhaseRef.current = gameState.phase;
  }, [gameState?.phase]);

  // Load saved theme from storage on mount
  useEffect(() => {
    AsyncStorage.getItem('blot_card_theme').then((stored) => {
      if (stored) {
        try { setCustomTheme(JSON.parse(stored)); } catch {}
      }
    });
  }, []);

  const handleSaveTheme = (theme: CardTheme) => {
    // Prefetch remote images before applying theme to avoid UI freeze
    const urls = [theme.boardImage, theme.backgroundImage].filter(Boolean) as string[];
    if (urls.length > 0) {
      Promise.all(urls.map(url => Image.prefetch(url).catch(() => {})))
        .then(() => {
          setCustomTheme({...theme});
          AsyncStorage.setItem('blot_card_theme', JSON.stringify(theme));
        });
    } else {
      setCustomTheme({...theme});
      AsyncStorage.setItem('blot_card_theme', JSON.stringify(theme));
    }
  };


  const [arCards, setArCards] = useState<ARCard[]>([]);
  const [showBlur, setShowBlur] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [arEnabled, setArEnabled] = useState(true);
  const arOverlayRef = useRef<AR3DOverlayHandle>(null);
  const _pinchZoom = useRef(1.0);
  const _pinchBase = useRef(1.0);
  const _pinchStartDist = useRef(0);
  const pinchResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => gs.numberActiveTouches === 2,
      onMoveShouldSetPanResponder: (_, gs) => gs.numberActiveTouches === 2,
      onPanResponderGrant: (e) => {
        const [t0, t1] = e.nativeEvent.touches as any[];
        if (!t0 || !t1) return;
        const dx = t1.pageX - t0.pageX;
        const dy = t1.pageY - t0.pageY;
        _pinchStartDist.current = Math.sqrt(dx * dx + dy * dy);
        _pinchBase.current = _pinchZoom.current;
      },
      onPanResponderMove: (e) => {
        const [t0, t1] = e.nativeEvent.touches as any[];
        if (!t0 || !t1 || _pinchStartDist.current === 0) return;
        const dx = t1.pageX - t0.pageX;
        const dy = t1.pageY - t0.pageY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ratio = dist / _pinchStartDist.current;
        const next = Math.min(Math.max(_pinchBase.current * ratio, 0.4), 3.0);
        _pinchZoom.current = next;
        arOverlayRef.current?.setScale(next);
      },
      onPanResponderRelease: () => { _pinchStartDist.current = 0; },
      onPanResponderTerminate: () => { _pinchStartDist.current = 0; },
    })
  ).current;
  const [showPanel, setShowPanel] = useState(false);
  const panelAnim = useRef(new Animated.Value(0)).current;
  const toolbarExpanded = useSharedValue(false);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const { user: currentUser, setUser, refreshUser } = useAuth();

  // Entry fee deduction (single-player Blot)
  const blotGameIdRef = useRef<string>(uuidv4());
  const [entryDeducted, setEntryDeducted] = useState(false);

  const syncUserBalance = useCallback((newBalance: number) => {
    setUser(curr => {
      if (!curr) return curr;
      return {
        ...curr,
        balance: newBalance,
        playerStats: curr.playerStats
          ? { ...curr.playerStats, available_points: newBalance }
          : curr.playerStats,
      };
    });
  }, [setUser]);

  const deductBlotEntry = useCallback(async () => {
    if (entryDeducted || !currentUser?.id) return true;
    try {
      console.log('💰 Deducting blot entry fee...');
      const result = await apiService.deductEntry('blot', blotGameIdRef.current);
      if (result.success) {
        console.log(`✅ Entry deducted. Balance: ${result.newBalance}`);
        setEntryDeducted(true);
        syncUserBalance(result.newBalance);
        refreshUser().catch(console.error);
        return true;
      }
      Alert.alert('Insufficient Points', result.error || 'You need 50 points to play blot.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return false;
    } catch (err: any) {
      console.error('❌ Entry deduction error:', err);
      Alert.alert('Error', 'Failed to deduct entry fee.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return false;
    }
  }, [entryDeducted, currentUser?.id, syncUserBalance, refreshUser, navigation]);

  // Handle score selection and start game
  const handleScoreSelection = useCallback(async (score: number) => {
    const ok = await deductBlotEntry();
    if (!ok) return;
    setTargetScore(score);
    const newGame = initializeGame();
    setGameState(newGame);
    // Don't start dealing yet - wait for board layout
  }, [deductBlotEntry]);

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

  const toggleLeave = () => {
    BisetkaAlert.alert('Leave Game', 'Are you sure you want to leave the game?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };
  const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'blot');
  const isPlayingCardRef = useRef(false);
  const [isResolvingTrick, setIsResolvingTrick] = useState(false);
  const resolutionInProgressRef = useRef(false);
  
  // ─── Card Animation States ────────────────────────────────────────────
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const [cardPlayAnimation, setCardPlayAnimation] = useState<Animated.Value | null>(null);
  const trickTransitionOpacity = useRef(new Animated.Value(1)).current;
  const roundTransitionOpacity = useRef(new Animated.Value(1)).current;
  const trickCardAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;

  // Blot player positions for animation (4 players: You, Left, Top, Right)
  const centerX = screenWidth / 2;
  const centerY = screenHeight * 0.5;
  const blotPlayerPositions = [
    { x: 0, y: screenHeight * 0.35 },           // Position 0: Bottom (You)
    { x: -screenWidth * 0.35, y: 0 },          // Position 1: Left
    { x: 0, y: -screenHeight * 0.35 },         // Position 2: Top
    { x: screenWidth * 0.35, y: 0 },           // Position 3: Right
  ];
  const trumpRevealScale = useRef(new Animated.Value(0.8)).current;
  
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

  // ------------------------------------------------------------------
  // Bidding logic
  // ------------------------------------------------------------------
  // Player 0 (human) is Team 1; AI: players 1 (T2), 2 (T1), 3 (T2).
  // Non-dealer (player 1) bids first (clockwise).
  // Round 1: take proposed suit or pass.
  // Round 2: declare any suit or pass → redeal if all pass again.
  const TOTAL_PLAYERS = 4;

  const acceptTrump = useCallback((suit: Suit) => {
    setShowBiddingModal(false); // Close bidding modal
    setGameState(prev => {
      const takingPlayer = prev.players[prev.currentPlayer];
      const beloteTeam = detectBeloteTeam(prev.players, suit);
      return {
        ...prev,
        trump: suit,
        takerTeam: takingPlayer.team,
        beloteTeam,
        phase: 'playing',
        // Non-dealer (player 1) leads the first trick after trump is set
        currentPlayer: (prev.dealer + 1) % TOTAL_PLAYERS,
      };
    });
  }, []);

  const passBid = useCallback(() => {
    setGameState(prev => {
      const newPassCount = prev.bidPassCount + 1;
      // After all 4 players passed in round 1 → go to round 2
      if (prev.bidRound === 1 && newPassCount >= TOTAL_PLAYERS) {
        return {
          ...prev,
          bidPassCount: 0,
          bidRound: 2,
          currentPlayer: (prev.dealer + 1) % TOTAL_PLAYERS,
        };
      }
      // After all 4 players passed in round 2 → redeal
      if (prev.bidRound === 2 && newPassCount >= TOTAL_PLAYERS) {
        setShowBiddingModal(false); // Close modal before redeal
        // Trigger riffle deal animation after board renders
        isRoundTransitioningRef.current = true;
        setTimeout(() => setShowRiffleDealAnimation(true), 300);
        setTimeout(() => setShowRiffleDealAnimation(false), 2800); // 300ms start delay + 2500ms animation
        setTimeout(() => setShowBiddingModal(true), 4800); // Show bidding modal after cards shown for 2s

        const { players: dealt, proposalCard } = dealCards(prev.players);
        const newDealer = (prev.dealer + 1) % TOTAL_PLAYERS;
        return {
          ...prev,
          players: dealt,
          proposalCard,
          trump: null,
          takerTeam: null,
          bidRound: 1,
          bidPassCount: 0,
          currentTrick: { cards: [], winner: null },
          completedTricks: [],
          scores: { team1: 0, team2: 0 },
          phase: 'bidding',
          dealer: newDealer,
          currentPlayer: (newDealer + 1) % TOTAL_PLAYERS,
        };
      }
      // Move to next player
      return {
        ...prev,
        bidPassCount: newPassCount,
        currentPlayer: (prev.currentPlayer + 1) % TOTAL_PLAYERS,
      };
    });
  }, []);

  // ------------------------------------------------------------------
  // AI bidding: auto-run when phase is bidding and currentPlayer != 0
  // ------------------------------------------------------------------
  useEffect(() => {
    if (showRiffleDealAnimation || isRoundTransitioningRef.current) return;
    if (!gameState || gameState.phase !== 'bidding' || gameState.currentPlayer === 0) return;
    const timer = setTimeout(() => {
      const aiPlayer = gameState.players[gameState.currentPlayer];
      const proposed = gameState.proposalCard?.suit ?? null;
      const decision = chooseAIBid(aiPlayer.hand, proposed, gameState.bidRound);
      if (decision.action === 'accept' && decision.suit) {
        acceptTrump(decision.suit);
        return;
      }
      passBid();
    }, 600);
    return () => clearTimeout(timer);
  }, [
    showRiffleDealAnimation,
    gameState?.phase,
    gameState?.currentPlayer,
    gameState?.bidRound,
    acceptTrump,
    passBid,
  ]);

  // ------------------------------------------------------------------
  // AI card play: auto-run when phase is playing and currentPlayer != 0
  // ------------------------------------------------------------------
  useEffect(() => {
    if (showRiffleDealAnimation || isRoundTransitioningRef.current) return;
    if (!gameState || gameState.phase !== 'playing' || gameState.currentPlayer === 0) return;
    if (isResolvingTrick) return;
    const timer = setTimeout(() => {
      const aiPlayer = gameState.players[gameState.currentPlayer];
      if (aiPlayer.hand.length === 0) return;
      const card = chooseAICard(
        aiPlayer,
        gameState.currentTrick,
        gameState.trump,
        gameState.players,
        gameState,
        gameState.takerTeam,
      );
      playCard(card);
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRiffleDealAnimation, gameState?.phase, gameState?.currentPlayer, gameState?.currentTrick, isResolvingTrick]);

  const TABLE_SIZE = Math.min(screenWidth - 32, screenHeight * 0.5);

  // Sync trick cards to AR 3D overlay
  useEffect(() => {
    if (!arEnabled || !gameState?.currentTrick?.cards) { setArCards([]); return; }
    const TILT = 0; // flat on table
    const positions: Record<number, { x: number; y: number; z: number }> = {
      0: { x:  0.00, y: -0.30, z: 0.02 },  // near player (bottom, toward camera)
      1: { x:  0.30, y:  0.00, z: 0.02 },  // right player
      2: { x:  0.00, y:  0.30, z: 0.02 },  // far player (top, away from camera)
      3: { x: -0.30, y:  0.00, z: 0.02 },  // left player
    };
    const rotations: Record<number, { x: number; y: number; z: number }> = {
      0: { x: TILT, y: 0, z: 0 },
      1: { x: TILT, y: 0, z: -Math.PI / 2 },
      2: { x: TILT, y: 0, z: Math.PI },
      3: { x: TILT, y: 0, z:  Math.PI / 2 },
    };
    const mapped: ARCard[] = gameState.currentTrick.cards
      .filter(cp => cp?.card?.suit && cp?.card?.rank)
      .map(cp => ({
        key: `trick-${cp.playerId}-${cp.card.suit}-${cp.card.rank}`,
        position: positions[cp.playerId] ?? { x: 0, y: 0, z: 0.025 },
        rotation: rotations[cp.playerId] ?? { x: 0, y: 0, z: 0 },
        scale: 1,
        cardData: {
          suit: cp.card.suit as ARCard['cardData']['suit'],
          rank: cp.card.rank as ARCard['cardData']['rank'],
          value: 0,
          faceDown: false,
          backgroundImageUri: customTheme?.backgroundImage ?? undefined,
          cardBackImageUri:   customTheme?.cardBackImage   ?? undefined,
          cardFaceImageUri:     Image.resolveAssetSource(getCardImage({ rank: cp.card.rank, suit: cp.card.suit }))?.uri,
          cardBackFaceImageUri: Image.resolveAssetSource(getCardBackImage('red'))?.uri,
          font:               customTheme?.font             ?? undefined,
        },
      }));
    setArCards(mapped);
  }, [arEnabled, gameState?.currentTrick?.cards, customTheme]);

  // ------------------------------------------------------------------
  // Trick resolution (called after delay so players see all 4 cards)
  // ------------------------------------------------------------------
  const resolveTrick = useCallback(() => {
    setGameState(prev => {
      if (prev.currentTrick.cards.length < TOTAL_PLAYERS) return prev;

      const leadSuit = prev.currentTrick.cards[0].card.suit;
      const winnerId = determineTrickWinner(prev.currentTrick, prev.trump, leadSuit);
      const completedTrick = { ...prev.currentTrick, winner: winnerId };
      const newCompleted = [...prev.completedTricks, completedTrick];
      const runningScore = calculateRunningScore(newCompleted, prev.players, prev.trump);

      if (newCompleted.length < 6) { // 24-card deck / 4 players = 6 tricks per round
        return {
          ...prev,
          currentTrick: { cards: [], winner: null },
          completedTricks: newCompleted,
          lastTrickWinner: winnerId,
          currentPlayer: winnerId,
          scores: runningScore,
        };
      }

      // All 8 tricks done — calculate final round score
      const result = calculateRoundScore(
        newCompleted, prev.players, prev.trump, prev.takerTeam, prev.beloteTeam,
      );
      const newGameScore = {
        team1: prev.gameScore.team1 + result.team1,
        team2: prev.gameScore.team2 + result.team2,
      };
      const TARGET_SCORE = targetScore!; // Use selected target score
      const gameOver = newGameScore.team1 >= TARGET_SCORE || newGameScore.team2 >= TARGET_SCORE;

      const makeMsg = () => {
        if (result.capot) return `Capot! ${result.team1 > result.team2 ? 'Team 1' : 'Team 2'} won all tricks!`;
        if (result.takerFell) return `${prev.takerTeam === 2 ? 'Team 1' : 'Team 2'} wins — ${prev.takerTeam === 1 ? 'Team 1' : 'Team 2'} fell!`;
        return `Team 1: ${result.team1}  Team 2: ${result.team2}`;
      };

      if (gameOver) {
        const winTeam = newGameScore.team1 >= TARGET_SCORE ? 1 : 2;
        gameResultService.recordGameResult({
          gameType: 'blot',
          result: winTeam === 1 ? 'win' : 'loss',
          score: newGameScore.team1,
          opponentScore: newGameScore.team2,
        } as any).catch(() => {});
        refreshOnGameEnd?.();
        return {
          ...prev,
          currentTrick: { cards: [], winner: null },
          completedTricks: newCompleted,
          lastTrickWinner: winnerId,
          currentPlayer: winnerId,
          scores: runningScore,
          gameScore: newGameScore,
          phase: 'gameEnd',
          roundMessage: makeMsg(),
        };
      }

      // Start a new round
      setShowBiddingModal(false); // Close modal before new round
      // Trigger riffle deal animation after board renders
      isRoundTransitioningRef.current = true;
      setTimeout(() => setShowRiffleDealAnimation(true), 300);
      setTimeout(() => setShowRiffleDealAnimation(false), 2800); // 300ms start delay + 2500ms animation
      setTimeout(() => setShowBiddingModal(true), 4800); // Show bidding modal after cards shown for 2s

      const { players: dealt, proposalCard } = dealCards(prev.players);
      const newDealer = (prev.dealer + 1) % TOTAL_PLAYERS;
      return {
        ...prev,
        players: dealt,
        proposalCard,
        trump: null,
        takerTeam: null,
        beloteTeam: null,
        bidRound: 1,
        bidPassCount: 0,
        currentTrick: { cards: [], winner: null },
        completedTricks: [],
        scores: { team1: 0, team2: 0 },
        gameScore: newGameScore,
        phase: 'bidding',
        dealer: newDealer,
        currentPlayer: (newDealer + 1) % TOTAL_PLAYERS,
        roundMessage: makeMsg(),
      };
    });
  }, [refreshOnGameEnd]);

  // Auto-resolve trick 1.5s after all 4 cards are played
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;
    if (gameState.currentTrick.cards.length !== TOTAL_PLAYERS) return;
    if (resolutionInProgressRef.current) return;

    resolutionInProgressRef.current = true;
    setIsResolvingTrick(true);

    const timer = setTimeout(() => {
      resolveTrick();
      setTimeout(() => {
        setIsResolvingTrick(false);
        resolutionInProgressRef.current = false;
      }, 300);
    }, 1500);

    return () => clearTimeout(timer);
  }, [gameState?.currentTrick?.cards?.length, gameState?.phase, resolveTrick]);

  // ------------------------------------------------------------------
  // Card play — only adds the card; resolution handled by useEffect above
  // ------------------------------------------------------------------
  const playCard = (card: CardType) => {
    // Debounce only for the human player to prevent double-taps;
    // AI calls must never be blocked.
    if (gameState.currentPlayer === 0) {
      if (isPlayingCardRef.current) return;
      isPlayingCardRef.current = true;
      setTimeout(() => { isPlayingCardRef.current = false; }, 800);
    }

    playCardFlipSound();

    setGameState(prev => {
      if (prev.phase !== 'playing') return prev;
      const playerId = prev.currentPlayer;

      const newPlayers = prev.players.map(p =>
        p.id === playerId
          ? { ...p, hand: p.hand.filter(c => !(c.suit === card.suit && c.rank === card.rank)) }
          : p,
      );
      const newTrick = {
        cards: [...prev.currentTrick.cards, { playerId, card }],
        winner: null as number | null,
      };

      // Always just add the card; resolution useEffect handles the 4th card after a delay
      return {
        ...prev,
        players: newPlayers,
        currentTrick: newTrick,
        // Only advance currentPlayer for non-final cards; winner determines next player after resolution
        ...(newTrick.cards.length < TOTAL_PLAYERS && { currentPlayer: (playerId + 1) % TOTAL_PLAYERS }),
      };
    });
  };

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const renderCard = (
    card: CardType,
    index: number,
    isTrickCard = false,
    onPress?: () => void,
    playable = true,
  ) => {
    const sizeStyle = isTrickCard ? styles.nativeCardTrick : styles.nativeCard;
    const cardW = isTrickCard ? 62 : 77;
    const cardH = isTrickCard ? 86 : 107;
    const cardContent = (
      <View style={[sizeStyle, { width: cardW, height: cardH }]}>
        <Image
          source={getCardImage(card)}
          style={{ width: cardW, height: cardH }}
          resizeMode="contain"
        />
      </View>
    );
    if (!onPress) {
      return <View key={card.id}>{cardContent}</View>;
    }
    return (
      <TouchableOpacity
        key={card.id}
        style={playable ? styles.recommendedCard : styles.disabledCard}
        onPress={playable ? onPress : undefined}
        disabled={!playable}
      >
        {cardContent}
      </TouchableOpacity>
    );
  };

  const renderTrumpSelection = () => {
    const isHumanTurn = gameState.currentPlayer === 0;
    const proposedSuit = gameState.proposalCard?.suit;

    if (gameState.bidRound === 1) {
      return (
        <View style={styles.trumpSelection}>
          <Text style={styles.trumpTitle}>Trump Bidding</Text>
          {proposedSuit && (
            <View style={styles.proposalRow}>
              <Text style={styles.proposalLabel}>Proposed:</Text>
              <Text style={[styles.proposalSuit, { color: SUIT_COLOR[proposedSuit] }]}>
                {SUIT_ICON[proposedSuit]}
              </Text>
              <Text style={styles.proposalLabel}>{SUIT_NAME[proposedSuit]}</Text>
            </View>
          )}
          <Text style={styles.bidRoundLabel}>
            {isHumanTurn
              ? 'Accept the proposed suit or pass'
              : `${gameState.players[gameState.currentPlayer]?.name ?? 'AI'} is deciding…`}
          </Text>
          {isHumanTurn && proposedSuit ? (
            <View style={styles.bidButtons}>
              <TouchableOpacity style={[styles.bidBtn, styles.bidBtnTake]} onPress={() => acceptTrump(proposedSuit)}>
                <Text style={styles.bidBtnText}>Take {SUIT_ICON[proposedSuit]}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bidBtn, styles.bidBtnPass]} onPress={passBid}>
                <Text style={styles.bidBtnText}>Pass</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.waitingText}>Waiting for players to bid…</Text>
          )}
        </View>
      );
    }

    // Round 2: player chooses any suit
    return (
      <View style={styles.trumpSelection}>
        <Text style={styles.trumpTitle}>Choose Trump</Text>
        <Text style={styles.bidRoundLabel}>
          {isHumanTurn
            ? 'No one took. Choose a trump suit or pass.'
            : `${gameState.players[gameState.currentPlayer]?.name ?? 'AI'} is deciding…`}
        </Text>
        {isHumanTurn ? (
          <>
            <View style={styles.suitButtons}>
              {(['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]).map(suit => (
                <TouchableOpacity key={suit} style={styles.suitButton} onPress={() => acceptTrump(suit)}>
                  <Text style={[styles.suitButtonText, { color: SUIT_COLOR[suit] }]}>{SUIT_ICON[suit]}</Text>
                  <Text style={styles.suitButtonLabel}>{SUIT_NAME[suit]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.bidBtn, styles.bidBtnPass, { marginTop: 16 }]}
              onPress={passBid}
            >
              <Text style={styles.bidBtnText}>Pass (Redeal)</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.waitingText}>Waiting for players to bid…</Text>
        )}
      </View>
    );
  };

  const renderGameEnd = () => {
    const winner = gameState.gameScore.team1 > gameState.gameScore.team2 ? 1 : 2;
    const playerTeam = gameState.players.find(p => p.id === 0)?.team ?? 1;
    const playerWon = winner === playerTeam;
    return (
      <View style={styles.gameEndContainer}>
        <Text style={styles.gameEndTitle}>Game Over!</Text>
        <Text style={styles.gameEndWinner}>
          {playerWon ? '🏆 You Win!' : '😔 You Lose'}
        </Text>
        <Text style={styles.gameEndScore}>
          Team 1: {gameState.gameScore.team1} — Team 2: {gameState.gameScore.team2}
        </Text>
        <TouchableOpacity style={styles.newGameButton} onPress={() => {
          navigation.replace('GameInfo', {
            gameType: 'blot',
            preferredMode: 'ai',
          });
        }}>
          <Text style={styles.newGameButtonText}>New Game</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Static ararat4 background image is used instead of the 360 photosphere.
  // AR3DOverlay is still mounted to preserve the existing layering behavior.
  return (
    <View style={styles.container}>
      <AraratBackground  />
      <AR3DOverlay ref={arOverlayRef} visible={arEnabled} boardGlbPath="glb/game_assets/marble_circle_table.glb" hideCheckerboard boardFixed boardFixedZoom={1.0} boardScale={1.9} tableDist={0.9} boardY={-1.5} boardTiltX={0.35} cardGlbPath="glb/cards/card-template.glb" cards={arCards} />
      {/* Always mount SyncedYouTubePlayer alongside the other WebViews so all
          three hardware-accelerated layers are created together at screen open.
          Adding a new WebView after the others are running kills them on Android. */}
      <SyncedYouTubePlayer roomId={null} visible={true} />
      {(!targetScore || !gameState) ? (
        <View style={[StyleSheet.absoluteFill, {zIndex: 10}]}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.scoreSelectionContainer}>
              <Text style={styles.scoreSelectionTitle}>Choose Target Score</Text>
              <TouchableOpacity style={styles.scoreButton} onPress={() => handleScoreSelection(101)}>
                <Text style={styles.scoreButtonText}>101 Points</Text>
                <Text style={styles.scoreButtonSubtext}>Quick Game</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scoreButton} onPress={() => handleScoreSelection(201)}>
                <Text style={styles.scoreButtonText}>201 Points</Text>
                <Text style={styles.scoreButtonSubtext}>Standard Game</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scoreButton} onPress={() => handleScoreSelection(301)}>
                <Text style={styles.scoreButtonText}>301 Points</Text>
                <Text style={styles.scoreButtonSubtext}>Long Game</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      ) : (
        <>
          <View style={StyleSheet.absoluteFill} {...pinchResponder.panHandlers} pointerEvents="box-none" />
      <View style={styles.overlay} pointerEvents="box-none">
        <GamePlayerOverlay opponent="ai" topOffset={260} size={100} />
        <SafeAreaView style={[styles.safeArea,]} onLayout={handleBoardLayout}>
          <View>
            <GameToolbar
              title="🃏 Blot"
              onBack={() => navigation.goBack()}
              backgroundColor="transparent"
            />
            <View>
              <GameToolbarControls
                buttons={[
                  { icon: '🎨', onPress: () => setShowCustomization(true) },
                  { icon: arEnabled ? '🥽' : '🎮', onPress: () => setArEnabled(!arEnabled) },
                  { icon: showMusicPlayer ? '🎵' : '🎶', onPress: () => setShowMusicPlayer(s => !s) },
                  { icon: '👥', onPress: togglePanel },
                  { icon: '🚪', onPress: toggleLeave },
                ]}
              />
            </View>
          </View>

          {gameState.phase === 'playing' && arEnabled && (
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <Text style={{color:'#00ff88',fontSize:11,textAlign:'center',opacity:0.8}}>
                3D cards: {arCards.length}
              </Text>
            </View>
          )}

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
                <Text
                  style={[
                    styles.trumpSuit,
                    {
                      color:
                        gameState.trump === 'hearts' ||
                        gameState.trump === 'diamonds'
                          ? '#d40000'
                          : '#000',
                    },
                  ]}>
                  {gameState.trump === 'hearts'
                    ? '♥'
                    : gameState.trump === 'diamonds'
                    ? '♦'
                    : gameState.trump === 'clubs'
                    ? '♣'
                    : '♠'}
                </Text>
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

          {gameState.phase === 'playing' && (
            <View pointerEvents="none" style={styles.turnIndicatorWrap}>
              <Text style={styles.currentPlayerText}>
                {gameState.currentPlayer === 0
                  ? '★ Your Turn (Team 1)'
                  : `${
                      gameState.players[gameState.currentPlayer].name
                    }'s Turn (Team ${
                      gameState.players[gameState.currentPlayer].team
                    })`}
              </Text>
            </View>
          )}



          {/* Bidding Modal - transparent overlay */}
          {gameState.phase === 'bidding' && showBiddingModal && (
            <View style={styles.biddingModalOverlay} pointerEvents="box-none">
              <View style={styles.biddingModalContent}>
                {renderTrumpSelection()}
              </View>
            </View>
          )}

          {gameState.phase === 'gameEnd' && renderGameEnd()}

          {/* Round message shown between rounds */}
          {gameState.roundMessage && gameState.phase === 'bidding' && (
            <View style={styles.roundMsgBox}>
              <Text style={styles.roundMsgText}>{gameState.roundMessage}</Text>
            </View>
          )}

          {gameState.phase === 'playing' && (
            <>
              <View style={styles.playArea}>

                {!arEnabled && (
                <View
                  style={[
                    styles.tableContainer,
                    { width: TABLE_SIZE, height: TABLE_SIZE },
                  ]}
                >
                  <ImageBackground
                    source={customTheme?.boardImage ? { uri: customTheme.boardImage } : require('../../../../assets/blot/card-table.png')}
                    style={styles.cardTable}
                    imageStyle={{ borderRadius: 16, opacity: 0.20 }}
                  >
                      {/* Card placement placeholders */}
                      <View style={styles.trickArea}>
                        <View style={[styles.cardPlaceholder, styles.trickSlotTop]} />
                        <View style={[styles.cardPlaceholder, styles.trickSlotBottom]} />
                        <View style={[styles.cardPlaceholder, styles.trickSlotLeft]} />
                        <View style={[styles.cardPlaceholder, styles.trickSlotRight]} />
                      </View>

                      {gameState.currentTrick.cards.length > 0 && (() => {
                          const ledSuit = gameState.currentTrick.cards[0].card.suit;
                          const positionStyle: Record<number, object> = {
                            0: styles.trickSlotBottom,
                            1: styles.trickSlotRight,
                            2: styles.trickSlotTop,
                            3: styles.trickSlotLeft,
                          };
                          return (
                            <View style={styles.trickArea}>
                              <View style={styles.ledSuitBadge}>
                                <Text style={[styles.ledSuitIcon, { color: SUIT_COLOR[ledSuit] }]}>
                                  {SUIT_ICON[ledSuit]}
                                </Text>
                                <Text style={styles.ledSuitLabel}>
                                  Led: {SUIT_NAME[ledSuit]}
                                </Text>
                              </View>
                              {gameState.currentTrick.cards.map((cardPlay, idx) => (
                                <View
                                  key={idx}
                                  style={[
                                    styles.trickSlot,
                                    positionStyle[cardPlay.playerId] ?? styles.trickSlotTop,
                                  ]}
                                >
                                  {renderCard(cardPlay.card, idx, true)}
                                </View>
                              ))}
                            </View>
                          );
                        })()}
                  </ImageBackground>
                </View>
                )}

              {/* Hide player hand during riffle animation but keep layout space */}
              <View style={[styles.handContainer, showRiffleDealAnimation && { opacity: 0 }]}>
                  <Text style={styles.handLabel}>Your Hand:</Text>
                  <CardHandFan
                    cards={sortHandForDisplay(gameState.players[0].hand)}
                    renderCard={(card, index) => {
                      const isMyTurn = gameState.currentPlayer === 0;
                      const playable =
                        isMyTurn &&
                        canPlayCard(
                          card,
                          gameState.players[0].hand,
                          gameState.currentTrick,
                          gameState.trump,
                        );
                      return renderCard(
                        card,
                        index,
                        false,
                        isMyTurn ? () => playCard(card) : undefined,
                        playable
                      );
                    }}
                  />
                </View>
              </View>
            </>
          )}
        </SafeAreaView>
      </View>

      {showCustomization && (
        <CardCustomizationModal
          visible={showCustomization}
          onClose={() => setShowCustomization(false)}
          onSave={handleSaveTheme}
          currentTheme={customTheme}
        />
      )}

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
          <TouchableOpacity
            onPress={togglePanel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.panelClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.panelSectionTitle}>🎮 In Game</Text>
          {gameState.players.map((player, idx) => {
            const isYou = idx === 0;
            const avatarSource = isYou ? resolveAvatar(currentUser?.avatar_url ?? null) : null;
            const isCurrentTurn = gameState.currentPlayer === idx;
            const teamColor = player.team === 1 ? '#4ade80' : '#60a5fa';
            const initials = player.name
              .split(' ')
              .map((w: string) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            return (
              <View
                key={idx}
                style={[styles.panelPlayerRow, isCurrentTurn && styles.panelPlayerRowActive]}
              >
                <View style={styles.panelAvatarClip}>
                  {avatarSource ? (
                    <Image
                      source={avatarSource}
                      style={styles.panelAvatar}
                      resizeMode="contain"
                    />
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
                    <Text style={[styles.panelTeamText, { color: teamColor }]}>
                      Team {player.team}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          <Text style={[styles.panelSectionTitle, { marginTop: 20 }]}>👁 Spectating</Text>
          <Text style={styles.panelEmptyText}>No spectators</Text>
        </ScrollView>
      </Animated.View>

      {/* Riffle Shuffle & Deal Animation */}
      <RiffleDealAnimation
        visible={showRiffleDealAnimation}
        playerPositions={blotPlayerPositions}
        dealerPosition={{ x: centerX, y: centerY }}
        cardsPerPlayer={6}
        onComplete={() => {
          setShowRiffleDealAnimation(false);
          isRoundTransitioningRef.current = false;
          // Wait 2 seconds showing cards, then show bidding modal
          setTimeout(() => {
            setShowBiddingModal(true);
          }, 2000);
        }}
        theme={customTheme}
      />
      <InGameChat
        roomId={''}
        currentUserId={currentUser?.id ?? ''}
        gameType="blot"
        visible={true}
      />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scoreSelectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  scoreSelectionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  scoreButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    minWidth: 250,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  scoreButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scoreButtonSubtext: {
    fontSize: 14,
    color: '#FFD700',
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'transparent',
  },
  backButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  newGameText: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  customizeText: {
    fontSize: 22,
    color: '#FFD700',
  },
  editRoomButton: {
    padding: 6,
    borderRadius: 8,
  },
  editRoomIcon: {
    fontSize: 22,
    color: '#FFD700',
  },
  scoreBoard: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'transparent',
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
    flex:1,
    maxWidth:70,
    maxHeight:98,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  trumpLabel: {
    fontSize: 12,
    color: '#222',
    marginBottom: 4,
  },
  trumpSuit: {
    fontSize: 32,
  },
  turnIndicatorWrap: {
    position: 'absolute',
    top: 280,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 4,
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
    marginBottom: 2,
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
  trickLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
    fontWeight: '600',
  },
  trickCards: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trickCard: {
    width: 90,
    height: 120,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    marginHorizontal: 0,
    overflow: 'hidden',
  },
  // Led suit indicator
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
  // Card placement placeholder style
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
  // Absolute card slots for each player position on the table
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
  trickPlayerName: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 6,
    fontWeight: '600',
  },
  card: {
    width: 80,
    height: 110,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    marginHorizontal: 5,
    overflow: 'hidden',
  },
  nativeCard: {
    width: 77,
    height: 107,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cccccc',
    overflow: 'hidden',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  nativeCardTrick: {
    width: 52,
    height: 72,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cccccc',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  nativeCardCorner: {
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  nativeCardRank: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  nativeCardSuit: {
    fontSize: 12,
    lineHeight: 14,
  },
  nativeCardCenter: {
    fontSize: 28,
  },
  selectedCard: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  disabledCard: {
    opacity: 0.45,
  },
  recommendedCard: {
    // Green glow/tint to flag cards that are legal to play
    shadowColor: '#2ecc71',
    shadowOpacity: 0.95,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    borderRadius: 8,
    backgroundColor: 'rgba(46, 204, 113, 0.22)',
  },
  cardRank: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  cardSuit: {
    fontSize: 32,
  },
  cardValue: {
    fontSize: 12,
    color: '#666',
  },
  cardImageBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
  },
  handContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  handLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  biddingModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  biddingModalContent: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    paddingVertical: 22,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
  trumpSelection: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  trumpTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 16,
    textAlign: 'center',
  },
  suitButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  suitButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    margin: 12,
    alignItems: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  suitButtonText: {
    fontSize: 48,
    marginBottom: 8,
  },
  suitButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  gameEndContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gameEndTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 16,
  },
  gameEndWinner: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#90EE90',
    marginBottom: 24,
  },
  gameEndScore: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 48,
  },
  newGameButton: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 48,
  },
  newGameButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A3622',
  },
  // Bidding UI
  proposalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  proposalLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  proposalSuit: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  bidRoundLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
    textAlign: 'center',
  },
  bidButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  bidBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 130,
  },
  bidBtnTake: {
    backgroundColor: '#2e7d32',
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  bidBtnPass: {
    backgroundColor: '#7f1d1d',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  bidBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  waitingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    marginTop: 16,
    fontStyle: 'italic',
  },
  // Round result message
  roundMsgBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  roundMsgText: {
    color: '#FFD700',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  // Side panel
  panelBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sidePanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 270,
    backgroundColor: 'rgba(12,12,30,0.97)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  panelClose: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  panelContent: {
    padding: 16,
  },
  panelSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  panelPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  panelPlayerRowActive: {
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  panelAvatarClip: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#1e1e40',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  panelAvatar: {
    width: 50,
    height: 50,
  },
  panelAvatarPlaceholder: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a55',
  },
  panelAvatarInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  panelTurnDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFD700',
    borderWidth: 2,
    borderColor: 'rgba(12,12,30,0.97)',
  },
  panelPlayerInfo: {
    flex: 1,
    gap: 5,
  },
  panelPlayerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  panelTeamBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  panelTeamText: {
    fontSize: 11,
    fontWeight: '700',
  },
  panelEmptyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  recenterBtn: { position:'absolute', bottom:200, alignSelf:'center', left:'50%', transform:[{translateX:-54}], flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(0,0,0,0.35)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)', borderRadius:24, paddingHorizontal:18, paddingVertical:10 },
  recenterIcon: { fontSize:20, color:'#fff' },
  recenterLabel: { fontSize:13, color:'#fff', fontWeight:'600', letterSpacing:0.3 },
});

export default BlotScreen;
