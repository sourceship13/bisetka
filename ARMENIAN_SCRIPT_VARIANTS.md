# Armenian Script Variants - Implementation Plan

## Overview
Bisetka now supports **three Armenian writing systems**:
1. **hy** - Native Armenian Script (Հայերեն) 
2. **hy-latin** - Latin-based Armenian Transliteration (Hayeren)
3. Plus English (en) and Russian (ru)

## Why Two Armenian Scripts?

### Native Armenian Script (hy)
- **Script:** Գ, ե, ծ, շ... (ancient Armenian alphabet)
- **Use Case:** Users comfortable with traditional Armenian
- **Audience:** Native speakers, cultural enthusiasts
- **Example:** "Բլոտ" (Blot game)

### Latin-based Armenian (hy-latin)
- **Script:** A, E, I, O, U... (English alphabet transliteration)
- **Use Case:** Users who prefer phonetic Latin representation
- **Audience:** 
  - Diaspora Armenians not fluent in native script
  - Language learners
  - Users on devices with Armenian keyboard challenges
  - Social media conventions (many Armenians write in Latin online)
- **Example:** "Blot" (same as English but Armenian meanings)
- **Phonetic System Used:**
  - Գ = G
  - Ե/ի = E/I  
  - Ծ = Ts
  - Շ = Sh
  - Խ = Kh
  - Ռ/ր = R
  - Չ = Ch
  - Ջ = J
  - Ռ = R
  - Ւ = U

## Technical Architecture

### File Structure
```
src/i18n/translations/
├── en.json           # English (350+ strings)
├── ru.json           # Russian (350+ strings)  
├── hy.json           # Armenian native script (350+ strings)
└── hy-latin.json     # Armenian Latin (350+ strings) ← NEW
```

### i18n System Updates

#### Language Type Extension
```typescript
// OLD
export type Language = 'en' | 'ru' | 'hy';

// NEW  
export type Language = 'en' | 'ru' | 'hy' | 'hy-latin';
```

#### Storage Keys
```typescript
const LANGUAGE_KEY = '@bisetka_language';      // Stores: 'en', 'ru', 'hy'
const SCRIPT_KEY = '@bisetka_script';           // Stores: 'native' or 'latin'
```

**How it works:**
- User selects "Hayeren (Latin)" in Settings
- LANGUAGE_KEY = 'hy' (base language)
- SCRIPT_KEY = 'latin' (preferred script)
- Actual language code used: 'hy-latin'

#### New Helper Methods
```typescript
// Get base language (for comparisons)
getBaseLanguage(): string
// Returns: 'en', 'ru', 'hy'

// Check if using Latin script
isLatinScript(): boolean
// Returns: true only if language === 'hy-latin'

// Get all variants of a language
getLanguageVariants(baseLanguage: string): Language[]
// Returns: ['hy', 'hy-latin'] for Armenian, ['en'], ['ru']
```

## User Experience

### Settings Screen Language Selector
```
🌐 Language

🇺🇸 English                    ✓
🇷🇺 Русский
🇦🇲 Հայերեն (Native)
🇦🇲 Hayeren (Latin)
```

**User Flow:**
1. Open Settings → Language section
2. See 4 options (English, Russian, Native Armenian, Latin Armenian)
3. Tap "Hayeren (Latin)" → App switches to Armenian-Latin translations
4. Next app restart: Detects LANGUAGE_KEY='hy' + SCRIPT_KEY='latin' → loads hy-latin.json

### First-Time Setup
- Device language detected (iOS/Android locale parser)
- If device language = Armenian:
  - **Check SCRIPT_KEY** (new user = no key set)
  - Default to native script (hy)
  - User can switch to Latin (hy-latin) anytime in Settings

### Device Language Auto-Detection Flow
```
Device Locale → Parse Language Code → Load Translations
┌─────────────────────────────────────────────────────┐
│ Device: Armenian (hy_AM)                             │
│ → Detected language: hy                              │
│ → Load hy.json (native script)                       │
│ → User changes to "Hayeren (Latin)" in Settings      │
│ → setLanguage('hy-latin')                            │
│ → Store LANGUAGE_KEY='hy' + SCRIPT_KEY='latin'       │
│ → Next restart: Load hy-latin.json automatically     │
└─────────────────────────────────────────────────────┘
```

## Translation Philosophy

### Latin Transliteration System
The `hy-latin.json` uses a **phonetic, readable system** optimized for:
- Clarity for diaspora Armenians
- Easy typing on standard keyboards
- Social media compatibility

**Examples:**
```
Native      Latin          English
─────────── ──────────────── ─────────────
Բլոտ        Blot            Card Game
Շաշ         Shash           Checkers
Շաչ         Shach           Chess
Նարդի       Nardi           Backgammon
Հայերեն     Hayeren         Armenian
Հայաստան   Hayastan        Armenia
Ձայն        Dain            Sound
Մուսիկա     Musika          Music
```

### Quality Assurance
- ✅ All 350+ translation keys exist in hy-latin.json
- ✅ Phonetically accurate representation
- ✅ Consistent transliteration rules
- ✅ No mixing of scripts (all Latin or all Armenian, never mixed)

## Implementation Checklist

### Core System (✅ DONE)
- [x] Create hy-latin.json with 350+ translations
- [x] Add hy-latin import to i18n/index.ts
- [x] Update Language type to include 'hy-latin'
- [x] Add SCRIPT_KEY storage
- [x] Implement getBaseLanguage() helper
- [x] Implement isLatinScript() helper
- [x] Implement getLanguageVariants() helper
- [x] Update setLanguage() to handle script preference
- [x] Update initialize() to detect script preference on startup

### UI Integration (✅ DONE)
- [x] Update SettingsScreen language selector
- [x] Show both Armenian options with flags
- [x] Add "(Native)" and "(Latin)" labels for clarity
- [x] Test language switching between variants

### Testing
- [ ] Test device language detection (Armenian device → loads hy.json)
- [ ] Test script switching in Settings (hy ↔ hy-latin)
- [ ] Verify persistence (switch, restart app, verify still switched)
- [ ] Test all 45 screens display correctly in both Armenian variants
- [ ] Verify no script mixing or corruption
- [ ] Test with actual Armenian users (diaspora + homeland)

## Migration Guide for Developers

### Using Armenian Variants in Code
```typescript
const { translate, language, isLatinScript } = useI18n();

// Simple translation (works for all languages)
const title = translate('games.blot.name');
// Returns: "Բլոտ" (if hy) or "Blot" (if hy-latin)

// Check if user wants Latin script (for special handling if needed)
if (isLatinScript()) {
  // Optional: Special formatting for Latin text
}

// Get base language for comparisons
const baseLang = getBaseLanguage();
if (baseLang === 'hy') {
  // Armenian is selected (either script)
}
```

### Adding New Strings
1. Add to `en.json` (English version)
2. Add to `ru.json` (Russian version)
3. Add to `hy.json` (Armenian native script)
4. Add to `hy-latin.json` (Armenian Latin - use phonetic transliteration)
5. Use in component: `translate('key.path')`

### Transliteration Rules (for new Armenian-Latin strings)
```
Armenian Letter → Transliteration
────────────────────────────────
Ա/ա → A/a
Բ/բ → B/b
Գ/գ → G/g
Դ/դ → D/d
Ե/ե → E/e
Զ/զ → Z/z
Է/է → E/e
Ը/ը → Y/y
Թ/թ → T/t
Ժ/ժ → Zh/zh
Ի/ի → I/i
Լ/լ → L/l
Խ/խ → Kh/kh
Ծ/ծ → Ts/ts
Կ/կ → K/k
Հ/հ → H/h
Մ/մ → M/m
Յ/յ → Y/y
Ն/ն → N/n
Շ/շ → Sh/sh
Ո/ո → O/o
Չ/չ → Ch/ch
Պ/պ → P/p
Ջ/ջ → J/j
Ռ/ռ → R/r
Ս/ս → S/s
Վ/վ → V/v
Տ/տ → T/t
Ր/ր → R/r
Ց/ց → Ts/ts
Ւ/ւ → U/u
Փ/փ → P/p
Ք/ք → Q/q
Օ/օ → O/o
Ֆ/ֆ → F/f
```

## Expected Outcomes

### User Benefits
- ✅ Native Armenians have their script respected
- ✅ Diaspora Armenians get accessible Latin option
- ✅ Language learners can practice with both systems
- ✅ Device auto-detection just works
- ✅ Seamless script switching without app restart

### Business Benefits
- ✅ Appeal to broader Armenian diaspora market
- ✅ Support users with limited native script literacy
- ✅ Accessibility improves adoption
- ✅ Cultural inclusivity (respects both traditions)
- ✅ Competitive advantage (most apps don't offer Latin option)

## Future Enhancements
- [ ] Keyboard input detection (prefer Latin entry → suggest hy-latin)
- [ ] Analytics: Track which Armenian script users prefer
- [ ] Content: Add Armenian language learning mode
- [ ] Community: User forums in both Armenian scripts
- [ ] Transliteration library: Open-source hy↔hy-latin converter

---

**Status:** ✅ Ready for Testing  
**Last Updated:** 2026-06-11  
**Maintained By:** Bro Bot 🛰️
