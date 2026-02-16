import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import { aiMoveLogService } from '../services/aiMoveLog.service';
import { v4 as uuidv4 } from 'uuid';

type Props = NativeStackScreenProps<RootStackParamList, 'PokerRoom'>;

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

const TURN_TIME_LIMIT = 30; // 30 seconds per turn

const PokerRoomScreen: React.FC<Props> = ({route, navigation}) => {
  const {session, gameType, mode} = route.params;
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [playerIndex] = useState(0); // Current user is player 0
  const [timeRemaining, setTimeRemaining] = useState(TURN_TIME_LIMIT);
  const [timerActive, setTimerActive] = useState(false);
  const lastResetTimeRef = useRef(0);
  const lastActivePlayerRef = useRef(-1);
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

  useEffect(() => {
    initializeGame();
  }, []);

  // Timer effect
  useEffect(() => {
    if (!timerActive) return;

    const timerId = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - auto fold
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [timerActive]);

  // Reset timer when active player changes
  useEffect(() => {
    if (gamePhase === 'waiting' || gamePhase === 'showdown') return;
    if (players.length === 0) return;
    
    // Only reset if active player actually changed
    if (lastActivePlayerRef.current === activePlayerIndex) {
      return;
    }
    
    const activePlayer = players[activePlayerIndex];
    if (!activePlayer || activePlayer.folded) return;
    
    console.log('Active player changed to:', activePlayerIndex, activePlayer.name);
    lastActivePlayerRef.current = activePlayerIndex;
    aiMoveTriggeredRef.current = false;
    
    // Reset timer
    setTimerActive(false);
    setTimeRemaining(TURN_TIME_LIMIT);
    setTimeout(() => {
      setTimerActive(true);
    }, 50);
    
    // Trigger AI move if not human player - simulateAIMove now uses refs to avoid stale closures
    if (activePlayerIndex !== playerIndex && !aiMoveTriggeredRef.current) {
      aiMoveTriggeredRef.current = true;
      const aiIdx = activePlayerIndex; // Capture the index
      const timer = setTimeout(() => {
        simulateAIMove(aiIdx);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activePlayerIndex, gamePhase, players.length]);

  const handleTimeExpired = () => {
    console.log('Time expired for player', activePlayerIndex);
    setTimerActive(false);
    
    if (activePlayerIndex === playerIndex) {
      // Auto-fold the human player
      handleFold();
    } else {
      // Force AI to act
      simulateAIMove(activePlayerIndex);
    }
  };

  const resetTimer = () => {
    const now = Date.now();
    // Prevent resetting timer if it was reset less than 500ms ago
    if (now - lastResetTimeRef.current < 500) {
      console.log('Prevented rapid timer reset');
      return;
    }
    lastResetTimeRef.current = now;
    
    // Stop timer first, then restart on next tick
    setTimerActive(false);
    setTimeRemaining(TURN_TIME_LIMIT);
    
    // Use setTimeout to ensure the timer stops before restarting
    setTimeout(() => {
      setTimerActive(true);
    }, 50);
  };

  const initializeGame = () => {
    // Initialize 8 players
    const initialPlayers: Player[] = Array.from({length: 8}, (_, i) => ({
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
    const nextDealerIndex = (currentDealerIndex + 1) % 8;
    
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
    const smallBlindIndex = (dealerIndex + 1) % 8;
    const bigBlindIndex = (dealerIndex + 2) % 8;
    
    updatedPlayers[smallBlindIndex].chips -= 5;
    updatedPlayers[smallBlindIndex].currentBet = 5;
    updatedPlayers[smallBlindIndex].hasActed = true;
    updatedPlayers[bigBlindIndex].chips -= 10;
    updatedPlayers[bigBlindIndex].currentBet = 10;
    updatedPlayers[bigBlindIndex].hasActed = true;

    // First to act is after big blind
    const firstPlayerIndex = (dealerIndex + 3) % 8;
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
    setTimerActive(false);
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
    setTimerActive(false);
    const player = players[playerIndex];
    const callAmount = currentBet - player.currentBet;
    
    if (player.chips < callAmount) {
      Alert.alert('Not enough chips');
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
    setTimerActive(false);
    const raiseAmount = currentBet + 20; // Simple raise by 20
    const player = players[playerIndex];
    const totalAmount = raiseAmount - player.currentBet;
    
    if (player.chips < totalAmount) {
      Alert.alert('Not enough chips');
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
    setTimerActive(false);
    if (players[playerIndex].currentBet < currentBet) {
      Alert.alert('Cannot check', 'You must call or raise');
      return;
    }

    lastPlayerActionRef.current = { action: 'check', amount: 0 };
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex].isActive = false;
    updatedPlayers[playerIndex].hasActed = true;
    setPlayers(updatedPlayers);
    moveToNextPlayer(updatedPlayers);
  };

  const moveToNextPlayer = (currentPlayers: Player[]) => {
    // Find next active player who hasn't folded
    let nextIndex = (activePlayerIndex + 1) % 8;
    let attempts = 0;
    
    while (currentPlayers[nextIndex].folded && attempts < 8) {
      nextIndex = (nextIndex + 1) % 8;
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
      setTimerActive(false);
      const winner = activePlayers[0];
      const updatedPlayers = [...currentPlayers];
      const winnerIndex = updatedPlayers.findIndex(p => p.id === winner.id);
      updatedPlayers[winnerIndex].chips += pot;
      setPlayers(updatedPlayers);
      
      // Log AI poker hand data
      if (aiActionsThisRoundRef.current.length > 0) {
        aiMoveLogService.logPokerMove({
          gameId: pokerGameIdRef.current,
          handNumber: handNumberRef.current,
          phase: gamePhase,
          playerAction: lastPlayerActionRef.current || undefined,
          aiActions: aiActionsThisRoundRef.current,
          communityCards: communityCards,
          potSize: pot,
          winnerInfo: {
            playerId: winner.id,
            playerName: winner.name,
            isAI: winner.id !== playerIndex,
            winAmount: pot,
          },
        }).catch(err => console.warn('Failed to log poker hand:', err));
      }
      
      Alert.alert('Winner!', `${winner.name} wins $${pot}!`, [
        {
          text: 'Next Hand',
          onPress: () => {
            setPot(0);
            startNewHand(updatedPlayers);
          }
        }
      ]);
      return;
    }
    
    if (allPlayersActed && allBetsEqual) {
      console.log('Advancing to next phase');
      setTimerActive(false);
      advanceGamePhase(currentPlayers);
    } else {
      const updatedPlayers = [...currentPlayers];
      updatedPlayers[nextIndex].isActive = true;
      setActivePlayerIndex(nextIndex);
      setPlayers(updatedPlayers);
      
      console.log('Next player active:', nextIndex, updatedPlayers[nextIndex].name);
      
      // Reset and start timer for next player
      resetTimer();
      
      // Simulate AI moves for other players
      if (nextIndex !== playerIndex) {
        setTimeout(() => {
          console.log('Triggering AI move for player', nextIndex);
          simulateAIMove(nextIndex);
        }, 1000);
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
    
    // AI is less likely to fold - only 8% chance
    // More conservative play to reach showdown more often
    if (random < 0.08) {
      // Fold (8% chance)
      updatedPlayers[aiPlayerIndex].folded = true;
      updatedPlayers[aiPlayerIndex].hasActed = true;
      updatedPlayers[aiPlayerIndex].cards = []; // Clear cards on fold
      aiAction = { playerId: aiPlayerIndex, action: 'fold' };
    } else if (random < 0.75) {
      // Call (67% chance)
      const callAmount = betAmount - aiPlayer.currentBet;
      updatedPlayers[aiPlayerIndex].chips -= callAmount;
      updatedPlayers[aiPlayerIndex].currentBet = betAmount;
      updatedPlayers[aiPlayerIndex].hasActed = true;
      potIncrease = callAmount;
      aiAction = { playerId: aiPlayerIndex, action: 'call', amount: callAmount };
    } else {
      // Raise (25% chance)
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
    
    // Move to next player after a short delay to allow state updates
    setTimeout(() => {
      moveToNextPlayer(updatedPlayers);
    }, 500);
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
    const firstPlayerIndex = (dealerIndex + 1) % 8;
    
    // Find first active player who hasn't folded
    let activeIdx = firstPlayerIndex;
    let attempts = 0;
    while (updatedPlayers[activeIdx].folded && attempts < 8) {
      activeIdx = (activeIdx + 1) % 8;
      attempts++;
    }
    
    updatedPlayers[activeIdx].isActive = true;
    setActivePlayerIndex(activeIdx);
    setPlayers(updatedPlayers);
    
    // Start timer for new betting round
    resetTimer();
    
    if (activeIdx !== playerIndex) {
      setTimeout(() => {
        simulateAIMove(activeIdx);
      }, 1500);
    }
  };

  const determineWinner = (currentPlayers: Player[]) => {
    const activePlayers = currentPlayers.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      
      // Log AI poker hand data at showdown
      if (aiActionsThisRoundRef.current.length > 0) {
        aiMoveLogService.logPokerMove({
          gameId: pokerGameIdRef.current,
          handNumber: handNumberRef.current,
          phase: 'showdown',
          playerAction: lastPlayerActionRef.current || undefined,
          aiActions: aiActionsThisRoundRef.current,
          communityCards: communityCards,
          potSize: pot,
          winnerInfo: {
            playerId: winner.id,
            playerName: winner.name,
            isAI: winner.id !== playerIndex,
            winAmount: pot,
          },
        }).catch(err => console.warn('Failed to log poker hand:', err));
      }
      
      Alert.alert('Winner!', `${winner.name} wins ${pot} chips!`);
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
        aiMoveLogService.logPokerMove({
          gameId: pokerGameIdRef.current,
          handNumber: handNumberRef.current,
          phase: 'showdown',
          playerAction: lastPlayerActionRef.current || undefined,
          aiActions: aiActionsThisRoundRef.current,
          communityCards: communityCards,
          potSize: pot,
          winnerInfo: {
            playerId: randomWinner.id,
            playerName: randomWinner.name,
            isAI: randomWinner.id !== playerIndex,
            winAmount: pot,
          },
        }).catch(err => console.warn('Failed to log poker hand:', err));
      }
      
      Alert.alert('Winner!', `${randomWinner.name} wins ${pot} chips at showdown!`);
      const updatedPlayers = [...currentPlayers];
      const winnerIndex = updatedPlayers.findIndex(p => p.id === randomWinner.id);
      updatedPlayers[winnerIndex].chips += pot;
      setPlayers(updatedPlayers);
      setPot(0);
    }
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
    const isCurrentPlayer = player.id === playerIndex;
    const showCards = isCurrentPlayer || gamePhase === 'showdown';
    
    const positionStyle = position === 0 ? styles.position0 :
                         position === 1 ? styles.position1 :
                         position === 2 ? styles.position2 :
                         position === 3 ? styles.position3 :
                         position === 4 ? styles.position4 :
                         position === 5 ? styles.position5 :
                         position === 6 ? styles.position6 :
                         styles.position7;

    return (
      <View key={player.id} style={[styles.playerContainer, positionStyle]}>
        {player.isDealer && (
          <View style={styles.dealerChip}>
            <Text style={styles.dealerChipText}>D</Text>
          </View>
        )}
        <View style={[styles.playerInfo, player.isActive && styles.activePlayer, player.folded && styles.foldedPlayer]}>
          <Text style={styles.playerName}>
            {player.name}
          </Text>
          <Text style={styles.playerChips}>${player.chips}</Text>
          {player.currentBet > 0 && (
            <Text style={styles.playerBet}>Bet: ${player.currentBet}</Text>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Texas Hold'em - {gamePhase.toUpperCase()}</Text>
          {timerActive && (
            <View style={[styles.timerContainer, timeRemaining <= 10 && styles.timerWarning]}>
              <Text style={styles.timerText}>⏱️ {timeRemaining}s</Text>
            </View>
          )}
        </View>
        <Text style={styles.potAmount}>Pot: ${pot}</Text>
      </View>

      <View style={styles.tableContainer}>
        {/* Render players in positions around the table */}
        {players.slice(1, 8).map((player, idx) => renderPlayer(player, idx + 1))}

        {/* Community cards in center */}
        <View style={styles.communityCardsContainer}>
          <Text style={styles.communityTitle}>Community Cards</Text>
          <View style={styles.communityCards}>
            {communityCards.map((card, idx) => (
              <View key={idx}>{renderCard(card)}</View>
            ))}
          </View>
        </View>
      </View>

      {/* Current player (you) at bottom */}
      <View style={styles.currentPlayerArea}>
        {players[playerIndex] && renderPlayer(players[playerIndex], 0)}
        
        {players[playerIndex] && players[playerIndex].isActive && !players[playerIndex].folded && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.button, styles.foldButton]} onPress={handleFold}>
              <Text style={styles.buttonText}>Fold</Text>
            </TouchableOpacity>
            
            {players[playerIndex].currentBet === currentBet ? (
              <TouchableOpacity style={[styles.button, styles.checkButton]} onPress={handleCheck}>
                <Text style={styles.buttonText}>Check</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.button, styles.callButton]} onPress={handleCall}>
                <Text style={styles.buttonText}>Call ${currentBet - players[playerIndex].currentBet}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={[styles.button, styles.raiseButton]} onPress={handleRaise}>
              <Text style={styles.buttonText}>Raise</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d5e3a',
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
  timerContainer: {
    marginTop: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
  },
  timerWarning: {
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
  },
  timerText: {
    color: '#fff',
    fontSize: 14,
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
    bottom: '5%',
    left: '42%',
  },
  position1: {
    bottom: '20%',
    right: '15%',
  },
  position2: {
    bottom: '40%',
    right: '8%',
  },
  position3: {
    top: '25%',
    right: '15%',
  },
  position4: {
    top: '8%',
    left: '42%',
  },
  position5: {
    top: '25%',
    left: '15%',
  },
  position6: {
    bottom: '40%',
    left: '8%',
  },
  position7: {
    bottom: '20%',
    left: '15%',
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
    borderWidth: 4,
    backgroundColor: '#2a7c4e',
    shadowColor: '#ffd700',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
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
    backgroundColor: '#094029',
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
});

export default PokerRoomScreen;
