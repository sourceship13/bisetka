import React, {useState} from 'react';
import { useGameEndRefresh } from '../libs/hooks/useGameEndRefresh';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GameToolbar from '../components/GameToolbar';
import Card, {CardType, Suit} from '../components/Card';
import {
  GameState,
  initializeGame,
  canPlayCard,
  determineTrickWinner,
  calculateRoundScore,
  dealCards,
} from '../game/blotLogic';

const BlotScreen = ({navigation}: any) => {
  const [gameState, setGameState] = useState<GameState>(initializeGame());
  useGameEndRefresh(gameState.phase === 'gameEnd', 'blot');

  const selectTrump = (suit: Suit) => {
    setGameState(prev => ({
      ...prev,
      trump: suit,
      phase: 'playing',
    }));
  };

  const playCard = (card: CardType) => {
    const currentPlayer = gameState.players[gameState.currentPlayer];
    
    if (!canPlayCard(card, currentPlayer.hand, gameState.currentTrick, gameState.trump)) {
      Alert.alert('Invalid Move', 'You must follow suit or play trump if possible.');
      return;
    }

    // Remove card from hand
    const updatedHand = currentPlayer.hand.filter(c => c.id !== card.id);
    const updatedPlayers = gameState.players.map(p =>
      p.id === currentPlayer.id ? { ...p, hand: updatedHand } : p
    );

    // Add card to current trick
    const updatedTrick = {
      ...gameState.currentTrick,
      cards: [...gameState.currentTrick.cards, { playerId: currentPlayer.id, card }],
    };

    // Check if trick is complete
    if (updatedTrick.cards.length === 4) {
      const leadSuit = updatedTrick.cards[0].card.suit;
      const winner = determineTrickWinner(updatedTrick, gameState.trump, leadSuit);
      updatedTrick.winner = winner;

      const completedTricks = [...gameState.completedTricks, updatedTrick];

      // Check if round is over
      if (updatedPlayers[0].hand.length === 0) {
        const roundScore = calculateRoundScore(completedTricks, updatedPlayers, gameState.trump);
        const newGameScore = {
          team1: (gameState.gameScore.team1 || 0) + (roundScore.team1 || 0),
          team2: (gameState.gameScore.team2 || 0) + (roundScore.team2 || 0),
        };

        // Check for game end
        if (newGameScore.team1 >= 151 || newGameScore.team2 >= 151) {
          setGameState(prev => ({
            ...prev,
            players: updatedPlayers,
            completedTricks,
            scores: roundScore,
            gameScore: newGameScore,
            phase: 'gameEnd',
          }));
          return;
        }

        // Start new round
        setTimeout(() => {
          const newDealer = (gameState.dealer + 1) % 4;
          const dealtPlayers = dealCards(updatedPlayers);
          setGameState({
            ...gameState,
            players: dealtPlayers,
            dealer: newDealer,
            currentPlayer: newDealer,
            trump: null,
            currentTrick: { cards: [], winner: null },
            completedTricks: [],
            scores: roundScore,
            gameScore: newGameScore,
            phase: 'bidding',
            lastTrickWinner: winner,
          });
        }, 2000);
        return;
      }

      // Next trick, winner leads
      setTimeout(() => {
        setGameState({
          ...gameState,
          players: updatedPlayers,
          currentPlayer: winner,
          currentTrick: { cards: [], winner: null },
          completedTricks,
          lastTrickWinner: winner,
        });
      }, 1500);
    } else {
      // Next player's turn
      const nextPlayer = (gameState.currentPlayer + 1) % 4;
      setGameState({
        ...gameState,
        players: updatedPlayers,
        currentPlayer: nextPlayer,
        currentTrick: updatedTrick,
      });
    }
  };

  const startNewGame = () => {
    setGameState(initializeGame());
  };

  const renderTrumpSelection = () => (
    <View style={styles.trumpSelection}>
      <Text style={styles.trumpTitle}>Select Trump Suit:</Text>
      <View style={styles.suitButtons}>
        {(['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]).map(suit => (
          <TouchableOpacity
            key={suit}
            style={styles.suitButton}
            onPress={() => selectTrump(suit)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.suitButtonText}>
              {suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'clubs' ? '♣' : '♠'}
            </Text>
            <Text style={styles.suitButtonLabel}>{suit}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderGameEnd = () => {
    const winner = (gameState.gameScore.team1 || 0) >= 151 ? 'Team 1' : 'Team 2';
    return (
      <View style={styles.gameEndContainer}>
        <Text style={styles.gameEndTitle}>Game Over!</Text>
        <Text style={styles.gameEndWinner}>{winner} Wins!</Text>
        <Text style={styles.gameEndScore}>
          Final Score: {gameState.gameScore.team1 || 0} - {gameState.gameScore.team2 || 0}
        </Text>
        <TouchableOpacity style={styles.newGameButton} onPress={startNewGame} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
      source={require('../../assets/blot/park-background.png')}
      style={styles.container}
      blurRadius={3}>
      <LinearGradient
        colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']}
        style={styles.overlay}>
        
        <SafeAreaView style={styles.safeArea}>
          <GameToolbar
            title="🃏 Blot"
            onBack={() => navigation.goBack()}
            backgroundColor="transparent"
            rightElement={
              <TouchableOpacity onPress={startNewGame} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.newGameText}>New Game</Text>
              </TouchableOpacity>
            }
          />

          <View style={styles.scoreBoard}>
        <View style={styles.teamScore}>
          <Text style={styles.teamLabel}>Team 1</Text>
          <Text style={styles.score}>{gameState.gameScore.team1 || 0}</Text>
          <Text style={styles.roundScore}>+{gameState.scores?.team1 || 0}</Text>
        </View>
        {gameState.trump && (
          <View style={styles.trumpDisplay}>
            <Text style={styles.trumpLabel}>Trump</Text>
            <Text style={styles.trumpSuit}>
              {gameState.trump === 'hearts' ? '♥' : gameState.trump === 'diamonds' ? '♦' : gameState.trump === 'clubs' ? '♣' : '♠'}
            </Text>
          </View>
        )}
        <View style={styles.teamScore}>
          <Text style={styles.teamLabel}>Team 2</Text>
          <Text style={styles.score}>{gameState.gameScore.team2 || 0}</Text>
          <Text style={styles.roundScore}>+{gameState.scores?.team2 || 0}</Text>
        </View>
      </View>

      {gameState.phase === 'bidding' && renderTrumpSelection()}
      {gameState.phase === 'gameEnd' && renderGameEnd()}

      {gameState.phase === 'playing' && (
        <>
          <View style={styles.playArea}>
            <Text style={styles.currentPlayerText}>
              {currentPlayer.name}'s Turn (Team {currentPlayer.team})
            </Text>
            
            <View style={[styles.tableContainer, { width: TABLE_SIZE, height: TABLE_SIZE }]}>
              <ImageBackground
                source={require('../../assets/blot/card-table.png')}
                style={styles.cardTable}
                imageStyle={{ borderRadius: 16 }}>
                
                {gameState.currentTrick.cards.length > 0 && (
                  <View style={styles.trickArea}>
                    <View style={styles.trickCards}>
                      {gameState.currentTrick.cards.map((cardPlay, idx) => (
                        <View key={idx} style={styles.trickCard}>
                          <Text style={styles.trickPlayerName}>
                            {gameState.players[cardPlay.playerId].name}
                          </Text>
                          <Card card={cardPlay.card} size="medium" />
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ImageBackground>
            </View>
          </View>

          <ScrollView horizontal style={styles.handContainer} contentContainerStyle={styles.handContent}>
            <Text style={styles.handLabel}>Your Hand:</Text>
            <View style={styles.hand}>
              {currentPlayer.hand.map(card => (
                <Card
                  key={card.id}
                  card={card}
                  onPress={() => playCard(card)}
                  isPlayable={canPlayCard(card, currentPlayer.hand, gameState.currentTrick, gameState.trump)}
                  size="medium"
                />
              ))}
            </View>
          </ScrollView>
        </>
      )}
        </SafeAreaView>
      </LinearGradient>
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
  scoreBoard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'transparent',
  },
  teamScore: {
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
    alignItems: 'center',
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
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  trickLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
    fontWeight: '600',
  },
  trickCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trickCard: {
    alignItems: 'center',
    margin: 4,
  },
  trickPlayerName: {
    fontSize: 12,
    color: '#fff',
    marginBottom: 4,
  },
  handContainer: {
    backgroundColor: 'transparent',
  },
  handContent: {
    padding: 16,
  },
  handLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 8,
    position: 'absolute',
    top: 16,
    left: 16,
  },
  hand: {
    flexDirection: 'row',
    marginTop: 32,
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
});

export default BlotScreen;
