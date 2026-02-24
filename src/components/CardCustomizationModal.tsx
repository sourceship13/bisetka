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
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  generateCardBackground,
  generateCardBack,
} from '../services/cardImageGeneration.service';

export type FaceStyle = 'modern' | 'vintage' | 'retro' | 'cyberpunk' | 'minimal';

export interface CardTheme {
  id: string;
  name: string;
  backgroundImage?: string; // URI to generated background
  cardBackImage?: string; // URI to generated card back
  faceStyle: FaceStyle;
  createdAt: number;
}

interface CardCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (theme: CardTheme) => void;
  currentTheme?: CardTheme;
}

const FACE_STYLES: { id: FaceStyle; name: string; description: string }[] = [
  { id: 'modern', name: 'Modern', description: 'Clean, minimalist design with bold colors' },
  { id: 'vintage', name: 'Vintage', description: 'Classic ornate patterns, aged look' },
  { id: 'retro', name: 'Retro', description: '80s neon vibes, geometric shapes' },
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Futuristic tech, neon accents' },
  { id: 'minimal', name: 'Minimal', description: 'Ultra-clean, subtle elegance' },
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
  const [selectedFaceStyle, setSelectedFaceStyle] = useState<FaceStyle>(
    currentTheme?.faceStyle || 'modern'
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
      Alert.alert('Error', 'Please enter a background theme prompt');
      return;
    }

    setIsGeneratingBg(true);
    try {
      const result = await generateCardBackground(backgroundPrompt);
      setGeneratedBackground(result.url);
      Alert.alert('Success', 'Background generated!');
    } catch (error) {
      console.error('Background generation error:', error);
      Alert.alert('Error', 'Failed to generate background. Please try again.');
    } finally {
      setIsGeneratingBg(false);
    }
  };

  const generateCardBack = async () => {
    if (!cardBackPrompt.trim()) {
      Alert.alert('Error', 'Please enter a card back design prompt');
      return;
    }

    setIsGeneratingBack(true);
    try {
      const result = await generateCardBack(cardBackPrompt);
      setGeneratedCardBack(result.url);
      Alert.alert('Success', 'Card back generated!');
    } catch (error) {
      console.error('Card back generation error:', error);
      Alert.alert('Error', 'Failed to generate card back. Please try again.');
    } finally {
      setIsGeneratingBack(false);
    }
  };

  const handleSave = () => {
    if (!themeName.trim()) {
      Alert.alert('Error', 'Please enter a theme name');
      return;
    }

    const theme: CardTheme = {
      id: currentTheme?.id || `theme_${Date.now()}`,
      name: themeName,
      backgroundImage: generatedBackground || undefined,
      cardBackImage: generatedCardBack || undefined,
      faceStyle: selectedFaceStyle,
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
                <Text style={styles.label}>Card Background Texture</Text>
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
                  </View>
                )}
              </View>

              {/* Card Back */}
              <View style={styles.section}>
                <Text style={styles.label}>Card Back Design</Text>
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
                  </View>
                )}
              </View>

              {/* Face Style Selection */}
              <View style={styles.section}>
                <Text style={styles.label}>Face Card Style</Text>
                <Text style={styles.sublabel}>Choose a design style for J, Q, K cards</Text>
                {FACE_STYLES.map((style) => (
                  <TouchableOpacity
                    key={style.id}
                    style={[
                      styles.styleOption,
                      selectedFaceStyle === style.id && styles.styleOptionSelected,
                    ]}
                    onPress={() => setSelectedFaceStyle(style.id)}>
                    <View style={styles.styleOptionContent}>
                      <Text
                        style={[
                          styles.styleOptionTitle,
                          selectedFaceStyle === style.id && styles.styleOptionTitleSelected,
                        ]}>
                        {style.name}
                      </Text>
                      <Text style={styles.styleOptionDescription}>{style.description}</Text>
                    </View>
                    {selectedFaceStyle === style.id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
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
});

export default CardCustomizationModal;
