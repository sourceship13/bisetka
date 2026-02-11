# Billiards Game Rules — 8-Ball vs 9-Ball

Both variants use the same physics engine, controls, and visuals. Rules differ:

## 🎱 8-Ball Pool (Standard)

### Objective
Pocket all of your group (solids or stripes), then legally pocket the 8-ball.

### Rules
1. **Break:** First shot from behind the head string
2. **Type Assignment:** First player to legally pocket a ball claims that group (solids 1-7 or stripes 9-15)
3. **Turns:** If you pocket one of your own balls → shoot again. Miss or pocket nothing → opponent's turn
4. **Legal Shot:** Must hit one of your own balls first (after types are assigned)
5. **8-Ball:** Can only be pocketed after clearing all your balls. Pocket it early or scratch on it → you lose
6. **Scratch (Foul):**
   - Cue ball pocketed
   - Cue ball doesn't hit any ball
   - Cue ball hits opponent's ball first
   - **Penalty:** Opponent gets ball-in-hand behind the head string (dashed line)

### Win Conditions
- ✅ Clear your group, then legally pocket the 8-ball
- ❌ Pocket the 8-ball before clearing your group → lose
- ❌ Scratch while pocketing the 8-ball → lose

---

## 9️⃣ 9-Ball Pool (Fast Game)

### Objective
Pocket the 9-ball. Doesn't matter when or how — first to sink it wins.

### Rules
1. **Break:** First shot from behind the head string
2. **No Type Assignment:** All balls 1-9 are in play for both players
3. **Legal Shot:** Must hit the **lowest numbered ball on the table** first each shot
4. **Turns:** Always alternate (no shoot-again rule)
5. **9-Ball:** Pocket it at any time (even via combo or lucky bank) → instant win
6. **Scratch (Foul):**
   - Cue ball pocketed
   - Cue ball doesn't hit any ball
   - Cue ball hits a higher numbered ball first (must hit lowest first)
   - **Penalty:** Opponent gets ball-in-hand **anywhere** on the table

### Win Conditions
- ✅ Pocket the 9-ball at any time (legally)
- If 9-ball is pocketed on a foul → respotted, opponent gets ball-in-hand

---

## Shared Mechanics

### Controls
- **Aim:** Drag anywhere on the table away from the cue ball (like pulling back a cue stick)
- **Power:** Further you drag = harder the shot (power bar fills)
- **Release:** Let go to shoot

### Visual Guides
- **White dotted line:** Cue ball's path
- **Gold dotted line:** Target ball's deflection after hit
- **Blue dotted line:** Cue ball's deflection after impact
- **Ghost circle:** Shows exact contact point

### Ball-in-Hand
- **8-Ball:** Can only place cue ball behind the head string (lower third of table)
- **9-Ball:** Can place cue ball anywhere on the table

### Physics
- Realistic ball collisions, wall bounces, pocket detection
- Rolling animations while balls move
- Friction slows balls over time

---

## Implementation Notes

- Both variants share the same `BilliardsGameScreen` component
- Variant is determined by `session.gameType` ('8-ball' or '9-ball')
- Rules enforcement happens in the settlement logic when all balls stop moving
- AI opponent targets appropriate balls based on variant rules
