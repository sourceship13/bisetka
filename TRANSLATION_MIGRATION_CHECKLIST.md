# Translation Migration Checklist

## Status: ✅ System Setup Complete

**What's Done:**
- ✅ i18n system implemented
- ✅ English (en.json) and Russian (ru.json) translation files created
- ✅ Device language detection working
- ✅ Language switching UI in SettingsScreen
- ✅ Translation keys structured and organized
- ✅ useI18n hook created for easy component usage
- ✅ App.tsx wrapped with I18nProvider

---

## Screen Migration Status

### 🔴 Critical Priority (Must Do First)

- [ ] **HomeScreen** 
  - Strings to replace: "Available Games", "Online Now", "Play Now", etc.
  - Add translations for game names/descriptions from GAMES array
  - File: `src/screens/Meta/Home/HomeScreen.tsx`

- [ ] **LoginScreen**
  - Auth strings: "Login", "Email", "Password", "Sign in with Google", etc.
  - File: `src/screens/Meta/LoginScreen.tsx`

- [ ] **ProfileScreen**
  - Profile strings: "Level", "Total Points", "Wins", "Losses", etc.
  - File: `src/screens/Meta/Home/ProfileScreen.tsx`

- [ ] **DMListScreen & DMChatScreen**
  - Chat strings: "Messages", "No conversations yet", "Send message", etc.
  - File: `src/screens/Chat/DMListScreen.tsx` and `src/screens/Chat/DMChatScreen.tsx`

- [ ] **SettingsScreen** ✅ (ALREADY DONE)
  - All settings labels now use `t()` function
  - Language selector implemented

### 🟡 High Priority (Gameplay)

- [ ] **GameSelectionScreen**
  - Game names and descriptions
  - "Single Player", "Multiplayer" options
  - File: `src/screens/Meta/Home/GameSelectionScreen.tsx`

- [ ] **BlotScreen**
  - Game UI: "Your Turn", "Opponent's Turn", "Draw", "You Won", etc.
  - File: `src/screens/Games/Blot/BlotScreen.tsx`

- [ ] **ChessScreen**
  - Chess game UI
  - File: `src/screens/Games/Chess/ChessScreen.tsx`

- [ ] **CheckersScreen**
  - Checkers game UI
  - File: `src/screens/Games/Checkers/CheckersScreen.tsx`

- [ ] **NardiScreen**
  - Nardi/Backgammon game UI
  - File: `src/screens/Games/Nardi/NardiScreen.tsx`

- [ ] **MultiplayerBlotScreen**
  - Multiplayer UI strings
  - File: `src/screens/Games/Blot/MultiplayerBlotScreen.tsx`

- [ ] **MultiplayerChessScreen**
  - Multiplayer UI strings
  - File: `src/screens/Games/Chess/MultiplayerChessScreen.tsx`

- [ ] **MultiplayerCheckersScreen**
  - Multiplayer UI strings
  - File: `src/screens/Games/Checkers/MultiplayerCheckersScreen.tsx`

- [ ] **SessionStatusScreen**
  - Session info UI: "Share Code", "Session ID", "Created", etc.
  - File: `src/screens/Meta/SessionStatusScreen.tsx`

- [ ] **GameModeScreen**
  - "Easy", "Medium", "Hard" difficulty options
  - File: `src/screens/Meta/Game/GameModeScreen.tsx`

- [ ] **GameInfoScreen**
  - Game description and rules
  - File: `src/screens/Meta/Game/GameInfoScreen.tsx`

### 🟠 Medium Priority (Features)

- [ ] **OnboardingScreen**
  - Onboarding flow text
  - File: `src/screens/Meta/Onboarding/OnboardingScreen.tsx`

- [ ] **AvatarSelectionScreen**
  - Avatar selection UI
  - File: `src/screens/Meta/Onboarding/AvatarSelectionScreen.tsx`

- [ ] **UsernameSelectionScreen**
  - Username input labels
  - File: `src/screens/Meta/Onboarding/UsernameSelectionScreen.tsx`

- [ ] **AvatarBuilderScreen**
  - Avatar customization labels
  - File: `src/screens/Meta/Home/AvatarBuilderScreen.tsx`

- [ ] **WardrobeScreen**
  - Wardrobe selection UI
  - File: `src/screens/Meta/Home/WardrobeScreen.tsx`

- [ ] **StoreScreen**
  - Store UI: "Purchase", "Not Enough Points", "Sold"
  - File: `src/screens/Meta/Home/StoreScreen.tsx`

- [ ] **PointsShopScreen**
  - Points shop UI
  - File: `src/screens/Meta/PointsShop/PointsShopScreen.tsx`

- [ ] **AchievementsScreen**
  - Achievements UI: "Locked", "Unlocked", date/points display
  - File: `src/screens/Meta/Achievements/AchievementsScreen.tsx`

- [ ] **LeaderboardScreen**
  - Leaderboard UI: "Rank", "Player", "Score", "Global", "Weekly"
  - File: `src/screens/Meta/Home/LeaderboardScreen.tsx`

- [ ] **ChatRoomsListScreen**
  - Chat rooms UI: "Global Chat", "Join Room", "Create Room"
  - File: `src/screens/Global Chat/ChatRoomsListScreen.tsx`

- [ ] **ChatRoomScreen**
  - Room chat UI
  - File: `src/screens/Global Chat/ChatRoomScreen.tsx`

### 🔵 Lower Priority (Utility)

- [ ] **ClothingStoreScreen**
  - File: `src/screens/Meta/Home/ClothingStoreScreen.tsx`

- [ ] **PhotosphereScreen**
  - File: `src/screens/Meta/Home/PhotosphereScreen.tsx`

- [ ] **ActiveRoomsScreen**
  - File: `src/screens/Meta/Home/ActiveRoomsScreen.tsx`

- [ ] **TravelScreen**
  - File: `src/screens/Meta/Home/TravelScreen.tsx`

- [ ] **BisetkaDetailScreen**
  - File: `src/screens/Meta/BisetkaDetail/BisetkaDetailScreen.tsx`

- [ ] **GlobalViewScreen**
  - File: `src/screens/Meta/GlobalView/GlobalViewScreen.tsx`

---

## How to Migrate Each Screen

### Step 1: Add Import
```tsx
import { useI18n } from '../../../hooks/useI18n';
```

### Step 2: Get Translation Function
```tsx
const { t, tp } = useI18n();
```

### Step 3: Find All Hardcoded Strings
Look for patterns like:
```tsx
<Text>Login</Text>
<TouchableOpacity><Text>Click me</Text></TouchableOpacity>
placeholder="Enter email"
title: 'Blot',
description: 'Classic card game',
alert('Success', 'Game complete!')
```

### Step 4: Check Translation Files
- If string exists in `en.json` and `ru.json`, use the key
- If not, add it to both translation files first

### Step 5: Replace with t() or tp()
```tsx
// Before:
<Text>Login</Text>

// After:
<Text>{t('auth.login')}</Text>

// Before:
name: 'Blot'

// After (for dynamic arrays):
const getName = (t: ReturnType<typeof useI18n>['t']) => {
  return t('games.blot.name');
};
```

### Step 6: Test
1. Run the app
2. Go to Settings
3. Switch language to Russian
4. Verify all text in the screen updates
5. Close and reopen the app - language should persist

---

## Translation File Structure

### When Adding New Strings

Keep this hierarchy:
```json
{
  "section": {
    "subsection": {
      "key": "English text",
      "anotherKey": "Another text"
    }
  }
}
```

### Examples:

**English (en.json):**
```json
{
  "games": {
    "blot": {
      "name": "Blot",
      "description": "Classic card game"
    }
  }
}
```

**Russian (ru.json):**
```json
{
  "games": {
    "blot": {
      "name": "Блот",
      "description": "Классическая карточная игра"
    }
  }
}
```

**Usage in component:**
```tsx
const { t } = useI18n();
<Text>{t('games.blot.name')}</Text>
```

---

## Special Cases

### 1. Dynamic Games Array

Instead of:
```tsx
const GAMES = [
  { name: 'Blot', description: 'Classic card game' }
];
```

Do:
```tsx
const buildGames = (t: ReturnType<typeof useI18n>['t']) => [
  { name: t('games.blot.name'), description: t('games.blot.description') }
];

export const MyScreen = () => {
  const { t } = useI18n();
  const GAMES = useMemo(() => buildGames(t), [t]);
  // ...
};
```

### 2. Parameters in Strings

If translating:
```tsx
<Text>You earned 100 points</Text>
```

First add to translations:
```json
{
  "achievements": {
    "earnedPoints": "You earned {points} points"
  }
}
```

Then use:
```tsx
<Text>{tp('achievements.earnedPoints', { points: 100 })}</Text>
```

### 3. Alerts

Before:
```tsx
BisetkaAlert.alert('Error', 'Something went wrong');
```

After:
```tsx
const { t } = useI18n();
BisetkaAlert.alert(t('common.error'), t('errors.somethingWentWrong'));
```

### 4. Buttons & Actions

Before:
```tsx
<TouchableOpacity onPress={play}>
  <Text>Play Now</Text>
</TouchableOpacity>
```

After:
```tsx
const { t } = useI18n();
<TouchableOpacity onPress={play}>
  <Text>{t('home.playNow')}</Text>
</TouchableOpacity>
```

---

## Testing Checklist

For each screen you migrate:

- [ ] Add useI18n hook
- [ ] Replace all hardcoded strings with t() or tp()
- [ ] Add missing translation keys to en.json and ru.json
- [ ] Run app in English - all text visible?
- [ ] Go to Settings, switch to Russian
- [ ] Run app in Russian - all text updated?
- [ ] Kill app, reopen - language persists?
- [ ] No console errors about missing keys?

---

## Notes

- **DO**: Add translations for ALL user-visible text
- **DO**: Use meaningful key names (games.blot.name, not game1.text)
- **DO**: Keep en.json and ru.json in sync
- **DO**: Test language switching

- **DON'T**: Leave hardcoded strings in components
- **DON'T**: Mix hardcoded and translated text in same array/object
- **DON'T**: Forget to translate validation messages and alerts

---

## Next Steps

1. Start with **HomeScreen** (critical)
2. Migrate **LoginScreen** (critical)
3. Do all game screens (**BlotScreen**, **ChessScreen**, etc.)
4. Migrate remaining screens
5. Run full app testing with both languages

---

## Questions?

Refer to `TRANSLATION_MIGRATION_GUIDE.md` for detailed examples and patterns.
