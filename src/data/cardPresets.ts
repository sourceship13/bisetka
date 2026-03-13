/**
 * Pre-configured card themes and card backs
 */

import type { CardTheme, CardFont } from '../components/global/GameCustomizationModal';

export interface PresetTheme extends Omit<CardTheme, 'id' | 'createdAt'> {
  presetId: string;
  description: string;
  thumbnail?: string;
}

export interface PresetCardBack {
  id: string;
  name: string;
  description: string;
  image: any; // require() result
}

// Pre-defined themes
export const PRESET_THEMES: PresetTheme[] = [
  {
    presetId: 'modern',
    name: 'Modern',
    description: 'Clean geometric shapes, blue gradient',
    backgroundImage: require('../../assets/cards/presets/modern-background.png'),
    cardBackImage: require('../../assets/cards/presets/modern-back.png'),
    font: 'Inter_18pt-Regular' as CardFont,
  },
  {
    presetId: 'retro-8bit',
    name: 'Retro 8-Bit',
    description: 'Pixel art style, vibrant colors',
    backgroundImage: require('../../assets/cards/presets/retro-background.png'),
    cardBackImage: require('../../assets/cards/presets/back-geometric.png'),
    font: 'SpaceMono-Regular' as CardFont,
  },
];

// Pre-defined card backs
export const PRESET_CARD_BACKS: PresetCardBack[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional ornate pattern',
    image: require('../../assets/cards/presets/modern-back.png'),
  },
  {
    id: 'geometric',
    name: 'Geometric',
    description: 'Modern abstract shapes',
    image: require('../../assets/cards/presets/back-geometric.png'),
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Simple elegant lines',
    image: require('../../assets/cards/presets/back-minimalist.png'),
  },
];

// Font previews with styled examples
export const FONT_PREVIEWS: Record<CardFont, { sample: string; style: any }> = {
  'Inter_18pt-Regular':     { sample: 'K♠', style: { fontFamily: 'Inter_18pt-Regular' } },
  'Cinzel-Bold':            { sample: 'K♠', style: { fontFamily: 'Cinzel-Bold' } },
  'BebasNeue-Regular':      { sample: 'K♠', style: { fontFamily: 'BebasNeue-Regular' } },
  'PlayfairDisplaySC-Bold': { sample: 'K♠', style: { fontFamily: 'PlayfairDisplaySC-Bold' } },
  'EBGaramond-Bold':        { sample: 'K♠', style: { fontFamily: 'EBGaramond-Bold' } },
  'CrimsonText-Bold':       { sample: 'K♠', style: { fontFamily: 'CrimsonText-Bold' } },
  'Fredoka-Bold':           { sample: 'K♠', style: { fontFamily: 'Fredoka-Bold' } },
  'JetBrainsMono-Bold':     { sample: 'K♠', style: { fontFamily: 'JetBrainsMono-Bold' } },
  'SpaceMono-Regular':      { sample: 'K♠', style: { fontFamily: 'SpaceMono-Regular' } },
  'RobotoMono-Regular':     { sample: 'K♠', style: { fontFamily: 'RobotoMono-Regular' } },
};
