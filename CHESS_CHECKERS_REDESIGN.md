# Chess & Checkers Visual Redesign

## 🎯 Goal
Make chess and checkers games have the same beautiful visual style as the Blot games with:
- Park background (blurred)
- Original chess board and piece designs
- Original checkers board and piece designs
- AI generation palette in toolbar for on-the-fly regeneration

---

## 📋 Implementation Checklist

### Phase 1: Background Updates ✅
- [x] Update ChessScreen.tsx to use park-background.png
- [x] Update CheckersScreen.tsx to use park-background.png
- [x] Add LinearGradient overlay matching Blot style

### Phase 2: Asset Generation
#### Chess Assets
- [ ] **Chess Board** - 1 image (8x8 grid with coordinates)
- [ ] **Chess Pieces** (12 total):
  - White: King, Queen, Rook, Bishop, Knight, Pawn
  - Black: King, Queen, Rook, Bishop, Knight, Pawn

#### Checkers Assets
- [ ] **Checkers Board** - 1 image (8x8 alternating red/black)
- [ ] **Checkers Pieces** (4 total):
  - Red: Regular piece, King piece
  - Black: Regular piece, King piece

### Phase 3: AI Generation Palette
- [ ] Create AIGenerationPalette component
- [ ] Add to GameToolbar as dropdown/modal
- [ ] Allow selection of:
  - Board style
  - Piece style
  - Individual piece regeneration
- [ ] Save generated assets to project

---

## 🎨 Asset Specifications

### Chess Board
**Dimensions:** 2K (2048x2048px)
**Style:** 
- Original/unique design (not standard chess board)
- Clear 8x8 grid with alternating squares
- Coordinates on edges (a-h, 1-8)
- Professional but creative look
- Transparent background for overlay on park-background

**Prompt:**
```
Create a beautiful, original chess board design viewed from above. 
8x8 grid with clearly defined squares. 
Alternating light and dark squares in an artistic style (not standard tan/brown). 
Consider: marble texture, wood grain, or metallic finish. 
Include coordinate labels (a-h horizontally, 1-8 vertically) on the edges. 
Transparent background. High-quality, professional game board design.
Style: elegant, modern, premium quality. 
No pieces on the board.
```

### Chess Pieces
**Dimensions:** 1K (1024x1024px) per piece
**Style:**
- Original design (not traditional Staunton pieces)
- Clearly distinguishable piece types
- Modern/artistic interpretation
- Transparent background
- Clear silhouette for recognition

**Piece Prompts:**

**White King:**
```
Chess piece: White King. Original artistic design. 
Front view, centered. Clearly the tallest piece with crown/cross on top. 
Regal and commanding presence. Premium material (marble, crystal, or metal). 
Transparent background. High detail, professional quality.
Style: elegant, modern, easily recognizable as a king.
```

**White Queen:**
```
Chess piece: White Queen. Original artistic design.
Front view, centered. Second tallest piece with elegant crown (no cross). 
Graceful and powerful design. Premium material (marble, crystal, or metal).
Transparent background. High detail, professional quality.
Style: elegant, feminine strength, easily recognizable as a queen.
```

**White Rook:**
```
Chess piece: White Rook (Castle). Original artistic design.
Front view, centered. Tower/fortress shape with battlements on top.
Strong, solid appearance. Premium material (marble, crystal, or metal).
Transparent background. High detail, professional quality.
Style: fortress-like, sturdy, easily recognizable as a rook.
```

**White Bishop:**
```
Chess piece: White Bishop. Original artistic design.
Front view, centered. Tall piece with pointed top or mitre shape.
Elegant diagonal design. Premium material (marble, crystal, or metal).
Transparent background. High detail, professional quality.
Style: ecclesiastical, pointed top, easily recognizable as a bishop.
```

**White Knight:**
```
Chess piece: White Knight. Original artistic design.
Side profile view, centered. Horse head or stylized equestrian design.
Dynamic and noble appearance. Premium material (marble, crystal, or metal).
Transparent background. High detail, professional quality.
Style: noble steed, unique shape, easily recognizable as a knight.
```

**White Pawn:**
```
Chess piece: White Pawn. Original artistic design.
Front view, centered. Smallest piece, simple rounded or spherical top.
Clean, elegant simplicity. Premium material (marble, crystal, or metal).
Transparent background. High detail, professional quality.
Style: simple, soldier-like, easily recognizable as a pawn.
```

**Black pieces:** Same prompts as white, but specify:
- "Dark material (obsidian, black marble, dark metal)"
- "Black Chess piece: [Type]"

### Checkers Board
**Dimensions:** 2K (2048x2048px)
**Style:**
- 8x8 alternating dark and light squares
- Classic checkers look but with modern twist
- Clear square boundaries
- Transparent background

**Prompt:**
```
Create a beautiful checkers board viewed from above.
8x8 grid with clearly defined alternating dark and light squares.
Classic red and black color scheme with modern artistic style.
Clean, precise square boundaries.
Transparent background. High-quality, professional game board design.
Style: bold, colorful, premium quality.
No pieces on the board.
```

### Checkers Pieces
**Dimensions:** 1K (1024x1024px) per piece
**Style:**
- Circular disc shape
- Clear color differentiation (red vs black)
- King pieces have crown or double-stack visual

**Prompts:**

**Red Regular:**
```
Checkers piece: Red regular disc. Top-down view, centered.
Circular disc with smooth glossy surface. Bright red color.
3D appearance with slight shadow underneath.
Transparent background. High detail, professional quality.
Style: bold, colorful, clearly red.
```

**Red King:**
```
Checkers piece: Red king disc. Top-down view, centered.
Circular disc with crown symbol or double-stacked appearance.
Bright red color with gold crown accent.
3D appearance with slight shadow underneath.
Transparent background. High detail, professional quality.
Style: royal, decorated, clearly a king piece.
```

**Black Regular:**
```
Checkers piece: Black regular disc. Top-down view, centered.
Circular disc with smooth glossy surface. Deep black color.
3D appearance with slight shadow underneath.
Transparent background. High detail, professional quality.
Style: bold, sleek, clearly black.
```

**Black King:**
```
Checkers piece: Black king disc. Top-down view, centered.
Circular disc with crown symbol or double-stacked appearance.
Deep black color with gold or silver crown accent.
3D appearance with slight shadow underneath.
Transparent background. High detail, professional quality.
Style: royal, decorated, clearly a king piece.
```

---

## 🛠️ AI Generation Palette Component

### Location
`src/components/AIGenerationPalette.tsx`

### Features
- Dropdown/modal accessible from game toolbar
- Sections:
  1. **Board Generation**
     - Prompt input field
     - Generate button
     - Preview of current board
  2. **Piece Generation**
     - Grid of all pieces
     - Click piece to regenerate
     - Prompt input per piece
     - "Regenerate All" button
  3. **Quick Styles**
     - Preset style buttons:
       - Classic
       - Modern
       - Fantasy
       - Minimalist
       - Metallic

### Integration
- Add "🎨" button to GameToolbar
- Opens AIGenerationPalette modal
- Pass game type ('chess' or 'checkers')
- Save generated images to:
  - `assets/chess/board.png`
  - `assets/chess/pieces/white-king.png`
  - `assets/checkers/board.png`
  - `assets/checkers/pieces/red-regular.png`
  - etc.

---

## 📂 Asset Directory Structure

```
bisetka/
  assets/
    chess/
      board.png                    # Chess board (2K)
      pieces/
        white-king.png             # 1K
        white-queen.png
        white-rook.png
        white-bishop.png
        white-knight.png
        white-pawn.png
        black-king.png
        black-queen.png
        black-rook.png
        black-bishop.png
        black-knight.png
        black-pawn.png
    checkers/
      board.png                    # Checkers board (2K)
      pieces/
        red-regular.png            # 1K
        red-king.png
        black-regular.png
        black-king.png
    blot/
      park-background.png          # Existing
      card-table.png               # Existing
```

---

## 🎯 Component Updates

### ChessScreen.tsx
```tsx
// Add imports
import { ImageBackground } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

// Wrap SafeAreaView content
<ImageBackground
  source={require('../../../assets/blot/park-background.png')}
  style={styles.container}
  blurRadius={3}
>
  <LinearGradient
    colors={['rgba(15,15,35,0.7)', 'rgba(26,23,66,0.6)']}
    style={styles.overlay}
  >
    {/* Existing content */}
  </LinearGradient>
</ImageBackground>

// Update board rendering to use generated board image
<ImageBackground
  source={require('../../../assets/chess/board.png')}
  style={styles.board}
  imageStyle={{ borderRadius: 8 }}
>
  {/* Squares and pieces */}
</ImageBackground>

// Update piece rendering to use generated piece images
<Image
  source={require(`../../../assets/chess/pieces/${color}-${type}.png`)}
  style={styles.pieceImage}
/>
```

### CheckersScreen.tsx
- Same pattern as ChessScreen
- Use checkers assets instead

---

## 🚀 Generation Commands

### Generate Chess Assets

**Board:**
```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/chess
uv run ~/.codex/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Create a beautiful, original chess board design viewed from above. 8x8 grid with clearly defined squares. Alternating light and dark squares in artistic marble texture style. Include coordinate labels (a-h horizontally, 1-8 vertically) on edges. Transparent background. High-quality professional game board. No pieces." \
  --filename "board.png" \
  --resolution 2K
```

**Pieces (example for white king):**
```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/chess/pieces
uv run ~/.codex/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Chess piece: White King. Original artistic design. Front view, centered. Tallest piece with crown/cross on top. Regal commanding presence. White marble material. Transparent background. High detail professional quality." \
  --filename "white-king.png" \
  --resolution 1K
```

### Generate Checkers Assets

**Board:**
```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/checkers
uv run ~/.codex/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Beautiful checkers board viewed from above. 8x8 grid with alternating dark/light squares. Classic red and black color scheme, modern artistic style. Clean precise boundaries. Transparent background. Professional quality. No pieces." \
  --filename "board.png" \
  --resolution 2K
```

**Pieces (example for red regular):**
```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/checkers/pieces
uv run ~/.codex/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "Checkers piece: Red regular disc. Top-down view centered. Circular disc smooth glossy surface. Bright red color. 3D appearance with slight shadow. Transparent background. Professional quality." \
  --filename "red-regular.png" \
  --resolution 1K
```

---

## ⏱️ Timeline Estimate

- **Phase 1 (Backgrounds):** 15 minutes
- **Phase 2 (Asset Generation):** 
  - Chess: ~30 minutes (13 images: 1 board + 12 pieces)
  - Checkers: ~10 minutes (5 images: 1 board + 4 pieces)
- **Phase 3 (AI Palette):** 1-2 hours
- **Testing & Polish:** 30 minutes

**Total:** ~3-4 hours

---

## 🎨 Style Direction

**Overall aesthetic:**
- Premium quality
- Modern/contemporary feel
- Clear visual hierarchy
- Consistent material language (marble, crystal, metal)
- Transparent backgrounds for easy compositing
- High contrast for gameplay clarity

**Avoid:**
- Generic/stock imagery
- Unclear piece identification
- Busy/distracting patterns
- Low contrast that hinders gameplay

---

## 📱 Testing Checklist

- [ ] Park background visible and blurred
- [ ] Chess board displays correctly
- [ ] All 12 chess pieces render with correct images
- [ ] Checkers board displays correctly
- [ ] All 4 checkers pieces render with correct images
- [ ] AI generation palette opens from toolbar
- [ ] Can regenerate board
- [ ] Can regenerate individual pieces
- [ ] Generated assets save to correct directories
- [ ] Gameplay not affected (pieces still clickable, moves work)

---

## 🎯 Success Criteria

✅ Chess and checkers have same visual quality as Blot games
✅ Original, unique board and piece designs
✅ AI generation palette functional for on-the-fly customization
✅ Assets organized in proper directory structure
✅ Performance not impacted by new images
✅ Gameplay experience enhanced by better visuals
