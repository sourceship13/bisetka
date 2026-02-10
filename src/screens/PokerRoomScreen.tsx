import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/AppNavigator';

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

const PokerRoomScreen: React.FC<Props> = ({route, navigation}) => {
  const {session, gameType, mode} = route.params;
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [playerIndex] = useState(0); // Current user is player 0

  useEffect(() => {
    initializeGame();
  }, []);

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
    const deck = createDeck();
    
    // Deal 2 cards to each player
    const updatedPlayers = currentPlayers.map((player, index) => ({
      ...player,
      cards: [deck.pop()!, deck.pop()!],
      currentBet: 0,
      folded: false,
      hasActed: false,
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
    
    // Start AI if first player is not human
    if (firstPlayerIndex !== playerIndex) {
      setTimeout(() => {
        simulateAIMove(firstPlayerIndex);
      }, 1500);
    }
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
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex].folded = true;
    updatedPlayers[playerIndex].isActive = false;
    updatedPlayers[playerIndex].hasActed = true;
    setPlayers(updatedPlayers);
    moveToNextPlayer(updatedPlayers);
  };

  const handleCall = () => {
    const player = players[playerIndex];
    const callAmount = currentBet - player.currentBet;
    
    if (player.chips < callAmount) {
      Alert.alert('Not enough chips');
      return;
    }

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
    const raiseAmount = currentBet + 20; // Simple raise by 20
    const player = players[playerIndex];
    const totalAmount = raiseAmount - player.currentBet;
    
    if (player.chips < totalAmount) {
      Alert.alert('Not enough chips');
      return;
    }

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
    if (players[playerIndex].currentBet < currentBet) {
      Alert.alert('Cannot check', 'You must call or raise');
      return;
    }

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
    
    if ((allPlayersActed && allBetsEqual) || activePlayers.length === 1) {
      console.log('Advancing to next phase');
      advanceGamePhase(currentPlayers);
    } else {
      const updatedPlayers = [...currentPlayers];
      updatedPlayers[nextIndex].isActive = true;
      setActivePlayerIndex(nextIndex);
      setPlayers(updatedPlayers);
      
      console.log('Next player active:', nextIndex, updatedPlayers[nextIndex].name);
      
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
    // Get current state values
    const aiPlayer = players[aiPlayerIndex];
    if (!aiPlayer || aiPlayer.folded || !aiPlayer.isActive) {
      return;
    }
    
    const random = Math.random();
    const updatedPlayers = [...players];
    let newCurrentBet = currentBet;
    let potIncrease = 0;
    
    if (random < 0.2) {
      // Fold
      updatedPlayers[aiPlayerIndex].folded = true;
      updatedPlayers[aiPlayerIndex].hasActed = true;
    } else if (random < 0.7) {
      // Call
      const callAmount = currentBet - aiPlayer.currentBet;
      updatedPlayers[aiPlayerIndex].chips -= callAmount;
      updatedPlayers[aiPlayerIndex].currentBet = currentBet;
      updatedPlayers[aiPlayerIndex].hasActed = true;
      potIncrease = callAmount;
    } else {
      // Raise
      const raiseAmount = currentBet + 20;
      const totalAmount = raiseAmount - aiPlayer.currentBet;
      updatedPlayers[aiPlayerIndex].chips -= totalAmount;
      updatedPlayers[aiPlayerIndex].currentBet = raiseAmount;
      updatedPlayers[aiPlayerIndex].hasActed = true;
      newCurrentBet = raiseAmount;
      potIncrease = totalAmount;
      
      // Reset hasActed for all other players
      for (let i = 0; i < updatedPlayers.length; i++) {
        if (i !== aiPlayerIndex && !updatedPlayers[i].folded) {
          updatedPlayers[i].hasActed = false;
        }
      }
    }
    
    updatedPlayers[aiPlayerIndex].isActive = false;
    
    // Update all state at once
    setPlayers(updatedPlayers);
    if (potIncrease > 0) {
      setPot(prev => prev + potIncrease);
    }
    if (newCurrentBet !== currentBet) {
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
      Alert.alert('Winner!', `${winner.name} wins ${pot} chips!`);
      const updatedPlayers = [...currentPlayers];
      const winnerIndex = updatedPlayers.findIndex(p => p.id === winner.id);
      updatedPlayers[winnerIndex].chips += pot;
      setPlayers(updatedPlayers);
      setPot(0);
    } else {
      // Simplified: just give pot to first active player (real implementation would evaluate hands)
      const winner = activePlayers[0];
      Alert.alert('Showdown!', `${winner.name} wins ${pot} chips!`);
      const updatedPlayers = [...currentPlayers];
      const winnerIndex = updatedPlayers.findIndex(p => p.id === winner.id);
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
        <View style={[styles.playerInfo, player.isActive && styles.activePlayer, player.folded && styles.foldedPlayer]}>
          <Text style={styles.playerName}>
            {player.name} {player.isDealer && '🔘'}
          </Text>
          <Text style={styles.playerChips}>${player.chips}</Text>
          {player.currentBet > 0 && (
            <Text style={styles.playerBet}>Bet: ${player.currentBet}</Text>
          )}
        </View>
        <View style={styles.playerCards}>
          {player.cards.map((card, idx) => (
            <View key={idx}>{renderCard(card, !showCards)}</View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Texas Hold'em - {gamePhase.toUpperCase()}</Text>
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
  },
  playerContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  position0: {
    bottom: 20,
  },
  position1: {
    top: 20,
    left: 20,
  },
  position2: {
    top: 20,
    left: '25%',
  },
  position3: {
    top: 20,
    left: '50%',
  },
  position4: {
    top: 20,
    right: '25%',
  },
  position5: {
    top: 20,
    right: 20,
  },
  position6: {
    bottom: 100,
    right: 20,
  },
  position7: {
    bottom: 100,
    left: 20,
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
