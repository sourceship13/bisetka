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
    font: 'modern',
  },
  {
    presetId: 'retro-8bit',
    name: 'Retro 8-Bit',
    description: 'Pixel art style, vibrant colors',
    backgroundImage: require('../../assets/cards/presets/retro-background.png'),
    cardBackImage: require('../../assets/cards/presets/back-geometric.png'),
    font: 'bold',
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
  classic: {
    sample: 'K♠',
    style: { fontWeight: '700' as const, letterSpacing: 0 },
  },
  modern: {
    sample: 'A♥',
    style: { fontWeight: '600' as const, letterSpacing: 1 },
  },
  bold: {
    sample: 'Q♦',
    style: { fontWeight: '900' as const, letterSpacing: -0.5 },
  },
  elegant: {
    sample: 'J♣',
    style: { fontWeight: '300' as const, letterSpacing: 2 },
  },
  playful: {
    sample: '10♥',
    style: { fontWeight: '800' as const, letterSpacing: 0 },
  },
};
