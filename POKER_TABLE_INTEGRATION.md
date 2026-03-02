# ✅ Poker Table Generated - 8 Player Setup

## What Was Generated

### Poker Table (`assets/poker/table.png` - 1.8MB HD)
- ✅ **Oval/elliptical shape** designed for 8 players
- ✅ **Green felt surface** in center (casino style)
- ✅ **Ornate wooden border** with golden decorative accents
- ✅ **8 player positions** around the perimeter
- ✅ **NO CARDS, NO CHIPS** - clean empty table
- ✅ **Matches Blot/Chess aesthetic** - luxury card table style

---

## Design Features

### Layout:
- **Shape:** Oval/elliptical (traditional poker table)
- **Surface:** Green felt center area
- **Border:** Dark wood with golden ornamental corners
- **Capacity:** 8 player positions around perimeter
- **Style:** Professional casino/luxury game table

### Consistent with Other Games:
- ✅ Same ornate wooden border (like Chess/Checkers/Blot)
- ✅ Same golden decorative accents
- ✅ Same luxury card table aesthetic
- ✅ Unified design language across all Bisetka games

---

## Integration Guide

### Step 1: Find Poker Screen

Locate the poker game screen file (likely):
- `src/screens/Games/Poker/PokerScreen.tsx` or
- `src/screens/Games/Texas Holdem/TexasHoldemScreen.tsx` or
- Similar poker game component

### Step 2: Add ImageBackground

Wrap the poker table/game area with ImageBackground:

```typescript
import { ImageBackground } from 'react-native';

// In the render, wrap the game table area:
<ImageBackground
  source={require('../../../assets/poker/table.png')}
  style={styles.tableContainer}
  resizeMode="contain"  // or "stretch" depending on layout
>
  {/* Player positions */}
  {/* Community cards area */}
  {/* Pot display */}
  {/* Action buttons */}
</ImageBackground>
```

### Step 3: Position 8 Players

For an 8-player oval table, position players around the perimeter:

```typescript
const PLAYER_POSITIONS = [
  { position: 0, style: styles.playerBottom },      // Bottom center (you)
  { position: 1, style: styles.playerBottomLeft },  // Bottom left
  { position: 2, style: styles.playerLeft },        // Left
  { position: 3, style: styles.playerTopLeft },     // Top left
  { position: 4, style: styles.playerTop },         // Top center
  { position: 5, style: styles.playerTopRight },    // Top right
  { position: 6, style: styles.playerRight },       // Right
  { position: 7, style: styles.playerBottomRight }, // Bottom right
];

// Style positioning (example):
playerBottom: {
  position: 'absolute',
  bottom: 20,
  alignSelf: 'center',
},
playerLeft: {
  position: 'absolute',
  left: 20,
  top: '50%',
},
playerTop: {
  position: 'absolute',
  top: 20,
  alignSelf: 'center',
},
playerRight: {
  position: 'absolute',
  right: 20,
  top: '50%',
},
// ... etc for all 8 positions
```

### Step 4: Center Community Cards

Position the community cards in the center of the table:

```typescript
communityCardsContainer: {
  position: 'absolute',
  top: '35%',
  alignSelf: 'center',
  flexDirection: 'row',
  gap: 8,
}
```

### Step 5: Style the Table Container

```typescript
tableContainer: {
  flex: 1,
  width: '100%',
  maxWidth: 800,  // Larger than chess (8 players need more space)
  aspectRatio: 1,
  justifyContent: 'center',
  alignItems: 'center',
}
```

---

## 8-Player Layout Visualization

```
            Player 4 (top)
              Cards
    
  Player 3          Player 5
   Cards              Cards
   
Player 2              Player 6
 Cards      [Pot]      Cards
            [Flop]
            [Turn]
Player 1    [River]   Player 7
 Cards                 Cards

  You (Player 0)
     Your Cards
   [Action Buttons]
```

### Position Breakdown:
- **Position 0:** Bottom center (your seat)
- **Positions 1-3:** Left side (counterclockwise)
- **Position 4:** Top center (across from you)
- **Positions 5-7:** Right side (counterclockwise)

---

## Integration Examples

### Example 1: Texas Hold'em Screen

```typescript
const TexasHoldemScreen = () => {
  return (
    <ImageBackground
      source={require('../../../assets/backgrounds/park-background.png')}
      style={styles.container}
      blurRadius={3}>
      <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']} style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <GameToolbar title="Texas Hold'em" onBack={() => navigation.goBack()} />
          
          <View style={styles.gameContainer}>
            <ImageBackground
              source={require('../../../assets/poker/table.png')}
              style={styles.tableContainer}
              resizeMode="contain"
            >
              {/* 8 Players positioned around table */}
              {players.map((player, index) => (
                <View key={player.id} style={PLAYER_POSITIONS[index].style}>
                  <PlayerCard player={player} />
                </View>
              ))}
              
              {/* Community cards in center */}
              <View style={styles.communityCardsContainer}>
                {communityCards.map(card => <Card key={card.id} card={card} />)}
              </View>
              
              {/* Pot display */}
              <View style={styles.potDisplay}>
                <Text style={styles.potText}>Pot: ${pot}</Text>
              </View>
            </ImageBackground>
            
            {/* Your action buttons below table */}
            <View style={styles.actionsContainer}>
              <Button title="Fold" onPress={handleFold} />
              <Button title="Call" onPress={handleCall} />
              <Button title="Raise" onPress={handleRaise} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
};
```

### Example 2: Simple Integration

If the poker screen already has a table container, just add the ImageBackground:

```typescript
// Before:
<View style={styles.pokerTable}>
  {/* game content */}
</View>

// After:
<ImageBackground
  source={require('../../../assets/poker/table.png')}
  style={styles.pokerTable}
  resizeMode="contain"
>
  {/* game content */}
</ImageBackground>
```

---

## Styling Tips

### 1. Table Size
```typescript
tableContainer: {
  width: '100%',
  maxWidth: 800,    // Larger than chess (500px) for 8 players
  aspectRatio: 1,   // Square container for oval table
}
```

### 2. Responsive Player Positions
Use percentages for positioning so it scales:
```typescript
playerLeft: {
  position: 'absolute',
  left: '5%',      // % of table width
  top: '40%',      // % of table height
}
```

### 3. Community Cards Sizing
```typescript
communityCard: {
  width: 60,       // Smaller than player cards
  height: 90,
  marginHorizontal: 4,
}
```

### 4. Keep Action Buttons Outside Table
```typescript
actionsContainer: {
  marginTop: 20,   // Below the table image
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 12,
}
```

---

## Benefits

✅ **Professional appearance** - Real casino poker table look  
✅ **8-player capacity** - Room for full table games  
✅ **Consistent design** - Matches Chess/Checkers/Blot luxury aesthetic  
✅ **Empty table** - No pre-rendered cards/chips to conflict with game state  
✅ **Ornate border** - Same golden decorative accents as other games  
✅ **Green felt** - Traditional poker table color  

---

## Testing Checklist

- [ ] Table image displays correctly
- [ ] All 8 player positions visible and accessible
- [ ] Community cards positioned in center
- [ ] Player cards visible at each position
- [ ] Action buttons accessible
- [ ] Pot display visible
- [ ] Table scales on different screen sizes
- [ ] Matches Blot/Chess/Checkers aesthetic

---

## Files Created

```
✅ assets/poker/table.png (1.8MB HD)
   - 8-player oval poker table
   - Ornate border with golden accents
   - Green felt surface
   - Empty (no cards/chips)
```

---

## Next Steps

1. **Locate poker screen file** (PokerScreen.tsx or similar)
2. **Add ImageBackground** with poker table
3. **Position 8 players** around the perimeter
4. **Center community cards** on the table
5. **Test with different screen sizes**

**Want me to integrate it into the poker screen for you?** 🛰️

Just point me to the poker screen file and I'll add the table background! 🃏
