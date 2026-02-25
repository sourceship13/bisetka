# Card Rank/Suit Overlays

This directory contains transparent PNG overlays with just the rank numbers and suit symbols for all 52 playing cards.

## Purpose

These overlays are composited on top of custom AI-generated backgrounds, allowing users to have personalized card backgrounds while keeping consistent, readable rank/suit symbols.

## Structure

Each overlay is a transparent PNG (700×1000) with:
- Rank numbers in corners (top-left, bottom-right)
- Suit symbols in standard playing card pattern
- **No background** (fully transparent)
- Black symbols for clubs/spades, red for hearts/diamonds

## File Naming

`{Rank}-{suit}.png`

Examples:
- `A-spades.png`
- `K-hearts.png`
- `7-diamonds.png`

## Generation

Run the generation script to create all 52 overlays:

```bash
python3 generate-overlays.py
```

This will generate:
- 13 ranks × 4 suits = 52 cards
- ~10-15 minutes total
- ~$2-3 in API costs (one-time)

## Usage

In the app, cards are rendered as:
1. **Background layer**: Custom AI-generated texture (or white default)
2. **Overlay layer**: Transparent rank/suit symbols from this directory

This allows users to customize their cards with only 2 AI generations per theme (background + card back) instead of 52 individual cards.

## Testing Locally

To preview overlays on different backgrounds:
```bash
# Create test composite
convert default-card-background.png A-spades.png -composite test-card.png
```

## Regenerating Individual Cards

To regenerate a specific overlay:
```bash
# Delete the card
rm A-spades.png

# Run the generation script (it will skip existing files)
python3 generate-overlays.py
```
