# ✅ Pool Table - Clean Empty for Mobile Game

## What You Got

### Completely Clean Pool Table
- ✅ **NOTHING on the table** - absolutely empty
- ✅ **Just green felt** (playing surface)
- ✅ **Wood rails** (border around table)
- ✅ **6 pockets** (4 corners + 2 sides)
- ✅ **Top-down mobile game perspective**
- ✅ **Portrait orientation** (1024×1792)

### Perfect for Mobile Games:
- Ready for you to add balls programmatically
- Clean surface to place game objects
- Top-down view for 2D gameplay
- No distractions or pre-rendered objects
- Game-ready asset

---

## What's On The Table

### NOTHING! That's the point!

**Just these elements:**
1. **Green felt surface** - clean empty playing area
2. **Dark wood rails** - border around the table
3. **6 black pockets:**
   - Top-left corner
   - Top-right corner
   - Middle-left side
   - Middle-right side
   - Bottom-left corner
   - Bottom-right corner

**NO:**
- ❌ Balls
- ❌ Cue stick
- ❌ Rack triangle
- ❌ Chalk
- ❌ Shadows of objects
- ❌ Any game objects

---

## Mobile Game Perfect

### Why This Works:

**Clean Canvas:**
- You add balls dynamically in your game code
- No pre-rendered elements to work around
- Full control over what appears on table

**Top-Down Perspective:**
- Perfect for mobile touch controls
- Drag to aim cue ball
- Tap to shoot
- Simple 2D physics

**Portrait Orientation:**
- Fits mobile screens vertically
- Standard phone gameplay
- Easy one-handed play

---

## File Specifications

**File:** `assets/pool/table.png`  
**Size:** 2.1MB  
**Dimensions:** 1024×1792 pixels (portrait)  
**Perspective:** Top-down (90° overhead)  
**Content:** Empty table only  
**Format:** PNG HD  
**Ready for:** 9-Ball, 8-Ball, any pool game  

---

## Usage in Your 9-Ball Game

```typescript
<ImageBackground
  source={require('../../../assets/pool/table.png')}
  style={styles.poolTable}
  resizeMode="contain"
>
  {/* Your game balls rendered on top */}
  {balls.map(ball => (
    <Ball
      key={ball.id}
      number={ball.number}
      x={ball.x}
      y={ball.y}
      color={ball.color}
    />
  ))}
  
  {/* Cue ball */}
  <CueBall x={cueBall.x} y={cueBall.y} />
  
  {/* Aiming line */}
  {isAiming && <AimLine angle={aimAngle} power={power} />}
</ImageBackground>

const styles = StyleSheet.create({
  poolTable: {
    width: '100%',
    maxWidth: 500,
    aspectRatio: 1024 / 1792,  // Portrait
    alignSelf: 'center',
  },
});
```

---

## Ball Positioning Example

```typescript
// Example: Position 9 balls in diamond formation
const balls = [
  { id: 1, number: 1, x: 512, y: 896, color: 'yellow' },   // Center
  { id: 2, number: 2, x: 462, y: 846, color: 'blue' },     // Top-left
  { id: 3, number: 3, x: 562, y: 846, color: 'red' },      // Top-right
  // ... etc
];

// Render on the table
{balls.map(ball => (
  <View
    key={ball.id}
    style={{
      position: 'absolute',
      left: ball.x - 20,  // Center the ball (40px diameter)
      top: ball.y - 20,
    }}
  >
    <PoolBall number={ball.number} color={ball.color} />
  </View>
))}
```

---

## Coordinate System

**Table Dimensions:** 1024×1792 pixels

**Playable Area (felt):**
- Left edge: ~80px
- Right edge: ~944px
- Top edge: ~80px
- Bottom edge: ~1712px

**Pocket Positions (approximate):**
- Top-left: (80, 80)
- Top-right: (944, 80)
- Middle-left: (80, 896)
- Middle-right: (944, 896)
- Bottom-left: (80, 1712)
- Bottom-right: (944, 1712)

---

## Benefits for Game Development

✅ **Clean slate** - Add only what you need  
✅ **No clutter** - Nothing to hide or work around  
✅ **Performance** - Single background image  
✅ **Flexibility** - Place balls anywhere programmatically  
✅ **Top-down view** - Perfect for 2D mobile gameplay  
✅ **Portrait format** - Standard mobile orientation  
✅ **Professional look** - Realistic felt and wood  

---

## What You Can Add On Top

In your game code, you'll add:
- 9 numbered balls (1-9) for 9-Ball
- 1 cue ball (white)
- Aiming line from cue ball
- Power meter
- Shot trajectory preview
- Ball shadows (optional)
- Collision effects

All of these get rendered on top of this clean empty table!

---

## Summary

**This is a clean, empty pool table asset for mobile games:**
- ✅ NOTHING on the table - completely empty
- ✅ Top-down mobile game perspective
- ✅ Portrait orientation (1024×1792)
- ✅ Just felt, rails, and pockets
- ✅ Ready for you to add balls and gameplay
- ✅ Perfect for 9-Ball, 8-Ball, any pool game

**This is exactly what you need for a mobile pool game!** 🎱🛰️
