#!/bin/bash

# Generate all 52 playing cards with modern design
# Usage: bash generate-cards.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GEN_SCRIPT="/Users/alpha/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/openai-image-gen/scripts/gen.py"

cd "$SCRIPT_DIR"

# Base prompt for all cards
BASE_PROMPT="A single playing card, modern minimalist design, clean white border, centered large symbol, professional casino quality, high contrast, elegant typography, flat design with subtle gradients, premium card stock texture"

# Array of suits and their colors
declare -A suit_colors
suit_colors[hearts]="red"
suit_colors[diamonds]="red"
suit_colors[clubs]="black"
suit_colors[spades]="black"

# Suits with symbols
declare -A suit_symbols
suit_symbols[hearts]="♥"
suit_symbols[diamonds]="♦"
suit_symbols[clubs]="♣"
suit_symbols[spades]="♠"

# Ranks
ranks=("A" "2" "3" "4" "5" "6" "7" "8" "9" "10" "J" "Q" "K")

# Generate each card
for suit in hearts diamonds clubs spades; do
  color=${suit_colors[$suit]}
  symbol=${suit_symbols[$suit]}
  
  for rank in "${ranks[@]}"; do
    filename="${rank}-${suit}.png"
    
    if [ -f "$filename" ]; then
      echo "✓ Skipping $filename (already exists)"
      continue
    fi
    
    prompt="${BASE_PROMPT}, large ${symbol} symbol in ${color}, ${rank} rank in corners, ${suit} suit, photorealistic 3D render with soft shadows"
    
    echo "🎴 Generating $filename..."
    python3 "$GEN_SCRIPT" \
      --prompt "$prompt" \
      --count 1 \
      --size 1024x1024 \
      --quality high \
      --model gpt-image-1 \
      --out-dir /tmp/card-gen-tmp
    
    # Move the generated file
    if [ -f /tmp/card-gen-tmp/*.png ]; then
      mv /tmp/card-gen-tmp/*.png "$filename"
      rm -rf /tmp/card-gen-tmp
      echo "✅ Generated $filename"
    else
      echo "❌ Failed to generate $filename"
    fi
    
    # Small delay to avoid rate limits
    sleep 2
  done
done

echo "🎉 All cards generated!"
