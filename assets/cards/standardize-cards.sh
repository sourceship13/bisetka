#!/bin/bash
# Standardize all card images to exact same size using macOS sips

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Target dimensions
TARGET_WIDTH=700
TARGET_HEIGHT=1000

echo "🎴 Standardizing cards to ${TARGET_WIDTH}x${TARGET_HEIGHT}..."
echo

count=0
for card in *.png; do
  if [ "$card" = "*.png" ]; then
    echo "No PNG files found!"
    exit 1
  fi
  
  echo "Processing $card..."
  
  # Resize while maintaining aspect ratio, then pad to exact size
  sips --resampleHeightWidthMax 980 "$card" &>/dev/null
  sips --padToHeightWidth $TARGET_HEIGHT $TARGET_WIDTH "$card" &>/dev/null
  
  if [ $? -eq 0 ]; then
    echo "✅ Standardized $card"
    ((count++))
  else
    echo "❌ Failed to process $card"
  fi
  echo
done

echo "=================================================="
echo "🎉 Standardized $count cards!"
echo "📐 Uniform size: ${TARGET_WIDTH}x${TARGET_HEIGHT}"
echo "=================================================="
