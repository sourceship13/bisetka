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
  ImageSourcePropType,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BisetkaAlert } from '../utils/BisetkaAlert';

export type StyleOption = {
  id: string;
  name: string;
  description: string;
};

export type PresetTheme = {
  presetId: string;
  name: string;
  description: string;
  thumbnail?: string | ImageSourcePropType;
  primaryImage?: string | ImageSourcePropType;
  secondaryImage?: string | ImageSourcePropType;
  styleOption?: string;
};

export interface GamePieceTheme {
  id: string;
  name: string;
  primaryImage?: string; // Main image (e.g., card face background, chess piece texture)
  secondaryImage?: string; // Secondary image (e.g., card back, alternate piece style)
  styleOption?: string; // Selected style/font/variant
  metadata?: Record<string, any>; // Game-specific extra data
  createdAt: number;
}

export interface CustomizationConfig {
  title: string; // e.g., "🎨 Customize Cards", "♟️ Customize Chess Pieces"
  primaryLabel: string; // e.g., "Card Face Background", "Chess Piece Texture"
  primarySubLabel?: string; // Optional explanation
  primaryPromptPlaceholder?: string;
  secondaryLabel?: string; // e.g., "Card Back Design", "Alternate Piece Color"
  secondarySubLabel?: string;
  secondaryPromptPlaceholder?: string;
  styleLabel?: string; // e.g., "Rank Number Font", "Piece Style"
  styleSubLabel?: string;
  styleOptions?: StyleOption[]; // Font choices, piece styles, etc.
  presetThemes?: PresetTheme[]; // Preset themes to choose from
  presetSecondaryImages?: Array<{
    id: string;
    name: string;
    image: ImageSourcePropType | string;
  }>; // Preset options for secondary image
  generatePrimaryImage?: (prompt: string) => Promise<{ url: string }>; // AI generation function
  generateSecondaryImage?: (prompt: string) => Promise<{ url: string }>; // AI generation function
  infoText?: string; // Custom info box text
  showPrimaryImage?: boolean; // Default true
  showSecondaryImage?: boolean; // Default false
  showStyleOptions?: boolean; // Default false
}

interface GamePieceCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (theme: GamePieceTheme) => void;
  currentTheme?: GamePieceTheme;
  config: CustomizationConfig;
}

const GamePieceCustomizationModal: React.FC<GamePieceCustomizationModalProps> = ({
  visible,
  onClose,
  onSave,
  currentTheme,
  config,
}) => {
  const [themeName, setThemeName] = useState(currentTheme?.name || '');
  const [primaryPrompt, setPrimaryPrompt] = useState('');
  const [secondaryPrompt, setSecondaryPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>(
    currentTheme?.styleOption || config.styleOptions?.[0]?.id || ''
  );
  const [generatedPrimary, setGeneratedPrimary] = useState<string | null>(
    currentTheme?.primaryImage || null
  );
  const [generatedSecondary, setGeneratedSecondary] = useState<string | null>(
    currentTheme?.secondaryImage || null
  );
  const [isGeneratingPrimary, setIsGeneratingPrimary] = useState(false);
  const [isGeneratingSecondary, setIsGeneratingSecondary] = useState(false);

  const showPrimaryImage = config.showPrimaryImage !== false;
  const showSecondaryImage = config.showSecondaryImage === true;
  const showStyleOptions = config.showStyleOptions === true;

  const generatePrimary = async () => {
    if (!primaryPrompt.trim()) {
      BisetkaAlert.error('Error', `Please enter a ${config.primaryLabel.toLowerCase()} prompt`);
      return;
    }

    if (!config.generatePrimaryImage) {
      BisetkaAlert.error('Error', 'AI generation not configured for this game');
      return;
    }

    setIsGeneratingPrimary(true);
    try {
      const result = await config.generatePrimaryImage(primaryPrompt);
      setGeneratedPrimary(result.url);
      BisetkaAlert.success('Success', `${config.primaryLabel} generated!`);
    } catch (error) {
      console.error('Primary image generation error:', error);
      BisetkaAlert.error('Error', `Failed to generate ${config.primaryLabel.toLowerCase()}. Please try again.`);
    } finally {
      setIsGeneratingPrimary(false);
    }
  };

  const generateSecondary = async () => {
    if (!secondaryPrompt.trim()) {
      BisetkaAlert.error('Error', `Please enter a ${config.secondaryLabel?.toLowerCase() || 'secondary image'} prompt`);
      return;
    }

    if (!config.generateSecondaryImage) {
      BisetkaAlert.error('Error', 'AI generation not configured for this game');
      return;
    }

    setIsGeneratingSecondary(true);
    try {
      const result = await config.generateSecondaryImage(secondaryPrompt);
      setGeneratedSecondary(result.url);
      BisetkaAlert.success('Success', `${config.secondaryLabel} generated!`);
    } catch (error) {
      console.error('Secondary image generation error:', error);
      BisetkaAlert.error('Error', `Failed to generate ${config.secondaryLabel?.toLowerCase() || 'secondary image'}. Please try again.`);
    } finally {
      setIsGeneratingSecondary(false);
    }
  };

  const handleSave = () => {
    if (!themeName.trim()) {
      BisetkaAlert.error('Error', 'Please enter a theme name');
      return;
    }

    const theme: GamePieceTheme = {
      id: currentTheme?.id || `theme_${Date.now()}`,
      name: themeName,
      primaryImage: generatedPrimary || undefined,
      secondaryImage: generatedSecondary || undefined,
      styleOption: selectedStyle || undefined,
      metadata: currentTheme?.metadata,
      createdAt: Date.now(),
    };

    onSave(theme);
    onClose();
  };

  const resolveImageSource = (source: string | ImageSourcePropType | undefined): string | undefined => {
    if (!source) return undefined;
    if (typeof source === 'string') return source;
    return Image.resolveAssetSource(source as ImageSourcePropType).uri;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>{config.title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Preset Themes */}
              {config.presetThemes && config.presetThemes.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.label}>🎨 Preset Themes</Text>
                  <Text style={styles.sublabel}>Quick start with pre-designed themes</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
                    {config.presetThemes.map((preset) => (
                      <TouchableOpacity
                        key={preset.presetId}
                        style={styles.presetCard}
                        onPress={() => {
                          setThemeName(preset.name);
                          if (preset.styleOption) setSelectedStyle(preset.styleOption);
                          if (preset.primaryImage) {
                            setGeneratedPrimary(resolveImageSource(preset.primaryImage) || null);
                          }
                          if (preset.secondaryImage) {
                            setGeneratedSecondary(resolveImageSource(preset.secondaryImage) || null);
                          }
                        }}>
                        {preset.thumbnail && (
                          <Image
                            source={typeof preset.thumbnail === 'string' ? { uri: preset.thumbnail } : preset.thumbnail as any}
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
              )}

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

              {/* Primary Image (e.g., Card Face Background, Chess Piece Texture) */}
              {showPrimaryImage && (
                <View style={styles.section}>
                  <Text style={styles.label}>{config.primaryLabel}</Text>
                  {config.primarySubLabel && (
                    <Text style={styles.sublabel}>{config.primarySubLabel}</Text>
                  )}
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder={config.primaryPromptPlaceholder || "e.g. Neon city lights at night"}
                    placeholderTextColor="#888"
                    value={primaryPrompt}
                    onChangeText={setPrimaryPrompt}
                    multiline
                    numberOfLines={3}
                  />
                  {config.generatePrimaryImage && (
                    <TouchableOpacity
                      style={styles.generateButton}
                      onPress={generatePrimary}
                      disabled={isGeneratingPrimary}>
                      {isGeneratingPrimary ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.generateButtonText}>🎨 Generate {config.primaryLabel}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {generatedPrimary && (
                    <View style={styles.preview}>
                      <Image source={{ uri: generatedPrimary }} style={styles.previewImage} />
                      <Text style={styles.previewLabel}>{config.primaryLabel}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Secondary Image (e.g., Card Back, Alternate Piece Style) */}
              {showSecondaryImage && config.secondaryLabel && (
                <View style={styles.section}>
                  <Text style={styles.label}>{config.secondaryLabel}</Text>
                  {config.secondarySubLabel && (
                    <Text style={styles.sublabel}>{config.secondarySubLabel}</Text>
                  )}
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder={config.secondaryPromptPlaceholder || "e.g. Geometric patterns"}
                    placeholderTextColor="#888"
                    value={secondaryPrompt}
                    onChangeText={setSecondaryPrompt}
                    multiline
                    numberOfLines={3}
                  />
                  {config.generateSecondaryImage && (
                    <TouchableOpacity
                      style={styles.generateButton}
                      onPress={generateSecondary}
                      disabled={isGeneratingSecondary}>
                      {isGeneratingSecondary ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.generateButtonText}>🃏 Generate {config.secondaryLabel}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {generatedSecondary && (
                    <View style={styles.preview}>
                      <Image source={{ uri: generatedSecondary }} style={styles.previewImageSecondary} />
                      <Text style={styles.previewLabel}>{config.secondaryLabel}</Text>
                    </View>
                  )}

                  {/* Preset Secondary Images */}
                  {config.presetSecondaryImages && config.presetSecondaryImages.length > 0 && (
                    <>
                      <Text style={[styles.label, { marginTop: 16 }]}>Or choose a preset:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
                        {config.presetSecondaryImages.map((preset) => (
                          <TouchableOpacity
                            key={preset.id}
                            style={styles.secondaryPreset}
                            onPress={() => {
                              setGeneratedSecondary(resolveImageSource(preset.image) || null);
                            }}>
                            <Image
                              source={typeof preset.image === 'string' ? { uri: preset.image } : preset.image as any}
                              style={styles.secondaryThumbnail}
                              resizeMode="cover"
                            />
                            <Text style={styles.presetName}>{preset.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}
                </View>
              )}

              {/* Style Options (e.g., Font Selection, Piece Style) */}
              {showStyleOptions && config.styleOptions && config.styleOptions.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.label}>{config.styleLabel || 'Style Options'}</Text>
                  {config.styleSubLabel && (
                    <Text style={styles.sublabel}>{config.styleSubLabel}</Text>
                  )}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
                    {config.styleOptions.map((option) => (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.styleCard,
                          selectedStyle === option.id && styles.styleCardSelected,
                        ]}
                        onPress={() => setSelectedStyle(option.id)}>
                        <Text style={styles.presetName}>{option.name}</Text>
                        <Text style={styles.presetDesc}>{option.description}</Text>
                        {selectedStyle === option.id && (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedBadgeText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Info Box */}
              {config.infoText && (
                <View style={styles.section}>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>💡 How It Works</Text>
                    <Text style={styles.infoText}>{config.infoText}</Text>
                  </View>
                </View>
              )}

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
  previewImageSecondary: {
    width: 140,
    height: 200,
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
  secondaryPreset: {
    width: 90,
    marginRight: 12,
    alignItems: 'center',
  },
  secondaryThumbnail: {
    width: 70,
    height: 100,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  styleCard: {
    width: 110,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  styleCardSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
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

export default GamePieceCustomizationModal;
