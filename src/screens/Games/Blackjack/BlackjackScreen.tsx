import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Image,
  Dimensions,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../libs/hooks/useAuth';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import GameToolbar from '../../../components/global/GameToolbar';
import DynamicCard from '../../../components/DynamicCard';
import CardCustomizationModal from '../../../components/global/GameCustomizationModal';
import type { CardTheme } from '../../../components/DynamicCard';
import { gameResultService } from '../../../services/gameResult.service';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
  id: string;
}

interface Hand {
  cards: Card[];
  value: number;
  isBust: boolean;
  isBlackjack: boolean;
}

interface GameState {
  playerHand: Hand;
  dealerHand: Hand;
  deck: Card[];
  balance: number;
  currentBet: number;
  gameStatus: 'betting' | 'playing' | 'dealerTurn' | 'finished';
  result: 'win' | 'lose' | 'push' | null;
  resultMessage: string;
}

const BlackjackScreen = ({ navigation }: any) => {
  const { user: currentUser } = useAuth();
  const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'blackjack');

  // Game State
  const [gameState, setGameState] = useState<GameState>({
    playerHand: { cards: [], value: 0, isBust: false, isBlackjack: false },
    dealerHand: { cards: [], value: 0, isBust: false, isBlackjack: false },
    deck: [],
    balance: 1000,
    currentBet: 0,
    gameStatus: 'betting',
    result: null,
    resultMessage: '',
  });

  const [betAmount, setBetAmount] = useState(10);
  const [customTheme, setCustomTheme] = useState<CardTheme | undefined>(undefined);
  const [showCustomization, setShowCustomization] = useState(false);
  const gameStartTimeRef = useRef<Date | null>(null);

  // Load theme
  useEffect(() => {
    AsyncStorage.getItem('blot_card_theme').then((stored) => {
      if (stored) {
        try {
          setCustomTheme(JSON.parse(stored));
        } catch {}
      }
    });
  }, []);

  const handleSaveTheme = (theme: CardTheme) => {
    setCustomTheme(theme);
    AsyncStorage.setItem('blot_card_theme', JSON.stringify(theme));
  };

  // ─── Game Logic ────────────────────────────────────────────────────────────

  /**
   * Create a double deck (2 standard 52-card decks)
   */
  const createDoubleDeck = (): Card[] => {
    const suits: Array<'hearts' | 'diamonds' | 'clubs' | 'spades'> = [
      'hearts',
      'diamonds',
      'clubs',
      'spades',
    ];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const rankValues: Record<string, number> = {
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6,
      '7': 7,
      '8': 8,
      '9': 9,
      '10': 10,
      J: 10,
      Q: 10,
      K: 10,
      A: 11,
    };

    const deck: Card[] = [];
    let cardId = 0;

    // Create 2 decks
    for (let deckNum = 0; deckNum < 2; deckNum++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push({
            suit,
            rank,
            value: rankValues[rank],
            id: `card_${cardId++}`,
          });
        }
      }
    }

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  };

  /**
   * Calculate hand value (handles Aces)
   */
  const calculateHandValue = (cards: Card[]): number => {
    let value = 0;
    let aces = 0;

    for (const card of cards) {
      if (card.rank === 'A') {
        aces++;
        value += 11;
      } else {
        value += card.value;
      }
    }

    // Adjust for aces if busting
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return value;
  };

  /**
   * Check if hand is blackjack
   */
  const isBlackjack = (cards: Card[]): boolean => {
    return cards.length === 2 && calculateHandValue(cards) === 21;
  };

  /**
   * Create hand object
   */
  const createHand = (cards: Card[]): Hand => {
    const value = calculateHandValue(cards);
    return {
      cards,
      value,
      isBust: value > 21,
      isBlackjack: isBlackjack(cards),
    };
  };

  /**
   * Place bet and start game
   */
  const handlePlaceBet = () => {
    if (betAmount <= 0) {
      BisetkaAlert.error('Invalid Bet', 'Bet amount must be greater than 0');
      return;
    }

    if (betAmount > gameState.balance) {
      BisetkaAlert.error('Insufficient Balance', 'You don\'t have enough chips for this bet');
      return;
    }

    const newDeck = createDoubleDeck();
    const playerCards = [newDeck.pop()!, newDeck.pop()!];
    const dealerCards = [newDeck.pop()!];

    const playerHand = createHand(playerCards);
    const dealerHand = createHand(dealerCards);

    gameStartTimeRef.current = new Date();

    setGameState({
      ...gameState,
      deck: newDeck,
      playerHand,
      dealerHand,
      currentBet: betAmount,
      gameStatus: 'playing',
      result: null,
      resultMessage: '',
    });

    // Auto-finish if player has blackjack
    if (playerHand.isBlackjack) {
      setTimeout(() => {
        handleDealerTurn(playerHand, dealerHand, newDeck);
      }, 1000);
    }
  };

  /**
   * Hit - draw a card
   */
  const handleHit = () => {
    if (gameState.deck.length === 0) {
      BisetkaAlert.error('Deck Empty', 'Reshuffling deck...');
      setGameState(prev => ({ ...prev, deck: createDoubleDeck() }));
      return;
    }

    const newDeck = [...gameState.deck];
    const newCard = newDeck.pop()!;
    const newHand = createHand([...gameState.playerHand.cards, newCard]);

    setGameState(prev => ({
      ...prev,
      playerHand: newHand,
      deck: newDeck,
    }));

    // Auto move to dealer if bust
    if (newHand.isBust) {
      setTimeout(() => {
        finishGame('lose', 'You busted!');
      }, 500);
    }
  };

  /**
   * Stand - player passes to dealer
   */
  const handleStand = () => {
    handleDealerTurn(gameState.playerHand, gameState.dealerHand, gameState.deck);
  };

  /**
   * Double Down
   */
  const handleDoubleDown = () => {
    if (gameState.currentBet * 2 > gameState.balance) {
      BisetkaAlert.error('Insufficient Balance', 'Not enough chips to double down');
      return;
    }

    if (gameState.playerHand.cards.length !== 2) {
      BisetkaAlert.error('Invalid Action', 'Can only double down on initial hand');
      return;
    }

    const newDeck = [...gameState.deck];
    const newCard = newDeck.pop()!;
    const newHand = createHand([...gameState.playerHand.cards, newCard]);
    const newBet = gameState.currentBet * 2;

    setGameState(prev => ({
      ...prev,
      playerHand: newHand,
      currentBet: newBet,
      deck: newDeck,
    }));

    setTimeout(() => {
      handleDealerTurn(newHand, gameState.dealerHand, newDeck);
    }, 500);
  };

  /**
   * Dealer turn logic
   */
  const handleDealerTurn = (playerHand: Hand, dealerHand: Hand, deck: Card[]) => {
    if (playerHand.isBust) {
      finishGame('lose', 'You busted!');
      return;
    }

    let newDeck = [...deck];
    let dealer = { ...dealerHand };

    // Dealer draws until 17 or higher
    while (dealer.value < 17 && newDeck.length > 0) {
      const newCard = newDeck.pop()!;
      dealer.cards.push(newCard);
      dealer.value = calculateHandValue(dealer.cards);
      dealer.isBust = dealer.value > 21;
    }

    setGameState(prev => ({
      ...prev,
      dealerHand: dealer,
      deck: newDeck,
      gameStatus: 'dealerTurn',
    }));

    setTimeout(() => {
      determineWinner(playerHand, dealer);
    }, 1000);
  };

  /**
   * Determine winner
   */
  const determineWinner = (playerHand: Hand, dealerHand: Hand) => {
    if (playerHand.isBust) {
      finishGame('lose', 'You busted!');
    } else if (dealerHand.isBust) {
      finishGame('win', 'Dealer busted! You win!');
    } else if (playerHand.value > dealerHand.value) {
      finishGame('win', 'You win!');
    } else if (playerHand.value < dealerHand.value) {
      finishGame('lose', 'Dealer wins!');
    } else {
      finishGame('push', "It's a push!");
    }
  };

  /**
   * Finish game and update balance
   */
  const finishGame = (result: 'win' | 'lose' | 'push', message: string) => {
    let newBalance = gameState.balance;

    if (result === 'win') {
      if (gameState.playerHand.isBlackjack && gameState.playerHand.cards.length === 2) {
        newBalance += gameState.currentBet * 1.5; // Blackjack pays 3:2
      } else {
        newBalance += gameState.currentBet;
      }
    } else if (result === 'push') {
      // No change
    } else {
      newBalance -= gameState.currentBet;
    }

    setGameState(prev => ({
      ...prev,
      gameStatus: 'finished',
      result,
      resultMessage: message,
      balance: newBalance,
    }));

    // Log game result
    if (gameStartTimeRef.current) {
      const durationSeconds = (Date.now() - gameStartTimeRef.current.getTime()) / 1000;
      gameResultService.recordGameResult({
        gameType: 'blackjack',
        gameMode: 'solo',
        result: result === 'win' ? 'win' : result === 'lose' ? 'loss' : 'draw',
        durationSeconds,
        difficulty: 'easy',
        gameData: {
          betAmount: gameState.currentBet,
          winnings: result === 'win' ? gameState.currentBet : 0,
        },
      }).catch(() => {});
    }
  };

  /**
   * Reset for next hand
   */
  const handleNewHand = () => {
    if (gameState.balance <= 0) {
      BisetkaAlert.error('Game Over', 'You\'re out of chips! Game over.');
      navigation.goBack();
      return;
    }

    setGameState({
      ...gameState,
      playerHand: { cards: [], value: 0, isBust: false, isBlackjack: false },
      dealerHand: { cards: [], value: 0, isBust: false, isBlackjack: false },
      gameStatus: 'betting',
      result: null,
      resultMessage: '',
      currentBet: 0,
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const renderCard = (card: Card | undefined, faceDown = false, key?: string) => {
    if (!card) return null;

    return (
      <View key={key || card.id} style={styles.cardWrapper}>
        <DynamicCard card={card} faceDown={faceDown} size="medium" theme={customTheme} />
      </View>
    );
  };

  return (
    <ImageBackground source={require('../../../../assets/blot/park-background.png')} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <GameToolbar
          title="🎰 Blackjack (Double Deck)"
          onBack={() => navigation.goBack()}
          backgroundColor="transparent"
          rightElement={
            <TouchableOpacity onPress={() => setShowCustomization(true)}>
              <Text style={styles.customizeButton}>🎨</Text>
            </TouchableOpacity>
          }
        />

        {/* Customization Modal */}
        <CardCustomizationModal
          visible={showCustomization}
          onClose={() => setShowCustomization(false)}
          onSave={handleSaveTheme}
          currentTheme={customTheme}
        />

        {/* Game Area */}
        <ScrollView style={styles.gameArea} showsVerticalScrollIndicator={false}>
          {/* Balance */}
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balanceAmount}>${gameState.balance}</Text>
          </View>

          {/* Dealer Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎲 Dealer</Text>
            <View style={styles.handContainer}>
              {gameState.dealerHand.cards.map((card, idx) => 
                renderCard(card, gameState.gameStatus === 'playing', `dealer_${idx}`)
              )}
              {gameState.gameStatus === 'playing' && gameState.dealerHand.cards.length === 1 && (
                <View style={styles.cardWrapper}>
                  <DynamicCard card={undefined as any} faceDown={true} size="medium" theme={customTheme} />
                </View>
              )}
            </View>
            {gameState.gameStatus !== 'playing' && gameState.dealerHand.cards.length > 0 && (
              <Text style={styles.handValue}>Value: {gameState.dealerHand.value}</Text>
            )}
          </View>

          {/* Player Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Player</Text>
            <View style={styles.handContainer}>
              {gameState.playerHand.cards.map((card, idx) => 
                renderCard(card, false, `player_${idx}`)
              )}
            </View>
            {gameState.playerHand.cards.length > 0 && (
              <Text style={[styles.handValue, gameState.playerHand.isBust && styles.bustText]}>
                Value: {gameState.playerHand.value} {gameState.playerHand.isBust ? '(BUST!)' : ''}
              </Text>
            )}
          </View>

          {/* Current Bet */}
          {gameState.currentBet > 0 && (
            <View style={styles.betDisplay}>
              <Text style={styles.betLabel}>Current Bet: ${gameState.currentBet}</Text>
            </View>
          )}

          {/* Game Messages */}
          {gameState.resultMessage && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{gameState.resultMessage}</Text>
            </View>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            {gameState.gameStatus === 'betting' && (
              <>
                <View style={styles.betControls}>
                  <TouchableOpacity
                    style={styles.betButton}
                    onPress={() => setBetAmount(Math.max(10, betAmount - 10))}>
                    <Text style={styles.betButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.betAmount}>${betAmount}</Text>
                  <TouchableOpacity
                    style={styles.betButton}
                    onPress={() => setBetAmount(betAmount + 10)}>
                    <Text style={styles.betButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.dealButton} onPress={handlePlaceBet}>
                  <Text style={styles.dealButtonText}>Deal</Text>
                </TouchableOpacity>
              </>
            )}

            {gameState.gameStatus === 'playing' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionButton} onPress={handleHit}>
                  <Text style={styles.actionButtonText}>Hit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleStand}>
                  <Text style={styles.actionButtonText}>Stand</Text>
                </TouchableOpacity>
                {gameState.playerHand.cards.length === 2 && !gameState.playerHand.isBust && (
                  <TouchableOpacity style={styles.actionButton} onPress={handleDoubleDown}>
                    <Text style={styles.actionButtonText}>Double Down</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {gameState.gameStatus === 'finished' && (
              <TouchableOpacity style={styles.dealButton} onPress={handleNewHand}>
                <Text style={styles.dealButtonText}>New Hand</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  safeArea: {
    flex: 1,
  },
  gameArea: {
    flex: 1,
    padding: 16,
  },
  balanceBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  balanceLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
  balanceAmount: {
    color: '#FFD700',
    fontSize: 32,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  handContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  cardWrapper: {
    margin: 4,
  },
  handValue: {
    color: '#0f0',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bustText: {
    color: '#f44',
  },
  betDisplay: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  betLabel: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  messageBox: {
    backgroundColor: 'rgba(0,255,0,0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0f0',
  },
  messageText: {
    color: '#0f0',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  controls: {
    marginTop: 24,
  },
  betControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 20,
  },
  betButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  betButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  betAmount: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 100,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dealButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  dealButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  customizeButton: {
    fontSize: 24,
  },
});

export default BlackjackScreen;
