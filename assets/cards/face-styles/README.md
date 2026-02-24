# Face Card Styles

This directory contains pre-designed face card styles (J, Q, K) for each theme.

## Styles

Each style should have 12 cards (J, Q, K × 4 suits):

### 1. Modern
- Clean, minimalist design
- Bold colors
- Geometric shapes
- Sans-serif typography

### 2. Vintage
- Classic ornate patterns
- Aged, textured look
- Sepia tones
- Decorative borders

### 3. Retro
- 80s neon vibes
- Geometric shapes
- Bright colors
- Bold outlines

### 4. Cyberpunk
- Futuristic tech aesthetic
- Neon accents (cyan, magenta, yellow)
- Digital/glitch effects
- Circuit patterns

### 5. Minimal
- Ultra-clean design
- Subtle colors
- Maximum negative space
- Elegant simplicity

## File Naming Convention

`{style}/{rank}-{suit}.png`

Examples:
- `modern/J-hearts.png`
- `vintage/Q-spades.png`
- `cyberpunk/K-diamonds.png`

## Generation Script

Run the generation script to create all face card styles:

```bash
python3 generate-face-styles.py
```

This will generate all 60 face cards (12 cards × 5 styles).
