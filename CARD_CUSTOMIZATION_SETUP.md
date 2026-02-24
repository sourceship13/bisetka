# Card Customization Setup Guide

## Overview

The card customization system allows players to generate custom card themes using AI:
- Custom background textures (1 generation)
- Custom card back designs (1 generation)
- Choose from 5 pre-designed face card styles

## Setup Steps

### 1. Add OpenAI API Key

Edit `src/services/cardImageGeneration.service.ts`:

```typescript
const OPENAI_API_KEY = 'your-openai-api-key-here';
```

Or use environment variables:
```bash
export OPENAI_API_KEY="sk-..."
```

### 2. Generate Face Card Styles

Generate all 60 face cards (J/Q/K × 4 suits × 5 styles):

```bash
cd assets/cards/face-styles
python3 generate-face-styles.py
```

This will create:
```
face-styles/
  modern/
    J-hearts.png, Q-hearts.png, K-hearts.png
    J-diamonds.png, Q-diamonds.png, K-diamonds.png
    ... (12 cards total)
  vintage/
    ... (12 cards)
  retro/
    ... (12 cards)
  cyberpunk/
    ... (12 cards)
  minimal/
    ... (12 cards)
```

### 3. Test the Feature

1. Run the app
2. Go to Blot game
3. Tap the 🎨 icon in the top right
4. Enter a theme name (e.g., "Neon Tokyo")
5. Generate background: "Cyberpunk city at night, neon lights"
6. Generate card back: "Geometric patterns with glowing edges"
7. Select a face style (e.g., Cyberpunk)
8. Save theme

### 4. Persistence (Optional)

To save themes between sessions, integrate AsyncStorage:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Save theme
await AsyncStorage.setItem('cardTheme', JSON.stringify(theme));

// Load theme
const saved = await AsyncStorage.getItem('cardTheme');
const theme = saved ? JSON.parse(saved) : null;
```

## Cost Estimation

**Per Theme:**
- Background texture: ~$0.04 (DALL-E 3 HD)
- Card back: ~$0.04 (DALL-E 3 HD)
- **Total: ~$0.08 per custom theme**

**One-Time Setup:**
- 60 face cards: ~$2.40 (DALL-E 3 HD)
- Can reuse across all players

## Architecture

```
User Action
    ↓
[CardCustomizationModal]
    ↓
[cardImageGeneration.service]
    ↓
[OpenAI DALL-E 3 API]
    ↓
[Generated Image URL]
    ↓
[Save to Theme]
    ↓
[Card Component Uses Theme]
```

## Future Enhancements

- [ ] Theme library (browse community themes)
- [ ] Share themes with friends
- [ ] Seasonal themes (Halloween, Christmas)
- [ ] Premium: Custom suit symbols (+$0.16)
- [ ] Download themes for offline use
- [ ] Theme marketplace

## Troubleshooting

**"Image generation failed"**
- Check API key is correct
- Ensure you have API credits
- Check network connection

**Face cards not showing**
- Run generation script
- Check files exist in `assets/cards/face-styles/`
- Rebuild app to include new assets

**Theme not persisting**
- Implement AsyncStorage save/load
- Check device storage permissions
