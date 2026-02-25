#!/bin/bash
# Generate all preset card backs and theme assets

GEN_SCRIPT="/Users/alpha/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/openai-image-gen/scripts/gen.py"
cd "$(dirname "$0")"

echo "🎴 Generating preset card assets..."
echo

# Card backs
declare -A CARD_BACKS=(
  ["back-geometric"]="Modern abstract geometric shapes, colorful triangles and circles, contemporary design, symmetrical pattern, playing card back"
  ["back-floral"]="Elegant botanical floral design, ornate flowers and vines, Victorian style, symmetrical pattern, playing card back"
  ["back-tech"]="Circuit board pattern, technology theme, blue and green lines, microchip design, futuristic, playing card back"
  ["back-vintage"]="Aged vintage ornate pattern, sepia tones, classic decorative borders, antique playing card back"
  ["back-minimalist"]="Simple elegant minimalist design, clean lines, monochrome, modern luxury, subtle pattern, playing card back"
)

# Theme card backs
declare -A THEME_BACKS=(
  ["modern-back"]="Modern minimalist card back, clean geometric pattern, blue gradient, contemporary style, professional"
  ["retro-back"]="Retro 8-bit pixel art card back, vibrant neon colors, arcade style, geometric pixel pattern, nostalgic 1980s"
)

# Generate card backs
for name in "${!CARD_BACKS[@]}"; do
  if [ -f "${name}.png" ]; then
    echo "✓ Skipping $name (exists)"
  else
    echo "🎨 Generating $name..."
    python3 "$GEN_SCRIPT" \
      --prompt "${CARD_BACKS[$name]}" \
      --count 1 \
      --size 1024x1536 \
      --quality high \
      --model gpt-image-1 \
      --output-format png
    
    # Move generated file
    if [ -d tmp/openai-image-gen-* ]; then
      mv tmp/openai-image-gen-*/*.png "${name}.png"
      rm -rf tmp
      echo "✅ Generated $name"
    fi
    echo
    sleep 2
  fi
done

# Generate theme backs
for name in "${!THEME_BACKS[@]}"; do
  if [ -f "${name}.png" ]; then
    echo "✓ Skipping $name (exists)"
  else
    echo "🎨 Generating $name..."
    python3 "$GEN_SCRIPT" \
      --prompt "${THEME_BACKS[$name]}" \
      --count 1 \
      --size 1024x1536 \
      --quality high \
      --model gpt-image-1 \
      --output-format png
    
    # Move generated file
    if [ -d tmp/openai-image-gen-* ]; then
      mv tmp/openai-image-gen-*/*.png "${name}.png"
      rm -rf tmp
      echo "✅ Generated $name"
    fi
    echo
    sleep 2
  fi
done

echo "🎉 Preset generation complete!"
