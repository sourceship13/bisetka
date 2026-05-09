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
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../../../../libs/hooks/useAuth';
import { BisetkaAlert } from '../../../../utils/BisetkaAlert';
import GameToolbar from '../../../../components/global/GameToolbar';
import Card3D from '../../../../components/Card3D';
import CardCustomizationModal from '../../../../components/global/GameCustomizationModal';
import type { CardTheme } from '../../../../components/global/GameCustomizationModal';
import { gameResultService } from '../../../../services/gameResult.service';
import { useGameEndRefresh } from '../../../../libs/hooks/useGameEndRefresh';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../../components/global/ExpandableView';
import GameToolbarControls from '../../../../components/global/GameToolbarControls';
import AraratBackground from '../../../../components/AraratBackground';
import SyncedYouTubePlayer from '../../../../components/SyncedYouTubePlayer';
import InGameChat from '../../../../components/InGameChat';
import { playCardFlipSound } from '../../../../utils/nardiSound';

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

  const [showBlur, setShowBlur] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const toolbarExpanded = useSharedValue(false);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));

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
    const dealerCards = [newDeck.pop()!, newDeck.pop()!];

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

    // Flip sound for each of the 4 dealt cards (player x2, dealer x2)
    [0, 220, 440, 660].forEach(delay => setTimeout(playCardFlipSound, delay));

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

    playCardFlipSound();

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

    playCardFlipSound();

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

    // Reveal dealer's hidden card
    playCardFlipSound();

    // Dealer draws until 17 or higher
    let drawIdx = 1;
    while (dealer.value < 17 && newDeck.length > 0) {
      const newCard = newDeck.pop()!;
      dealer.cards.push(newCard);
      dealer.value = calculateHandValue(dealer.cards);
      dealer.isBust = dealer.value > 21;
      // Stagger flip sound for each drawn card
      setTimeout(playCardFlipSound, drawIdx * 250);
      drawIdx++;
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
        <Card3D suit={card.suit as any} rank={card.rank as any} faceDown={faceDown} size={90} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AraratBackground overlayOpacity={showBlur ? 0.65 : 0.45} />
      <View style={styles.overlay} pointerEvents="box-none">
      <SafeAreaView style={styles.safeArea}>
        <View>
          <GameToolbar
            title="🎰 Blackjack"
            onBack={() => navigation.goBack()}
            backgroundColor="transparent"
          />
          <View>
            <GameToolbarControls
              buttons={[
                { icon: '🎨', onPress: () => setShowCustomization(true) },
              ]}
            />
          </View>
        </View>

        {/* Customization Modal */}
        <CardCustomizationModal
          visible={showCustomization}
          onClose={() => setShowCustomization(false)}
          onSave={handleSaveTheme}
          currentTheme={customTheme as any}
        />

        {/* Game Area */}
        <ScrollView style={styles.gameArea} showsVerticalScrollIndicator={false}>
          {/* Balance */}
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balanceAmount}>${gameState.balance}</Text>
          </View>

          {/* Casino Felt Table */}
          <LinearGradient
            colors={['#0d4f2c', '#0a3d22', '#062817']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.cardTable}>
            {/* Felt arc legend */}
            <Text style={styles.feltArcText}>BLACKJACK PAYS 3 TO 2</Text>
            <Text style={styles.feltSubText}>Dealer must draw to 16 and stand on all 17s</Text>

            {/* Dealer Section */}
            <View style={styles.tableSection}>
              <Text style={styles.sectionTitle}>🎲 Dealer{gameState.gameStatus !== 'playing' && gameState.dealerHand.cards.length > 0 ? ` — ${gameState.dealerHand.value}` : ''}</Text>
              <View style={styles.handContainer}>
                {gameState.dealerHand.cards.map((card, idx) =>
                  renderCard(card, gameState.gameStatus === 'playing' && idx > 0, `dealer_${idx}`)
                )}
              </View>
            </View>

            {/* Center bet circle */}
            {gameState.currentBet > 0 && (
              <View style={styles.betCircle}>
                <Text style={styles.betCircleAmount}>${gameState.currentBet}</Text>
                <Text style={styles.betCircleLabel}>BET</Text>
              </View>
            )}

            {/* Player Section */}
            <View style={styles.tableSection}>
              <View style={styles.handContainer}>
                {gameState.playerHand.cards.map((card, idx) =>
                  renderCard(card, false, `player_${idx}`)
                )}
              </View>
              {gameState.playerHand.cards.length > 0 && (
                <View style={styles.playerValueRow}>
                  <View
                    style={[
                      styles.valueBadge,
                      gameState.playerHand.isBust && styles.valueBadgeBust,
                      gameState.playerHand.isBlackjack && styles.valueBadgeBlackjack,
                    ]}>
                    <Text style={styles.valueBadgeLabel}>YOUR HAND</Text>
                    <Text style={styles.valueBadgeNumber}>{gameState.playerHand.value}</Text>
                  </View>
                  {gameState.playerHand.isBust && (
                    <Text style={[styles.handValue, styles.bustText]}>BUST</Text>
                  )}
                  {gameState.playerHand.isBlackjack && (
                    <Text style={[styles.handValue, styles.blackjackText]}>BLACKJACK!</Text>
                  )}
                </View>
              )}
            </View>
          </LinearGradient>

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
                <Text style={styles.chipPrompt}>Place your bet</Text>
                <View style={styles.chipRow}>
                  {[5, 25, 100, 500].map((chip) => {
                    const palette: Record<number, [string, string, string]> = {
                      5:   ['#ef4444', '#b91c1c', '#fff'],
                      25:  ['#22c55e', '#15803d', '#fff'],
                      100: ['#1f2937', '#0f172a', '#fbbf24'],
                      500: ['#a855f7', '#6d28d9', '#fff'],
                    };
                    const [c1, c2, txt] = palette[chip];
                    return (
                      <TouchableOpacity
                        key={chip}
                        activeOpacity={0.85}
                        onPress={() => setBetAmount(Math.min(gameState.balance, betAmount + chip))}>
                        <LinearGradient
                          colors={[c1, c2]}
                          style={styles.chip}>
                          <View style={styles.chipInner}>
                            <Text style={[styles.chipText, { color: txt }]}>${chip}</Text>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.betControls}>
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => setBetAmount(0)}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </TouchableOpacity>
                  <Text style={styles.betAmount}>${betAmount}</Text>
                  <TouchableOpacity
                    style={[styles.dealButton, betAmount <= 0 && styles.dealButtonDisabled]}
                    disabled={betAmount <= 0}
                    onPress={handlePlaceBet}>
                    <Text style={styles.dealButtonText}>DEAL</Text>
                  </TouchableOpacity>
                </View>
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
      </View>
      <InGameChat
        roomId={''}
        currentUserId={currentUser?.id ?? ''}
        gameType="blackjack"
        visible={true}
      />
      <SyncedYouTubePlayer roomId={null} visible={true} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  overlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  editRoomButton: {
    padding: 6,
    borderRadius: 8,
  },
  editRoomIcon: {
    fontSize: 22,
    color: '#FFD700',
  },
  toolbarControls: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 3,
    flexWrap: 'wrap',
    alignSelf: 'flex-end',
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
  cardTable: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    minHeight: 360,
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
  },
  feltArcText: {
    color: 'rgba(251, 191, 36, 0.9)',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  feltSubText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  betCircle: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.7)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  betCircleAmount: { color: '#fbbf24', fontWeight: '900', fontSize: 16 },
  betCircleLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, letterSpacing: 1, marginTop: -2 },
  chipPrompt: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 10, letterSpacing: 1 },
  chipRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  chip: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 6,
  },
  chipInner: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '900' },
  clearBtn: {
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.85)',
  },
  clearBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.6 },
  dealButtonDisabled: { opacity: 0.4 },
  cardTableImage: {
    borderRadius: 16,
    opacity: 0.92,
  },
  tableSection: {
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  handContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
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
  blackjackText: {
    color: '#FFD700',
  },
  playerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  valueBadge: {
    minWidth: 110,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  valueBadgeBust: {
    borderColor: '#f44',
    shadowColor: '#f44',
  },
  valueBadgeBlackjack: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.18)',
  },
  valueBadgeLabel: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  valueBadgeNumber: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
  recenterBtn: { position:'absolute', bottom:200, alignSelf:'center', left:'50%', transform:[{translateX:-54}], flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(0,0,0,0.35)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)', borderRadius:24, paddingHorizontal:18, paddingVertical:10 },
  recenterIcon: { fontSize:20, color:'#fff' },
  recenterLabel: { fontSize:13, color:'#fff', fontWeight:'600', letterSpacing:0.3 },
});

export default BlackjackScreen;
