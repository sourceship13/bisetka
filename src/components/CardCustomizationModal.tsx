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
  generateCardBackground as apiGenerateBackground,
  generateCardBack as apiGenerateCardBack,
} from '../services/cardImageGeneration.service';
import { PRESET_THEMES, PRESET_CARD_BACKS, FONT_PREVIEWS } from '../data/cardPresets';
import { BisetkaAlert } from '../utils/BisetkaAlert';

export type CardFont = 'classic' | 'modern' | 'bold' | 'elegant' | 'playful';

export interface CardTheme {
  id: string;
  name: string;
  backgroundImage?: string; // URI to generated background
  cardBackImage?: string; // URI to generated card back
  font: CardFont; // Selected font for rank numbers
  createdAt: number;
}

interface CardCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (theme: CardTheme) => void;
  currentTheme?: CardTheme;
}

const FONTS: { id: CardFont; name: string; description: string }[] = [
  { id: 'classic', name: 'Classic', description: 'Traditional bold serif, casino-style' },
  { id: 'modern', name: 'Modern', description: 'Clean sans-serif, contemporary' },
  { id: 'bold', name: 'Bold', description: 'Heavy weight, strong presence' },
  { id: 'elegant', name: 'Elegant', description: 'Thin refined, sophisticated' },
  { id: 'playful', name: 'Playful', description: 'Fun rounded, casual vibe' },
];

const CardCustomizationModal: React.FC<CardCustomizationModalProps> = ({
  visible,
  onClose,
  onSave,
  currentTheme,
}) => {
  const [themeName, setThemeName] = useState(currentTheme?.name || '');
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [cardBackPrompt, setCardBackPrompt] = useState('');
  const [selectedFont, setSelectedFont] = useState<CardFont>(
    currentTheme?.font || 'classic'
  );
  const [generatedBackground, setGeneratedBackground] = useState<string | null>(
    currentTheme?.backgroundImage || null
  );
  const [generatedCardBack, setGeneratedCardBack] = useState<string | null>(
    currentTheme?.cardBackImage || null
  );
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [isGeneratingBack, setIsGeneratingBack] = useState(false);

  const generateBackground = async () => {
    if (!backgroundPrompt.trim()) {
      BisetkaAlert.error('Error', 'Please enter a background theme prompt');
      return;
    }

    setIsGeneratingBg(true);
    try {
      const result = await apiGenerateBackground(backgroundPrompt);
      setGeneratedBackground(result.url);
      BisetkaAlert.success('Success', 'Background generated!');
    } catch (error) {
      console.error('Background generation error:', error);
      BisetkaAlert.error('Error', 'Failed to generate background. Please try again.');
    } finally {
      setIsGeneratingBg(false);
    }
  };

  const generateCardBack = async () => {
    if (!cardBackPrompt.trim()) {
      BisetkaAlert.error('Error', 'Please enter a card back design prompt');
      return;
    }

    setIsGeneratingBack(true);
    try {
      const result = await apiGenerateCardBack(cardBackPrompt);
      setGeneratedCardBack(result.url);
      BisetkaAlert.success('Success', 'Card back generated!');
    } catch (error) {
      console.error('Card back generation error:', error);
      BisetkaAlert.error('Error', 'Failed to generate card back. Please try again.');
    } finally {
      setIsGeneratingBack(false);
    }
  };

  const handleSave = () => {
    if (!themeName.trim()) {
      BisetkaAlert.error('Error', 'Please enter a theme name');
      return;
    }

    const theme: CardTheme = {
      id: currentTheme?.id || `theme_${Date.now()}`,
      name: themeName,
      backgroundImage: generatedBackground || undefined,
      cardBackImage: generatedCardBack || undefined,
      font: selectedFont,
      createdAt: Date.now(),
    };

    onSave(theme);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>🎨 Customize Cards</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

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
                          setGeneratedBackground(
                            typeof preset.backgroundImage === 'string'
                              ? preset.backgroundImage
                              : Image.resolveAssetSource(preset.backgroundImage).uri
                          );
                        }
                        if (preset.cardBackImage != null) {
                          setGeneratedCardBack(
                            typeof preset.cardBackImage === 'string'
                              ? preset.cardBackImage
                              : Image.resolveAssetSource(preset.cardBackImage).uri
                          );
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
                    <Text style={styles.previewLabel}>Card Face Background</Text>
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
                    <Text style={styles.previewLabel}>Face-Down Card</Text>
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
                        setGeneratedCardBack(Image.resolveAssetSource(back.image).uri);
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
                <Text style={styles.sublabel}>Choose the font style for card numbers</Text>
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
                          <Text style={[styles.fontSample, preview.style]}>{preview.sample}</Text>
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
                <LinearGradient colors={['#10b981', '#34d399']} style={styles.saveButtonGradient}>
                  <Text style={styles.saveButtonText}>💾 Save Theme</Text>
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
    padding: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  previewLabel: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
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
});

export default CardCustomizationModal;
