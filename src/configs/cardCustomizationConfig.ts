import { CustomizationConfig } from '../components/global/GamePieceCustomizationModal';
import {
  generateCardBackground,
  generateCardBack,
} from '../services/cardImageGeneration.service';
import { PRESET_THEMES, PRESET_CARD_BACKS } from '../data/cardPresets';

export const cardConfig: CustomizationConfig = {
  title: '🎨 Customize Cards',
  
  // Primary Image (Card Face Background)
  primaryLabel: 'Card Face Background',
  primarySubLabel: 'This texture will appear on all 52 card faces',
  primaryPromptPlaceholder: 'e.g. Neon city lights at night, cyberpunk aesthetic',
  showPrimaryImage: true,
  generatePrimaryImage: generateCardBackground,
  
  // Secondary Image (Card Back)
  secondaryLabel: 'Card Back Design (Face-Down)',
  secondarySubLabel: 'This appears when cards are face-down',
  secondaryPromptPlaceholder: 'e.g. Geometric patterns with glowing edges',
  showSecondaryImage: true,
  generateSecondaryImage: generateCardBack,
  
  // Style Options (Fonts)
  styleLabel: 'Rank Number Font',
  styleSubLabel: 'Choose the font style for card numbers',
  showStyleOptions: true,
  styleOptions: [
    { id: 'classic', name: 'Classic', description: 'Traditional bold serif, casino-style' },
    { id: 'modern', name: 'Modern', description: 'Clean sans-serif, contemporary' },
    { id: 'bold', name: 'Bold', description: 'Heavy weight, strong presence' },
    { id: 'elegant', name: 'Elegant', description: 'Thin refined, sophisticated' },
    { id: 'playful', name: 'Playful', description: 'Fun rounded, casual vibe' },
  ],
  
  // Presets
  presetThemes: PRESET_THEMES,
  presetSecondaryImages: PRESET_CARD_BACKS,
  
  // Info
  infoText: '• Your background texture appears on all 52 cards\n• Rank numbers and suit symbols overlay on top\n• Card back shows when cards are face-down\n• Only 2 AI generations needed per theme!',
};
