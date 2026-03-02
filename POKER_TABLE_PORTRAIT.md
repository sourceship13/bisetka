# ✅ Portrait Poker Table - Ready for Integration

## What We Have

### Poker Table (`assets/poker/table.png` - 1.2MB Portrait)
- ✅ **Portrait orientation** (1024×1536 - vertical format)
- ✅ **Oval poker table** from top-down view
- ✅ **Green felt surface** with card placement areas
- ✅ **Gray racetrack rail** around perimeter
- ✅ **8 player positions** marked with card spaces
- ✅ **Community card area** in center (5 card spaces)
- ✅ **4 poker chips** shown in center

### Note on Background
The table currently has a **black background**. In React Native, handle this by:
1. **Option A:** Set `backgroundColor: '#000'` on container (matches black background)
2. **Option B:** Use park background like other games (table appears on top)

---

## Table Layout

### 8 Player Positions (Portrait):

```
       [P3]  [P4]  [P5]
          ╔═══════╗
    [P2]  ║       ║  [P6]
          ║ [Pot] ║
          ║[Cards]║
    [P1]  ║       ║  [P7]
          ╚═══════╝
         [P0 - You]
```

**Player Arrangement:**
- **Bottom (P0):** Your seat - best position
- **Left side (P1-P2-P3):** Players on your left
- **Top (P4):** Player across from you
- **Right side (P5-P6-P7):** Players on your right

**Card Spaces:**
- Each position has 2 card spaces marked
- Center has 5 community card spaces (flop/turn/river)
- 4 poker chips visible in center

---

## Integration Guide

### Step 1: Basic Setup

```typescript
import { ImageBackground } from 'react-native';

<ImageBackground
  source={require('../../../assets/poker/table.png')}
  style={styles.pokerTable}
  resizeMode="contain"  // Maintains aspect ratio
>
  {/* Game content */}
</ImageBackground>
```

### Step 2: Container Styling

**Option A: Black Background (Seamless)**
```typescript
container: {
  flex: 1,
  backgroundColor: '#000',  // Matches table background
  justifyContent: 'center',
  alignItems: 'center',
}

pokerTable: {
  width: '100%',
  maxWidth: 600,      // Portrait, so narrower maxWidth
  aspectRatio: 1024 / 1536,  // 0.667 (portrait ratio)
  alignSelf: 'center',
}
```

**Option B: Park Background (Like Other Games)**
```typescript
<ImageBackground
  source={require('../../../assets/backgrounds/park-background.png')}
  style={styles.container}
  blurRadius={3}>
  <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']} style={styles.overlay}>
    <ImageBackground
      source={require('../../../assets/poker/table.png')}
      style={styles.pokerTable}
      resizeMode="contain"
    >
      {/* Game content */}
    </ImageBackground>
  </LinearGradient>
</ImageBackground>
```

### Step 3: Position 8 Players Around Table

Since the table is portrait and player positions are marked:

```typescript
const PLAYER_POSITIONS = [
  // Bottom center (you)
  { seat: 0, style: { bottom: '8%', left: '50%', transform: [{ translateX: -40 }] } },
  
  // Left side
  { seat: 1, style: { bottom: '25%', left: '15%' } },
  { seat: 2, style: { top: '35%', left: '12%' } },
  { seat: 3, style: { top: '18%', left: '22%' } },
  
  // Top center
  { seat: 4, style: { top: '8%', left: '50%', transform: [{ translateX: -40 }] } },
  
  // Right side
  { seat: 5, style: { top: '18%', right: '22%' } },
  { seat: 6, style: { top: '35%', right: '12%' } },
  { seat: 7, style: { bottom: '25%', right: '15%' } },
];

// Render players
{players.map((player, index) => (
  <View key={player.id} style={[styles.playerSeat, PLAYER_POSITIONS[index].style]}>
    <PlayerCard player={player} />
  </View>
))}
```

### Step 4: Position Community Cards

The table has 5 card spaces marked in the center:

```typescript
communityCards: {
  position: 'absolute',
  top: '42%',          // Vertically centered
  left: '50%',
  transform: [{ translateX: -125 }],  // Center 5 cards (~50px each)
  flexDirection: 'row',
  gap: 6,
}
```

### Step 5: Pot Display

Position above or below community cards:

```typescript
pot: {
  position: 'absolute',
  top: '38%',
  alignSelf: 'center',
  backgroundColor: 'rgba(0,0,0,0.6)',
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 20,
}
```

---

## Complete Example

```typescript
const PokerScreen = () => {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <GameToolbar title="Texas Hold'em" onBack={goBack} />
        
        <View style={styles.gameArea}>
          <ImageBackground
            source={require('../../../assets/poker/table.png')}
            style={styles.pokerTable}
            resizeMode="contain"
          >
            {/* 8 Players */}
            {players.map((player, idx) => (
              <View 
                key={player.id} 
                style={[styles.playerSeat, PLAYER_POSITIONS[idx].style]}
              >
                <PlayerCard 
                  name={player.name}
                  chips={player.chips}
                  cards={player.cards}
                  isActive={player.isActive}
                />
              </View>
            ))}
            
            {/* Pot */}
            <View style={styles.pot}>
              <Text style={styles.potText}>Pot: ${pot}</Text>
            </View>
            
            {/* Community Cards */}
            <View style={styles.communityCards}>
              {board.map((card, i) => (
                <Card key={i} rank={card.rank} suit={card.suit} />
              ))}
            </View>
          </ImageBackground>
          
          {/* Action Buttons (Below Table) */}
          <View style={styles.actions}>
            <Button title="Fold" onPress={handleFold} />
            <Button title="Check" onPress={handleCheck} />
            <Button title="Call $50" onPress={handleCall} />
            <Button title="Raise" onPress={handleRaise} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',  // Match table background
  },
  safeArea: {
    flex: 1,
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pokerTable: {
    width: '100%',
    maxWidth: 600,
    aspectRatio: 1024 / 1536,  // Portrait ratio
    alignSelf: 'center',
  },
  playerSeat: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
  },
  communityCards: {
    position: 'absolute',
    top: '42%',
    left: '50%',
    transform: [{ translateX: -125 }],
    flexDirection: 'row',
    gap: 6,
  },
  pot: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  potText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
});
```

---

## Key Features

✅ **Portrait orientation** - Perfect for mobile screens  
✅ **8 player positions** - Clearly marked with card spaces  
✅ **Community card area** - 5 spaces in center  
✅ **Realistic layout** - Authentic casino poker table design  
✅ **Pre-marked positions** - Card spaces show where to place elements  
✅ **Green felt + gray rail** - Professional casino aesthetic  

---

## Styling Tips

### 1. Portrait Aspect Ratio
```typescript
pokerTable: {
  aspectRatio: 1024 / 1536,  // 0.667 (portrait)
  maxWidth: 600,              // Narrower than landscape tables
}
```

### 2. Player Card Sizing
```typescript
playerCard: {
  width: 70,
  height: 90,
  backgroundColor: 'rgba(255,255,255,0.9)',
  borderRadius: 8,
  padding: 8,
}
```

### 3. Community Card Sizing
```typescript
communityCard: {
  width: 50,
  height: 75,
  marginHorizontal: 3,
}
```

### 4. Black Background Handling
```typescript
// Option A: Match black
container: {
  backgroundColor: '#000',
}

// Option B: Use park background
<ImageBackground source={parkBg}>
  <ImageBackground source={table}>
    {/* content */}
  </ImageBackground>
</ImageBackground>
```

---

## Table Specifications

**File:** `assets/poker/table.png`  
**Size:** 1.2MB  
**Dimensions:** 1024×1536 pixels  
**Aspect Ratio:** 0.667 (portrait)  
**Orientation:** Vertical (portrait)  
**Format:** PNG  
**Players:** 8 positions marked  
**Card Spaces:** 2 per player + 5 community  
**Background:** Black (match with container style)  

---

## Testing Checklist

- [ ] Table displays in portrait orientation
- [ ] All 8 player positions visible
- [ ] Community cards positioned correctly in center
- [ ] Pot display visible and readable
- [ ] Action buttons accessible below table
- [ ] Table scales properly on different screen sizes
- [ ] Black background handled (matched or overlaid)
- [ ] Player cards align with marked spaces on table

---

## Summary

Portrait poker table created from your uploaded image:
- ✅ Rotated 90° to portrait orientation (1024×1536)
- ✅ 8 player positions clearly marked
- ✅ Community card spaces in center
- ✅ Professional casino aesthetic
- ✅ Ready for React Native ImageBackground integration

**Background:** Black (match with `backgroundColor: '#000'` or use park background like other games)

**Integration:** Use `aspectRatio: 1024/1536` to maintain portrait proportions!

---

**Ready to integrate into your poker screen!** 🃏🛰️
