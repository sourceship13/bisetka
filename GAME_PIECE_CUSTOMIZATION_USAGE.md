# GamePieceCustomizationModal - Usage Guide

**Location**: `src/components/GamePieceCustomizationModal.tsx`

A fully reusable, themed modal component for customizing game pieces across all Bisetka games. Same polished UI as the card customization modal, but works for cards, chess pieces, checkers, nardi, poker chips, or any future game pieces.

## Features

- ✅ **Reusable across all games** - Configure once, use everywhere
- ✅ **AI image generation** - Optional primary/secondary image generation
- ✅ **Preset themes** - Quick-start presets for each game
- ✅ **Style options** - Fonts, piece styles, variants
- ✅ **BisetkaAlert integration** - Uses themed alerts
- ✅ **Same UI/UX** - Consistent with existing Bisetka design

## Basic Usage

```tsx
import GamePieceCustomizationModal, { 
  CustomizationConfig, 
  GamePieceTheme 
} from '../components/GamePieceCustomizationModal';

const [modalVisible, setModalVisible] = useState(false);
const [currentTheme, setCurrentTheme] = useState<GamePieceTheme | undefined>();

const config: CustomizationConfig = {
  title: '♟️ Customize Chess Pieces',
  primaryLabel: 'Piece Texture',
  primarySubLabel: 'This texture will appear on all chess pieces',
  primaryPromptPlaceholder: 'e.g. Marble with gold veins',
  showPrimaryImage: true,
  showSecondaryImage: false,
  showStyleOptions: false,
  generatePrimaryImage: async (prompt: string) => {
    // Your AI generation logic here
    return { url: 'https://...' };
  },
  infoText: '• Texture applies to all pieces\n• Supports PNG with transparency\n• Optimized for mobile rendering'
};

<GamePieceCustomizationModal
  visible={modalVisible}
  onClose={() => setModalVisible(false)}
  onSave={(theme) => {
    setCurrentTheme(theme);
    // Save theme to AsyncStorage or backend
  }}
  currentTheme={currentTheme}
  config={config}
/>
```

## Example Configurations

### 1. Cards (Blot, Baazar Blot, Poker)

```tsx
import {
  generateCardBackground,
  generateCardBack,
} from '../services/cardImageGeneration.service';
import { PRESET_THEMES, PRESET_CARD_BACKS, FONT_PREVIEWS } from '../data/cardPresets';

const cardConfig: CustomizationConfig = {
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
    { id: 'classic', name: 'Classic', description: 'Traditional bold serif' },
    { id: 'modern', name: 'Modern', description: 'Clean sans-serif' },
    { id: 'bold', name: 'Bold', description: 'Heavy weight' },
    { id: 'elegant', name: 'Elegant', description: 'Thin refined' },
    { id: 'playful', name: 'Playful', description: 'Fun rounded' },
  ],
  
  // Presets
  presetThemes: PRESET_THEMES,
  presetSecondaryImages: PRESET_CARD_BACKS,
  
  // Info
  infoText: '• Your background texture appears on all 52 cards\n• Rank numbers and suit symbols overlay on top\n• Card back shows when cards are face-down\n• Only 2 AI generations needed per theme!'
};
```

### 2. Chess Pieces

```tsx
const chessConfig: CustomizationConfig = {
  title: '♟️ Customize Chess Pieces',
  
  // Primary Image (Piece Texture)
  primaryLabel: 'Piece Texture',
  primarySubLabel: 'This texture will be applied to all chess pieces',
  primaryPromptPlaceholder: 'e.g. Polished marble with gold veins',
  showPrimaryImage: true,
  generatePrimaryImage: async (prompt: string) => {
    // Chess piece texture generation
    return generateChessPieceTexture(prompt);
  },
  
  // Style Options (Piece Set Style)
  styleLabel: 'Piece Set Style',
  styleSubLabel: 'Choose the design style for your pieces',
  showStyleOptions: true,
  styleOptions: [
    { id: 'classic', name: 'Classic', description: 'Traditional Staunton design' },
    { id: 'modern', name: 'Modern', description: 'Minimalist contemporary' },
    { id: 'ornate', name: 'Ornate', description: 'Detailed decorative' },
    { id: 'abstract', name: 'Abstract', description: 'Geometric shapes' },
  ],
  
  // Presets
  presetThemes: [
    {
      presetId: 'marble',
      name: 'Marble',
      description: 'White/black marble',
      thumbnail: require('../assets/chess/marble-preview.png'),
      primaryImage: require('../assets/chess/marble-texture.png'),
      styleOption: 'classic',
    },
    {
      presetId: 'wood',
      name: 'Wood',
      description: 'Natural wood grain',
      thumbnail: require('../assets/chess/wood-preview.png'),
      primaryImage: require('../assets/chess/wood-texture.png'),
      styleOption: 'classic',
    },
  ],
  
  infoText: '• Texture applies to all pieces (pawns, rooks, knights, etc.)\n• Pieces automatically colored for white/black\n• 3D shading applied based on texture'
};
```

### 3. Checkers/Nardi Pieces

```tsx
const checkersConfig: CustomizationConfig = {
  title: '🔴 Customize Checkers',
  
  // Primary Image (Piece Face)
  primaryLabel: 'Piece Face Design',
  primarySubLabel: 'This design will appear on all checker pieces',
  primaryPromptPlaceholder: 'e.g. Concentric circles with metallic finish',
  showPrimaryImage: true,
  generatePrimaryImage: async (prompt: string) => {
    return generateCheckerPieceFace(prompt);
  },
  
  // Secondary Image (King Crown)
  secondaryLabel: 'King Crown Design',
  secondarySubLabel: 'Special design for king pieces',
  secondaryPromptPlaceholder: 'e.g. Golden crown with diamonds',
  showSecondaryImage: true,
  generateSecondaryImage: async (prompt: string) => {
    return generateKingCrown(prompt);
  },
  
  // Presets
  presetThemes: [
    {
      presetId: 'classic',
      name: 'Classic',
      description: 'Traditional red/black',
      thumbnail: require('../assets/checkers/classic-preview.png'),
      primaryImage: require('../assets/checkers/classic-piece.png'),
      secondaryImage: require('../assets/checkers/classic-crown.png'),
    },
    {
      presetId: 'neon',
      name: 'Neon',
      description: 'Glowing edges',
      thumbnail: require('../assets/checkers/neon-preview.png'),
      primaryImage: require('../assets/checkers/neon-piece.png'),
      secondaryImage: require('../assets/checkers/neon-crown.png'),
    },
  ],
  
  infoText: '• Design applies to all regular pieces\n• King pieces get the crown overlay\n• Colors automatically adjusted for red/black sides'
};
```

### 4. Poker Chips

```tsx
const pokerChipConfig: CustomizationConfig = {
  title: '🪙 Customize Poker Chips',
  
  // Primary Image (Chip Face)
  primaryLabel: 'Chip Face Design',
  primarySubLabel: 'Center design on both sides of the chip',
  primaryPromptPlaceholder: 'e.g. Casino logo with ornate border',
  showPrimaryImage: true,
  generatePrimaryImage: async (prompt: string) => {
    return generateChipFace(prompt);
  },
  
  // Style Options (Chip Edge Pattern)
  styleLabel: 'Edge Pattern',
  styleSubLabel: 'Pattern around the rim of the chip',
  showStyleOptions: true,
  styleOptions: [
    { id: 'stripes', name: 'Stripes', description: 'Alternating color stripes' },
    { id: 'dots', name: 'Dots', description: 'Small circular dots' },
    { id: 'diamonds', name: 'Diamonds', description: 'Diamond shapes' },
    { id: 'plain', name: 'Plain', description: 'Solid color rim' },
  ],
  
  presetThemes: [
    {
      presetId: 'casino',
      name: 'Casino',
      description: 'Classic Vegas style',
      thumbnail: require('../assets/poker/casino-chip.png'),
      primaryImage: require('../assets/poker/casino-face.png'),
      styleOption: 'stripes',
    },
  ],
  
  infoText: '• Design appears on both sides of the chip\n• Each denomination gets a different color\n• Edge pattern wraps around the rim'
};
```

### 5. Billiards/Pool Balls

```tsx
const billiardsConfig: CustomizationConfig = {
  title: '🎱 Customize Pool Balls',
  
  // Primary Image (Ball Surface Texture)
  primaryLabel: 'Ball Surface Texture',
  primarySubLabel: 'Surface finish for all balls',
  primaryPromptPlaceholder: 'e.g. Glossy pearl finish with subtle sparkles',
  showPrimaryImage: true,
  generatePrimaryImage: async (prompt: string) => {
    return generateBallTexture(prompt);
  },
  
  // Style Options (Number Style)
  styleLabel: 'Number Style',
  styleSubLabel: 'How numbers appear on balls',
  showStyleOptions: true,
  styleOptions: [
    { id: 'classic', name: 'Classic', description: 'Traditional bold' },
    { id: '3d', name: '3D', description: 'Raised embossed look' },
    { id: 'neon', name: 'Neon', description: 'Glowing numbers' },
  ],
  
  presetThemes: [
    {
      presetId: 'standard',
      name: 'Standard',
      description: 'Classic pool hall',
      thumbnail: require('../assets/billiards/standard.png'),
      primaryImage: require('../assets/billiards/standard-texture.png'),
      styleOption: 'classic',
    },
    {
      presetId: 'galaxy',
      name: 'Galaxy',
      description: 'Cosmic swirls',
      thumbnail: require('../assets/billiards/galaxy.png'),
      primaryImage: require('../assets/billiards/galaxy-texture.png'),
      styleOption: '3d',
    },
  ],
  
  infoText: '• Texture wraps around the entire ball\n• Numbers overlay on top\n• Solid colors automatically applied\n• Stripes rendered for balls 9-15'
};
```

## CustomizationConfig Reference

```typescript
interface CustomizationConfig {
  // Title
  title: string; // Modal title (e.g., "🎨 Customize Cards")
  
  // Primary Image
  primaryLabel: string; // Label (e.g., "Card Face Background")
  primarySubLabel?: string; // Optional explanation
  primaryPromptPlaceholder?: string; // Input placeholder text
  showPrimaryImage?: boolean; // Default true
  generatePrimaryImage?: (prompt: string) => Promise<{ url: string }>;
  
  // Secondary Image
  secondaryLabel?: string; // Label (e.g., "Card Back Design")
  secondarySubLabel?: string; // Optional explanation
  secondaryPromptPlaceholder?: string; // Input placeholder text
  showSecondaryImage?: boolean; // Default false
  generateSecondaryImage?: (prompt: string) => Promise<{ url: string }>;
  
  // Style Options
  styleLabel?: string; // Label (e.g., "Rank Number Font")
  styleSubLabel?: string; // Optional explanation
  showStyleOptions?: boolean; // Default false
  styleOptions?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  
  // Presets
  presetThemes?: Array<{
    presetId: string;
    name: string;
    description: string;
    thumbnail?: string | ImageSourcePropType;
    primaryImage?: string | ImageSourcePropType;
    secondaryImage?: string | ImageSourcePropType;
    styleOption?: string;
  }>;
  
  presetSecondaryImages?: Array<{
    id: string;
    name: string;
    image: ImageSourcePropType | string;
  }>;
  
  // Info Box
  infoText?: string; // Custom info text (supports \n for line breaks)
}
```

## GamePieceTheme Data Structure

```typescript
interface GamePieceTheme {
  id: string; // Unique theme ID
  name: string; // User-defined name
  primaryImage?: string; // URL to primary image
  secondaryImage?: string; // URL to secondary image
  styleOption?: string; // Selected style ID
  metadata?: Record<string, any>; // Game-specific extra data
  createdAt: number; // Timestamp
}
```

## Integration Example (Full Flow)

```tsx
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GamePieceCustomizationModal, { GamePieceTheme } from '../components/GamePieceCustomizationModal';
import { chessConfig } from '../configs/chessCustomizationConfig';

const ChessScreen: React.FC = () => {
  const [customizeModalVisible, setCustomizeModalVisible] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<GamePieceTheme | undefined>();

  // Load saved theme on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('chess_theme');
      if (saved) {
        setCurrentTheme(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load chess theme:', error);
    }
  };

  const saveTheme = async (theme: GamePieceTheme) => {
    try {
      await AsyncStorage.setItem('chess_theme', JSON.stringify(theme));
      setCurrentTheme(theme);
      // Trigger re-render of chess pieces with new theme
    } catch (error) {
      console.error('Failed to save chess theme:', error);
    }
  };

  return (
    <View>
      {/* Your game UI */}
      
      {/* Customize button */}
      <TouchableOpacity onPress={() => setCustomizeModalVisible(true)}>
        <Text>🎨 Customize Pieces</Text>
      </TouchableOpacity>

      {/* Customization modal */}
      <GamePieceCustomizationModal
        visible={customizeModalVisible}
        onClose={() => setCustomizeModalVisible(false)}
        onSave={saveTheme}
        currentTheme={currentTheme}
        config={chessConfig}
      />
    </View>
  );
};
```

## Migration from CardCustomizationModal

If you have existing code using `CardCustomizationModal`, migration is simple:

**Before:**
```tsx
<CardCustomizationModal
  visible={modalVisible}
  onClose={onClose}
  onSave={onSave}
  currentTheme={currentTheme}
/>
```

**After:**
```tsx
import { cardConfig } from '../configs/cardCustomizationConfig';

<GamePieceCustomizationModal
  visible={modalVisible}
  onClose={onClose}
  onSave={onSave}
  currentTheme={currentTheme}
  config={cardConfig}
/>
```

## Best Practices

1. **Config Files**: Store configs in `src/configs/` for reusability
2. **Presets**: Always include 2-3 preset themes for quick starts
3. **AI Generation**: Make AI generation optional (some games might use presets only)
4. **Image Caching**: Cache generated images to avoid re-generation
5. **Fallbacks**: Provide default themes when no customization exists
6. **Theme Validation**: Validate theme data before applying to game

## Files Created

- ✅ `src/components/GamePieceCustomizationModal.tsx` - Main component
- ✅ `GAME_PIECE_CUSTOMIZATION_USAGE.md` - This usage guide

## Next Steps

1. Create config files for each game in `src/configs/`
2. Migrate existing `CardCustomizationModal` usage to use this component
3. Add customization buttons to remaining games (Chess, Checkers, Nardi, etc.)
4. Create preset themes for each game
5. Implement image generation functions for new game types

---

**Ready to use!** 🚀 This component handles all the UI/UX — you just need to provide the config object for each game.
