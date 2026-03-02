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
import LinearGradient from 'react-native-linear-gradient';
import {
  generateChessPieceSet,
  generateCheckersPieceSet,
  generateGameBoard,
  type GameType,
  type GeneratedPiece,
  type PieceGenerationProgress,
} from '../../services/pieceImageGeneration.service';
import { BisetkaAlert } from '../../utils/BisetkaAlert';

export interface PieceSet {
  id: string;
  name: string;
  gameType: GameType;
  prompt: string;
  pieces: Record<string, string>; // e.g. { 'white-king': 'data:image/png;base64,...' }
  boardImage?: string;
  createdAt: number;
}

interface GamePieceCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (pieceSet: PieceSet) => void;
  gameType: GameType; // 'chess' or 'checkers'
  currentPieceSet?: PieceSet;
}

const PRESET_PROMPTS: Record<GameType, Array<{ name: string; prompt: string; description: string }>> = {
  chess: [
    { name: 'Classic Marble', prompt: 'elegant white marble and black obsidian', description: 'Traditional luxury' },
    { name: 'Steampunk', prompt: 'brass and copper steampunk robot', description: 'Victorian sci-fi' },
    { name: 'Fantasy Crystal', prompt: 'glowing magical crystal', description: 'Mystical gems' },
    { name: 'Medieval Stone', prompt: 'ancient weathered stone carved', description: 'Historical fortress' },
    { name: 'Neon Cyber', prompt: 'glowing neon cyberpunk holographic', description: 'Futuristic tech' },
    { name: 'Wood Carved', prompt: 'hand-carved wooden rustic', description: 'Natural organic' },
  ],
  checkers: [
    { name: 'Classic Glossy', prompt: 'glossy smooth plastic', description: 'Traditional shine' },
    { name: 'Poker Chips', prompt: 'casino poker chip style', description: 'Vegas vibes' },
    { name: 'Metal Coins', prompt: 'metallic gold and silver coin', description: 'Precious metals' },
    { name: 'Glass Discs', prompt: 'translucent colored glass', description: 'Elegant transparent' },
    { name: 'Stone Pebbles', prompt: 'smooth river stone', description: 'Natural zen' },
  ],
};

const GamePieceCustomizationModal: React.FC<GamePieceCustomizationModalProps> = ({
  visible,
  onClose,
  onSave,
  gameType,
  currentPieceSet,
}) => {
  const [setName, setSetName] = useState(currentPieceSet?.name || '');
  const [prompt, setPrompt] = useState(currentPieceSet?.prompt || '');
  const [generatedPieces, setGeneratedPieces] = useState<Record<string, string>>(
    currentPieceSet?.pieces || {}
  );
  const [generatedBoard, setGeneratedBoard] = useState<string | null>(
    currentPieceSet?.boardImage || null
  );
  const [isGeneratingPieces, setIsGeneratingPieces] = useState(false);
  const [isGeneratingBoard, setIsGeneratingBoard] = useState(false);
  const [progress, setProgress] = useState<PieceGenerationProgress | null>(null);

  const totalPieces = gameType === 'chess' ? 12 : 4;

  const generatePieces = async () => {
    if (!prompt.trim()) {
      BisetkaAlert.error('Error', 'Please enter a style prompt for your pieces');
      return;
    }

    setIsGeneratingPieces(true);
    setProgress({ current: 0, total: totalPieces, currentPiece: '' });

    try {
      const pieces = gameType === 'chess'
        ? await generateChessPieceSet(prompt, setProgress)
        : await generateCheckersPieceSet(prompt, setProgress);

      // Convert to Record<string, string> using transparent URLs
      const piecesRecord: Record<string, string> = {};
      pieces.forEach((piece: GeneratedPiece) => {
        piecesRecord[piece.type] = piece.transparentUrl || piece.url;
      });

      setGeneratedPieces(piecesRecord);
      BisetkaAlert.success('Success', `All ${totalPieces} pieces generated!`);
    } catch (error) {
      console.error('Piece generation error:', error);
      BisetkaAlert.error('Error', 'Failed to generate pieces. Please try again.');
    } finally {
      setIsGeneratingPieces(false);
      setProgress(null);
    }
  };

  const generateBoard = async () => {
    if (!prompt.trim()) {
      BisetkaAlert.error('Error', 'Please enter a style prompt for your board');
      return;
    }

    setIsGeneratingBoard(true);
    try {
      const boardUrl = await generateGameBoard(gameType, prompt);
      setGeneratedBoard(boardUrl);
      BisetkaAlert.success('Success', 'Board generated!');
    } catch (error) {
      console.error('Board generation error:', error);
      BisetkaAlert.error('Error', 'Failed to generate board. Please try again.');
    } finally {
      setIsGeneratingBoard(false);
    }
  };

  const handleSave = () => {
    if (!setName.trim()) {
      BisetkaAlert.error('Error', 'Please enter a name for this piece set');
      return;
    }

    if (Object.keys(generatedPieces).length === 0) {
      BisetkaAlert.error('Error', 'Please generate pieces first');
      return;
    }

    const pieceSet: PieceSet = {
      id: currentPieceSet?.id || `pieceset_${Date.now()}`,
      name: setName,
      gameType,
      prompt,
      pieces: generatedPieces,
      boardImage: generatedBoard || undefined,
      createdAt: Date.now(),
    };

    onSave(pieceSet);
    onClose();
  };

  const presets = PRESET_PROMPTS[gameType];
  const pieceCount = Object.keys(generatedPieces).length;

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {gameType === 'chess' ? '♟️ Customize Chess Pieces' : '⚫ Customize Checkers Pieces'}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Preset Prompts */}
              <View style={styles.section}>
                <Text style={styles.label}>🎨 Preset Styles</Text>
                <Text style={styles.sublabel}>Quick start with popular themes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
                  {presets.map((preset) => (
                    <TouchableOpacity
                      key={preset.name}
                      style={styles.presetCard}
                      onPress={() => {
                        setPrompt(preset.prompt);
                        setSetName(preset.name);
                      }}>
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
                  value={setName}
                  onChangeText={setSetName}
                />
              </View>

              {/* Style Prompt */}
              <View style={styles.section}>
                <Text style={styles.label}>Style Prompt</Text>
                <Text style={styles.sublabel}>
                  Describe the style for all {totalPieces} pieces ({gameType === 'chess' ? '6 white + 6 black' : '2 red + 2 black'})
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. glowing neon cyberpunk holographic"
                  placeholderTextColor="#888"
                  value={prompt}
                  onChangeText={setPrompt}
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
                      {progress && (
                        <Text style={styles.progressText}>
                          Generating {progress.currentPiece}... ({progress.current}/{progress.total})
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.generateButtonText}>
                      ✨ Generate {totalPieces} Pieces
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Piece Preview Grid */}
                {pieceCount > 0 && (
                  <View style={styles.pieceGrid}>
                    <Text style={styles.previewLabel}>
                      Generated Pieces ({pieceCount}/{totalPieces})
                    </Text>
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
                <Text style={styles.sublabel}>
                  Generate a matching board for your pieces
                </Text>
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={generateBoard}
                  disabled={isGeneratingBoard}>
                  {isGeneratingBoard ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.generateButtonText}>
                      🎲 Generate Board
                    </Text>
                  )}
                </TouchableOpacity>
                {generatedBoard && (
                  <View style={styles.preview}>
                    <Image source={{ uri: generatedBoard }} style={styles.boardPreview} />
                    <Text style={styles.previewLabel}>Game Board</Text>
                  </View>
                )}
              </View>

              {/* Info Box */}
              <View style={styles.section}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>💡 How It Works</Text>
                  <Text style={styles.infoText}>
                    • AI generates {totalPieces} unique pieces in your style{'\n'}
                    • Backgrounds are automatically removed{'\n'}
                    • Pieces are transparent and ready to use{'\n'}
                    • Optionally generate a matching board{'\n'}
                    • Cost: ~${gameType === 'chess' ? '0.50' : '0.20'} per set (DALL-E)
                  </Text>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={handleSave}
                disabled={pieceCount === 0}>
                <LinearGradient colors={['#10b981', '#34d399']} style={styles.saveButtonGradient}>
                  <Text style={styles.saveButtonText}>💾 Save Piece Set</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </LinearGradient>
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
    fontSize: 22,
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
  },
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
  preview: {
    marginTop: 16,
    alignItems: 'center',
  },
  boardPreview: {
    width: 250,
    height: 250,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  previewLabel: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    padding: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
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
  presetName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  presetDesc: {
    fontSize: 11,
    color: '#aaa',
  },
});

export default GamePieceCustomizationModal;
