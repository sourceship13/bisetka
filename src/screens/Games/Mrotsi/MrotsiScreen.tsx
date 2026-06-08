/**
 * Yamb (Ямб / Покер на костях) — solo dice-poker grid-fill game.
 * 5 d6, up to 3 rolls per turn, 14 categories × 4 columns (Down / Up / Free / Announced).
 * Game ends when all 56 cells are filled.
 *
 * Backend keeps using the legacy 'mrotsi' game-type key so entry-fee, prize, and
 * room/session services continue to work without migration.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import GamePlayerOverlay from '../../../components/GamePlayerOverlay';

const MROTSI_BACKGROUND = require('../../../../assets/backgrounds/game_backgrounds/street_armo_bisetka.png');
import { v4 as uuidv4 } from 'uuid';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import Dice3DSimple from '../../../components/Games/Dice3DSimple';
import { apiService } from '../../../services/api.service';
import { useAuth } from '../../../libs/hooks/useAuth';
import { useAchievements } from '../../../contexts/AchievementContext';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';
import InGameChat from '../../../components/InGameChat';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Game model ────────────────────────────────────────────────────────────────

type Category =
  | 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes'
  | 'max' | 'min'
  | 'twoPairs' | 'threeOfKind' | 'straight' | 'fullHouse' | 'fourOfKind' | 'yamb';

type Section = 'upper' | 'middle' | 'lower';

type Column = 'down' | 'up' | 'free' | 'announced';

interface CategoryDef {
  key: Category;
  label: string;
  short: string;
  section: Section;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'ones',        label: 'Ones',          short: '1s',     section: 'upper' },
  { key: 'twos',        label: 'Twos',          short: '2s',     section: 'upper' },
  { key: 'threes',      label: 'Threes',        short: '3s',     section: 'upper' },
  { key: 'fours',       label: 'Fours',         short: '4s',     section: 'upper' },
  { key: 'fives',       label: 'Fives',         short: '5s',     section: 'upper' },
  { key: 'sixes',       label: 'Sixes',         short: '6s',     section: 'upper' },
  { key: 'max',         label: 'Max',           short: 'Max',    section: 'middle' },
  { key: 'min',         label: 'Min',           short: 'Min',    section: 'middle' },
  { key: 'twoPairs',    label: 'Two Pairs',     short: '2 Pair', section: 'lower' },
  { key: 'threeOfKind', label: 'Three of Kind', short: '3-Kind', section: 'lower' },
  { key: 'straight',    label: 'Straight',      short: 'Strt',   section: 'lower' },
  { key: 'fullHouse',   label: 'Full House',    short: 'Full',   section: 'lower' },
  { key: 'fourOfKind',  label: 'Poker',         short: '4-Kind', section: 'lower' },
  { key: 'yamb',        label: 'Yamb',          short: 'Yamb',   section: 'lower' },
];

const COLUMNS: Column[] = ['down', 'up', 'free', 'announced'];
const COLUMN_LABEL: Record<Column, string> = {
  down: '↓',
  up: '↑',
  free: 'Free',
  announced: 'Ann',
};

type Sheet = Record<Column, Partial<Record<Category, number>>>;

const emptySheet = (): Sheet => ({ down: {}, up: {}, free: {}, announced: {} });

// ─── Scoring helpers ───────────────────────────────────────────────────────────

const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);

function counts(dice: number[]): Record<number, number> {
  const c: Record<number, number> = {};
  dice.forEach(d => { c[d] = (c[d] || 0) + 1; });
  return c;
}

function scoreFor(cat: Category, dice: number[]): number {
  if (dice.length !== 5 || dice.some(d => d < 1 || d > 6)) return 0;
  const c = counts(dice);
  const total = sum(dice);
  switch (cat) {
    case 'ones':   return (c[1] || 0) * 1;
    case 'twos':   return (c[2] || 0) * 2;
    case 'threes': return (c[3] || 0) * 3;
    case 'fours':  return (c[4] || 0) * 4;
    case 'fives':  return (c[5] || 0) * 5;
    case 'sixes':  return (c[6] || 0) * 6;
    case 'max':    return total;
    case 'min':    return total;
    case 'twoPairs': {
      // Two distinct pairs (pair counts as 2 of a kind)
      const pairs = Object.entries(c).filter(([, n]) => n >= 2).map(([v]) => parseInt(v, 10));
      if (pairs.length < 2) return 0;
      // Use the two highest-value pair faces for max score
      pairs.sort((a, b) => b - a);
      const [p1, p2] = pairs;
      return (p1 * 2 + p2 * 2) + 10;
    }
    case 'threeOfKind': {
      const trip = Object.entries(c).find(([, n]) => n >= 3);
      if (!trip) return 0;
      return parseInt(trip[0], 10) * 3 + 20;
    }
    case 'straight': {
      const set = new Set(dice);
      const small = [1, 2, 3, 4, 5].every(v => set.has(v));
      const large = [2, 3, 4, 5, 6].every(v => set.has(v));
      if (large) return 45;
      if (small) return 35;
      return 0;
    }
    case 'fullHouse': {
      const trip = Object.entries(c).find(([, n]) => n >= 3);
      if (!trip) return 0;
      const tripFace = parseInt(trip[0], 10);
      const pair = Object.entries(c).find(([v, n]) => n >= 2 && parseInt(v, 10) !== tripFace);
      if (!pair) return 0;
      return tripFace * 3 + parseInt(pair[0], 10) * 2 + 30;
    }
    case 'fourOfKind': {
      const four = Object.entries(c).find(([, n]) => n >= 4);
      if (!four) return 0;
      return parseInt(four[0], 10) * 4 + 40;
    }
    case 'yamb': {
      const yamb = Object.entries(c).find(([, n]) => n >= 5);
      if (!yamb) return 0;
      return parseInt(yamb[0], 10) * 5 + 50;
    }
  }
}

// ─── Column-rule helpers ───────────────────────────────────────────────────────

/** Is the (col,cat) cell legal to fill right now given column rules + announcement? */
function isCellWriteable(
  col: Column,
  cat: Category,
  sheet: Sheet,
  announced: Category | null,
): boolean {
  if (sheet[col][cat] !== undefined) return false;
  if (col === 'free') return true;
  if (col === 'announced') return announced === cat;
  if (col === 'down') {
    // Lowest-index unfilled row in this column
    for (const c of CATEGORIES) {
      if (sheet.down[c.key] === undefined) return c.key === cat;
    }
    return false;
  }
  if (col === 'up') {
    for (let i = CATEGORIES.length - 1; i >= 0; i--) {
      const c = CATEGORIES[i];
      if (sheet.up[c.key] === undefined) return c.key === cat;
    }
    return false;
  }
  return false;
}

function totalsFor(sheet: Sheet): {
  perColumn: Record<Column, { upper: number; upperBonus: number; middle: number; lower: number; total: number }>;
  grandTotal: number;
  filledCells: number;
} {
  const perColumn = {} as Record<Column, { upper: number; upperBonus: number; middle: number; lower: number; total: number }>;
  let filledCells = 0;
  let grand = 0;
  for (const col of COLUMNS) {
    let upper = 0, middle = 0, lower = 0;
    for (const c of CATEGORIES) {
      const v = sheet[col][c.key];
      if (v === undefined) continue;
      filledCells++;
      if (c.section === 'upper') upper += v;
      else if (c.section === 'lower') lower += v;
    }
    // Middle: (max - min) * ones — only if all three middle-relevant cells are present
    const onesV = sheet[col].ones;
    const maxV = sheet[col].max;
    const minV = sheet[col].min;
    if (onesV !== undefined && maxV !== undefined && minV !== undefined) {
      middle = Math.max(0, (maxV - minV)) * onesV;
    }
    const upperBonus = upper >= 60 ? 30 : 0;
    const colTotal = upper + upperBonus + middle + lower;
    perColumn[col] = { upper, upperBonus, middle, lower, total: colTotal };
    grand += colTotal;
  }
  return { perColumn, grandTotal: grand, filledCells };
}

// ─── Dice state ────────────────────────────────────────────────────────────────

const DEFAULT_DICE = [1, 1, 1, 1, 1];
const DICE_SIZE = Math.floor((SCREEN_WIDTH / 5.6));

interface YambGameState {
  sheet: Sheet;
  dice: number[];
  kept: boolean[];
  rollsUsed: number;        // 0–3
  announced: Category | null;
  rolling: boolean;
  isGameOver: boolean;
  finalScore: number;
}

function freshGame(): YambGameState {
  return {
    sheet: emptySheet(),
    dice: [...DEFAULT_DICE],
    kept: [false, false, false, false, false],
    rollsUsed: 0,
    announced: null,
    rolling: false,
    isGameOver: false,
    finalScore: 0,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

const MrotsiScreen = ({ navigation, route }: any) => {
  // route params accepted for navigation compatibility (currently unused — Yamb is solo)
  const fakeOpponent = route?.params?.fakeOpponent ?? null;

  const [state, setState] = useState<YambGameState>(freshGame());
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false); // announce picker
  const gameIdRef = useRef<string>(uuidv4());

  const { user, setUser, refreshUser } = useAuth();
  const { showAchievements } = useAchievements();
  const [entryDeducted, setEntryDeducted] = useState(false);
  const [prizeAwarded, setPrizeAwarded] = useState(false);
  const [isFinalizingGame, setIsFinalizingGame] = useState(false);
  const { refreshOnGameEnd, isRefreshing: isRefreshingGameEnd } =
    useGameEndRefresh(undefined, 'mrotsi');

  const isPostGameSyncing = isFinalizingGame || isRefreshingGameEnd;

  // Mirror balance/state to auth user
  const syncUserBalance = (newBalance: number) => {
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
  };

  // ─── Entry fee / prize ──────────────────────────────────────────────────────

  const handleGameStart = async () => {
    if (entryDeducted || !user?.id) return;
    try {
      const result = await apiService.deductEntry('mrotsi', gameIdRef.current);
      if (result.success) {
        setEntryDeducted(true);
        syncUserBalance(result.newBalance);
        refreshUser().catch(() => {});
      } else {
        Alert.alert('Insufficient Points', result.error || 'You need 50 points to play Yamb.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', `Failed to deduct entry fee: ${err?.message || 'Unknown error'}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const handleGameEnd = async (finalScore: number) => {
    if (prizeAwarded || !user?.id) return;
    try {
      setIsFinalizingGame(true);
      // "Win" threshold for Yamb solo: 200 pts is a respectable game.
      const didWin = finalScore >= 200;
      const result = didWin ? 'win' : 'loss';
      const prize = await apiService.awardPrizeAndLog('mrotsi', result, 'ai', {
        gameId: gameIdRef.current,
        playerScore: finalScore,
      });
      if (prize.success) {
        setPrizeAwarded(true);
        syncUserBalance(prize.newBalance);
        const unlocked = prize.unlockedAchievements ?? [];
        if (unlocked.length > 0) showAchievements(unlocked);
        await refreshOnGameEnd();
        if (didWin) {
          setTimeout(() => {
            Alert.alert(
              '🏆 Great Game!',
              `Final score: ${finalScore}\nYou won ${prize.prize} points!\n\nNew balance: ${prize.newBalance}`,
            );
          }, 600);
        }
      }
    } catch {
      // swallow — UI already shows final score
    } finally {
      setIsFinalizingGame(false);
    }
  };

  useEffect(() => {
    if (!entryDeducted && user?.id) handleGameStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryDeducted, user?.id]);

  useEffect(() => {
    if (state.isGameOver && !prizeAwarded) handleGameEnd(state.finalScore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isGameOver, prizeAwarded, state.finalScore]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleBackPress = () => {
    if (state.isGameOver && isPostGameSyncing) {
      BisetkaAlert.alert('Updating Profile', 'Finishing your points sync before returning home.');
      return;
    }
    navigation.goBack();
  };

  const rollDice = () => {
    if (state.rolling || state.rollsUsed >= 3 || state.isGameOver) return;
    const rolling = state.rollsUsed === 0
      ? [false, false, false, false, false] // reset keepers on first roll
      : state.kept.slice();
    const newDice = state.dice.map((d, i) => (rolling[i] ? d : (Math.floor(Math.random() * 6) + 1)));
    // After first roll, re-rolled dice are NOT auto-kept; player toggles
    setState(s => ({
      ...s,
      dice: newDice,
      kept: s.rollsUsed === 0 ? [false, false, false, false, false] : s.kept,
      rollsUsed: s.rollsUsed + 1,
      rolling: true,
    }));
  };

  // The dice WebView fires a per-die rollComplete; turn off "rolling" after a small grace
  const rollCompleteCountRef = useRef(0);
  const onDieRollComplete = () => {
    rollCompleteCountRef.current += 1;
    if (rollCompleteCountRef.current >= state.dice.length) {
      rollCompleteCountRef.current = 0;
      setState(s => ({ ...s, rolling: false }));
    }
  };
  // Reset the rollComplete counter whenever a new roll starts
  useEffect(() => {
    if (state.rolling) rollCompleteCountRef.current = 0;
  }, [state.rolling]);

  const toggleKeep = (i: number) => {
    if (state.rolling || state.rollsUsed === 0 || state.isGameOver) return;
    setState(s => {
      const k = s.kept.slice();
      k[i] = !k[i];
      return { ...s, kept: k };
    });
  };

  const announce = (cat: Category) => {
    if (state.rollsUsed !== 0 || state.announced) return;
    if (state.sheet.announced[cat] !== undefined) return;
    setState(s => ({ ...s, announced: cat }));
    setPickerVisible(false);
  };

  const writeCell = (col: Column, cat: Category) => {
    if (state.rolling || state.isGameOver) return;
    if (state.rollsUsed === 0) return; // must roll at least once
    if (!isCellWriteable(col, cat, state.sheet, state.announced)) return;
    const v = scoreFor(cat, state.dice);
    setState(s => {
      const nextSheet: Sheet = {
        ...s.sheet,
        [col]: { ...s.sheet[col], [cat]: v },
      };
      const t = totalsFor(nextSheet);
      const done = t.filledCells >= CATEGORIES.length * COLUMNS.length;
      return {
        ...s,
        sheet: nextSheet,
        dice: [...DEFAULT_DICE],
        kept: [false, false, false, false, false],
        rollsUsed: 0,
        announced: null,
        isGameOver: done,
        finalScore: done ? t.grandTotal : s.finalScore,
      };
    });
  };

  const resetGame = () => {
    setState(freshGame());
    gameIdRef.current = uuidv4();
    setEntryDeducted(false);
    setPrizeAwarded(false);
    rollCompleteCountRef.current = 0;
  };

  // ─── Derived state ──────────────────────────────────────────────────────────

  const totals = useMemo(() => totalsFor(state.sheet), [state.sheet]);

  const previewByCell = useMemo(() => {
    // Preview score that *would* be written if this cell is selected now.
    const map: Record<string, number> = {};
    if (state.rollsUsed === 0) return map;
    for (const col of COLUMNS) {
      for (const c of CATEGORIES) {
        if (isCellWriteable(col, c.key, state.sheet, state.announced)) {
          map[`${col}:${c.key}`] = scoreFor(c.key, state.dice);
        }
      }
    }
    return map;
  }, [state.dice, state.sheet, state.announced, state.rollsUsed]);

  const rollLabel = state.rollsUsed === 0
    ? 'Roll #1'
    : state.rollsUsed === 3
      ? 'No rolls left'
      : `Roll ${state.rollsUsed + 1} / 3`;

  const canAnnounce =
    state.rollsUsed === 0 &&
    state.announced === null &&
    Object.keys(state.sheet.announced).length < CATEGORIES.length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.backgroundImage} collapsable={false}>
      <ImageBackground
        source={MROTSI_BACKGROUND}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        {showBackground && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
          />
        )}
      </ImageBackground>
      <View style={styles.overlay} pointerEvents="box-none">
        <GamePlayerOverlay
          opponent={
            fakeOpponent
              ? {
                  userId: fakeOpponent.id,
                  username: fakeOpponent.username,
                  fakeAppearance: fakeOpponent.appearance,
                }
              : null
          }
        />
        <SafeAreaView style={styles.container} pointerEvents="box-none">
          <View>
            <GameToolbar
              title="Yamb"
              onBack={handleBackPress}
              backgroundColor="transparent"
            />
            <GameToolbarControls
              buttons={[
                { icon: showBackground ? '🖼️' : '🔲', onPress: () => setShowBackground(b => !b) },
                { icon: showMusicPlayer ? '🎵' : '🎶', onPress: () => setShowMusicPlayer(s => !s) },
                { icon: '🔄', onPress: resetGame },
              ]}
            />
          </View>

          {/* Header strip: total + roll status + announce */}
          <View style={styles.headerStrip}>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{totals.grandTotal}</Text>
            </View>
            <View style={styles.rollStatusBox}>
              <Text style={styles.rollStatusText}>{rollLabel}</Text>
              {state.announced && (
                <Text style={styles.announceBadge}>
                  📣 {CATEGORIES.find(c => c.key === state.announced)?.short}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.announceBtn, !canAnnounce && styles.announceBtnDisabled]}
              onPress={() => canAnnounce && setPickerVisible(true)}
              disabled={!canAnnounce}
            >
              <Text style={styles.announceBtnText}>📣 Announce</Text>
            </TouchableOpacity>
          </View>

          {/* Dice row — 5 dice, tap to keep/release between rolls */}
          <View style={styles.diceRow} pointerEvents="box-none">
            {state.dice.map((d, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => toggleKeep(i)}
                disabled={state.rolling || state.rollsUsed === 0 || state.isGameOver}
                activeOpacity={0.75}
                style={[styles.dieWrap, state.kept[i] && styles.dieWrapKept]}
              >
                <Dice3DSimple
                  value={d}
                  isRolling={state.rolling && !state.kept[i]}
                  index={i}
                  size={DICE_SIZE}
                  onRollComplete={onDieRollComplete}
                />
                {state.kept[i] && (
                  <View style={styles.keepBadge}>
                    <Text style={styles.keepBadgeText}>HOLD</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.tipText}>
            {state.rollsUsed === 0
              ? 'Tap ROLL to start your turn.'
              : state.rolling
                ? '🎲 Rolling…'
                : state.rollsUsed >= 3
                  ? 'Pick a cell below to score.'
                  : 'Tap dice to HOLD, then ROLL or pick a cell.'}
          </Text>

          {/* Roll button */}
          <View style={styles.rollBtnWrap}>
            <TouchableOpacity
              onPress={rollDice}
              disabled={state.rolling || state.rollsUsed >= 3 || state.isGameOver}
              style={[
                styles.rollButton,
                (state.rolling || state.rollsUsed >= 3 || state.isGameOver) && styles.rollButtonDisabled,
              ]}
            >
              <Text style={styles.rollButtonText}>
                🎲 {state.rollsUsed === 0 ? 'ROLL' : state.rollsUsed >= 3 ? 'No rolls left' : 'RE-ROLL'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Score sheet */}
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header row */}
            <View style={styles.sheetRow}>
              <View style={styles.sheetRowLabel} />
              {COLUMNS.map(col => (
                <View key={col} style={styles.sheetCellHeader}>
                  <Text style={styles.sheetCellHeaderText}>{COLUMN_LABEL[col]}</Text>
                </View>
              ))}
            </View>

            {CATEGORIES.map((cdef, idx) => {
              const sectionStart =
                idx === 0 ||
                CATEGORIES[idx - 1].section !== cdef.section;
              return (
                <View key={cdef.key}>
                  {sectionStart && idx !== 0 && <View style={styles.sectionDivider} />}
                  <View style={styles.sheetRow}>
                    <View style={styles.sheetRowLabel}>
                      <Text style={styles.sheetRowLabelText} numberOfLines={1}>
                        {cdef.label}
                      </Text>
                    </View>
                    {COLUMNS.map(col => {
                      const written = state.sheet[col][cdef.key];
                      const writeable = isCellWriteable(col, cdef.key, state.sheet, state.announced);
                      const preview = previewByCell[`${col}:${cdef.key}`];
                      return (
                        <TouchableOpacity
                          key={col}
                          style={[
                            styles.sheetCell,
                            written !== undefined && styles.sheetCellFilled,
                            writeable && styles.sheetCellWriteable,
                          ]}
                          onPress={() => writeCell(col, cdef.key)}
                          disabled={!writeable}
                          activeOpacity={0.6}
                        >
                          <Text
                            style={[
                              styles.sheetCellText,
                              written !== undefined && styles.sheetCellTextFilled,
                              writeable && preview === 0 && styles.sheetCellTextZero,
                            ]}
                          >
                            {written !== undefined ? written : (writeable ? preview ?? '' : '')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Per-column subtotals */}
            <View style={styles.sectionDivider} />
            <View style={styles.sheetRow}>
              <View style={styles.sheetRowLabel}>
                <Text style={styles.sheetSubLabel}>Upper</Text>
              </View>
              {COLUMNS.map(col => (
                <View key={col} style={styles.sheetCell}>
                  <Text style={styles.subtotalText}>{totals.perColumn[col].upper}</Text>
                </View>
              ))}
            </View>
            <View style={styles.sheetRow}>
              <View style={styles.sheetRowLabel}>
                <Text style={styles.sheetSubLabel}>+Bonus</Text>
              </View>
              {COLUMNS.map(col => (
                <View key={col} style={styles.sheetCell}>
                  <Text style={styles.subtotalText}>{totals.perColumn[col].upperBonus}</Text>
                </View>
              ))}
            </View>
            <View style={styles.sheetRow}>
              <View style={styles.sheetRowLabel}>
                <Text style={styles.sheetSubLabel}>Middle</Text>
              </View>
              {COLUMNS.map(col => (
                <View key={col} style={styles.sheetCell}>
                  <Text style={styles.subtotalText}>{totals.perColumn[col].middle}</Text>
                </View>
              ))}
            </View>
            <View style={styles.sheetRow}>
              <View style={styles.sheetRowLabel}>
                <Text style={styles.sheetSubLabel}>Lower</Text>
              </View>
              {COLUMNS.map(col => (
                <View key={col} style={styles.sheetCell}>
                  <Text style={styles.subtotalText}>{totals.perColumn[col].lower}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.sheetRow, styles.sheetTotalRow]}>
              <View style={styles.sheetRowLabel}>
                <Text style={styles.sheetTotalLabel}>Total</Text>
              </View>
              {COLUMNS.map(col => (
                <View key={col} style={styles.sheetCell}>
                  <Text style={styles.sheetTotalCellText}>{totals.perColumn[col].total}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Announce picker modal */}
          {pickerVisible && (
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerCard}>
                <Text style={styles.pickerTitle}>Announce a category</Text>
                <ScrollView style={{ maxHeight: 360 }}>
                  {CATEGORIES.map(c => {
                    const used = state.sheet.announced[c.key] !== undefined;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        style={[styles.pickerRow, used && styles.pickerRowUsed]}
                        disabled={used}
                        onPress={() => announce(c.key)}
                      >
                        <Text style={[styles.pickerRowText, used && styles.pickerRowTextUsed]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={styles.pickerCancel}
                  onPress={() => setPickerVisible(false)}
                >
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Game over */}
          {state.isGameOver && (
            <View style={styles.gameOverOverlay}>
              <View style={styles.gameOverBanner}>
                <Text style={styles.gameOverText}>
                  {state.finalScore >= 200 ? '🏆 Great Game!' : '🎲 Game Complete'}
                </Text>
                <Text style={styles.gameOverScore}>Final Score: {state.finalScore}</Text>
                <View style={styles.gameOverButtons}>
                  <TouchableOpacity style={styles.playAgainButtonModal} onPress={resetGame}>
                    <Text style={styles.playAgainModalText}>🎮 Play Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeButtonModal}
                    onPress={() => navigation.navigate('Home' as never)}
                    disabled={isPostGameSyncing}
                  >
                    <Text style={styles.closeModalText}>
                      {isPostGameSyncing ? 'Syncing…' : 'Exit'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>

      <InGameChat
        roomId={''}
        currentUserId={user?.id ?? ''}
        gameType="mrotsi"
        visible={true}
      />
      <SyncedYouTubePlayer roomId={null} visible={true} />
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const CELL_W = Math.floor((SCREEN_WIDTH - 24 - 100) / COLUMNS.length);

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent' },
  overlay: { flex: 1 },

  headerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 8,
  },
  totalBox: { alignItems: 'center', minWidth: 70 },
  totalLabel: { color: '#FFD700', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  totalValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  rollStatusBox: { flex: 1, alignItems: 'center' },
  rollStatusText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  announceBadge: { color: '#FFD700', fontSize: 12, marginTop: 2, fontWeight: '700' },
  announceBtn: {
    backgroundColor: 'rgba(139,69,19,0.95)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  announceBtnDisabled: { opacity: 0.4 },
  announceBtnText: { color: '#FFD700', fontWeight: '700', fontSize: 12 },

  diceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 4,
  },
  dieWrap: {
    borderRadius: 10,
    padding: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  dieWrapKept: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.1)' },
  keepBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  keepBadgeText: { color: '#3b1c00', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  tipText: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  rollBtnWrap: { alignItems: 'center', marginBottom: 8 },
  rollButton: {
    backgroundColor: 'rgba(34,139,34,0.95)',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 200,
    borderWidth: 2,
    borderColor: '#228B22',
  },
  rollButtonDisabled: { backgroundColor: 'rgba(80,80,80,0.7)', borderColor: '#555' },
  rollButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },

  sheetScroll: { flex: 1, marginHorizontal: 8 },
  sheetScrollContent: {
    paddingBottom: 60,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingVertical: 6,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'stretch' },
  sheetRowLabel: {
    width: 100,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  sheetRowLabelText: { color: '#FFD700', fontWeight: '700', fontSize: 13 },
  sheetSubLabel: { color: '#fff', fontSize: 12, fontStyle: 'italic', opacity: 0.9 },
  sheetCellHeader: {
    width: CELL_W,
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  sheetCellHeaderText: { color: '#FFD700', fontSize: 13, fontWeight: '900' },
  sheetCell: {
    width: CELL_W,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  sheetCellFilled: { backgroundColor: 'rgba(34,139,34,0.30)' },
  sheetCellWriteable: { backgroundColor: 'rgba(255,215,0,0.18)' },
  sheetCellText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  sheetCellTextFilled: { color: '#fff', fontWeight: '800' },
  sheetCellTextZero: { color: 'rgba(255,255,255,0.5)' },
  sectionDivider: {
    height: 2,
    backgroundColor: 'rgba(255,215,0,0.4)',
    marginVertical: 4,
  },
  sheetTotalRow: { backgroundColor: 'rgba(139,69,19,0.5)' },
  sheetTotalLabel: { color: '#FFD700', fontWeight: '900', fontSize: 14 },
  sheetTotalCellText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  subtotalText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  pickerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 100,
  },
  pickerCard: {
    width: SCREEN_WIDTH * 0.82,
    backgroundColor: 'rgba(40,20,5,0.97)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  pickerTitle: { color: '#FFD700', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  pickerRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  pickerRowUsed: { opacity: 0.35 },
  pickerRowText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  pickerRowTextUsed: { color: 'rgba(255,255,255,0.5)' },
  pickerCancel: {
    marginTop: 12,
    backgroundColor: 'rgba(220,20,60,0.9)',
    borderRadius: 10,
    paddingVertical: 10,
  },
  pickerCancelText: { color: '#fff', fontWeight: '900', textAlign: 'center', fontSize: 15 },

  gameOverOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 90,
  },
  gameOverBanner: {
    backgroundColor: 'rgba(139,69,19,0.97)',
    padding: 28, borderRadius: 22,
    alignItems: 'center',
    borderWidth: 3, borderColor: '#FFD700',
    minWidth: SCREEN_WIDTH * 0.7,
  },
  gameOverText: { fontSize: 26, fontWeight: '900', color: '#FFD700', marginBottom: 10 },
  gameOverScore: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 18 },
  gameOverButtons: { flexDirection: 'row', gap: 10 },
  playAgainButtonModal: {
    backgroundColor: 'rgba(34,139,34,0.95)',
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 12, borderWidth: 2, borderColor: '#228B22',
  },
  playAgainModalText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  closeButtonModal: {
    backgroundColor: 'rgba(220,20,60,0.95)',
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 12, borderWidth: 2, borderColor: '#DC143C',
  },
  closeModalText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  recenterBtn: {
    position: 'absolute', bottom: 200, alignSelf: 'center',
    left: '50%', transform: [{ translateX: -54 }],
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10,
  },
  recenterIcon: { fontSize: 20, color: '#fff' },
  recenterLabel: { fontSize: 13, color: '#fff', fontWeight: '600', letterSpacing: 0.3 },
});

export default MrotsiScreen;
