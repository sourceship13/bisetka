# Game Piece Customization - Integration Guide

## Overview

The `GamePieceCustomizationModal` component allows players to generate custom chess and checkers pieces using AI, following the same pattern as the existing `CardCustomizationModal` for Blot games.

**Key Features:**
- ✅ Generate 12 chess pieces or 4 checkers pieces with AI
- ✅ Automatic background removal for transparent pieces
- ✅ Generate matching game boards
- ✅ Save/load custom piece sets
- ✅ Preset style prompts for quick starts
- ✅ Progress tracking during generation

---

## Files Created

### 1. Service Layer
**`src/services/pieceImageGeneration.service.ts`**
- `generateChessPieceSet(prompt, onProgress)` - Generate 12 chess pieces
- `generateCheckersPieceSet(prompt, onProgress)` - Generate 4 checkers pieces
- `generateGameBoard(gameType, prompt)` - Generate matching board
- Automatic background removal (requires `REMOVE_BG_API_KEY` env var)

### 2. Component
**`src/components/GamePieceCustomizationModal.tsx`**
- Modal UI matching `CardCustomizationModal` design
- Preset prompts for chess and checkers
- Progress tracking with live updates
- Piece preview grid
- Board generation

---

## Integration Steps

### Step 1: Add Environment Variable (Optional)

For automatic background removal, add to `.env`:

```bash
REMOVE_BG_API_KEY=your_key_from_remove.bg
```

**Free tier:** 50 API calls/month (enough for 4 chess sets)  
**Get key:** https://remove.bg/api

**Note:** If not set, pieces will have white backgrounds (requires manual removal or alternative solution).

---

### Step 2: Update ChessScreen.tsx

Add the customization modal and piece set storage:

```typescript
import GamePieceCustomizationModal, { PieceSet } from '../../components/GamePieceCustomizationModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const [customizationVisible, setCustomizationVisible] = useState(false);
const [currentPieceSet, setCurrentPieceSet] = useState<PieceSet | null>(null);

// Load saved piece set on mount
useEffect(() => {
  loadPieceSet();
}, []);

const loadPieceSet = async () => {
  try {
    const saved = await AsyncStorage.getItem('chess_piece_set');
    if (saved) {
      setCurrentPieceSet(JSON.parse(saved));
    }
  } catch (error) {
    console.error('Failed to load piece set:', error);
  }
};

const savePieceSet = async (pieceSet: PieceSet) => {
  try {
    await AsyncStorage.setItem('chess_piece_set', JSON.stringify(pieceSet));
    setCurrentPieceSet(pieceSet);
  } catch (error) {
    console.error('Failed to save piece set:', error);
  }
};

// Add button to GameToolbar
<GameToolbar
  title="Chess"
  onBack={() => navigation.goBack()}
  onCustomize={() => setCustomizationVisible(true)}  // Add this prop
/>

// Add modal before closing </SafeAreaView>
<GamePieceCustomizationModal
  visible={customizationVisible}
  onClose={() => setCustomizationVisible(false)}
  onSave={savePieceSet}
  gameType="chess"
  currentPieceSet={currentPieceSet}
/>
```

---

### Step 3: Update ChessPiece Component

Make ChessPiece use custom or default pieces:

```typescript
interface ChessPieceProps {
  type: PieceType;
  color: PieceColor;
  customPieceSet?: PieceSet | null;  // Add this prop
}

const ChessPiece: React.FC<ChessPieceProps> = ({ type, color, customPieceSet }) => {
  const pieceKey = `${color}-${type}`;
  
  // Use custom piece if available, otherwise default
  const imageSource = customPieceSet?.pieces[pieceKey]
    ? { uri: customPieceSet.pieces[pieceKey] }
    : DEFAULT_PIECES[pieceKey];

  return (
    <View style={styles.container}>
      <Image
        source={imageSource}
        style={styles.pieceImage}
        resizeMode="contain"
      />
    </View>
  );
};
```

**Then in ChessScreen, pass the piece set:**

```typescript
<ChessPiece 
  type={piece.type} 
  color={piece.color}
  customPieceSet={currentPieceSet}  // Pass custom set
/>
```

---

## Summary

✅ **Created:**
1. `pieceImageGeneration.service.ts` - AI generation + background removal
2. `GamePieceCustomizationModal.tsx` - Customization UI (same pattern as Blot cards)
3. Integration guide with code examples

✅ **Next Steps:**
1. Add customize button to Chess/Checkers screens
2. Update ChessPiece to use custom or default pieces
3. Add AsyncStorage for saving piece sets
4. (Optional) Get remove.bg API key for transparent backgrounds

✅ **Reuses Existing Pattern:**
- Same modal design as CardCustomizationModal
- Same service architecture as cardImageGeneration
- Same save/load flow with AsyncStorage

**Ready to integrate!** 🛰️
