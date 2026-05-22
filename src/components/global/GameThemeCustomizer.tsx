/**
 * GameThemeCustomizer
 *
 * Full-screen in-game customization panel for Chess & Checkers.
 * Two tabs — Board and Pieces — each showing 6 save slots.
 * Users enter a text prompt and generate AI assets into any slot,
 * then tap a slot to make it the active theme.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
} from 'react-native';

import {
  generateChessPieceSet,
  generateCheckersPieceSet,
  generateGameBoard,
  type GameType,
  type GeneratedPiece,
  type PieceGenerationProgress,
} from '../../services/pieceImageGeneration.service';
import { BisetkaAlert } from '../../utils/BisetkaAlert';

const { width: SW } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BoardSlot {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
}

export interface PieceSlot {
  id: string;
  prompt: string;
  pieces: Record<string, string>; // e.g. { 'white-king': url }
  boardImage?: string;
  createdAt: number;
}

export interface GameTheme {
  activeBoard?: BoardSlot;
  activePieces?: PieceSlot;
}

interface GameThemeCustomizerProps {
  visible: boolean;
  onClose: () => void;
  gameType: GameType;
  /** Called when user taps Apply — passes the current active board + pieces */
  onApply: (theme: GameTheme) => void;
  initialTheme?: GameTheme;
}

// ─── Preset prompts ───────────────────────────────────────────────────────────

const BOARD_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'Marble',    prompt: 'Luxury white marble and dark granite chess board, top-down view, photorealistic' },
  { label: 'Forest',    prompt: 'Mossy forest floor game board with wood grain squares, nature aesthetic, top-down' },
  { label: 'Neon',      prompt: 'Futuristic neon-lit glowing grid game board, cyberpunk, top-down view' },
  { label: 'Golden',    prompt: 'Ornate gold and obsidian inlaid game board, luxury royal, top-down' },
  { label: 'Sand',      prompt: 'Desert sand stone ancient etched game board, top-down view' },
  { label: 'Galaxy',    prompt: 'Deep space cosmic nebula game board, glowing star squares, top-down' },
];

const PIECE_PROMPTS: Record<GameType, { label: string; prompt: string }[]> = {
  chess: [
    { label: 'Marble',    prompt: 'Elegant white marble and black obsidian chess pieces' },
    { label: 'Steampunk', prompt: 'Brass and copper steampunk robot chess pieces' },
    { label: 'Crystal',   prompt: 'Glowing magical crystal chess pieces, transparent' },
    { label: 'Medieval',  prompt: 'Ancient weathered stone carved castle chess pieces' },
    { label: 'Neon',      prompt: 'Glowing neon cyberpunk holographic chess pieces' },
    { label: 'Wood',      prompt: 'Hand-carved rustic wooden chess pieces, detailed grain' },
  ],
  checkers: [
    { label: 'Glossy',    prompt: 'Glossy smooth plastic checkers discs, high shine' },
    { label: 'Poker',     prompt: 'Casino poker chip style checkers pieces' },
    { label: 'Metal',     prompt: 'Heavy metallic gold and silver coin checkers' },
    { label: 'Glass',     prompt: 'Translucent colored art glass checkers discs' },
    { label: 'Stone',     prompt: 'Smooth polished river stone checkers pebbles' },
    { label: 'Wood',      prompt: 'Lacquered hand-turned wooden checkers discs' },
  ],
};

const MAX_SLOTS = 6;

// ─── Component ────────────────────────────────────────────────────────────────

const GameThemeCustomizer: React.FC<GameThemeCustomizerProps> = ({
  visible,
  onClose,
  gameType,
  onApply,
  initialTheme,
}) => {
  type Tab = 'board' | 'pieces';
  const [tab, setTab] = useState<Tab>('board');

  // Board state
  const [boardSlots,       setBoardSlots]       = useState<(BoardSlot | null)[]>(Array(MAX_SLOTS).fill(null));
  const [activeBoardIdx,   setActiveBoardIdx]   = useState<number | null>(null);
  const [selectedBoardSlot,setSelectedBoardSlot]= useState<number>(0);
  const [boardPrompt,      setBoardPrompt]      = useState('');
  const [isGenBoard,       setIsGenBoard]       = useState(false);

  // Pieces state
  const [pieceSlots,       setPieceSlots]       = useState<(PieceSlot | null)[]>(Array(MAX_SLOTS).fill(null));
  const [activePieceIdx,   setActivePieceIdx]   = useState<number | null>(null);
  const [selectedPieceSlot,setSelectedPieceSlot]= useState<number>(0);
  const [piecePrompt,      setPiecePrompt]      = useState('');
  const [isGenPieces,      setIsGenPieces]      = useState(false);
  const [pieceProgress,    setPieceProgress]    = useState<PieceGenerationProgress | null>(null);

  const totalPieces = gameType === 'chess' ? 12 : 4;

  // ── Board generation ────────────────────────────────────────────────────

  const handleGenerateBoard = useCallback(async () => {
    const prompt = boardPrompt.trim();
    if (!prompt) {
      BisetkaAlert.error('No prompt', 'Enter a description for the board first.');
      return;
    }
    setIsGenBoard(true);
    try {
      const url = await generateGameBoard(gameType, prompt);
      const slot: BoardSlot = { id: `board_${Date.now()}`, prompt, imageUrl: url, createdAt: Date.now() };
      setBoardSlots(prev => {
        const next = [...prev];
        next[selectedBoardSlot] = slot;
        return next;
      });
      setActiveBoardIdx(selectedBoardSlot);
      BisetkaAlert.success('Board ready!', 'Your custom board has been generated.');
    } catch {
      BisetkaAlert.error('Generation failed', 'Could not generate board. Try a different prompt.');
    } finally {
      setIsGenBoard(false);
    }
  }, [boardPrompt, gameType, selectedBoardSlot]);

  // ── Piece generation ────────────────────────────────────────────────────

  const handleGeneratePieces = useCallback(async () => {
    const prompt = piecePrompt.trim();
    if (!prompt) {
      BisetkaAlert.error('No prompt', 'Enter a style description for the pieces first.');
      return;
    }
    setIsGenPieces(true);
    setPieceProgress({ current: 0, total: totalPieces, currentPiece: '' });
    try {
      const generated = gameType === 'chess'
        ? await generateChessPieceSet(prompt, setPieceProgress)
        : await generateCheckersPieceSet(prompt, setPieceProgress);

      const record: Record<string, string> = {};
      generated.forEach((p: GeneratedPiece) => { record[p.type] = p.transparentUrl || p.url; });

      const slot: PieceSlot = { id: `pieces_${Date.now()}`, prompt, pieces: record, createdAt: Date.now() };
      setPieceSlots(prev => {
        const next = [...prev];
        next[selectedPieceSlot] = slot;
        return next;
      });
      setActivePieceIdx(selectedPieceSlot);
      BisetkaAlert.success('Pieces ready!', `All ${totalPieces} pieces generated.`);
    } catch {
      BisetkaAlert.error('Generation failed', 'Could not generate pieces. Try a different prompt.');
    } finally {
      setIsGenPieces(false);
      setPieceProgress(null);
    }
  }, [piecePrompt, gameType, selectedPieceSlot, totalPieces]);

  // ── Apply ───────────────────────────────────────────────────────────────

  const handleApply = () => {
    const theme: GameTheme = {
      activeBoard:  activeBoardIdx  != null ? boardSlots[activeBoardIdx]  ?? undefined : undefined,
      activePieces: activePieceIdx  != null ? pieceSlots[activePieceIdx]  ?? undefined : undefined,
    };
    onApply(theme);
    onClose();
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const pieceHints = PIECE_PROMPTS[gameType];

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.root}>
        {/* Tap backdrop to dismiss */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={[styles.content, { backgroundColor:'#0f0f1a' }]}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>
                  {gameType === 'chess' ? '♟️ Chess Customizer' : '⚫ Checkers Customizer'}
                </Text>
                <Text style={styles.headerSub}>AI-generated boards & pieces</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Tab bar */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'board' && styles.tabBtnActive]}
                onPress={() => setTab('board')}>
                <Text style={[styles.tabLabel, tab === 'board' && styles.tabLabelActive]}>🎲 Game Board</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'pieces' && styles.tabBtnActive]}
                onPress={() => setTab('pieces')}>
                <Text style={[styles.tabLabel, tab === 'pieces' && styles.tabLabelActive]}>
                  {gameType === 'chess' ? '♟ Pieces' : '⚫ Pieces'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">

              {/* ══ BOARD TAB ══════════════════════════════════════════════ */}
              {tab === 'board' && (
                <>
                  <Text style={styles.sectionTitle}>6 Board Slots</Text>
                  <Text style={styles.sectionSub}>
                    Select a slot, then describe and generate. Tap a filled slot to make it active.
                  </Text>

                  {/* 6-slot grid */}
                  <View style={styles.slotGrid}>
                    {boardSlots.map((slot, i) => {
                      const isSelected = selectedBoardSlot === i;
                      const isActive   = activeBoardIdx    === i;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[
                            styles.slot,
                            isSelected && styles.slotSelected,
                            isActive   && styles.slotActive,
                          ]}
                          onPress={() => {
                            setSelectedBoardSlot(i);
                            if (slot) setActiveBoardIdx(i);
                          }}
                          activeOpacity={0.75}>
                          {slot ? (
                            <>
                              <Image source={{ uri: slot.imageUrl }} style={styles.slotImg} resizeMode="cover" />
                              <View style={styles.slotOverlay}>
                                {isActive && (
                                  <View style={styles.activeBadge}>
                                    <Text style={styles.activeBadgeText}>✓ ACTIVE</Text>
                                  </View>
                                )}
                                <Text style={styles.slotPromptText} numberOfLines={2}>{slot.prompt}</Text>
                              </View>
                            </>
                          ) : (
                            <View style={styles.emptySlot}>
                              <Text style={styles.emptySlotNum}>{i + 1}</Text>
                              <Text style={styles.emptySlotLabel}>
                                {isSelected ? '← Generate here' : 'Empty'}
                              </Text>
                            </View>
                          )}
                          {isSelected && <View style={styles.selectionRing} pointerEvents="none" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Quick pick prompts */}
                  <Text style={styles.quickLabel}>Quick prompts:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
                    {BOARD_PROMPTS.map(bp => (
                      <TouchableOpacity
                        key={bp.label}
                        style={styles.quickChip}
                        onPress={() => setBoardPrompt(bp.prompt)}>
                        <Text style={styles.quickChipText}>{bp.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Prompt input */}
                  <Text style={styles.inputLabel}>Prompt for slot {selectedBoardSlot + 1}</Text>
                  <TextInput
                    style={styles.promptInput}
                    placeholder="e.g. Volcanic lava board with glowing cracks…"
                    placeholderTextColor="#555"
                    value={boardPrompt}
                    onChangeText={setBoardPrompt}
                    multiline
                    numberOfLines={3}
                  />

                  <TouchableOpacity
                    style={[styles.genBtn, isGenBoard && styles.genBtnDisabled]}
                    onPress={handleGenerateBoard}
                    disabled={isGenBoard}
                    activeOpacity={0.8}>
                    <View
                      style={[styles.genBtnGradient, { backgroundColor: isGenBoard ? '#333' : '#6366f1' }]}>
                      {isGenBoard ? (
                        <View style={styles.genBtnRow}>
                          <ActivityIndicator color="#fff" size="small" />
                          <Text style={styles.genBtnText}>  Generating board…</Text>
                        </View>
                      ) : (
                        <Text style={styles.genBtnText}>🎲 Generate Board → Slot {selectedBoardSlot + 1}</Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Cost note */}
                  <View style={styles.costNote}>
                    <Text style={styles.costText}>💡 ~$0.04 per board · Powered by DALL-E 3</Text>
                  </View>
                </>
              )}

              {/* ══ PIECES TAB ═════════════════════════════════════════════ */}
              {tab === 'pieces' && (
                <>
                  <Text style={styles.sectionTitle}>6 Piece-Set Slots</Text>
                  <Text style={styles.sectionSub}>
                    Each slot holds a full set of {totalPieces} pieces. Tap filled slot to activate.
                  </Text>

                  {/* 6-slot grid */}
                  <View style={styles.slotGrid}>
                    {pieceSlots.map((slot, i) => {
                      const isSelected = selectedPieceSlot === i;
                      const isActive   = activePieceIdx    === i;
                      // Pick a representative thumbnail (first piece)
                      const thumbKey   = slot ? Object.keys(slot.pieces)[0] : null;
                      const thumbUri   = thumbKey ? slot!.pieces[thumbKey] : null;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[
                            styles.slot,
                            isSelected && styles.slotSelected,
                            isActive   && styles.slotActive,
                          ]}
                          onPress={() => {
                            setSelectedPieceSlot(i);
                            if (slot) setActivePieceIdx(i);
                          }}
                          activeOpacity={0.75}>
                          {slot && thumbUri ? (
                            <>
                              {/* Mosaic of first 4 pieces */}
                              <View style={styles.pieceMosaic}>
                                {Object.values(slot.pieces).slice(0, 4).map((uri, pi) => (
                                  <Image key={pi} source={{ uri }} style={styles.mosaicImg} resizeMode="contain" />
                                ))}
                              </View>
                              <View style={styles.slotOverlay}>
                                {isActive && (
                                  <View style={styles.activeBadge}>
                                    <Text style={styles.activeBadgeText}>✓ ACTIVE</Text>
                                  </View>
                                )}
                                <Text style={styles.slotPromptText} numberOfLines={1}>{slot.prompt}</Text>
                              </View>
                            </>
                          ) : (
                            <View style={styles.emptySlot}>
                              <Text style={styles.emptySlotNum}>{i + 1}</Text>
                              <Text style={styles.emptySlotLabel}>
                                {isSelected ? '← Generate here' : 'Empty'}
                              </Text>
                            </View>
                          )}
                          {isSelected && <View style={styles.selectionRing} pointerEvents="none" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Quick pick */}
                  <Text style={styles.quickLabel}>Quick prompts:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
                    {pieceHints.map(ph => (
                      <TouchableOpacity
                        key={ph.label}
                        style={styles.quickChip}
                        onPress={() => setPiecePrompt(ph.prompt)}>
                        <Text style={styles.quickChipText}>{ph.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Prompt input */}
                  <Text style={styles.inputLabel}>
                    Describe piece style for slot {selectedPieceSlot + 1}
                  </Text>
                  <TextInput
                    style={styles.promptInput}
                    placeholder={`e.g. Glowing crystal ${gameType} pieces on black background…`}
                    placeholderTextColor="#555"
                    value={piecePrompt}
                    onChangeText={setPiecePrompt}
                    multiline
                    numberOfLines={3}
                  />

                  {/* Progress bar */}
                  {isGenPieces && pieceProgress && (
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round((pieceProgress.current / pieceProgress.total) * 100)}%` },
                        ]}
                      />
                      <Text style={styles.progressLabel}>
                        {pieceProgress.currentPiece
                          ? `Generating ${pieceProgress.currentPiece}…`
                          : `${pieceProgress.current} / ${pieceProgress.total} pieces`}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.genBtn, isGenPieces && styles.genBtnDisabled]}
                    onPress={handleGeneratePieces}
                    disabled={isGenPieces}
                    activeOpacity={0.8}>
                    <View
                      style={[styles.genBtnGradient, { backgroundColor: isGenPieces ? '#333' : '#7c3aed' }]}>
                      {isGenPieces ? (
                        <View style={styles.genBtnRow}>
                          <ActivityIndicator color="#fff" size="small" />
                          <Text style={styles.genBtnText}>
                            {'  '}
                            {pieceProgress
                              ? `${pieceProgress.current}/${pieceProgress.total} pieces…`
                              : 'Starting…'}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.genBtnText}>
                          ✨ Generate {totalPieces} Pieces → Slot {selectedPieceSlot + 1}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Preview strip of active set */}
                  {activePieceIdx != null && pieceSlots[activePieceIdx] && (
                    <View style={styles.activePreviewBox}>
                      <Text style={styles.activePreviewTitle}>
                        ✓ Active set — {Object.keys(pieceSlots[activePieceIdx]!.pieces).length} pieces
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.activePreviewRow}>
                          {Object.entries(pieceSlots[activePieceIdx]!.pieces).map(([key, uri]) => (
                            <View key={key} style={styles.activePieceThumb}>
                              <Image source={{ uri }} style={styles.activePieceImg} resizeMode="contain" />
                              <Text style={styles.activePieceKey} numberOfLines={1}>{key}</Text>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  <View style={styles.costNote}>
                    <Text style={styles.costText}>
                      {`💡 ~$${gameType === 'chess' ? '0.50' : '0.20'} per set · ${totalPieces} images · DALL-E 3`}
                    </Text>
                  </View>
                </>
              )}

              {/* ══ APPLY button (always visible at bottom) ═══════════════ */}
              <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.85}>
                <View
                  style={[styles.applyGradient, { backgroundColor: '#10b981' }]}>
                  <Text style={styles.applyText}>✓ Apply to Game</Text>
                </View>
              </TouchableOpacity>

              <View style={{ height: Platform.OS === 'ios' ? 40 : 24 }} />
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const SLOT_SIZE = (SW - 48 - 12) / 3; // 3 per row, 16px outer padding each side + 12px gaps

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    height: '88%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  sheetInner: {
    flex: 1,
  },
  handle: {
    alignSelf: 'center',
    marginTop: 10,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  closeBtn: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 30,
  },
  // ── Tabs ──
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: '#6366f1',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.38)',
  },
  tabLabelActive: {
    color: '#fff',
  },
  // ── Scroll ──
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 14,
    lineHeight: 18,
  },
  // ── 6-slot grid ──
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  slotSelected: {
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  slotActive: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  selectionRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  slotImg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  slotOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'space-between',
    padding: 6,
  },
  activeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#10b981',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  slotPromptText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    lineHeight: 12,
  },
  emptySlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptySlotNum: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.15)',
  },
  emptySlotLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  // ── Piece mosaic ──
  pieceMosaic: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 4,
    gap: 2,
  },
  mosaicImg: {
    width: (SLOT_SIZE - 12) / 2,
    height: (SLOT_SIZE - 12) / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
  },
  // ── Quick chips ──
  quickLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  quickScroll: {
    marginBottom: 16,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
    marginRight: 8,
  },
  quickChipText: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: '600',
  },
  // ── Prompt input ──
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  promptInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    color: '#fff',
    fontSize: 14,
    padding: 14,
    height: 90,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  // ── Generate button ──
  genBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  genBtnDisabled: {
    opacity: 0.7,
  },
  genBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // ── Progress bar ──
  progressBar: {
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    justifyContent: 'center',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
  },
  progressLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    zIndex: 1,
  },
  // ── Active pieces preview ──
  activePreviewBox: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    padding: 12,
    marginBottom: 16,
  },
  activePreviewTitle: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  activePreviewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  activePieceThumb: {
    alignItems: 'center',
    width: 56,
  },
  activePieceImg: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
  },
  activePieceKey: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
    marginTop: 3,
    textAlign: 'center',
  },
  // ── Cost note ──
  costNote: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
  },
  costText: {
    color: '#a5b4fc',
    fontSize: 12,
    textAlign: 'center',
  },
  // ── Apply button ──
  applyBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 8,
  },
  applyGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  applyText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});

export default GameThemeCustomizer;
