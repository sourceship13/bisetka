# Chess & Checkers Redesign - Status

## ✅ Completed

### 1. ChessScreen Background Update
- ✅ Added `ImageBackground` with park-background.png
- ✅ Added `LinearGradient` overlay matching Blot style
- ✅ Updated imports
- ✅ Updated styles (added overlay and safeArea styles)
- **File:** `src/screens/Games/Chess/ChessScreen.tsx`

### 2. Asset Directories Created
```
assets/
  chess/
    pieces/     ✅ Created
  checkers/
    pieces/     ✅ Created
```

### 3. Documentation Created
- ✅ `CHESS_CHECKERS_REDESIGN.md` - Complete implementation guide
- ✅ `CHESS_CHECKERS_STATUS.md` - This file

---

## 🚧 Remaining Work

### Phase 1: CheckersScreen Background (Quick - 10 mins)

**Update:** `src/screens/Games/Checkers/CheckersScreen.tsx`

**Changes needed:**
1. Add imports:
```tsx
import { ImageBackground } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
```

2. Wrap returns with ImageBackground + LinearGradient (same pattern as ChessScreen)

3. Update styles:
```tsx
container: {
  flex: 1,
},
overlay: {
  flex: 1,
},
safeArea: {
  flex: 1,
},
```

**Note:** CheckersScreen has 3 return statements (matchmaking, game, difficulty) - all need wrapping

---

### Phase 2: Generate Assets (API Quota Issue)

**Problem:** Gemini API quota exhausted
**Solution:** Wait for quota reset OR use OpenAI DALL-E

#### Assets Needed:

**Chess (13 images):**
- 1 board (2K resolution)
- 12 pieces (1K each): white-king, white-queen, white-rook, white-bishop, white-knight, white-pawn, black-king, black-queen, black-rook, black-bishop, black-knight, black-pawn

**Checkers (5 images):**
- 1 board (2K resolution)
- 4 pieces (1K each): red-regular, red-king, black-regular, black-king

#### Option A: Wait for Gemini Quota Reset (42s as of last error)

Run these commands after quota resets:

**Chess Board:**
```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/chess

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py \
  --prompt "Beautiful chess board design viewed from above. 8x8 grid with clearly defined squares. Alternating light tan and dark brown squares with elegant wood texture and subtle grain patterns. Include coordinate labels (a-h horizontally, 1-8 vertically) in small elegant font on edges. Clean professional design with slight shadow between squares for depth. No pieces. Flat lay perspective. Premium wooden chess board." \
  --filename "board.png" \
  --resolution 2K
```

**Chess Pieces (example for white king):**
```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/chess/pieces

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py \
  --prompt "Chess piece: White King. Original artistic design. Front view centered. Tallest piece with crown/cross on top. Regal commanding presence. White marble material. Transparent background. High detail professional quality. Clean elegant design easily recognizable as king." \
  --filename "white-king.png" \
  --resolution 1K
```

**Repeat for all 12 pieces** (see CHESS_CHECKERS_REDESIGN.md for all prompts)

**Checkers Board:**
```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/checkers

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py \
  --prompt "Beautiful checkers board viewed from above. 8x8 grid with alternating dark and light squares. Classic red and black color scheme, modern artistic style. Clean precise boundaries. Transparent background. Professional quality. No pieces." \
  --filename "board.png" \
  --resolution 2K
```

**Checkers Pieces (example for red regular):**
```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/checkers/pieces

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py \
  --prompt "Checkers piece: Red regular disc. Top-down view centered. Circular disc smooth glossy surface. Bright red color. 3D appearance with slight shadow. Transparent background. Professional quality." \
  --filename "red-regular.png" \
  --resolution 1K
```

**Repeat for all 4 pieces** (see CHESS_CHECKERS_REDESIGN.md for all prompts)

#### Option B: Use OpenAI DALL-E (Available Now)

Create a simple generation script:

**File:** `scripts/generate-game-assets.sh`
```bash
#!/bin/bash
# Generate chess and checkers assets using OpenAI DALL-E

ASSETS_DIR="/Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets"

# Requires: pip install openai pillow

python3 << 'EOF'
import openai
import os
import requests
from pathlib import Path

openai.api_key = os.environ.get("OPENAI_API_KEY")

def generate_image(prompt, output_path, size="1024x1024"):
    print(f"Generating: {output_path}")
    response = openai.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size=size,
        quality="standard",
        n=1,
    )
    image_url = response.data[0].url
    img_data = requests.get(image_url).content
    with open(output_path, 'wb') as f:
        f.write(img_data)
    print(f"✅ Saved: {output_path}")

# Chess board
generate_image(
    "Beautiful chess board design viewed from above. 8x8 grid with clearly defined squares. Alternating light tan and dark brown squares with elegant wood texture. Include coordinate labels a-h and 1-8 on edges. No pieces. Premium wooden chess board.",
    "$ASSETS_DIR/chess/board.png",
    "1024x1024"
)

# Chess pieces - white king
generate_image(
    "Chess piece: White King. Original artistic design. Front view centered. Tallest piece with crown on top. Regal design. White marble material. Transparent background. Professional quality.",
    "$ASSETS_DIR/chess/pieces/white-king.png",
    "1024x1024"
)

# ... add more pieces ...

print("✅ All assets generated!")
EOF
```

---

### Phase 3: Integrate Generated Assets into Components

#### Update ChessPiece Component

**Current:** Uses emoji or text
**New:** Use image assets

**File:** `src/components/ChessPiece.tsx`

```tsx
import { Image } from 'react-native';

const PIECE_IMAGES = {
  'white-king': require('../assets/chess/pieces/white-king.png'),
  'white-queen': require('../assets/chess/pieces/white-queen.png'),
  'white-rook': require('../assets/chess/pieces/white-rook.png'),
  'white-bishop': require('../assets/chess/pieces/white-bishop.png'),
  'white-knight': require('../assets/chess/pieces/white-knight.png'),
  'white-pawn': require('../assets/chess/pieces/white-pawn.png'),
  'black-king': require('../assets/chess/pieces/black-king.png'),
  'black-queen': require('../assets/chess/pieces/black-queen.png'),
  'black-rook': require('../assets/chess/pieces/black-rook.png'),
  'black-bishop': require('../assets/chess/pieces/black-bishop.png'),
  'black-knight': require('../assets/chess/pieces/black-knight.png'),
  'black-pawn': require('../assets/chess/pieces/black-pawn.png'),
};

const ChessPiece = ({ type, color }) => {
  const pieceKey = `${color}-${type}`;
  return (
    <Image
      source={PIECE_IMAGES[pieceKey]}
      style={{ width: '80%', height: '80%' }}
      resizeMode="contain"
    />
  );
};
```

#### Update CheckersScreen Piece Rendering

**Current:** Uses colored View with border
**New:** Use image assets

```tsx
const CHECKER_IMAGES = {
  'red-regular': require('../../../assets/checkers/pieces/red-regular.png'),
  'red-king': require('../../../assets/checkers/pieces/red-king.png'),
  'black-regular': require('../../../assets/checkers/pieces/black-regular.png'),
  'black-king': require('../../../assets/checkers/pieces/black-king.png'),
};

// In render:
{piece && (
  <Image
    source={CHECKER_IMAGES[`${piece.color}-${piece.type}`]}
    style={{ width: '70%', height: '70%' }}
    resizeMode="contain"
  />
)}
```

---

### Phase 4: AI Generation Palette Component (Advanced Feature)

**Purpose:** Allow on-the-fly regeneration of boards and pieces from within the game

**File:** `src/components/AIGenerationPalette.tsx`

**Features:**
- Modal/dropdown from toolbar
- Text input for prompts
- Preview of current assets
- "Generate" button per asset
- "Regenerate All" button
- Save generated images to assets folder

**Integration:**
- Add 🎨 button to GameToolbar
- Pass game type ('chess' or 'checkers')
- Open AIGenerationPalette modal
- On generate, call image generation API
- Save to correct asset path
- Reload game screen to show new assets

**Note:** This is an advanced feature - can be implemented later after basic assets are in place

---

## 📋 Quick Action Plan

### Immediate (You can do now):

1. **Update CheckersScreen background** (10 mins)
   - Copy pattern from ChessScreen
   - Same ImageBackground + LinearGradient wrapper

2. **Wait for API quota reset** (~1 minute from last error)
   - Then run asset generation commands

### After Assets Generated:

3. **Update ChessPiece component** (15 mins)
   - Use image assets instead of emoji/text

4. **Update CheckersScreen piece rendering** (10 mins)
   - Use image assets instead of colored View

5. **Test both games** (10 mins)
   - Verify background looks good
   - Verify all pieces render correctly
   - Verify gameplay still works

### Later (Optional):

6. **Build AI Generation Palette** (2-3 hours)
   - Full custom regeneration UI
   - Save assets dynamically

---

## 🎨 Visual Preview

**Before:** Plain colored backgrounds
**After:** Beautiful park background with blur + gradient overlay (like Blot)

**Before:** Generic emoji/text pieces
**After:** Custom artistic marble/wood pieces

---

## 🚀 Commands Ready to Run

All commands are documented in:
- `CHESS_CHECKERS_REDESIGN.md` - Full prompts for all 18 assets
- This file - Quick copy-paste commands

**Estimated time to generate all assets:** 15-20 minutes (if running sequentially due to API rate limits)

---

## ✅ Success Criteria

- [x] Chess has park background ✅
- [ ] Checkers has park background
- [ ] Chess board image generated
- [ ] 12 chess piece images generated
- [ ] Checkers board image generated
- [ ] 4 checkers piece images generated
- [ ] ChessPiece component updated to use images
- [ ] CheckersScreen updated to use images
- [ ] Gameplay tested and working
- [ ] (Optional) AI Generation Palette component created

---

**Next Step:** Wait ~1 minute for Gemini quota reset, then run asset generation commands! 🎨
