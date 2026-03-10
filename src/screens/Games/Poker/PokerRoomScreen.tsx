import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, ImageBackground, ActivityIndicator, Clipboard, TextInput, Animated} from 'react-native';
import { Snackbar } from 'react-native-paper';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';

import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import { aiMoveLogService } from '../../../services/aiMoveLog.service';
import { socketService } from '../../../services/SocketService';
import tokenService from '../../../services/token.service';
import RoomInfoDrawer from '../../../components/RoomInfoDrawer';
import { v4 as uuidv4 } from 'uuid';
import {apiConfig} from '../../../libs/utils/api.utils';

type Props = NativeStackScreenProps<RootStackParamList, 'PokerRoom'>;

interface WinSnackbar { visible: boolean; message: string; }
interface WaitingSeat { seatIndex: number; displayName: string; chips: number; isAI: boolean; } 
interface WaitingRoom { seats: (WaitingSeat | null)[]; humanCount: number; waitSeconds: number; countdown: number; }

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
}

interface Player {
  id: number;
  name: string;
  chips: number;
  currentBet: number;
  cards: Card[];
  folded: boolean;
  isDealer: boolean;
  isActive: boolean;
  hasActed: boolean;
}

type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

const TURN_SECONDS = 20;

/**
 * Isolated per-player turn timer. Mounts fresh on each turn (via key prop),
 * so only this tiny component re-renders on every tick — not the game screen.
 */
const PlayerTurnTimer = React.memo(({ onExpire }: { onExpire: () => void }) => {
  const [remaining, setRemaining] = React.useState(TURN_SECONDS);
  const onExpireRef = React.useRef(onExpire);
  React.useEffect(() => { onExpireRef.current = onExpire; });

  React.useEffect(() => {
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id);
          setTimeout(() => onExpireRef.current(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pct = remaining / TURN_SECONDS;
  const barColor = pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#f44336';

  return (
    <View style={{ marginTop: 4 }}>
      <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ height: 3, width: `${Math.round(pct * 100)}%`, backgroundColor: barColor, borderRadius: 2 }} />
      </View>
      <Text style={{ color: barColor, fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginTop: 2 }}>
        {remaining}s
      </Text>
    </View>
  );
});

const PokerRoomScreen: React.FC<Props> = ({route, navigation}) => {
  const {session, gameType, mode, joinCode} = route.params as any;
  const dbSessionId: string | undefined = (route.params as any)?.dbSessionId;
  const allowReplaceAI: boolean = session?.allowReplaceAI || false;
  const isMultiplayer = mode !== 'ai';
  const isPrivateCreate = mode === 'private-create';
  const isPrivateJoin   = mode === 'private-join';
  const isReplaceAI     = mode === 'replace-ai';
  const isSpectate      = mode === 'spectate';
  const userId = session?.userId || session?.user?.id || 'guest-' + Math.random().toString(36).substr(2, 6);
  const rawName: any = session?.displayName || session?.user?.fullName;
  const displayName: string = typeof rawName === 'string' && rawName
    ? rawName
    : (rawName?.givenName || rawName?.familyName)
      ? [rawName.givenName, rawName.familyName].filter(Boolean).join(' ')
      : (session?.user?.username || session?.user?.email || 'You');

  // Multiplayer state
  const [tableId, setTableId] = useState<string | null>(null);
  const tableIdRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const [mySeat, setMySeat] = useState<number>(0);
  const mySeatRef = useRef<number>(0);
  const [waitingRoom, setWaitingRoom] = useState<WaitingRoom | null>(null);
  const waitingCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isConnecting, setIsConnecting] = useState(isMultiplayer);
  // Private room
  const [privateRoomCode, setPrivateRoomCode] = useState<string | null>(null);
  const [isPrivateHost, setIsPrivateHost] = useState(false);
  const [privateHumanCount, setPrivateHumanCount] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isSpectating, setIsSpectating] = useState(false);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  // In multiplayer, playerIndex is mySeat (assigned by server); in AI mode it's always 0
  const [playerIndex] = useState(0); // used only in AI mode; overridden in multiplayer via computed value below
  const [winSnackbar, setWinSnackbar] = useState<WinSnackbar>({visible: false, message: ''});
  const [showConfetti, setShowConfetti] = useState(false);
  const [roomName, setRoomName] = useState('Multiplayer Poker');
  const [editingRoomName, setEditingRoomName] = useState(false);
  const [draftRoomName, setDraftRoomName] = useState('');
  const roomNameRef = useRef(roomName);
  useEffect(() => { roomNameRef.current = roomName; }, [roomName]);

  // Effective seat index for the human player
  const myPlayerIndex = isMultiplayer ? mySeatRef.current : playerIndex;
  const lastResetTimeRef = useRef(0);
  const lastActivePlayerRef = useRef(-1);
  const lastPhaseRef = useRef<GamePhase>('waiting');
  const aiMoveTriggeredRef = useRef(false);
  // Refs to hold current state for avoiding stale closures in AI moves
  const playersRef = useRef<Player[]>([]);
  const currentBetRef = useRef(0);
  const pokerGameIdRef = useRef<string>(uuidv4());
  const handNumberRef = useRef(0);
  const lastPlayerActionRef = useRef<{ action: string; amount: number } | null>(null);
  const aiActionsThisRoundRef = useRef<Array<{ playerId: number; action: string; amount?: number }>>([]);
  
  // Keep refs in sync with state
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  
  useEffect(() => {
    currentBetRef.current = currentBet;
  }, [currentBet]);

  // ─────────────────────────────────────────────────────────────────────────
  // MULTIPLAYER SOCKET CONNECTION
  // ─────────────────────────────────────────────────────────────────────────
  const applyServerState = useCallback((data: any) => {
    // Always keep mySeat in sync — the server tells us exactly which seat we own
    if (data.mySeat !== undefined) {
      mySeatRef.current = data.mySeat;
      setMySeat(data.mySeat);
    }
    if (data.players) {
      const toStr = (v: any): string => {
        if (!v) return '';
        if (typeof v === 'string') return v;
        if (v.givenName || v.familyName) return [v.givenName, v.familyName].filter(Boolean).join(' ');
        return String(v);
      };
      const mapped: Player[] = (data.players as (any | null)[]).map((p: any | null, idx: number) => ({
        id: idx,
        name: p ? (toStr(p.displayName) || `Seat ${idx + 1}`) : `Seat ${idx + 1}`,
        chips: p ? p.chips : 0,
        currentBet: p ? p.currentBet : 0,
        cards: p ? (p.cards as any[]).map((c: any) => c.hidden ? {suit: 'spades', rank: '?', value: 0} : c as Card) : [],
        folded: p ? p.folded : true,
        isDealer: p ? p.isDealer : false,
        isActive: p ? p.isActive : false,
        hasActed: p ? p.hasActed : false,
      }));
      setPlayers(mapped);
    }
    if (data.communityCards !== undefined) setCommunityCards(data.communityCards);
    if (data.pot !== undefined) setPot(data.pot);
    if (data.currentBet !== undefined) setCurrentBet(data.currentBet);
    if (data.phase !== undefined) setGamePhase(data.phase as GamePhase);
    if (data.activeSeat !== undefined) setActivePlayerIndex(data.activeSeat);
  }, []);

  useEffect(() => {
    if (!isMultiplayer) {
      initializeGame();
      return;
    }

    let mounted = true;
    const connect = async () => {
      try {
        setIsConnecting(true);
        const token = await tokenService.getAccessToken() || 'temp-token';
        await socketService.connect(userId, token);
        if (!mounted) return;

        // Remove any stale listeners from previous mounts before registering fresh ones
        socketService.offPokerEvents();
        // Always attempt to rejoin an existing table first — handles socket reconnects mid-game
        socketService.rejoinPoker(userId);

        // Room name updates from other players
        const _sock = socketService.getSocket();
        if (_sock) {
          _sock.on('room_name_updated', (data: { roomId: string; dbSessionId?: string; roomName: string }) => {
            if (data.roomId === tableIdRef.current || data.dbSessionId === tableIdRef.current ||
                data.roomId === roomIdRef.current || data.dbSessionId === roomIdRef.current) {
              setRoomName(data.roomName);
            }
          });
        }

        socketService.onPokerJoined((data) => {
          if (!mounted) return;
          tableIdRef.current = data.tableId;
          mySeatRef.current = data.seatIndex;
          setTableId(data.tableId);
          setMySeat(data.seatIndex);
          // replace-ai: game is already running, skip the waiting room
          if (isReplaceAI) {
            setIsConnecting(false);
            setWaitingRoom(null);
          }
        });

        // Private room created (host gets code back)
        socketService.onPokerPrivateCreated((data) => {
          if (!mounted) return;
          tableIdRef.current = data.tableId;
          mySeatRef.current = data.seatIndex;
          setTableId(data.tableId);
          setMySeat(data.seatIndex);
          setPrivateRoomCode(data.roomCode);
          setIsPrivateHost(true);
        });

        socketService.onPokerRoomUpdate((data) => {
          if (!mounted) return;
          if (data.isPrivate) setPrivateHumanCount(data.humanCount);
          if (waitingCountdownRef.current) clearInterval(waitingCountdownRef.current);
          let remaining = data.waitSeconds;
          setWaitingRoom({ seats: data.seats, humanCount: data.humanCount, waitSeconds: data.waitSeconds, countdown: remaining });
          if (remaining > 0) {
            waitingCountdownRef.current = setInterval(() => {
              remaining--;
              if (remaining <= 0) {
                if (waitingCountdownRef.current) clearInterval(waitingCountdownRef.current);
                return;
              }
              setWaitingRoom(prev => prev ? { ...prev, countdown: remaining } : null);
            }, 1000);
          }
        });

        socketService.onPokerGameStarted((data) => {
          if (!mounted) return;
          if (waitingCountdownRef.current) clearInterval(waitingCountdownRef.current);
          setWaitingRoom(null);
          setIsConnecting(false);
          applyServerState(data);
        });

        socketService.onPokerStateUpdate((data) => {
          if (!mounted) return;
          applyServerState(data);
        });

        socketService.onPokerHandResult((data) => {
          if (!mounted) return;
          applyServerState(data);
          
          // Show winner notification for everyone with confetti
          const winnerMessage = data.isYourWin 
            ? `🎉 You won $${data.potAmount}!` 
            : `${data.winnerName} wins $${data.potAmount}!`;
          setWinSnackbar({ visible: true, message: winnerMessage });
          setShowConfetti(true);
          
          // Auto-dismiss after 2 seconds
          setTimeout(() => {
            setWinSnackbar({visible: false, message: ''});
            setShowConfetti(false);
          }, 2000);
        });

        socketService.onPokerTurnTimeout((data) => {
          if (!mounted) return;
          BisetkaAlert.alert('Turn Timed Out', data.message || 'You were auto-folded for inactivity.');
        });

        socketService.onPokerPlayerDisconnected((data) => {
          if (!mounted) return;
          setWinSnackbar({ visible: true, message: `${data.displayName} disconnected` });
        });

        if (isSpectate && dbSessionId) {
          const data = await socketService.spectateRoom(dbSessionId, userId, displayName);
          if (!mounted) return;
          setIsSpectating(true);
          setIsConnecting(false);
          setWaitingRoom(null);
          roomIdRef.current = data.roomId;
          applyServerState({
            players: data.players,
            communityCards: data.gameState?.communityCards,
            pot: data.gameState?.pot,
            currentBet: data.gameState?.currentBet,
            phase: data.gameState?.phase || 'waiting',
            activeSeat: data.gameState?.activeSeat,
          });

          // Listen for ongoing spectator updates
          const _s = socketService.getSocket();
          if (_s) {
            _s.on('poker_spectate_update', (upd: any) => {
              if (!mounted) return;
              applyServerState(upd);
            });
            _s.on('poker_spectate_hand_result', (res: any) => {
              if (!mounted) return;
              applyServerState(res);
              BisetkaAlert.success(
                `${res.winnerName} Won`,
                `${res.winnerName} wins $${res.potAmount}!`
              );
            });
          }
        } else if (isPrivateCreate) {
          socketService.createPokerPrivateRoom(userId, displayName);
        } else if (isPrivateJoin && joinCode) {
          socketService.joinPokerPrivateRoom(joinCode as string, userId, displayName);
        } else if (isReplaceAI && dbSessionId) {
          socketService.replaceAiPlayer(dbSessionId, userId, displayName);
        } else {
          socketService.joinPokerMatchmaking(userId, displayName, allowReplaceAI || undefined);
        }
        // Keep isConnecting=true until poker_game_started arrives
      } catch (err) {
        console.error('Poker socket connect error:', err);
        if (mounted) {
          setIsConnecting(false);
          BisetkaAlert.error('Connection failed', 'Could not connect to server. Starting local game instead.');
          initializeGame();
        }
      }
    };
    connect();

    return () => {
      mounted = false;
      if (waitingCountdownRef.current) clearInterval(waitingCountdownRef.current);
      if (tableIdRef.current) socketService.cancelPokerMatchmaking(userId);
      socketService.offPokerEvents();
    };
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isMultiplayer) initializeGame();
  }, []);

  // Reset timer when active player changes (AI mode only — server drives turns in multiplayer)
  useEffect(() => {
    if (isMultiplayer) return;
    if (gamePhase === 'waiting' || gamePhase === 'showdown') return;
    if (players.length === 0) return;
    
    // If phase changed, reset tracking so AI can be triggered in new betting round
    const phaseChanged = lastPhaseRef.current !== gamePhase;
    if (phaseChanged) {
      console.log('Phase changed from', lastPhaseRef.current, 'to', gamePhase);
      lastPhaseRef.current = gamePhase;
      lastActivePlayerRef.current = -1; // Reset so AI triggers even if same player
      aiMoveTriggeredRef.current = false;
    }
    
    // Only reset if active player actually changed (unless phase just changed)
    if (!phaseChanged && lastActivePlayerRef.current === activePlayerIndex) {
      return;
    }
    
    const activePlayer = players[activePlayerIndex];
    if (!activePlayer || activePlayer.folded) return;
    
    console.log('Active player changed to:', activePlayerIndex, activePlayer.name);
    lastActivePlayerRef.current = activePlayerIndex;
    aiMoveTriggeredRef.current = false;
    
    // Trigger AI move if not human player
    if (activePlayerIndex !== playerIndex && !aiMoveTriggeredRef.current && !isMultiplayer) {
      aiMoveTriggeredRef.current = true;
      const aiIdx = activePlayerIndex;
      // Fast AI moves like multiplayer server (300-800ms)
      const aiDelay = 300 + Math.random() * 500;
      const timer = setTimeout(() => {
        simulateAIMove(aiIdx);
      }, aiDelay);
      return () => clearTimeout(timer);
    }
  }, [activePlayerIndex, gamePhase, players.length]);

  const initializeGame = () => {
    // Initialize 6 players
    const initialPlayers: Player[] = Array.from({length: 6}, (_, i) => ({
      id: i,
      name: i === 0 ? 'You' : `Player ${i + 1}`,
      chips: 1000,
      currentBet: 0,
      cards: [],
      folded: false,
      isDealer: i === 0,
      hasActed: false,
      isActive: false,
    }));

    setPlayers(initialPlayers);
    startNewHand(initialPlayers);
  };

  const startNewHand = (currentPlayers: Player[]) => {
    // Increment hand number and reset round refs
    handNumberRef.current += 1;
    lastPlayerActionRef.current = null;
    aiActionsThisRoundRef.current = [];
    
    const deck = createDeck();
    
    // Move dealer button to next player
    const currentDealerIndex = currentPlayers.findIndex(p => p.isDealer);
    const nextDealerIndex = (currentDealerIndex + 1) % 6;
    
    // Deal 2 cards to each player
    const updatedPlayers = currentPlayers.map((player, index) => ({
      ...player,
      cards: [deck.pop()!, deck.pop()!],
      currentBet: 0,
      folded: false,
      hasActed: false,
      isDealer: index === nextDealerIndex, // Rotate dealer button
    }));

    // Small blind and big blind (positions 1 and 2 after dealer)
    const dealerIndex = updatedPlayers.findIndex(p => p.isDealer);
    const smallBlindIndex = (dealerIndex + 1) % 6;
    const bigBlindIndex = (dealerIndex + 2) % 6;
    
    updatedPlayers[smallBlindIndex].chips -= 5;
    updatedPlayers[smallBlindIndex].currentBet = 5;
    updatedPlayers[smallBlindIndex].hasActed = true;
    updatedPlayers[bigBlindIndex].chips -= 10;
    updatedPlayers[bigBlindIndex].currentBet = 10;
    updatedPlayers[bigBlindIndex].hasActed = true;

    // First to act is after big blind
    const firstPlayerIndex = (dealerIndex + 3) % 6;
    updatedPlayers[firstPlayerIndex].isActive = true;

    setPlayers(updatedPlayers);
    setCommunityCards([]);
    setPot(15); // Small + big blind
    setCurrentBet(10);
    setGamePhase('preflop');
    setActivePlayerIndex(firstPlayerIndex);
  };

  const createDeck = (): Card[] => {
    const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];

    for (const suit of suits) {
      for (let i = 0; i < ranks.length; i++) {
        deck.push({suit, rank: ranks[i], value: i + 2});
      }
    }

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  };

  const handleFold = () => {
    if (isSpectating) return;
    if (isMultiplayer) {
      socketService.sendPokerAction(tableIdRef.current!, 'fold');
      return;
    }
    lastPlayerActionRef.current = { action: 'fold', amount: 0 };
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex].folded = true;
    updatedPlayers[playerIndex].isActive = false;
    updatedPlayers[playerIndex].hasActed = true;
    updatedPlayers[playerIndex].cards = []; // Clear cards on fold
    setPlayers(updatedPlayers);
    moveToNextPlayer(updatedPlayers);
  };

  const handleCall = () => {
    if (isSpectating) return;
    if (isMultiplayer) {
      socketService.sendPokerAction(tableIdRef.current!, 'call');
      return;
    }
    const player = players[playerIndex];
    const callAmount = currentBet - player.currentBet;
    
    if (player.chips < callAmount) {
      BisetkaAlert.warning('Not enough chips', 'You don\'t have enough chips for this action.');
      return;
    }

    lastPlayerActionRef.current = { action: 'call', amount: callAmount };
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex].chips -= callAmount;
    updatedPlayers[playerIndex].currentBet = currentBet;
    updatedPlayers[playerIndex].isActive = false;
    updatedPlayers[playerIndex].hasActed = true;
    
    setPlayers(updatedPlayers);
    setPot(pot + callAmount);
    moveToNextPlayer(updatedPlayers);
  };

  const handleRaise = () => {
    if (isSpectating) return;
    if (isMultiplayer) {
      socketService.sendPokerAction(tableIdRef.current!, 'raise', currentBet + 20);
      return;
    }
    const raiseAmount = currentBet + 20; // Simple raise by 20
    const player = players[playerIndex];
    const totalAmount = raiseAmount - player.currentBet;
    
    if (player.chips < totalAmount) {
      BisetkaAlert.warning('Not enough chips', 'You don\'t have enough chips for this action.');
      return;
    }

    lastPlayerActionRef.current = { action: 'raise', amount: totalAmount };
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex].chips -= totalAmount;
    updatedPlayers[playerIndex].currentBet = raiseAmount;
    updatedPlayers[playerIndex].isActive = false;
    updatedPlayers[playerIndex].hasActed = true;
    
    // Reset hasActed for all other players since there's a new bet to match
    for (let i = 0; i < updatedPlayers.length; i++) {
      if (i !== playerIndex && !updatedPlayers[i].folded) {
        updatedPlayers[i].hasActed = false;
      }
    }
    
    setPlayers(updatedPlayers);
    setPot(pot + totalAmount);
    setCurrentBet(raiseAmount);
    moveToNextPlayer(updatedPlayers);
  };

  const handleCheck = () => {
    if (isSpectating) return;
    if (isMultiplayer) {
      socketService.sendPokerAction(tableIdRef.current!, 'check');
      return;
    }
    if (players[playerIndex].currentBet < currentBet) {
      BisetkaAlert.warning('Cannot check', 'You must call or raise');
      return;
    }

    lastPlayerActionRef.current = { action: 'check', amount: 0 };
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex].isActive = false;
    updatedPlayers[playerIndex].hasActed = true;
    setPlayers(updatedPlayers);
    moveToNextPlayer(updatedPlayers);
  };

  const handleSaveRoomName = async (newName: string) => {
    try {
      setRoomName(newName);
      if (tableIdRef.current) {
        socketService.setRoomName(tableIdRef.current, newName);
      }
      BisetkaAlert.success('Success', 'Room name updated!');
    } catch (error) {
      console.error('Failed to update room name:', error);
      BisetkaAlert.error('Error', 'Failed to update room name');
    }
  };

  // Room name listener — registered after socket connects (inside mp setup)

  const moveToNextPlayer = (currentPlayers: Player[]) => {
    // Find next active player who hasn't folded
    let nextIndex = (activePlayerIndex + 1) % 6;
    let attempts = 0;
    
    while (currentPlayers[nextIndex].folded && attempts < 8) {
      nextIndex = (nextIndex + 1) % 6;
      attempts++;
    }

    console.log('Move to next player:', {
      nextIndex,
      activePlayerIndex,
      foldedPlayers: currentPlayers.filter(p => p.folded).length,
    });

    // Check if betting round is complete - all active players have acted and matched the current bet
    const activePlayers = currentPlayers.filter(p => !p.folded);
    const allPlayersActed = activePlayers.every(p => p.hasActed);
    const allBetsEqual = activePlayers.every(p => p.currentBet === currentBet);
    
    console.log('Betting round check:', {
      activePlayers: activePlayers.length,
      allPlayersActed,
      allBetsEqual,
      currentBet,
    });
    
    // If only one player left, they win immediately
    if (activePlayers.length === 1) {
      console.log('Only one player remaining - awarding pot');
      const winner = activePlayers[0];
      const updatedPlayers = [...currentPlayers];
      const winnerIndex = updatedPlayers.findIndex(p => p.id === winner.id);
      updatedPlayers[winnerIndex].chips += pot;
      setPlayers(updatedPlayers);
      
      // Log AI poker hand data
      if (aiActionsThisRoundRef.current.length > 0) {
        (aiMoveLogService.logPokerMove as (data: any) => any)({
          gameId: pokerGameIdRef.current,
          handNumber: handNumberRef.current,
          phase: gamePhase,
          playerAction: (lastPlayerActionRef.current?.action as any) ?? undefined,
          aiActions: aiActionsThisRoundRef.current,
          communityCards: communityCards,
          potSize: pot,
          winnerInfo: {
            playerId: winner.id,
            playerName: winner.name,
            isAI: winner.id !== playerIndex,
            winAmount: pot,
          },
        }).catch((err: unknown) => console.warn('Failed to log poker hand:', err));
      }
      
      // Show winner notification for everyone with confetti
      const winnerMessage = winner.id === playerIndex 
        ? `🎉 You won $${pot}!` 
        : `${winner.name} wins $${pot}!`;
      setWinSnackbar({visible: true, message: winnerMessage});
      setShowConfetti(true);
      
      // Auto-dismiss and start next hand after 2 seconds
      setTimeout(() => {
        setWinSnackbar({visible: false, message: ''});
        setShowConfetti(false);
        setPot(0);
        startNewHand(updatedPlayers);
      }, 2000);
      return;
    }
    
    if (allPlayersActed && allBetsEqual) {
      console.log('Advancing to next phase');
      advanceGamePhase(currentPlayers);
    } else {
      const updatedPlayers = [...currentPlayers];
      updatedPlayers[nextIndex].isActive = true;
      setActivePlayerIndex(nextIndex);
      setPlayers(updatedPlayers);
      
      console.log('Next player active:', nextIndex, updatedPlayers[nextIndex].name);
      
      // Trigger AI move for next player if AI
      if (nextIndex !== playerIndex && !isMultiplayer) {
        // Fast AI moves like multiplayer server (300-800ms)
        const aiDelay = 300 + Math.random() * 500;
        setTimeout(() => {
          simulateAIMove(nextIndex);
        }, aiDelay);
      }
    }
  };

  const simulateAIMove = (aiPlayerIndex: number) => {
    // Use refs to get current state values and avoid stale closures
    const currentPlayers = playersRef.current;
    const betAmount = currentBetRef.current;
    
    const aiPlayer = currentPlayers[aiPlayerIndex];
    if (!aiPlayer || aiPlayer.folded || !aiPlayer.isActive) {
      return;
    }
    
    const random = Math.random();
    const updatedPlayers = [...currentPlayers];
    let newCurrentBet = betAmount;
    let potIncrease = 0;
    let aiAction: { playerId: number; action: string; amount?: number };
    
    // Realistic poker AI behavior like human players:
    // 30% fold, 60% call/check, 10% raise
    if (random < 0.30) {
      // Fold (30% chance) - like normal poker players
      updatedPlayers[aiPlayerIndex].folded = true;
      updatedPlayers[aiPlayerIndex].hasActed = true;
      aiAction = { playerId: aiPlayerIndex, action: 'fold' };
    } else if (random < 0.90) {
      // Call/Check (60% chance)
      const callAmount = betAmount - aiPlayer.currentBet;
      updatedPlayers[aiPlayerIndex].chips -= callAmount;
      updatedPlayers[aiPlayerIndex].currentBet = betAmount;
      updatedPlayers[aiPlayerIndex].hasActed = true;
      potIncrease = callAmount;
      aiAction = { playerId: aiPlayerIndex, action: callAmount === 0 ? 'check' : 'call', amount: callAmount };
    } else {
      // Raise (10% chance)
      const raiseAmount = betAmount + 20;
      const totalAmount = raiseAmount - aiPlayer.currentBet;
      updatedPlayers[aiPlayerIndex].chips -= totalAmount;
      updatedPlayers[aiPlayerIndex].currentBet = raiseAmount;
      updatedPlayers[aiPlayerIndex].hasActed = true;
      newCurrentBet = raiseAmount;
      potIncrease = totalAmount;
      aiAction = { playerId: aiPlayerIndex, action: 'raise', amount: totalAmount };
      
      // Reset hasActed for all other players
      for (let i = 0; i < updatedPlayers.length; i++) {
        if (i !== aiPlayerIndex && !updatedPlayers[i].folded) {
          updatedPlayers[i].hasActed = false;
        }
      }
    }
    
    // Track AI action for logging
    aiActionsThisRoundRef.current.push(aiAction);
    
    updatedPlayers[aiPlayerIndex].isActive = false;
    
    // Update all state at once
    setPlayers(updatedPlayers);
    if (potIncrease > 0) {
      setPot(prev => prev + potIncrease);
    }
    if (newCurrentBet !== betAmount) {
      setCurrentBet(newCurrentBet);
    }
    
    // Move to next player immediately in single-player (state updates are synchronous)
    if (isMultiplayer) {
      setTimeout(() => moveToNextPlayer(updatedPlayers), 500);
    } else {
      moveToNextPlayer(updatedPlayers);
    }
  };

  const advanceGamePhase = (currentPlayers: Player[]) => {
    const deck = createDeck();
    const updatedPlayers = currentPlayers.map(p => ({...p, currentBet: 0, isActive: false, hasActed: false}));
    
    switch (gamePhase) {
      case 'preflop':
        // Deal flop (3 cards)
        setCommunityCards([deck.pop()!, deck.pop()!, deck.pop()!]);
        setGamePhase('flop');
        break;
      case 'flop':
        // Deal turn (1 card)
        setCommunityCards(prev => [...prev, deck.pop()!]);
        setGamePhase('turn');
        break;
      case 'turn':
        // Deal river (1 card)
        setCommunityCards(prev => [...prev, deck.pop()!]);
        setGamePhase('river');
        break;
      case 'river':
        // Showdown
        determineWinner(currentPlayers);
        setGamePhase('showdown');
        setTimeout(() => {
          startNewHand(currentPlayers);
        }, 3000);
        return;
    }

    // Reset for next betting round
    setCurrentBet(0);
    const dealerIndex = updatedPlayers.findIndex(p => p.isDealer);
    const firstPlayerIndex = (dealerIndex + 1) % 6;
    
    // Find first active player who hasn't folded
    let activeIdx = firstPlayerIndex;
    let attempts = 0;
    while (updatedPlayers[activeIdx].folded && attempts < 8) {
      activeIdx = (activeIdx + 1) % 6;
      attempts++;
    }
    
    updatedPlayers[activeIdx].isActive = true;
    setActivePlayerIndex(activeIdx);
    setPlayers(updatedPlayers);
    
    // Trigger AI move if needed (useEffect hook will handle this with proper timing)
  };

  const determineWinner = (currentPlayers: Player[]) => {
    const activePlayers = currentPlayers.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      
      // Log AI poker hand data at showdown
      if (aiActionsThisRoundRef.current.length > 0) {
        (aiMoveLogService.logPokerMove as (data: any) => any)({
          gameId: pokerGameIdRef.current,
          handNumber: handNumberRef.current,
          phase: 'showdown',
          playerAction: (lastPlayerActionRef.current?.action as any) ?? undefined,
          aiActions: aiActionsThisRoundRef.current,
          communityCards: communityCards,
          potSize: pot,
          winnerInfo: {
            playerId: winner.id,
            playerName: winner.name,
            isAI: winner.id !== playerIndex,
            winAmount: pot,
          },
        }).catch((err: unknown) => console.warn('Failed to log poker hand:', err));
      }
      
      // Show winner notification for everyone with confetti
      const winnerMessage = winner.id === playerIndex 
        ? `🎉 You won ${pot} chips!` 
        : `${winner.name} wins ${pot} chips!`;
      setWinSnackbar({visible: true, message: winnerMessage});
      setShowConfetti(true);
      
      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        setWinSnackbar({visible: false, message: ''});
        setShowConfetti(false);
      }, 2000);
      
      const updatedPlayers = [...currentPlayers];
      const winnerIndex = updatedPlayers.findIndex(p => p.id === winner.id);
      updatedPlayers[winnerIndex].chips += pot;
      setPlayers(updatedPlayers);
      setPot(0);
    } else if (activePlayers.length > 1) {
      // Multiple players at showdown - pick random winner for now (should implement proper hand evaluation)
      const randomWinner = activePlayers[Math.floor(Math.random() * activePlayers.length)];
      
      // Log AI poker hand data at showdown
      if (aiActionsThisRoundRef.current.length > 0) {
        (aiMoveLogService.logPokerMove as (data: any) => any)({
          gameId: pokerGameIdRef.current,
          handNumber: handNumberRef.current,
          phase: 'showdown',
          playerAction: (lastPlayerActionRef.current?.action as any) ?? undefined,
          aiActions: aiActionsThisRoundRef.current,
          communityCards: communityCards,
          potSize: pot,
          winnerInfo: {
            playerId: randomWinner.id,
            playerName: randomWinner.name,
            isAI: randomWinner.id !== playerIndex,
            winAmount: pot,
          },
        }).catch((err: unknown) => console.warn('Failed to log poker hand:', err));
      }
      
      // Show winner notification for everyone with confetti
      const winnerMessage = randomWinner.id === playerIndex 
        ? `🎉 You won ${pot} chips at showdown!` 
        : `${randomWinner.name} wins ${pot} chips at showdown!`;
      setWinSnackbar({visible: true, message: winnerMessage});
      setShowConfetti(true);
      
      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        setWinSnackbar({visible: false, message: ''});
        setShowConfetti(false);
      }, 2000);
      
      const updatedPlayers = [...currentPlayers];
      const winnerIndex = updatedPlayers.findIndex(p => p.id === randomWinner.id);
      updatedPlayers[winnerIndex].chips += pot;
      setPlayers(updatedPlayers);
      setPot(0);
    }
  };

  // Simple confetti animation component
  const ConfettiPiece = ({ delay }: { delay: number }) => {
    const animValue = useRef(new Animated.Value(0)).current;
    const leftPosition = useRef(Math.random() * 100).current;

    useEffect(() => {
      Animated.timing(animValue, {
        toValue: 1,
        duration: 2000,
        delay,
        useNativeDriver: true,
      }).start();
    }, [animValue, delay]);

    const translateY = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [-50, 800],
    });

    const rotate = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const confettiEmojis = ['🎉', '🎊', '✨', '💫', '⭐', '🌟'];
    const emoji = confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)];

    return (
      <Animated.Text
        style={{
          position: 'absolute',
          left: `${leftPosition}%`,
          top: 0,
          fontSize: 24,
          transform: [{ translateY }, { rotate }],
        }}
      >
        {emoji}
      </Animated.Text>
    );
  };

  const renderCard = (card: Card, hidden = false) => {
    if (hidden) {
      return (
        <View style={[styles.card, styles.cardHidden]}>
          <Text style={styles.cardText}>🂠</Text>
        </View>
      );
    }

    const suitSymbols = {
      hearts: '♥️',
      diamonds: '♦️',
      clubs: '♣️',
      spades: '♠️',
    };

    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

    return (
      <View style={[styles.card, isRed ? styles.cardRed : styles.cardBlack]}>
        <Text style={styles.cardRank}>{card.rank}</Text>
        <Text style={styles.cardSuit}>{suitSymbols[card.suit]}</Text>
      </View>
    );
  };

  const renderPlayer = (player: Player, position: number) => {
    const myIdx = isMultiplayer ? mySeatRef.current : playerIndex;
    const isCurrentPlayer = !isSpectating && player.id === myIdx;
    const showCards = isCurrentPlayer || gamePhase === 'showdown';
    
    const positionStyle = position === 0 ? styles.position0 :
                         position === 1 ? styles.position1 :
                         position === 2 ? styles.position2 :
                         position === 3 ? styles.position3 :
                         position === 4 ? styles.position4 :
                         styles.position5;

    return (
      <View key={`player-${player.id}-${position}`} style={[styles.playerContainer, positionStyle]}>
        {player.isDealer && (
          <View style={styles.dealerChip}>
            <Text style={styles.dealerChipText}>D</Text>
          </View>
        )}
        <View style={[styles.playerInfo, player.isActive && styles.activePlayer, player.folded && styles.foldedPlayer]}>
          <Text style={styles.playerName}>
            {isCurrentPlayer ? 'You' : player.name}
          </Text>
          <Text style={styles.playerChips}>${player.chips}</Text>
          {player.currentBet > 0 && (
            <Text style={styles.playerBet}>Bet: ${player.currentBet}</Text>
          )}
          {player.isActive && gamePhase !== 'waiting' && gamePhase !== 'showdown' && (isCurrentPlayer || isMultiplayer) && (
            <PlayerTurnTimer
              key={`turn-${activePlayerIndex}-${player.id}`}
              onExpire={() => {
                if (isCurrentPlayer) {
                  handleFold();
                } else if (!isMultiplayer) {
                  simulateAIMove(player.id);
                }
              }}
            />
          )}
        </View>
        {!player.folded && (
          <View style={styles.playerCards}>
            {player.cards.map((card, idx) => (
              <View key={idx}>{renderCard(card, !showCards)}</View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ImageBackground
      source={require('../../../../assets/blot/park-background.png')}
      style={styles.container}
      resizeMode="cover">
      <SafeAreaView style={styles.safeArea}>

      {/* ── Connecting / Waiting Room Overlay ── */}
      {(isConnecting || waitingRoom) && (
        <View style={styles.waitingOverlay}>
          {isConnecting && !waitingRoom ? (
            <>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.waitingTitle}>
                {isPrivateCreate ? 'Creating private table…' : isPrivateJoin ? 'Joining private table…' : 'Finding a table…'}
              </Text>
            </>
          ) : waitingRoom ? (
            <>
              <Text style={styles.waitingTitle}>♠️ Texas Hold'em</Text>

              {/* Private room code */}
              {privateRoomCode ? (
                <View style={styles.privateCodeBlock}>
                  <Text style={styles.privateCodeLabel}>PRIVATE ROOM CODE</Text>
                  <Text style={styles.privateCodeValue}>{privateRoomCode}</Text>
                  <TouchableOpacity
                    style={styles.copyCodeBtn}
                    onPress={() => {
                      Clipboard.setString(privateRoomCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    }}>
                    <Text style={styles.copyCodeBtnText}>{codeCopied ? '✓ Copied!' : 'Copy Code'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.privateCodeHint}>Share this code with friends to join</Text>
                </View>
              ) : null}

              {/* Seats */}
              <View style={styles.waitingSeats}>
                {waitingRoom.seats.map((seat, idx) => (
                  <View key={idx} style={[styles.waitingSeat, seat ? styles.waitingSeatFilled : styles.waitingSeatEmpty]}>
                    <Text style={styles.waitingSeatText}>{seat ? seat.displayName : `Seat ${idx + 1}`}</Text>
                    {!seat && <Text style={styles.waitingSeatSub}>Waiting…</Text>}
                  </View>
                ))}
              </View>

              {/* Countdown vs player count */}
              {privateRoomCode ? (
                <Text style={styles.waitingSubtitle}>{privateHumanCount} / 6 players joined</Text>
              ) : (
                <>
                  <Text style={styles.waitingCountdown}>{waitingRoom.countdown}s</Text>
                  <Text style={styles.waitingInfo}>
                    {waitingRoom.humanCount} / 6 players found — empty seats will be filled by AI
                  </Text>
                </>
              )}

              {isPrivateJoin && !isPrivateHost && !!privateRoomCode && (
                <Text style={styles.waitingInfo}>Waiting for host to start the game…</Text>
              )}

              {isPrivateHost && (
                <TouchableOpacity
                  style={[styles.startPrivateBtn, privateHumanCount < 2 && styles.startPrivateBtnDisabled]}
                  disabled={privateHumanCount < 2}
                  onPress={() => {
                    if (tableIdRef.current) socketService.startPokerPrivateRoom(tableIdRef.current, userId);
                  }}>
                  <Text style={styles.startPrivateBtnText}>
                    {privateHumanCount < 2 ? 'Waiting for players…' : 'Start Game'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : null}
        </View>
      )}
      {editingRoomName ? (
        <View style={styles.inlineNameEditor}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.inlineBackBtn}>
            <Text style={styles.inlineBackText}>← Back</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.inlineNameInput}
            value={draftRoomName}
            onChangeText={setDraftRoomName}
            autoFocus
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (draftRoomName.trim()) handleSaveRoomName(draftRoomName.trim());
              setEditingRoomName(false);
            }}
            selectTextOnFocus
            placeholderTextColor="rgba(255,255,255,0.4)"
            placeholder="Room name…"
          />
          <TouchableOpacity
            onPress={() => setEditingRoomName(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.inlineNameBtn}>
            <Text style={styles.inlineNameCancel}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (draftRoomName.trim()) handleSaveRoomName(draftRoomName.trim());
              setEditingRoomName(false);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.inlineNameBtn}>
            <Text style={styles.inlineNameSave}>✓</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <GameToolbar
          title={roomName}
          onBack={() => navigation.goBack()}
          backgroundColor="transparent"
          rightElement={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <RoomInfoDrawer roomId={tableId} />
              <Text style={styles.potAmount}>Pot: ${pot}</Text>
              <TouchableOpacity
                onPress={() => { setDraftRoomName(roomName); setEditingRoomName(true); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.editRoomButton}>
                <Text style={styles.editRoomIcon}>✏️</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <View style={styles.tableContainer}>
        <ImageBackground
          source={require('../../../../assets/poker/table.png')}
          style={styles.pokerTable}
          resizeMode="contain"
        >
          {/* Community cards in center */}
          <View style={styles.communityCardsContainer}>
            <Text style={styles.communityTitle}>Community Cards</Text>
            <View style={styles.communityCards}>
              {communityCards.map((card, idx) => (
                <View key={idx}>{renderCard(card)}</View>
              ))}
            </View>
          </View>
        </ImageBackground>

        {/* Player overlays rendered OUTSIDE ImageBackground so they don't cause it to re-render */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {isSpectating
            ? players
                .map((player, seatIdx) => ({ player, seatIdx }))
                .filter(({ player }) => player != null)
                .map(({ player, seatIdx }) => renderPlayer(player, seatIdx))
            : players
                .map((player, seatIdx) => ({ player, seatIdx }))
                .filter(({ player, seatIdx }) => seatIdx !== myPlayerIndex && player != null)
                .map(({ player, seatIdx }, idx) => renderPlayer(player, idx + 1))}
        </View>
      </View>

      {/* Current player (you) at bottom */}
      <View style={styles.currentPlayerArea}>
        {isSpectating ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ color: '#FFD700', fontSize: 18, fontWeight: 'bold' }}>👁️ Watching Game</Text>
            <Text style={{ color: '#ccc', fontSize: 13, marginTop: 4 }}>You are spectating this match</Text>
          </View>
        ) : (
          <>
            {players[myPlayerIndex] && renderPlayer(players[myPlayerIndex]!, 0)}
            
            {players[myPlayerIndex] && players[myPlayerIndex]!.isActive && !players[myPlayerIndex]!.folded && (
              <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.button, styles.foldButton]} onPress={handleFold}>
                  <Text style={styles.buttonText}>Fold</Text>
                </TouchableOpacity>
                
                {players[myPlayerIndex]!.currentBet === currentBet ? (
                  <TouchableOpacity style={[styles.button, styles.checkButton]} onPress={handleCheck}>
                    <Text style={styles.buttonText}>Check</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.button, styles.callButton]} onPress={handleCall}>
                    <Text style={styles.buttonText}>Call ${currentBet - players[myPlayerIndex]!.currentBet}</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={[styles.button, styles.raiseButton]} onPress={handleRaise}>
                  <Text style={styles.buttonText}>Raise</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      <Snackbar
        visible={winSnackbar.visible}
        onDismiss={() => setWinSnackbar({visible: false, message: ''})}
        duration={2000}
        style={styles.winSnackbar}
        action={{
          label: 'Nice!',
          onPress: () => setWinSnackbar({visible: false, message: ''}),
          labelStyle: {color: '#FFD700'},
        }}>
        <Text style={styles.winSnackbarText}>{winSnackbar.message}</Text>
      </Snackbar>

      {/* Confetti animation */}
      {showConfetti && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 20 }).map((_, i) => (
            <ConfettiPiece key={i} delay={i * 100} />
          ))}
        </View>
      )}

    </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
  },
  winSnackbar: {
    backgroundColor: '#1a472a',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
    marginBottom: 10,
    marginHorizontal: 12,
  },
  winSnackbarText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Waiting room overlay
  waitingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  waitingTitle: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  waitingSubtitle: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 4,
  },
  waitingCountdown: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    marginVertical: 12,
  },
  waitingSeats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  waitingSeat: {
    width: 100,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    margin: 4,
  },
  waitingSeatFilled: {
    backgroundColor: '#1a5c3e',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  waitingSeatEmpty: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: '#555',
  },
  waitingSeatText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
  waitingSeatSub: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 2,
  },
  waitingInfo: {
    color: '#aaa',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  privateCodeBlock: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    width: '85%',
  },
  privateCodeLabel: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  privateCodeValue: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
    letterSpacing: 10,
    marginBottom: 10,
  },
  copyCodeBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 8,
  },
  copyCodeBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  privateCodeHint: {
    color: '#aaa',
    fontSize: 12,
  },
  startPrivateBtn: {
    marginTop: 20,
    backgroundColor: '#27ae60',
    borderRadius: 10,
    paddingHorizontal: 36,
    paddingVertical: 14,
  },
  startPrivateBtnDisabled: {
    backgroundColor: '#555',
  },
  startPrivateBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  header: {
    padding: 15,
    backgroundColor: '#094029',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  potAmount: {
    color: '#ffd700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tableContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  pokerTable: {
    width: '100%',
    maxWidth: 600,
    aspectRatio: 1024 / 1536,
    alignSelf: 'center',
  },
  playerContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  dealerChip: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  dealerChipText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  position0: {
    bottom: '8%',
    alignSelf: 'center',
  },
  position1: {
    bottom: '28%',
    right: '2%',
  },
  position2: {
    top: '25%',
    right: '2%',
  },
  position3: {
    top: '0%',
    alignSelf: 'center',
  },
  position4: {
    top: '25%',
    left: '2%',
  },
  position5: {
    bottom: '28%',
    left: '2%',
  },
  playerInfo: {
    backgroundColor: '#1a5c3e',
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2a7c4e',
    minWidth: 100,
  },
  activePlayer: {
    borderColor: '#ffd700',
    borderWidth: 3,
    backgroundColor: '#2a7c4e',
  },
  foldedPlayer: {
    opacity: 0.5,
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  playerChips: {
    color: '#90ee90',
    fontSize: 12,
    textAlign: 'center',
  },
  playerBet: {
    color: '#ffd700',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  playerCards: {
    flexDirection: 'row',
    marginTop: 5,
    gap: 3,
  },
  communityCardsContainer: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  communityTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  communityCards: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    width: 40,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHidden: {
    backgroundColor: '#1e40af',
  },
  cardRed: {
    borderColor: '#dc2626',
    borderWidth: 1,
  },
  cardBlack: {
    borderColor: '#000',
    borderWidth: 1,
  },
  cardRank: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardSuit: {
    fontSize: 20,
  },
  cardText: {
    fontSize: 24,
    color: '#fff',
  },
  currentPlayerArea: {
    padding: 15,
    backgroundColor: 'rgba(9, 64, 41, 0.8)',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  foldButton: {
    backgroundColor: '#dc2626',
  },
  checkButton: {
    backgroundColor: '#2563eb',
  },
  callButton: {
    backgroundColor: '#059669',
  },
  raiseButton: {
    backgroundColor: '#d97706',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editRoomButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editRoomIcon: {
    fontSize: 18,
  },
  inlineNameEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.3)',
    gap: 8,
  },
  inlineBackBtn: {
    minWidth: 60,
  },
  inlineBackText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  inlineNameInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFD700',
    borderBottomWidth: 1.5,
    borderBottomColor: '#FFD700',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  inlineNameBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  inlineNameCancel: {
    fontSize: 16,
    color: '#f87171',
    fontWeight: '700',
  },
  inlineNameSave: {
    fontSize: 18,
    color: '#4ade80',
    fontWeight: '700',
  },
});

export default PokerRoomScreen;
