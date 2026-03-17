# Dice Roll Animation Integration for Nardi

## Files Created

1. **`src/components/DiceRoll.tsx`** - Animated dice roll component with swipe gesture support

## Integration Steps

### 1. Import the DiceRoll component in NardiScreen.tsx

Add this import at the top of `src/screens/Games/Nardi/NardiScreen.tsx`:

```typescript
import DiceRoll from '../../../components/DiceRoll';
```

### 2. Replace the Roll Dice button (around line 854-867)

**Find this code:**
```typescript
{gameState.phase === 'rolling' && gameState.currentPlayer === myNardiColor && (
  <TouchableOpacity
    style={{ borderRadius: 16, overflow: 'hidden', elevation: 6 }}
    onPress={() => {
      console.log('🎲 Roll Dice button pressed!');
      handleRollDice();
    }}>
    <LinearGradient 
      colors={['#6366f1', '#8b5cf6']} 
      style={{ height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>🎲 Roll Dice</Text>
    </LinearGradient>
  </TouchableOpacity>
)}
```

**Replace with:**
```typescript
{gameState.phase === 'rolling' && gameState.currentPlayer === myNardiColor && (
  <View style={{ alignItems: 'center', paddingVertical: 8 }}>
    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8, opacity: 0.9 }}>
      👆 Swipe dice to roll
    </Text>
    <DiceRoll
      onRollComplete={(die1, die2) => {
        console.log('🎲 Rolled:', die1, die2);
        handleRollDice();
      }}
      enabled={true}
    />
  </View>
)}
```

### 3. Optional: Display current dice values

If you want to show the current dice values somewhere on the screen during the moving phase, you can add state to track them:

**Add state (near the top with other useState declarations):**
```typescript
const [lastRoll, setLastRoll] = useState<{ die1: number; die2: number } | null>(null);
```

**Update handleRollDice to save the roll:**
```typescript
const handleRollDice = () => {
  if (!gameState || gameState.phase !== 'rolling' || gameState.currentPlayer !== myNardiColor) return;

  const dice = rollDice();
  const movesRemaining = dice.die1 === dice.die2 ? 4 : 2;
  
  setLastRoll(dice); // Save the roll
  
  const newState = {
    ...gameState,
    dice,
    phase: 'moving' as const,
    movesRemaining,
    possibleMoves: calculatePossibleMoves(gameState, dice),
  };
  // ... rest of function
};
```

**Display the dice values during moving phase:**
```typescript
{gameState.phase === 'moving' && lastRoll && (
  <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', paddingVertical: 10 }}>
    <View style={styles.miniDice}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#333' }}>
        {lastRoll.die1}
      </Text>
    </View>
    <View style={styles.miniDice}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#333' }}>
        {lastRoll.die2}
      </Text>
    </View>
  </View>
)}
```

**Add to styles:**
```typescript
miniDice: {
  width: 40,
  height: 40,
  backgroundColor: '#fff',
  borderRadius: 8,
  borderWidth: 2,
  borderColor: '#333',
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 4,
},
```

## Features

✅ **Swipe gesture** - Swipe in any direction to roll the dice  
✅ **Animated rolling** - Smooth rotation, scaling, and bounce effects  
✅ **Random results** - Generates random 1-6 values for each die  
✅ **Visual feedback** - Dice bounce and rotate during animation  
✅ **Classic dice faces** - Rendered with dots (pips) like real dice  
✅ **Callback on complete** - Triggers `onRollComplete` when animation finishes  
✅ **Disabled state** - Can be disabled when it's not the player's turn

## How it works

1. **Swipe Detection**: Uses PanResponder to detect swipe gestures
2. **Animation**: Rotates dice 4 full rotations with bounce effect
3. **Random Display**: Updates dice faces rapidly during roll
4. **Final Result**: Settles on random values and calls onRollComplete callback
5. **Integration**: Callback triggers the existing handleRollDice() logic

## Testing

1. Start the Nardi game
2. When it's your turn to roll, swipe the dice in any direction
3. Watch the animation play
4. The dice should settle on random values
5. The game should proceed with those dice values

## Customization

You can adjust animation parameters in `DiceRoll.tsx`:
- `duration` - How long the roll animation takes (default 600ms)
- `rotations` - Number of full rotations (default 4)
- Dice size, colors, shadow effects in styles

Enjoy the animated dice! 🎲🎲
