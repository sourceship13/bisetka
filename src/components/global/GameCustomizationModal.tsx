import React, { useState } from 'react';
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
} from 'react-native';
import {
  generateChessPieceSet,
  generateCheckersPieceSet,
  generateGameBoard,
  type GameType,
  type GeneratedPiece,
  type PieceGenerationProgress,
} from '../../services/pieceImageGeneration.service';
import { PRESET_THEMES, PRESET_CARD_BACKS, FONT_PREVIEWS } from '../../data/cardPresets';
import { BisetkaAlert } from '../../utils/BisetkaAlert';
import apiService from '../../services/api.service';

// ─── Card types ───────────────────────────────────────────────────────────────

export type CardFont =
  | 'Inter_18pt-Regular'
  | 'Cinzel-Bold'
  | 'BebasNeue-Regular'
  | 'PlayfairDisplaySC-Bold'
  | 'EBGaramond-Bold'
  | 'CrimsonText-Bold'
  | 'Fredoka-Bold'
  | 'JetBrainsMono-Bold'
  | 'SpaceMono-Regular'
  | 'RobotoMono-Regular';

export interface CardTheme {
  id: string;
  name: string;
  backgroundImage?: string;
  boardImage?: string;
  cardBackImage?: string;
  font: CardFont;
  createdAt: number;
}

// ─── Piece types ──────────────────────────────────────────────────────────────

export interface PieceSet {
  id: string;
  name: string;
  gameType: GameType;
  prompt: string;
  pieces: Record<string, string>;
  boardImage?: string;
  createdAt: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CardCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (theme: CardTheme) => void;
  currentTheme?: CardTheme;
  // Optional – enables the Pieces tab
  gameType?: GameType;
  currentPieceSet?: PieceSet;
  onSavePieceSet?: (pieceSet: PieceSet) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONTS: { id: CardFont; name: string; description: string }[] = [
  { id: 'Inter_18pt-Regular',     name: 'Inter',          description: 'Clean modern sans-serif' },
  { id: 'Cinzel-Bold',            name: 'Cinzel',         description: 'Elegant Roman display' },
  { id: 'BebasNeue-Regular',      name: 'Bebas Neue',     description: 'Bold all-caps condensed' },
  { id: 'PlayfairDisplaySC-Bold', name: 'Playfair SC',    description: 'Luxury serif small-caps' },
  { id: 'EBGaramond-Bold',        name: 'EB Garamond',    description: 'Classical book serif' },
  { id: 'CrimsonText-Bold',       name: 'Crimson Text',   description: 'Traditional newsprint serif' },
  { id: 'Fredoka-Bold',           name: 'Fredoka',        description: 'Playful rounded sans' },
  { id: 'JetBrainsMono-Bold',     name: 'JetBrains Mono', description: 'Technical monospace' },
  { id: 'SpaceMono-Regular',      name: 'Space Mono',     description: 'Retro digital mono' },
  { id: 'RobotoMono-Regular',     name: 'Roboto Mono',    description: 'Clean technical mono' },
];

const PRESET_PROMPTS: Record<GameType, Array<{ name: string; prompt: string; description: string }>> = {
  chess: [
    { name: 'Classic Marble',  prompt: 'elegant white marble and black obsidian',    description: 'Traditional luxury' },
    { name: 'Steampunk',       prompt: 'brass and copper steampunk robot',            description: 'Victorian sci-fi' },
    { name: 'Fantasy Crystal', prompt: 'glowing magical crystal',                    description: 'Mystical gems' },
    { name: 'Medieval Stone',  prompt: 'ancient weathered stone carved',             description: 'Historical fortress' },
    { name: 'Neon Cyber',      prompt: 'glowing neon cyberpunk holographic',         description: 'Futuristic tech' },
    { name: 'Wood Carved',     prompt: 'hand-carved wooden rustic',                  description: 'Natural organic' },
  ],
  checkers: [
    { name: 'Classic Glossy',  prompt: 'glossy smooth plastic',                      description: 'Traditional shine' },
    { name: 'Poker Chips',     prompt: 'casino poker chip style',                    description: 'Vegas vibes' },
    { name: 'Metal Coins',     prompt: 'metallic gold and silver coin',              description: 'Precious metals' },
    { name: 'Glass Discs',     prompt: 'translucent colored glass',                  description: 'Elegant transparent' },
    { name: 'Stone Pebbles',   prompt: 'smooth river stone',                         description: 'Natural zen' },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────

const GameCustomizationModal: React.FC<CardCustomizationModalProps> = ({
  visible,
  onClose,
  onSave,
  currentTheme,
  gameType,
  currentPieceSet,
  onSavePieceSet,
}) => {
  const hasPiecesTab = Boolean(gameType);
  const [activeTab,  setActiveTab]  = useState<'cards' | 'pieces'>('cards');
  const [aiProvider, setAiProvider] = useState<'openai' | 'fal' | 'google'>('openai');
  // ── Card state ────────────────────────────────────────────────────────────
  const [themeName,           setThemeName]           = useState(currentTheme?.name || '');
  const [backgroundPrompt,    setBackgroundPrompt]    = useState('');
  const [boardBackgroundPrompt,    setBoardBackgroundPrompt]    = useState('');
  const [cardBackPrompt,      setCardBackPrompt]      = useState('');
  const [selectedFont,        setSelectedFont]        = useState<CardFont>(currentTheme?.font || 'Inter_18pt-Regular');
  const [generatedBoardBg,    setGeneratedBoardBg]    = useState<string | null>(null);
  const [savedBoardBg,        setSavedBoardBg]        = useState<string | null>(currentTheme?.boardImage || null);
  const [generatedBackground, setGeneratedBackground] = useState<string | null>(null);
  const [savedBackground,     setSavedBackground]     = useState<string | null>(currentTheme?.backgroundImage || null);
  const [generatedCardBack,   setGeneratedCardBack]   = useState<string | null>(null);
  const [savedCardBack,       setSavedCardBack]       = useState<string | null>(currentTheme?.cardBackImage   || null);
  const [isGeneratingBoardBg, setIsGeneratingBoardBg] = useState(false);
  const [isGeneratingBg,      setIsGeneratingBg]      = useState(false);
  const [isGeneratingBack,    setIsGeneratingBack]    = useState(false);

  // ── Piece state ───────────────────────────────────────────────────────────
  const [pieceSetName,        setPieceSetName]        = useState(currentPieceSet?.name   || '');
  const [piecePrompt,         setPiecePrompt]         = useState(currentPieceSet?.prompt || '');
  const [generatedPieces,     setGeneratedPieces]     = useState<Record<string, string>>(currentPieceSet?.pieces || {});
  const [generatedBoard,      setGeneratedBoard]      = useState<string | null>(currentPieceSet?.boardImage || null);
  const [isGeneratingPieces,  setIsGeneratingPieces]  = useState(false);
  const [isGeneratingBoard,   setIsGeneratingBoard]   = useState(false);
  const [pieceProgress,       setPieceProgress]       = useState<PieceGenerationProgress | null>(null);

  const totalPieces = gameType === 'chess' ? 12 : 4;
  const pieceCount  = Object.keys(generatedPieces).length;
  const presets     = gameType ? PRESET_PROMPTS[gameType] : [];

  // ── Card handlers ─────────────────────────────────────────────────────────

  const generateBackground = async () => {
    if (!backgroundPrompt.trim()) { BisetkaAlert.error('Error', 'Please enter a background theme prompt'); return; }
    setIsGeneratingBg(true);
    try {
      const result = await apiService.generateCardFaceBackground(backgroundPrompt, aiProvider);
      setGeneratedBackground(result.url);
    } catch {
      BisetkaAlert.error('Error', 'Failed to generate background. Please try again.');
    } finally { setIsGeneratingBg(false); }
  };
  
  const generateBoardBackground = async () => {
    if (!boardBackgroundPrompt.trim()) { BisetkaAlert.error('Error', 'Please enter a board background prompt'); return; }
    setIsGeneratingBoardBg(true);
    try {
      const result = await apiService.generateBoardBackground(boardBackgroundPrompt, aiProvider);
      setGeneratedBoardBg(result.url);
    } catch {
      BisetkaAlert.error('Error', 'Failed to generate board background. Please try again.');
    } finally { setIsGeneratingBoardBg(false); }
  };

  const generateCardBack = async () => {
    if (!cardBackPrompt.trim()) { BisetkaAlert.error('Error', 'Please enter a card back design prompt'); return; }
    setIsGeneratingBack(true);
    try {
      const result = await apiService.generateCardBackDesign(cardBackPrompt, aiProvider);
      setGeneratedCardBack(result.url);
    } catch {
      BisetkaAlert.error('Error', 'Failed to generate card back. Please try again.');
    } finally { setIsGeneratingBack(false); }
  };

  // Auto-save helper: pushes current state to the game immediately
  const autoSave = (overrides: Partial<CardTheme> = {}) => {
    const theme: CardTheme = {
      id: currentTheme?.id || `theme_${Date.now()}`,
      name: themeName || currentTheme?.name || 'Custom Theme',
      backgroundImage: savedBackground || generatedBackground || undefined,
      boardImage: savedBoardBg || generatedBoardBg || undefined,
      cardBackImage: savedCardBack || generatedCardBack || undefined,
      font: selectedFont,
      createdAt: Date.now(),
      ...overrides,
    };
    onSave(theme);
  };

  const handleSave = () => {
    if (!themeName.trim()) { BisetkaAlert.error('Error', 'Please enter a theme name'); return; }
    autoSave();
    onClose();
  };

  // ── Piece handlers ────────────────────────────────────────────────────────

  const generatePieces = async () => {
    if (!piecePrompt.trim()) { BisetkaAlert.error('Error', 'Please enter a style prompt for your pieces'); return; }
    if (!gameType) return;
    setIsGeneratingPieces(true);
    setPieceProgress({ current: 0, total: totalPieces, currentPiece: '' });
    try {
      const pieces = gameType === 'chess'
        ? await generateChessPieceSet(piecePrompt, setPieceProgress)
        : await generateCheckersPieceSet(piecePrompt, setPieceProgress);
      const record: Record<string, string> = {};
      pieces.forEach((p: GeneratedPiece) => { record[p.type] = p.transparentUrl || p.url; });
      setGeneratedPieces(record);
      BisetkaAlert.success('Success', `All ${totalPieces} pieces generated!`);
    } catch {
      BisetkaAlert.error('Error', 'Failed to generate pieces. Please try again.');
    } finally { setIsGeneratingPieces(false); setPieceProgress(null); }
  };

  const generateBoard = async () => {
    if (!piecePrompt.trim()) { BisetkaAlert.error('Error', 'Please enter a style prompt for your board'); return; }
    if (!gameType) return;
    setIsGeneratingBoard(true);
    try {
      const url = await generateGameBoard(gameType, piecePrompt);
      setGeneratedBoard(url);
      BisetkaAlert.success('Success', 'Board generated!');
    } catch {
      BisetkaAlert.error('Error', 'Failed to generate board. Please try again.');
    } finally { setIsGeneratingBoard(false); }
  };

  const handleSavePieces = () => {
    if (!pieceSetName.trim()) { BisetkaAlert.error('Error', 'Please enter a name for this piece set'); return; }
    if (pieceCount === 0)     { BisetkaAlert.error('Error', 'Please generate pieces first'); return; }
    if (!gameType) return;
    const pieceSet: PieceSet = {
      id: currentPieceSet?.id || `pieceset_${Date.now()}`,
      name: pieceSetName,
      gameType,
      prompt: piecePrompt,
      pieces: generatedPieces,
      boardImage: generatedBoard || undefined,
      createdAt: Date.now(),
    };
    onSavePieceSet?.(pieceSet);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {activeTab === 'pieces'
                  ? (gameType === 'chess' ? '♟️ Customize Pieces' : '⚫ Customize Pieces')
                  : '🎨 Customize Cards'}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* AI Provider Toggle */}
            <View style={styles.providerRow}>
              <TouchableOpacity
                style={[styles.providerOption, aiProvider === 'openai' && styles.providerOptionActive]}
                onPress={() => setAiProvider('openai')}>
                <Text style={[styles.providerOptionText, aiProvider === 'openai' && styles.providerOptionTextActive]}>OpenAI DALL·E</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.providerOption, aiProvider === 'fal' && styles.providerOptionActive]}
                onPress={() => setAiProvider('fal')}>
                <Text style={[styles.providerOptionText, aiProvider === 'fal' && styles.providerOptionTextActive]}>fal.ai Flux</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.providerOption, aiProvider === 'google' && styles.providerOptionActive]}
                onPress={() => setAiProvider('google')}>
                <Text style={[styles.providerOptionText, aiProvider === 'google' && styles.providerOptionTextActive]}>Google Imagen</Text>
              </TouchableOpacity>
            </View>

            {/* Tab bar — only shown when gameType is provided */}
            {hasPiecesTab && (
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'cards' && styles.tabActive]}
                  onPress={() => setActiveTab('cards')}>
                  <Text style={[styles.tabText, activeTab === 'cards' && styles.tabTextActive]}>🃏 Cards</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'pieces' && styles.tabActive]}
                  onPress={() => setActiveTab('pieces')}>
                  <Text style={[styles.tabText, activeTab === 'pieces' && styles.tabTextActive]}>
                    {gameType === 'chess' ? '♟️ Pieces' : '⚫ Pieces'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── CARDS TAB ───────────────────────────────────────────────── */}
            {activeTab === 'cards' && (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Preset Themes */}
              <View style={styles.section}>
                <Text style={styles.label}>🎨 Preset Themes</Text>
                <Text style={styles.sublabel}>Quick start with pre-designed themes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
                  {PRESET_THEMES.map((preset) => (
                    <TouchableOpacity
                      key={preset.presetId}
                      style={styles.presetCard}
                      onPress={() => {
                        setThemeName(preset.name);
                        setSelectedFont(preset.font);
                        if (preset.backgroundImage != null) {
                          setSavedBackground(
                            typeof preset.backgroundImage === 'string'
                              ? preset.backgroundImage
                              : Image.resolveAssetSource(preset.backgroundImage).uri
                          );
                          setGeneratedBackground(null);
                        }
                        if (preset.cardBackImage != null) {
                          setSavedCardBack(
                            typeof preset.cardBackImage === 'string'
                              ? preset.cardBackImage
                              : Image.resolveAssetSource(preset.cardBackImage).uri
                          );
                          setGeneratedCardBack(null);
                        }
                      }}>
                      {preset.backgroundImage != null && (
                        <Image
                          source={typeof preset.backgroundImage === 'string' ? { uri: preset.backgroundImage } : preset.backgroundImage as any}
                          style={styles.presetThumbnail}
                          resizeMode="cover"
                        />
                      )}
                      <Text style={styles.presetName}>{preset.name}</Text>
                      <Text style={styles.presetDesc}>{preset.description}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Theme Name */}
              <View style={styles.section}>
                <Text style={styles.label}>Theme Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Cyberpunk Tokyo"
                  placeholderTextColor="#888"
                  value={themeName}
                  onChangeText={setThemeName}
                />
              </View>

              {/* Background Texture */}
              <View style={styles.section}>
                <Text style={styles.label}>Board Image</Text>
                <Text style={styles.sublabel}>Type in a description for the board image and we will generate a few options for you to pick from</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. Neon city lights at night, cyberpunk aesthetic"
                  placeholderTextColor="#888"
                  value={boardBackgroundPrompt}
                  onChangeText={setBoardBackgroundPrompt}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={generateBoardBackground}
                  disabled={isGeneratingBoardBg}>
                  {isGeneratingBoardBg ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.generateButtonText}>🎨 Generate Board Background</Text>
                  )}
                </TouchableOpacity>
                {generatedBoardBg && (
                  <View style={styles.preview}>
                    <Image source={{ uri: generatedBoardBg }} style={styles.previewImage} />
                    <Text style={styles.previewLabel}>Preview</Text>
                    <View style={styles.previewActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => { setSavedBoardBg(generatedBoardBg); setGeneratedBoardBg(null); autoSave({ boardImage: generatedBoardBg! }); }}>
                        <Text style={styles.acceptButtonText}>✓ Use This</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.regenerateButton}
                        onPress={generateBoardBackground}
                        disabled={isGeneratingBoardBg}>
                        <Text style={styles.regenerateButtonText}>↻ Regenerate</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {!generatedBoardBg && savedBoardBg && (
                  <View style={styles.preview}>
                    <Image source={{ uri: savedBoardBg }} style={styles.previewImage} />
                    <Text style={styles.savedLabel}>✓ Saved</Text>
                  </View>
                )}
                <Text style={[styles.label, { marginTop: 16 }]}>Or use the default:</Text>
                <TouchableOpacity
                  style={[styles.presetCard, { flexDirection: 'row', alignItems: 'center', width: 'auto' }]}
                  onPress={() => { setSavedBoardBg(null); setGeneratedBoardBg(null); autoSave({ boardImage: undefined }); }}>
                  <Image
                    source={require('../../../assets/blot/card-table.png')}
                    style={{ width: 60, height: 60, borderRadius: 8, marginRight: 12 }}
                    resizeMode="cover"
                  />
                  <View>
                    <Text style={styles.presetName}>Default Board</Text>
                    <Text style={styles.presetDesc}>Classic green card table</Text>
                  </View>
                </TouchableOpacity>
              </View>

               <View style={styles.section}>
                <Text style={styles.label}>Card Face Background</Text>
                <Text style={styles.sublabel}>This texture will appear on all 52 card faces</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. Neon city lights at night, cyberpunk aesthetic"
                  placeholderTextColor="#888"
                  value={backgroundPrompt}
                  onChangeText={setBackgroundPrompt}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={generateBackground}
                  disabled={isGeneratingBg}>
                  {isGeneratingBg ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.generateButtonText}>🎨 Generate Background</Text>
                  )}
                </TouchableOpacity>
                {generatedBackground && (
                  <View style={styles.preview}>
                    <Image source={{ uri: generatedBackground }} style={styles.previewImage} />
                    <Text style={styles.previewLabel}>Preview</Text>
                    <View style={styles.previewActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => { setSavedBackground(generatedBackground); setGeneratedBackground(null); autoSave({ backgroundImage: generatedBackground! }); }}>
                        <Text style={styles.acceptButtonText}>✓ Use This</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.regenerateButton}
                        onPress={generateBackground}
                        disabled={isGeneratingBg}>
                        <Text style={styles.regenerateButtonText}>↻ Regenerate</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {!generatedBackground && savedBackground && (
                  <View style={styles.preview}>
                    <Image source={{ uri: savedBackground }} style={styles.previewImage} />
                    <Text style={styles.savedLabel}>✓ Saved</Text>
                  </View>
                )}
              </View>

              {/* Card Back */}
              <View style={styles.section}>
                <Text style={styles.label}>Card Back Design (Face-Down)</Text>
                <Text style={styles.sublabel}>This appears when cards are face-down</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. Geometric patterns with glowing edges"
                  placeholderTextColor="#888"
                  value={cardBackPrompt}
                  onChangeText={setCardBackPrompt}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={generateCardBack}
                  disabled={isGeneratingBack}>
                  {isGeneratingBack ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.generateButtonText}>🃏 Generate Card Back</Text>
                  )}
                </TouchableOpacity>
                {generatedCardBack && (
                  <View style={styles.preview}>
                    <Image source={{ uri: generatedCardBack }} style={styles.previewImageBack} />
                    <Text style={styles.previewLabel}>Preview</Text>
                    <View style={styles.previewActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => { setSavedCardBack(generatedCardBack); setGeneratedCardBack(null); autoSave({ cardBackImage: generatedCardBack! }); }}>
                        <Text style={styles.acceptButtonText}>✓ Use This</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.regenerateButton}
                        onPress={generateCardBack}
                        disabled={isGeneratingBack}>
                        <Text style={styles.regenerateButtonText}>↻ Regenerate</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {!generatedCardBack && savedCardBack && (
                  <View style={styles.preview}>
                    <Image source={{ uri: savedCardBack }} style={styles.previewImageBack} />
                    <Text style={styles.savedLabel}>✓ Saved</Text>
                  </View>
                )}
                
                {/* Preset Card Backs */}
                <Text style={[styles.label, { marginTop: 16 }]}>Or choose a preset:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
                  {PRESET_CARD_BACKS.map((back) => (
                    <TouchableOpacity
                      key={back.id}
                      style={styles.cardBackPreset}
                      onPress={() => {
                        setSavedCardBack(Image.resolveAssetSource(back.image).uri);
                        setGeneratedCardBack(null);
                      }}>
                      <Image 
                        source={back.image} 
                        style={styles.cardBackThumbnail} 
                        resizeMode="cover"
                      />
                      <Text style={styles.presetName}>{back.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Font Selection */}
              <View style={styles.section}>
                <Text style={styles.label}>Rank Number Font</Text>
                <Text style={styles.sublabel}>Choose from the custom fonts installed in the app</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
                  {FONTS.map((font) => {
                    const preview = FONT_PREVIEWS[font.id];
                    return (
                      <TouchableOpacity
                        key={font.id}
                        style={[
                          styles.fontCard,
                          selectedFont === font.id && styles.fontCardSelected,
                        ]}
                        onPress={() => setSelectedFont(font.id)}>
                        <View style={styles.fontPreview}>
                          <Text style={[styles.fontSample, preview?.style]}>{preview?.sample ?? 'Aa'}</Text>
                        </View>
                        <Text style={styles.presetName}>{font.name}</Text>
                        <Text style={styles.presetDesc}>{font.description}</Text>
                        {selectedFont === font.id && (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedBadgeText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Info */}
              <View style={styles.section}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>💡 How It Works</Text>
                  <Text style={styles.infoText}>
                    • Your background texture appears on all 52 cards{'\n'}
                    • Rank numbers and suit symbols overlay on top{'\n'}
                    • Card back shows when cards are face-down{'\n'}
                    • Only 2 AI generations needed per theme!
                  </Text>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <View style={[styles.saveButtonGradient, { backgroundColor: '#10b981' }]}>
                  <Text style={styles.saveButtonText}>💾 Save Theme</Text>
                </View>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
            )}

            {/* ── PIECES TAB ──────────────────────────────────────────────── */}
            {activeTab === 'pieces' && (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Preset Styles */}
              <View style={styles.section}>
                <Text style={styles.label}>🎨 Preset Styles</Text>
                <Text style={styles.sublabel}>Quick start with popular themes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
                  {presets.map((preset) => (
                    <TouchableOpacity
                      key={preset.name}
                      style={styles.presetCard}
                      onPress={() => { setPiecePrompt(preset.prompt); setPieceSetName(preset.name); }}>
                      <Text style={styles.presetName}>{preset.name}</Text>
                      <Text style={styles.presetDesc}>{preset.description}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Set Name */}
              <View style={styles.section}>
                <Text style={styles.label}>Piece Set Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. My Custom Steampunk Set"
                  placeholderTextColor="#888"
                  value={pieceSetName}
                  onChangeText={setPieceSetName}
                />
              </View>

              {/* Style Prompt + pieces */}
              <View style={styles.section}>
                <Text style={styles.label}>Style Prompt</Text>
                <Text style={styles.sublabel}>
                  {`Describe the style for all ${totalPieces} pieces (${gameType === 'chess' ? '6 white + 6 black' : '2 red + 2 black'})`}
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. glowing neon cyberpunk holographic"
                  placeholderTextColor="#888"
                  value={piecePrompt}
                  onChangeText={setPiecePrompt}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={generatePieces}
                  disabled={isGeneratingPieces}>
                  {isGeneratingPieces ? (
                    <View style={styles.progressContainer}>
                      <ActivityIndicator color="#fff" />
                      {pieceProgress && (
                        <Text style={styles.progressText}>
                          {`Generating ${pieceProgress.currentPiece}... (${pieceProgress.current}/${pieceProgress.total})`}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.generateButtonText}>✨ Generate {totalPieces} Pieces</Text>
                  )}
                </TouchableOpacity>
                {pieceCount > 0 && (
                  <View style={styles.pieceGrid}>
                    <Text style={styles.previewLabel}>{`Generated Pieces (${pieceCount}/${totalPieces})`}</Text>
                    <View style={styles.gridRow}>
                      {Object.entries(generatedPieces).map(([key, url]) => (
                        <View key={key} style={styles.piecePreview}>
                          <Image source={{ uri: url }} style={styles.pieceImage} resizeMode="contain" />
                          <Text style={styles.pieceLabel}>{key}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Board Generation */}
              <View style={styles.section}>
                <Text style={styles.label}>Game Board (Optional)</Text>
                <Text style={styles.sublabel}>Generate a matching board for your pieces</Text>
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={generateBoard}
                  disabled={isGeneratingBoard}>
                  {isGeneratingBoard
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.generateButtonText}>🎲 Generate Board</Text>}
                </TouchableOpacity>
                {generatedBoard && (
                  <View style={styles.preview}>
                    <Image source={{ uri: generatedBoard }} style={styles.boardPreview} />
                    <Text style={styles.previewLabel}>Game Board</Text>
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={styles.section}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>💡 How It Works</Text>
                  <Text style={styles.infoText}>
                    {`• AI generates ${totalPieces} unique pieces in your style\n• Backgrounds are automatically removed\n• Pieces are transparent and ready to use\n• Optionally generate a matching board\n• Cost: ~$${gameType === 'chess' ? '0.50' : '0.20'} per set (DALL-E)`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSavePieces}
                disabled={pieceCount === 0}>
                <View style={styles.saveButtonGradient}>
                  <Text style={styles.saveButtonText}>💾 Save Piece Set</Text>
                </View>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  closeButton: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  generateButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  preview: {
    marginTop: 16,
    alignItems: 'center',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  previewImageBack: {
    width: 140,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  styleOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  styleOptionSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  styleOptionContent: {
    flex: 1,
  },
  styleOptionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  styleOptionTitleSelected: {
    color: '#a5b4fc',
  },
  styleOptionDescription: {
    fontSize: 13,
    color: '#aaa',
  },
  checkmark: {
    fontSize: 24,
    color: '#6366f1',
    fontWeight: '700',
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginVertical: 14,
  },
  previewLabel: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
  },
  savedLabel: {
    fontSize: 13,
    color: '#10b981',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  acceptButton: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  regenerateButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  regenerateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#a5b4fc',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#ddd',
    lineHeight: 22,
  },
  fontOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fontOptionSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  fontOptionContent: {
    flex: 1,
  },
  fontOptionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  fontOptionTitleSelected: {
    color: '#a5b4fc',
  },
  fontOptionDescription: {
    fontSize: 13,
    color: '#aaa',
  },
  // ── Tab bar ──────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
  },
  tabTextActive: {
    color: '#fff',
  },
  // ── Piece grid ────────────────────────────────────────────────────────────
  pieceGrid: {
    marginTop: 16,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  piecePreview: {
    width: 70,
    alignItems: 'center',
  },
  pieceImage: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  pieceLabel: {
    fontSize: 9,
    color: '#aaa',
    marginTop: 4,
    textAlign: 'center',
  },
  boardPreview: {
    width: 250,
    height: 250,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
  },
  presetsScroll: {
    marginTop: 12,
  },
  presetCard: {
    width: 120,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetThumbnail: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  presetName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  presetDesc: {
    fontSize: 11,
    color: '#aaa',
  },
  cardBackPreset: {
    width: 90,
    marginRight: 12,
    alignItems: 'center',
  },
  cardBackThumbnail: {
    width: 70,
    height: 100,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  fontCard: {
    width: 110,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  fontCardSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  fontPreview: {
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fontSample: {
    fontSize: 32,
    color: '#000',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  providerRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  providerOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  providerOptionActive: {
    backgroundColor: '#6366f1',
  },
  providerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  providerOptionTextActive: {
    color: '#fff',
  },
});

export default GameCustomizationModal;
