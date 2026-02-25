# Card System V2 - Dynamic Cards with Custom Backgrounds

## Overview

The new card system generates cards dynamically by layering elements, rather than creating 52 separate card images.

## Architecture

```
Card Rendering Stack (bottom to top):
┌─────────────────────────────────────┐
│  1. Background Texture              │ ← Custom or white default
│     (AI-generated, 1 image)         │
├─────────────────────────────────────┤
│  2. Rank Numbers + Suit Symbols     │ ← Rendered programmatically
│     (Unicode symbols + selected font)│
└─────────────────────────────────────┘
```

## Components

### DynamicCard.tsx
Main card rendering component that:
- Accepts a `theme` prop with custom background/back/font
- Renders rank numbers using selected font
- Places suit symbols (♠♥♦♣) in standard patterns
- Shows custom or default card back when face-down

### CardCustomizationModal.tsx
UI for creating custom themes:
- Theme name input
- AI background generation (card face)
- AI card back generation (face-down)
- Font selection (5 presets)

### Default Assets
- `default-card-background.png` - Plain white card
- `default-card-back.png` - Classic ornate pattern

## Theme Object

```typescript
interface CardTheme {
  id: string;
  name: string;
  backgroundImage?: string; // URI to custom background
  cardBackImage?: string;   // URI to custom card back
  font: CardFont;           // 'classic' | 'modern' | 'bold' | 'elegant' | 'playful'
  createdAt: number;
}
```

## Font Presets

### Classic
Traditional bold serif, casino-style
- Weight: 700
- Use: Standard playing cards

### Modern
Clean sans-serif, contemporary
- Weight: 600
- Letter spacing: 1px

### Bold
Heavy weight, strong presence
- Weight: 900
- Letter spacing: -0.5px

### Elegant
Thin refined, sophisticated
- Weight: 300
- Letter spacing: 2px

### Playful
Fun rounded, casual vibe
- Weight: 800

## Suit Symbol Rendering

Suits are rendered using Unicode symbols:
- ♥ Hearts (red)
- ♦ Diamonds (red)
- ♣ Clubs (black)
- ♠ Spades (black)

Positioned in standard playing card patterns based on rank.

## Cost Comparison

### Old System (52 individual cards)
- 52 cards × $0.04 = **$2.08 per theme**

### New System (dynamic rendering)
- 1 background × $0.04 = $0.04
- 1 card back × $0.04 = $0.04
- **Total: $0.08 per theme** ✅

**Savings: 96% reduction in generation costs!**

## Usage in Games

### BlotScreen.tsx
```typescript
import DynamicCard from '../components/DynamicCard';

const [customTheme, setCustomTheme] = useState<CardTheme | undefined>();

// Render card with theme
<DynamicCard
  card={card}
  size="medium"
  theme={customTheme}
  onPress={() => playCard(card)}
  isPlayable={canPlay}
/>
```

## Future Enhancements

- [ ] Custom suit symbols (4 generations per theme)
- [ ] Pattern overlays (dots, stripes, gradients)
- [ ] Animated cards (sparkles, glow effects)
- [ ] Community theme marketplace
- [ ] Seasonal themes (Halloween, Christmas)

## Migration from Old System

If you have existing Card components:
1. Replace `Card` with `DynamicCard`
2. Change `faceStyle` prop to `theme`
3. Remove references to individual card images
4. Delete old `assets/cards/*.png` (except defaults)

## Testing

1. Run app
2. Go to Blot game
3. Tap 🎨 icon
4. Generate background + card back
5. Select font
6. Save theme
7. Cards should render with custom look!
