import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameEndRefresh } from '../libs/hooks/useGameEndRefresh';
import { gameResultService } from '../services/gameResult.service';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GameToolbar from '../components/GameToolbar';
import { CardType, Suit } from '../components/Card';
import DynamicCard from '../components/DynamicCard';
import CardCustomizationModal from '../components/CardCustomizationModal';
import type { CardTheme } from '../components/CardCustomizationModal';
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
} from '../game/baazarBlotLogic';

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

const BaazarBlotScreen = ({ navigation }: any) => {
  const [gameState, setGameState] = useState<BaazarGameState | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [customTheme, setCustomTheme] = useState<CardTheme | undefined>(undefined);
  const [pendingBidLevel, setPendingBidLevel] = useState<BidLevel>(9);
  const [pendingBidSuit, setPendingBidSuit] = useState<Suit | null>(null);
  const dealtHandsRef = useRef<{ team: 1 | 2; hand: CardType[] }[]>([]);

  const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'baazar_blot');

  const handleSaveTheme = (theme: CardTheme) => setCustomTheme(theme);

  const startGame = useCallback((target: GameTarget) => {
    const gs = initializeBaazarGame(target);
    dealtHandsRef.current = gs.players.map(p => ({ team: p.team, hand: [...p.hand] }));
    setGameState(gs);
    setPendingBidLevel(9);
    setPendingBidSuit(null);
  }, []);

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

    const timer = setTimeout(() => {
      setGameState(prev => {
        if (!prev || prev.phase !== 'playing' || prev.currentPlayer === 0) return prev;
        const player = prev.players[prev.currentPlayer];
        const card = chooseAICard(player, prev.currentTrick, prev.trump, prev.players);
        return applyCardPlay(prev, prev.currentPlayer, card, dealtHandsRef.current);
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [gameState?.phase, gameState?.currentPlayer, gameState?.currentTrick]);

  const applyCardPlay = (
    prev: BaazarGameState,
    playerId: number,
    card: CardType,
    originalHands: { team: 1 | 2; hand: CardType[] }[],
  ): BaazarGameState => {
    const newPlayers = prev.players.map(p =>
      p.id === playerId
        ? { ...p, hand: p.hand.filter(c => !(c.suit === card.suit && c.rank === card.rank)) }
        : p,
    );
    const newTrick = {
      cards: [...prev.currentTrick.cards, { playerId, card }],
      winner: null as number | null,
    };

    if (newTrick.cards.length < TOTAL_PLAYERS) {
      return {
        ...prev,
        players: newPlayers,
        currentTrick: newTrick,
        currentPlayer: (playerId + 1) % TOTAL_PLAYERS,
      };
    }

    const leadSuit = newTrick.cards[0].card.suit;
    const winnerId = determineTrickWinner(newTrick, prev.trump, leadSuit);
    const completedTrick = { ...newTrick, winner: winnerId };
    const newCompleted = [...prev.completedTricks, completedTrick];
    const runningScore = calculateRunningScore(newCompleted, newPlayers, prev.trump);

    if (newCompleted.length < 8) {
      return {
        ...prev,
        players: newPlayers,
        currentTrick: { cards: [], winner: null },
        completedTricks: newCompleted,
        lastTrickWinner: winnerId,
        currentPlayer: winnerId,
        scores: runningScore,
      };
    }

    const result = calculateBaazarRound(
      newCompleted, newPlayers, prev.trump,
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
        gameType: 'baazar_blot',
        result: winner === 1 ? 'win' : 'loss',
        score: newGameScore.team1,
        opponentScore: newGameScore.team2,
      } as any).catch(() => {});
      refreshOnGameEnd?.();
    }

    return {
      ...prev,
      players: newPlayers,
      currentTrick: { cards: [], winner: null },
      completedTricks: newCompleted,
      lastTrickWinner: winnerId,
      currentPlayer: winnerId,
      scores: runningScore,
      gameScore: newGameScore,
      phase: gameOver ? 'gameEnd' : 'roundEnd',
      roundMessage: result.message,
    };
  };

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
    setGameState(prev => {
      if (!prev || prev.phase !== 'playing' || prev.currentPlayer !== 0) return prev;
      const player = prev.players[0];
      if (!canPlayCard(card, player.hand, prev.currentTrick, prev.trump)) return prev;
      return applyCardPlay(prev, 0, card, dealtHandsRef.current);
    });
  }, []);

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
      <View style={styles.centeredSection}>
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

        <View style={styles.scoreReminder}>
          <Text style={styles.scoreReminderText}>
            T1: {gameState.gameScore.team1}{'  |  '}T2: {gameState.gameScore.team2}
            {'  |  '}Target: {gameState.targetScore}
          </Text>
        </View>
      </View>
    );
  };

  // ── Playing ──────────────────────────────────────────────────────────────
  const renderPlaying = () => {
    if (!gameState) return null;
    const myPlayer = gameState.players[0];
    const { trump } = gameState;

    return (
      <View style={styles.playingLayout}>
        <View style={styles.scoreBar}>
          <Text style={styles.scoreBarText}>
            {'🔵 T1: '}
            {gameState.gameScore.team1 + gameState.scores.team1}
            {'   🔴 T2: '}
            {gameState.gameScore.team2 + gameState.scores.team2}
            {'   🎯 '}
            {gameState.targetScore}
          </Text>
          {trump && (
            <View style={styles.trumpBadge}>
              <Text style={styles.trumpBadgeText}>
                {'Trump: '}
                <Text style={{ color: suitColor(trump) }}>{SUIT_ICON[trump]}</Text>
                {'  Bid: '}
                {gameState.currentBid}
                {gameState.contracted ? '×2' : ''}
                {gameState.recontracted ? '×2' : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.tableWrapper}>
          <ImageBackground
            source={require('../../assets/blot/card-table.png')}
            style={styles.tableImage}
            imageStyle={styles.tableImageStyle}>
            <View style={styles.trickArea}>
              <View style={[styles.trickSlot, styles.trickSlotTop]}>
                <Text style={styles.trickPlayerName}>{playerName(2)}</Text>
                {trickCardForPlayer(2) && (
                  <DynamicCard card={trickCardForPlayer(2)!} theme={customTheme} size="small" />
                )}
              </View>
              <View style={[styles.trickSlot, styles.trickSlotLeft]}>
                <Text style={styles.trickPlayerName}>{playerName(3)}</Text>
                {trickCardForPlayer(3) && (
                  <DynamicCard card={trickCardForPlayer(3)!} theme={customTheme} size="small" />
                )}
              </View>
              <View style={[styles.trickSlot, styles.trickSlotRight]}>
                <Text style={styles.trickPlayerName}>{playerName(1)}</Text>
                {trickCardForPlayer(1) && (
                  <DynamicCard card={trickCardForPlayer(1)!} theme={customTheme} size="small" />
                )}
              </View>
              <View style={[styles.trickSlot, styles.trickSlotBottom]}>
                {trickCardForPlayer(0) && (
                  <DynamicCard card={trickCardForPlayer(0)!} theme={customTheme} size="small" />
                )}
                <Text style={styles.trickPlayerName}>{playerName(0)}</Text>
              </View>
            </View>
          </ImageBackground>
        </View>

        <View style={styles.handSection}>
          {gameState.currentPlayer === 0 ? (
            <Text style={styles.handLabel}>Your turn ↓</Text>
          ) : (
            <Text style={styles.handLabelWait}>Waiting…</Text>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.handContent}>
            {myPlayer.hand.map((card, idx) => {
              const legal = canPlayCard(
                card, myPlayer.hand, gameState.currentTrick, trump,
              );
              const isMyTurn = gameState.currentPlayer === 0;
              return (
                <TouchableOpacity
                  key={`${card.suit}-${card.rank}-${idx}`}
                  onPress={() => isMyTurn && handlePlayCard(card)}
                  style={[
                    styles.cardWrapper,
                    !legal || !isMyTurn ? styles.cardDimmed : styles.cardLegal,
                  ]}>
                  <DynamicCard card={card} theme={customTheme} size="medium" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
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
      case 'playing':  return <View style={{justifyContent: 'center', flex:1}}>{renderPlaying()}</View>;
      case 'roundEnd': return renderRoundEnd();
      case 'gameEnd':  return renderGameEnd();
      default:         return renderSetup();
    }
  };

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
          rightElement={
            <TouchableOpacity onPress={() => setShowCustomization(true)}>
              <Text style={{ color: '#FFD700', fontSize: 13, fontWeight: '700' }}>🎨 Cards</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.body}>{renderContent()}</View>
      </SafeAreaView>

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
  scoreReminder: { position: 'absolute', bottom: 16, alignItems: 'center' },
  scoreReminderText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  playingLayout: { flex: 1, maxHeight:600},
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scoreBarText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  trumpBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trumpBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
  handSection: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 8,
    minHeight: 120,
  },
  handLabel: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  handLabelWait: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  handContent: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    gap: 6,
    alignItems: 'center',
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
});

export default BaazarBlotScreen;
