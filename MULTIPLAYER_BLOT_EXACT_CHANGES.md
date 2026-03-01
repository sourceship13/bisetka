# MultiplayerBlotScreen.tsx - Exact Code Changes

Copy these EXACT code blocks to transform the multiplayer UI to match the single-player version.

---

## STEP 1: Add constants at top of component (after useState declarations)

**INSERT after line ~82 (after all useState declarations):**

```typescript
// Add SUIT constants for table UI
const SUIT_ICON: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};
const SUIT_NAME: Record<string, string> = {
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
  spades: 'Spades',
};
const SUIT_COLOR: Record<string, string> = {
  hearts: '#e74c3c',
  diamonds: '#e74c3c',
  clubs: '#ecf0f1',
  spades: '#ecf0f1',
};
```

---

## STEP 2: Update `renderLocalGame()` function

**FIND lines ~734-778, the ENTIRE renderLocalGame function.**

**REPLACE the ENTIRE function with:**

```typescript
const renderLocalGame = () => {
  if (!localGameState) return null;

  const { width, height } = Dimensions.get('window');
  const TABLE_SIZE = Math.min(width - 32, height * 0.5);

  return (
    <View style={styles.gameContainer}>
      <View style={styles.scoreBoard}>
        <View style={styles.teamScore}>
          <Text style={styles.teamLabel}>You</Text>
          <Text style={styles.score}>{localGameState.playerScore}</Text>
        </View>
        {localGameState.trumpSuit && (
          <View style={styles.trumpDisplay}>
            <Text style={styles.trumpLabel}>Trump</Text>
            <Text style={styles.trumpSuit}>
              {localGameState.trumpSuit === 'hearts' ? '♥' :
               localGameState.trumpSuit === 'diamonds' ? '♦' :
               localGameState.trumpSuit === 'clubs' ? '♣' : '♠'}
            </Text>
          </View>
        )}
        <View style={styles.teamScore}>
          <Text style={styles.teamLabel}>Computer</Text>
          <Text style={styles.score}>{localGameState.computerScore}</Text>
        </View>
      </View>

      <View style={styles.playArea}>
        <Text style={styles.currentPlayerText}>
          {localGameState.currentTurn === 'player' ? "★ Your Turn" : "Computer's Turn"}
        </Text>

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
            {localGameState.currentTrick.length > 0 && (
              <View style={styles.trickArea}>
                {localGameState.currentTrick.map((card, idx) => {
                  const isBottom = idx === localGameState.currentTrick.length - 1;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.trickSlot,
                        isBottom ? styles.trickSlotBottom : styles.trickSlotTop,
                      ]}
                    >
                      <Text style={styles.trickPlayerName}>
                        {isBottom ? 'You' : 'Computer'}
                      </Text>
                      <TouchableOpacity style={styles.card}>
                        <Text style={[styles.cardRank, { color: card.suit === 'hearts' || card.suit === 'diamonds' ? '#ff0000' : '#000000' }]}>
                          {card.rank}
                        </Text>
                        <Text style={styles.cardSuit}>
                          {card.suit === 'hearts' ? '♥️' :
                           card.suit === 'diamonds' ? '♦️' :
                           card.suit === 'clubs' ? '♣️' : '♠️'}
                        </Text>
                        <Text style={styles.cardValue}>{card.value}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </ImageBackground>
        </View>
      </View>

      <View style={styles.handContainer}>
        <Text style={styles.handLabel}>Your Hand:</Text>
        <CardHandFan
          cards={localGameState.playerHand}
          maxWidth={width - 32}
          renderCard={(card, index) => renderCard(card, index)}
        />
      </View>

      <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
        <Text style={styles.resignButtonText}>Quit Game</Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

## STEP 3: Update `renderGame()` function

**FIND lines ~780-872, the entire renderGame function inside the multiplayer game section.**

**REPLACE the game-started section (after the waiting screen) with:**

```typescript
const renderGame = () => {
  const playerHand = playerColor === 'white' 
    ? gameState?.player1Hand || [] 
    : gameState?.player2Hand || [];

  const { width, height } = Dimensions.get('window');
  const TABLE_SIZE = Math.min(width - 32, height * 0.5);

  return (
    <View style={styles.gameContainer}>
      {!isGameStarted ? (
        // Show waiting/ready screen (keep existing code)
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingTitle}>Match Found!</Text>
          <Text style={styles.waitingText}>
            Playing as: {playerColor === 'white' ? '⚪ White' : '⚫ Black'}
          </Text>
          <Text style={styles.waitingSubtext}>
            {opponent ? 'Opponent found!' : 'Waiting for opponent...'}
          </Text>
          <TouchableOpacity
            style={[styles.readyButton, isReadySent && { opacity: 0.6 }]}
            onPress={handlePlayerReady}
            disabled={isReadySent}
          >
            <Text style={styles.readyButtonText}>
              {isReadySent ? 'Waiting for opponent...' : 'Ready to Play'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cancelButton, { marginTop: 20 }]} onPress={() => {
            if (currentRoom?.roomId) {
              socketService.resign(currentRoom.roomId, userId);
            }
            navigation.goBack();
          }}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Show actual game
        <>
          <View style={styles.scoreBoard}>
            <View style={styles.teamScore}>
              <Text style={styles.teamLabel}>You</Text>
              <Text style={styles.score}>
                {playerColor === 'white' ? gameState?.player1Score || 0 : gameState?.player2Score || 0}
              </Text>
            </View>
            
            {gameState?.trumpSuit && (
              <View style={styles.trumpDisplay}>
                <Text style={styles.trumpLabel}>Trump</Text>
                <Text style={styles.trumpSuit}>
                  {gameState.trumpSuit === 'hearts' ? '♥' :
                   gameState.trumpSuit === 'diamonds' ? '♦' :
                   gameState.trumpSuit === 'clubs' ? '♣' : '♠'}
                </Text>
              </View>
            )}

            <View style={styles.teamScore}>
              <Text style={styles.teamLabel}>Opponent</Text>
              <Text style={styles.score}>
                {playerColor === 'white' ? gameState?.player2Score || 0 : gameState?.player1Score || 0}
              </Text>
            </View>
          </View>

          <View style={styles.playArea}>
            <Text style={styles.currentPlayerText}>
              {isMyTurn ? "★ Your Turn" : "Opponent's Turn"}
            </Text>

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
                {gameState?.currentTrick && gameState.currentTrick.length > 0 && (
                  <View style={styles.trickArea}>
                    {gameState.currentTrick.map((card, index) => (
                      <View
                        key={index}
                        style={[
                          styles.trickSlot,
                          index % 2 === 0 ? styles.trickSlotBottom : styles.trickSlotTop,
                        ]}
                      >
                        <TouchableOpacity style={styles.card}>
                          <Text style={[styles.cardRank, { color: card.suit === 'hearts' || card.suit === 'diamonds' ? '#ff0000' : '#000000' }]}>
                            {card.rank}
                          </Text>
                          <Text style={styles.cardSuit}>
                            {card.suit === 'hearts' ? '♥️' :
                             card.suit === 'diamonds' ? '♦️' :
                             card.suit === 'clubs' ? '♣️' : '♠️'}
                          </Text>
                          <Text style={styles.cardValue}>{card.value}</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </ImageBackground>
            </View>
          </View>

          <View style={styles.handContainer}>
            <Text style={styles.handLabel}>Your Hand:</Text>
            <CardHandFan
              cards={playerHand}
              maxWidth={width - 32}
              renderCard={(card, index) => renderCard(card, index)}
            />
          </View>

          <TouchableOpacity style={styles.resignButton} onPress={handleResign}>
            <Text style={styles.resignButtonText}>Resign</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};
```

---

## STEP 4: Update StyleSheet

**FIND the styles object (starts around line 974).**

**REMOVE these style entries:**
- `currentTrickContainer`
- `sectionTitle`
- `trickCards`
- `handCards`
- `gameScrollContent`

**UPDATE these existing styles:**

```typescript
// REPLACE handContainer with:
handContainer: {
  flex: 1,
  backgroundColor: 'transparent',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 16,
  paddingBottom: 16,
},

// REPLACE gameContainer with:
gameContainer: {
  flex: 1,
},

// UPDATE scoreBoard - replace the header style with:
scoreBoard: {
  flexDirection: 'row',
  justifyContent: 'space-around',
  alignItems: 'center',
  paddingVertical: 10,
  backgroundColor: 'transparent',
},
```

**ADD these NEW styles (after resignButton):**

```typescript
handLabel: {
  fontSize: 16,
  color: '#fff',
  fontWeight: '600',
  marginBottom: 12,
  textAlign: 'center',
},
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
currentPlayerText: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#FFD700',
  textAlign: 'center',
  marginBottom: 16,
  textShadowColor: 'rgba(0,0,0,0.8)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
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
  fontWeight: '600',
},
teamScore: {
  alignItems: 'center',
},
teamLabel: {
  fontSize: 14,
  color: '#fff',
  fontWeight: '600',
  marginBottom: 4,
},
trumpDisplay: {
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(26, 92, 63, 0.9)',
  padding: 12,
  borderRadius: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 4,
  maxWidth: 70,
  maxHeight: 98,
},
trumpLabel: {
  fontSize: 12,
  color: '#fff',
  marginBottom: 4,
},
```

---

## Summary

These changes will:
1. ✅ Add wooden table UI with card-table.png
2. ✅ Position cards at top/bottom of table
3. ✅ Add CardHandFan for realistic card hand
4. ✅ Match single-player styling exactly
5. ✅ Remove scrolling

After applying, the multiplayer UI will match the beautiful single-player screen!
