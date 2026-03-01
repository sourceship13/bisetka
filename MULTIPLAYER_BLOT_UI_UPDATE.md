# Multiplayer Blot Screen - UI Update Guide

**Goal:** Make the multiplayer Blot UI match the beautiful single-player version with:
- ✅ Wooden card table with decorative borders
- ✅ Cards in fan layout at bottom (overlapping, rotated)
- ✅ Card table image in center with cards at edges
- ✅ "Led: Suit" indicator
- ✅ Same overall styling

## Files to Update
- `src/screens/Games/Blot/MultiplayerBlotScreen.tsx`

## Changes Needed

### 1. Add Missing Imports (already done)
```tsx
import CardHandFan from '../../../components/CardHandFan';
import Dimensions from 'react-native';
```

### 2. Update `renderLocalGame()` Function

**FIND this section (~line 759-777):**
```tsx
<View style={styles.handContainer}>
  <Text style={styles.sectionTitle}>Your Hand</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    <View style={styles.handCards}>
      {localGameState.playerHand.map((card, index) => renderCard(card, index))}
    </View>
  </ScrollView>
</View>
```

**REPLACE with:**
```tsx
<View style={styles.handContainer}>
  <Text style={styles.handLabel}>Your Hand:</Text>
  <CardHandFan
    cards={localGameState.playerHand}
    maxWidth={Dimensions.get('window').width - 32}
    renderCard={(card, index) => renderCard(card, index)}
  />
</View>
```

### 3. Update `renderGame()` Function

**FIND this section (~line 859-871):**
```tsx
<View style={styles.handContainer}>
  <Text style={styles.sectionTitle}>Your Hand</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    <View style={styles.handCards}>
      {playerHand.map((card, index) => renderCard(card, index))}
    </View>
  </ScrollView>
</View>
```

**REPLACE with:**
```tsx
<View style={styles.handContainer}>
  <Text style={styles.handLabel}>Your Hand:</Text>
  <CardHandFan
    cards={playerHand}
    maxWidth={Dimensions.get('window').width - 32}
    renderCard={(card, index) => renderCard(card, index)}
  />
</View>
```

### 4. Add Wooden Table UI (MAJOR CHANGE)

**FIND the "Current Trick" section in both `renderGame()` and `renderLocalGame()`:**
```tsx
<View style={styles.currentTrickContainer}>
  <Text style={styles.sectionTitle}>Current Trick</Text>
  <View style={styles.trickCards}>
    {gameState?.currentTrick && gameState.currentTrick.length > 0 ? (
      gameState.currentTrick.map((card, index) => renderCard(card, index))
    ) : (
      <Text style={styles.emptyText}>No cards played yet</Text>
    )}
  </View>
</View>
```

**REPLACE with (copy from BlotScreen.tsx lines 630-681):**
```tsx
<View style={styles.playArea}>
  <View
    style={[
      styles.tableContainer,
      { width: TABLE_SIZE, height: TABLE_SIZE },
    ]}
  >
    <ImageBackground
      source={require('../../../../assets/blot/card-table.png')}
      style={styles.cardTable}
      imageStyle={{ borderRadius: 16 }}
    >
      {currentTrick.cards.length > 0 && (() => {
          const ledSuit = currentTrick.cards[0].card.suit;
          const positionStyle: Record<number, object> = {
            0: styles.trickSlotBottom,
            1: styles.trickSlotRight,
            2: styles.trickSlotTop,
            3: styles.trickSlotLeft,
          };
          return (
            <View style={styles.trickArea}>
              {/* Led suit indicator in the center */}
              <View style={styles.ledSuitBadge}>
                <Text style={[styles.ledSuitIcon, { color: SUIT_COLOR[ledSuit] }]}>
                  {SUIT_ICON[ledSuit]}
                </Text>
                <Text style={styles.ledSuitLabel}>
                  Led: {SUIT_NAME[ledSuit]}
                </Text>
              </View>
              {/* Cards positioned at table edges */}
              {currentTrick.cards.map((cardPlay, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.trickSlot,
                    positionStyle[cardPlay.playerId] ?? styles.trickSlotTop,
                  ]}
                >
                  <Text style={styles.trickPlayerName}>
                    {players[cardPlay.playerId].name}
                  </Text>
                  <DynamicCard
                    card={cardPlay.card}
                    size="medium"
                    theme={customTheme}
                  />
                </View>
              ))}
            </View>
          );
        })()}
    </ImageBackground>
  </View>
</View>
```

**Note:** You'll need to adapt variable names:
- `currentTrick` might be `gameState.currentTrick` in multiplayer
- `players` might be different structure
- Add `TABLE_SIZE` constant: `const TABLE_SIZE = Math.min(width - 32, height * 0.5);`
- Define `SUIT_ICON`, `SUIT_NAME`, `SUIT_COLOR` at top of component (already exists but check)

### 5. Update StyleSheet

**REMOVE these styles:**
```tsx
handCards: {
  flexDirection: 'row',
},
gameScrollContent: {
  padding: 15,
  paddingBottom: 40,
},
```

**UPDATE handContainer:**
```tsx
handContainer: {
  flex: 1,
  backgroundColor: 'transparent',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 16,
  paddingBottom: 16,
},
```

**UPDATE sectionTitle to handLabel:**
```tsx
handLabel: {
  fontSize: 16,
  color: '#fff',
  fontWeight: '600',
  marginBottom: 12,
  textAlign: 'center',
},
```

**ADD these new styles (copy from BlotScreen.tsx lines 835-949):**
```tsx
playArea: {
  flex: 2,
  padding: 16,
  alignItems: 'center',
  justifyContent: 'center',
},
tableContainer: {
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.5,
  shadowRadius: 16,
  elevation: 12,
},
cardTable: {
  width: '100%',
  height: '100%',
  alignItems: 'center',
  justifyContent: 'center',
},
trickArea: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
},
ledSuitBadge: {
  position: 'absolute',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.55)',
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.25)',
},
ledSuitIcon: {
  fontSize: 22,
  lineHeight: 26,
},
ledSuitLabel: {
  fontSize: 11,
  color: '#ccc',
  fontWeight: '600',
  marginTop: 1,
  letterSpacing: 0.5,
},
trickSlot: {
  position: 'absolute',
  alignItems: 'center',
},
trickSlotTop: {
  top: 14,
  left: 0,
  right: 0,
  alignItems: 'center',
},
trickSlotBottom: {
  bottom: 14,
  left: 0,
  right: 0,
  alignItems: 'center',
},
trickSlotLeft: {
  left: 14,
  top: '50%',
  marginTop: -75,
},
trickSlotRight: {
  right: 14,
  top: '50%',
  marginTop: -75,
},
trickPlayerName: {
  fontSize: 12,
  color: '#fff',
  marginBottom: 6,
},
```

### 6. Wrap game rendering properly

Both `renderLocalGame()` and `renderGame()` should NOT be wrapped in `<ScrollView>`. Instead:

```tsx
const renderGame = () => {
  const playerHand = playerColor === 'white' 
    ? gameState?.player1Hand || [] 
    : gameState?.player2Hand || [];

  const { width, height } = Dimensions.get('window');
  const TABLE_SIZE = Math.min(width - 32, height * 0.5);

  return (
    <View style={styles.gameContainer}>  {/* NO ScrollView! */}
      {!isGameStarted ? (
        // waiting screen...
      ) : (
        <>
          {/* header, trump, play area with table, hand with fan */}
        </>
      )}
    </View>
  );
};
```

## Summary of Changes

1. ✅ **Remove ScrollView** for card hands
2. ✅ **Add CardHandFan** component for fan layout
3. ✅ **Add wooden table** with ImageBackground
4. ✅ **Position cards at edges** (top/bottom/left/right)
5. ✅ **Add "Led: Suit" indicator** in center
6. ✅ **Update styles** to match single-player version

## Testing

After changes:
1. Start a multiplayer game (AI or real opponent)
2. Verify cards display in fan layout (no scrolling)
3. Verify wooden table appears with cards at edges
4. Verify "Led: Hearts" (or other suit) shows in center when trick is played

---

**Estimated work:** 30-45 minutes of careful copy-paste and variable name adjustments.

**Alternative:** I can make these changes via a script, but manual is safer given file size and complexity.
