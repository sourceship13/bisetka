# Translation Migration Guide

## Overview

The app now has a complete i18n system with English and Russian translations. All screens need to be updated to use this system instead of hardcoded strings.

## Setup (Already Done)

✅ Translation files created:
- `src/i18n/translations/en.json` - English translations
- `src/i18n/translations/ru.json` - Russian translations

✅ i18n system created:
- `src/i18n/index.ts` - Core i18n manager
- `src/hooks/useI18n.ts` - React hook for translations
- `src/contexts/I18nContext.tsx` - Provider context
- `src/App.tsx` - Updated to wrap app with I18nProvider

✅ Device language detection working:
- Automatically detects device language
- Falls back to English if device language not supported
- User can change language anytime

## How to Use

### In a Component

```tsx
import { useI18n } from '../../../hooks/useI18n';

const MyScreen = () => {
  const { t, tp, language, setLanguage } = useI18n();

  return (
    <View>
      {/* Simple translation */}
      <Text>{t('home.title')}</Text>

      {/* With parameters */}
      <Text>{tp('achievements.earnedPoints', { points: 100 })}</Text>

      {/* Get current language */}
      <Text>Current: {language}</Text>

      {/* Change language */}
      <TouchableOpacity onPress={() => setLanguage('ru')}>
        <Text>Switch to Russian</Text>
      </TouchableOpacity>
    </View>
  );
};
```

## Step-by-Step Migration

### 1. Add Hook to Component

At the top of your screen component:

```tsx
const { t, tp } = useI18n();
```

### 2. Find All Hardcoded Strings

Look for:
- Text components: `<Text>Login</Text>`
- String literals: `name: 'Blot'`
- Descriptions: `description: 'Classic card game'`
- Placeholders: `placeholder: 'Enter username'`
- Buttons: `title: 'Play Now'`

### 3. Add to Translation Files

If a string isn't already in `en.json` and `ru.json`, add it:

```json
// en.json
{
  "mySection": {
    "myKey": "My English Text"
  }
}

// ru.json
{
  "mySection": {
    "myKey": "Мой русский текст"
  }
}
```

### 4. Replace in Component

Before:
```tsx
<Text>Login</Text>
<Text>Welcome back!</Text>
```

After:
```tsx
<Text>{t('auth.login')}</Text>
<Text>{t('home.welcome')}</Text>
```

## Common Patterns

### Game Names & Descriptions (Games Array)

Instead of:
```tsx
const GAMES = [
  {
    id: 'blot',
    name: 'Blot',
    description: 'Classic card game',
    // ...
  },
];
```

Do:
```tsx
const getGames = (t: typeof useI18n['t']) => [
  {
    id: 'blot',
    name: t('games.blot.name'),
    description: t('games.blot.description'),
    // ...
  },
];

// In component:
const { t } = useI18n();
const GAMES = useMemo(() => getGames(t), [t]);
```

### Alert/Modal Messages

Before:
```tsx
BisetkaAlert.alert('Error', 'Something went wrong');
```

After:
```tsx
const { t } = useI18n();
BisetkaAlert.alert(t('common.error'), t('errors.somethingWentWrong'));
```

### Conditional Text with Parameters

Before:
```tsx
<Text>You earned 100 points</Text>
```

After:
```tsx
<Text>{tp('achievements.earnedPoints', { points: points })}</Text>
```

## Translation Keys Structure

```
common.       - Shared across app (OK, Cancel, Loading, etc)
home.         - Home screen specific
games.        - Game-related (names, descriptions, UI)
chat.         - Chat screens
profile.      - Profile screens
achievements. - Achievements
store.        - Store/Shop
leaderboard.  - Leaderboard
settings.     - Settings
onboarding.   - Onboarding/Auth
auth.         - Authentication
errors.       - Error messages
```

## Adding New Languages

1. Create `src/i18n/translations/[lang].json`
2. Add full translation structure
3. Add language code to `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`

```tsx
const SUPPORTED_LANGUAGES: Language[] = ['en', 'ru', 'hy']; // Armenian
```

## Screens to Update (Priority Order)

### Critical (User-facing, high traffic):
- [x] App.tsx (already updated)
- [ ] HomeScreen
- [ ] GameSelectionScreen
- [ ] LoginScreen
- [ ] ProfileScreen
- [ ] SettingsScreen
- [ ] ChatRoomsListScreen / DMListScreen

### High (Gameplay):
- [ ] All Game Screens (BlotScreen, ChessScreen, etc)
- [ ] GameModeScreen
- [ ] GameInfoScreen
- [ ] SessionStatusScreen

### Medium (Features):
- [ ] OnboardingScreen
- [ ] AvatarSelectionScreen
- [ ] AvatarBuilderScreen
- [ ] WardrobeScreen
- [ ] StoreScreen
- [ ] AchievementsScreen
- [ ] LeaderboardScreen

### Low (Utility):
- [ ] ClothingStoreScreen
- [ ] PointsShopScreen
- [ ] ActiveRoomsScreen
- [ ] TravelScreen

## Testing Language Switch

1. Run the app
2. Go to SettingsScreen (you'll add language selector here)
3. Switch language
4. Verify all text updates immediately
5. Close and reopen app - language should persist

## Notes

- Use `t()` for simple strings
- Use `tp()` when you need to interpolate variables
- Translation keys are camelCase.separated.by.dots
- Always add new strings to BOTH en.json and ru.json
- Device language is auto-detected on first app open
- User preference is saved in AsyncStorage
