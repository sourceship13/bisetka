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
} from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GameToolbar from '../../../components/global/GameToolbar';
import { CardType, Suit } from '../../../components/Card';
import DynamicCard from '../../../components/DynamicCard';
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
  dealCards,
} from '../../../game/blotLogic';

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
  clubs: '#ecf0f1',
  spades: '#ecf0f1',
};

const BlotScreen = ({ navigation }: any) => {
  const [gameState, setGameState] = useState<GameState>(initializeGame());
  const [showCustomization, setShowCustomization] = useState(false);
  const [customTheme, setCustomTheme] = useState<CardTheme | undefined>(
    undefined,
  );
  const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'blot');
  const isPlayingCardRef = useRef(false);

  const handleSaveTheme = (theme: CardTheme) => {
    setCustomTheme(theme);
    console.log('Saved custom theme:', theme);
  };

  // ------------------------------------------------------------------
  // Bidding logic
  // ------------------------------------------------------------------
  // Player 0 (human) is Team 1; AI: players 1 (T2), 2 (T1), 3 (T2).
  // Non-dealer (player 1) bids first (clockwise).
  // Round 1: take proposed suit or pass.
  // Round 2: declare any suit or pass → redeal if all pass again.
  const TOTAL_PLAYERS = 4;

  const acceptTrump = useCallback((suit: Suit) => {
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
    if (gameState.phase !== 'bidding' || gameState.currentPlayer === 0) return;
    const timer = setTimeout(() => {
      // AI strategy: take if they hold J or 9 of proposed suit, else pass in round 1
      //              in round 2 AI always passes (could be improved)
      const aiPlayer = gameState.players[gameState.currentPlayer];
      const proposed = gameState.proposalCard?.suit;
      if (gameState.bidRound === 1 && proposed) {
        const hasStrong = aiPlayer.hand.some(
          c =>
            c.suit === proposed &&
            (c.rank === 'J' || c.rank === '9' || c.rank === 'A'),
        );
        if (hasStrong) {
          acceptTrump(proposed);
          return;
        }
      }
      passBid();
    }, 600);
    return () => clearTimeout(timer);
  }, [
    gameState.phase,
    gameState.currentPlayer,
    gameState.bidRound,
    acceptTrump,
    passBid,
  ]);

  // ------------------------------------------------------------------
  // AI card play: auto-run when phase is playing and currentPlayer != 0
  // ------------------------------------------------------------------
  useEffect(() => {
    if (gameState.phase !== 'playing' || gameState.currentPlayer === 0) return;
    const timer = setTimeout(() => {
      const aiPlayer = gameState.players[gameState.currentPlayer];
      if (aiPlayer.hand.length === 0) return;
      const card = chooseAICard(
        aiPlayer,
        gameState.currentTrick,
        gameState.trump,
        gameState.players,
      );
      playCard(card);
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase, gameState.currentPlayer, gameState.currentTrick]);

  const playCard = (card: CardType) => {
    // Guard against race condition: prevent double-taps
    if (isPlayingCardRef.current) {
      return;
    }
    isPlayingCardRef.current = true;

    const currentPlayer = gameState.players[gameState.currentPlayer];

    if (
      !canPlayCard(
        card,
        currentPlayer.hand,
        gameState.currentTrick,
        gameState.trump,
      )
    ) {
      isPlayingCardRef.current = false;
      BisetkaAlert.error(
        'Invalid Move',
        'You must follow suit or play trump if possible.',
      );
      return;
    }

    // Remove card from hand
    const updatedHand = currentPlayer.hand.filter(c => c.id !== card.id);
    const updatedPlayers = gameState.players.map(p =>
      p.id === currentPlayer.id ? { ...p, hand: updatedHand } : p,
    );

    // Add card to current trick
    const updatedTrick = {
      ...gameState.currentTrick,
      cards: [
        ...gameState.currentTrick.cards,
        { playerId: currentPlayer.id, card },
      ],
    };

    // Check if trick is complete (all 4 players played)
    if (updatedTrick.cards.length === 4) {
      const leadSuit = updatedTrick.cards[0].card.suit;
      const winner = determineTrickWinner(
        updatedTrick,
        gameState.trump,
        leadSuit,
      );
      updatedTrick.winner = winner;

      const completedTricks = [...gameState.completedTricks, updatedTrick];

      // Show the completed trick (all 4 cards) before processing the result
      setGameState(prev => ({
        ...prev,
        players: updatedPlayers,
        currentTrick: updatedTrick,
        completedTricks,
      }));
      // Reset flag so next trick can start
      isPlayingCardRef.current = false;

      // Check if round is over (hands empty)
      if (updatedPlayers[0].hand.length === 0) {
        const roundResult = calculateRoundScore(
          completedTricks,
          updatedPlayers,
          gameState.trump,
          gameState.takerTeam,
          gameState.beloteTeam,
        );
        const roundScore = {
          team1: roundResult.team1,
          team2: roundResult.team2,
        };
        const newGameScore = {
          team1: (gameState.gameScore.team1 || 0) + roundResult.team1,
          team2: (gameState.gameScore.team2 || 0) + roundResult.team2,
        };

        // Build round summary message
        let msg = '';
        if (roundResult.capot) {
          const capotTeam = roundResult.team1 === 250 ? 'Team 1' : 'Team 2';
          msg = `CAPOT! ${capotTeam} wins all tricks — 250 pts!`;
        } else if (roundResult.takerFell) {
          const takerName = gameState.takerTeam === 1 ? 'Team 1' : 'Team 2';
          msg = `${takerName} fell! Scored less than 82 — opponent gets 162 pts.`;
        } else {
          if (roundResult.beloteBonus > 0) msg = 'Belote! +20 bonus. ';
          msg += `Round: Team 1 +${roundResult.team1} | Team 2 +${roundResult.team2}`;
        }

        // Game ends at 101 points
        if (newGameScore.team1 >= 101 || newGameScore.team2 >= 101) {
          const playerWon = newGameScore.team1 >= newGameScore.team2;
          // Delay transition to game-end so the 4th card remains visible
          setTimeout(() => {
            isPlayingCardRef.current = false;
            setGameState(prev => ({
              ...prev,
              players: updatedPlayers,
              completedTricks,
              scores: roundScore,
              gameScore: newGameScore,
              phase: 'gameEnd',
              roundMessage: msg,
            }));
            // Record result to backend so DB trigger awards points
            gameResultService
              .recordGameResult({
                gameType: 'blot',
                gameMode: 'ai',
                result: playerWon ? 'win' : 'loss',
                playerScore: newGameScore.team1,
                opponentScore: newGameScore.team2,
              })
              .then(() => refreshOnGameEnd())
              .catch(() => refreshOnGameEnd());
          }, 1500);
          return;
        }

        // Start new round — delay so the 4th card remains visible first
        setTimeout(() => {
          isPlayingCardRef.current = false;
          const newDealer = (gameState.dealer + 1) % 4;
          const { players: dealtPlayers, proposalCard } =
            dealCards(updatedPlayers);
          setGameState(prev => ({
            ...prev,
            players: dealtPlayers,
            dealer: newDealer,
            currentPlayer: (newDealer + 1) % 4,
            trump: null,
            proposalCard,
            takerTeam: null,
            beloteTeam: null,
            bidRound: 1,
            bidPassCount: 0,
            currentTrick: { cards: [], winner: null },
            completedTricks: [],
            scores: { team1: 0, team2: 0 },
            gameScore: newGameScore,
            phase: 'bidding',
            lastTrickWinner: winner,
            roundMessage: msg,
          }));
        }, 1500);
        return;
      }

      // Next trick — winner leads
      const runningScore = calculateRunningScore(completedTricks, updatedPlayers, gameState.trump);
      setTimeout(() => {
        isPlayingCardRef.current = false;
        setGameState(prev => ({
          ...prev,
          players: updatedPlayers,
          currentPlayer: winner,
          currentTrick: { cards: [], winner: null },
          completedTricks,
          scores: runningScore,
          lastTrickWinner: winner,
        }));
      }, 1200);
    } else {
      // Next player's turn
      const nextPlayer = (gameState.currentPlayer + 1) % 4;
      setGameState(prev => ({
        ...prev,
        players: updatedPlayers,
        currentPlayer: nextPlayer,
        currentTrick: updatedTrick,
      }));
      // Reset flag after state update
      isPlayingCardRef.current = false;
    }
  };

  const startNewGame = () => {
    isPlayingCardRef.current = false;
    setGameState(initializeGame());
  };

  const SUIT_SYM: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };
  const SUIT_COLOR: Record<Suit, string> = {
    hearts: '#DC143C',
    diamonds: '#DC143C',
    clubs: '#1a1a1a',
    spades: '#1a1a1a',
  };
  const isHumanBidTurn =
    gameState.phase === 'bidding' && gameState.currentPlayer === 0;

  const renderTrumpSelection = () => {
    const proposed = gameState.proposalCard;
    const proposedSuit = proposed?.suit as Suit | undefined;
    return (
      <View style={styles.trumpSelection}>
        {/* Proposal card */}
        {proposed && (
          <View style={styles.proposalRow}>
            <Text style={styles.proposalLabel}>Proposed trump:</Text>
            <Text
              style={[
                styles.proposalSuit,
                { color: SUIT_COLOR[proposedSuit!] },
              ]}
            >
              {SUIT_SYM[proposedSuit!]} {proposedSuit?.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.bidRoundLabel}>
          {gameState.bidRound === 1
            ? 'Round 1: Accept proposed suit or pass'
            : 'Round 2: Declare any suit or pass'}
        </Text>
        {isHumanBidTurn ? (
          <>
            {gameState.bidRound === 1 && proposedSuit ? (
              // Round 1: Take or Pass
              <View style={styles.bidButtons}>
                <TouchableOpacity
                  style={[styles.bidBtn, styles.bidBtnTake]}
                  onPress={() => acceptTrump(proposedSuit!)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.bidBtnText}>
                    ✓ Take {SUIT_SYM[proposedSuit!]}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bidBtn, styles.bidBtnPass]}
                  onPress={passBid}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.bidBtnText}>✗ Pass</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Round 2: pick any suit or pass
              <>
                <Text style={styles.trumpTitle}>Choose any trump suit:</Text>
                <View style={styles.suitButtons}>
                  {(['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]).map(
                    suit => (
                      <TouchableOpacity
                        key={suit}
                        style={styles.suitButton}
                        onPress={() => acceptTrump(suit)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text
                          style={[
                            styles.suitButtonText,
                            { color: SUIT_COLOR[suit] },
                          ]}
                        >
                          {SUIT_SYM[suit]}
                        </Text>
                        <Text style={styles.suitButtonLabel}>{suit}</Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.bidBtn, styles.bidBtnPass, { marginTop: 16 }]}
                  onPress={passBid}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.bidBtnText}>✗ Pass (force redeal)</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        ) : (
          <Text style={styles.waitingText}>
            Waiting for {gameState.players[gameState.currentPlayer]?.name} to
            bid…
          </Text>
        )}
      </View>
    );
  };

  const renderGameEnd = () => {
    const winner =
      (gameState.gameScore.team1 || 0) >= 101 ? 'Team 1' : 'Team 2';
    return (
      <View style={styles.gameEndContainer}>
        <Text style={styles.gameEndTitle}>Game Over!</Text>
        <Text style={styles.gameEndWinner}>{winner} Wins!</Text>
        <Text style={styles.gameEndScore}>
          Final Score: {gameState.gameScore.team1 || 0} -{' '}
          {gameState.gameScore.team2 || 0}
        </Text>
        <TouchableOpacity
          style={styles.newGameButton}
          onPress={startNewGame}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.newGameButtonText}>New Game</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const currentPlayer = gameState.players[gameState.currentPlayer];
  const { width, height } = Dimensions.get('window');
  const TABLE_SIZE = Math.min(width - 32, height * 0.5);

  return (
    <ImageBackground
      source={require('../../../../assets/blot/park-background.png')}
      style={styles.container}
      blurRadius={3}
    >
      <LinearGradient
        colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']}
        style={styles.overlay}
      >
        <SafeAreaView style={[styles.safeArea,]}>
          <GameToolbar
            title="🃏 Blot"
            onBack={() => navigation.goBack()}
            backgroundColor="transparent"
            rightElement={
              <View
                style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
              >
                <TouchableOpacity
                  onPress={() => setShowCustomization(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.customizeText}>🎨</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={startNewGame}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.newGameText}>New Game</Text>
                </TouchableOpacity>
              </View>
            }
          />

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
                <Text style={styles.trumpSuit}>
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

          {gameState.phase === 'bidding' && renderTrumpSelection()}
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
                <Text style={styles.currentPlayerText}>
                  {gameState.currentPlayer === 0
                    ? '★ Your Turn (Team 1)'
                    : `${
                        gameState.players[gameState.currentPlayer].name
                      }'s Turn (Team ${
                        gameState.players[gameState.currentPlayer].team
                      })`}
                </Text>

                <View
                  style={[
                    styles.tableContainer,
                    { width: TABLE_SIZE, height: TABLE_SIZE },
                  ]}
                >
                  <ImageBackground
                    source={require('../../../../assets/blot/card-table.png')}
                    style={styles.cardTable}
                    imageStyle={{ borderRadius: 16 }}
                  >
                    {gameState.currentTrick.cards.length > 0 && (() => {
                        const ledSuit = gameState.currentTrick.cards[0].card.suit;
                        // Map player IDs to visual table positions
                        // Player 0 = bottom, 1 = right, 2 = top, 3 = left
                        const positionStyle: Record<number, object> = {
                          0: styles.trickSlotBottom,
                          1: styles.trickSlotRight,
                          2: styles.trickSlotTop,
                          3: styles.trickSlotLeft,
                        };
                        return (
                          <View style={styles.trickArea}>
                            {/* Led suit indicator in the center */}
                            <View style={styles.ledSuitBadge}>
                              <Text style={[styles.ledSuitIcon, { color: SUIT_COLOR[ledSuit] }]}>
                                {SUIT_ICON[ledSuit]}
                              </Text>
                              <Text style={styles.ledSuitLabel}>
                                Led: {SUIT_NAME[ledSuit]}
                              </Text>
                            </View>
                            {/* Cards positioned at table edges */}
                            {gameState.currentTrick.cards.map((cardPlay, idx) => (
                              <View
                                key={idx}
                                style={[
                                  styles.trickSlot,
                                  positionStyle[cardPlay.playerId] ?? styles.trickSlotTop,
                                ]}
                              >
                                <Text style={styles.trickPlayerName}>
                                  {gameState.players[cardPlay.playerId].name}
                                </Text>
                                <DynamicCard
                                  card={cardPlay.card}
                                  size="medium"
                                  theme={customTheme}
                                />
                              </View>
                            ))}
                          </View>
                        );
                      })()}
                  </ImageBackground>
                </View>
              </View>

              <View style={styles.handContainer}>
                <Text style={styles.handLabel}>Your Hand:</Text>
                <CardHandFan
                  cards={gameState.players[0].hand}
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
                    return (
                      <DynamicCard
                        key={card.id}
                        card={card}
                        onPress={isMyTurn ? () => playCard(card) : undefined}
                        isPlayable={playable}
                        size="large"
                        theme={customTheme}
                      />
                    );
                  }}
                />
              </View>
            </>
          )}
        </SafeAreaView>
      </LinearGradient>

      <CardCustomizationModal
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onSave={handleSaveTheme}
        currentTheme={customTheme}
      />
    </ImageBackground>
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
    alignItems: 'center',
    margin: 4,
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
  // Absolute card slots for each player position on the table
  trickSlot: {
    position: 'absolute',
    alignItems: 'center',
  },
  trickSlotTop: {
    top: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  trickSlotBottom: {
    bottom: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  trickSlotLeft: {
    left: 14,
    top: '50%',
    marginTop: -75,
  },
  trickSlotRight: {
    right: 14,
    top: '50%',
    marginTop: -75,
  },
  trickPlayerName: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 6,
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
  trumpSelection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  trumpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 32,
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
});

export default BlotScreen;
