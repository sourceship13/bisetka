# Bisetka Database Schema - Language Preferences

## Overview
Language preference storage for internationalization (i18n) system. Stores user's selected language and script variant.

## RDS Database Setup

### Table: `user_language_preferences`

```sql
CREATE TABLE user_language_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  script VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Key
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Index for fast lookups
  INDEX idx_user_id (user_id),
  INDEX idx_language (language)
);
```

### Alternative: Add to Existing `users` Table

If your `users` table structure allows it, you can add these columns directly:

```sql
ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'en';
ALTER TABLE users ADD COLUMN language_script VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN language_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_user_language ON users(language);
```

---

## Data Model

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `user_id` | UUID | Yes | Foreign key to users table |
| `language` | VARCHAR(10) | Yes | Language code: 'en', 'ru', 'hy', 'hy-latin' |
| `script` | VARCHAR(20) | No | For Armenian: 'native', 'latin' (hy-latin is stored as language='hy', script='latin') |
| `created_at` | TIMESTAMP | Auto | When preference was first set |
| `updated_at` | TIMESTAMP | Auto | When preference was last updated |

### Valid Language Values
- `'en'` - English
- `'ru'` - Russian  
- `'hy'` - Armenian (native script, when script = 'native')
- `'hy'` - Armenian (Latin script, when script = 'latin')
- `'hy-latin'` - Combined code (stored as language='hy', script='latin')

---

## API Endpoints

### Update Language Preference

**Endpoint:** `POST /api/auth/update-language`

**Request Body:**
```json
{
  "language": "en|ru|hy|hy-latin",
  "script": "native|latin" // optional, only for Armenian
}
```

**Response:**
```json
{
  "message": "Language preference updated",
  "user": {
    "id": "...",
    "language": "en",
    "language_script": null,
    "updated_at": "2026-06-11T23:30:00Z"
  }
}
```

**Example Requests:**
```bash
# Switch to English
curl -X POST http://localhost:3000/api/auth/update-language \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"language": "en"}'

# Switch to Armenian (native script)
curl -X POST http://localhost:3000/api/auth/update-language \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"language": "hy", "script": "native"}'

# Switch to Armenian (Latin script)
curl -X POST http://localhost:3000/api/auth/update-language \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"language": "hy", "script": "latin"}'
```

### Get User's Language Preference

**Endpoint:** `GET /api/auth/language`

**Response:**
```json
{
  "language": "en",
  "script": null
}
```

---

## Backend Implementation (Node.js/Express)

### Controller: `auth.controller.ts`

```typescript
// Update user's language preference
export async function updateLanguage(req: Request, res: Response) {
  try {
    const userId = req.user.id; // From auth middleware
    const { language, script } = req.body;

    // Validate language
    const validLanguages = ['en', 'ru', 'hy'];
    if (!validLanguages.includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    // Validate script (only for Armenian)
    if (language === 'hy' && script && !['native', 'latin'].includes(script)) {
      return res.status(400).json({ error: 'Invalid script variant' });
    }

    // Update in database
    const result = await db.query(
      `UPDATE user_language_preferences 
       SET language = $1, script = $2, updated_at = NOW()
       WHERE user_id = $3
       ON CONFLICT (user_id) DO UPDATE
       SET language = EXCLUDED.language, script = EXCLUDED.script, updated_at = NOW()
       RETURNING *`,
      [language, script || null, userId]
    );

    res.json({
      message: 'Language preference updated',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating language:', error);
    res.status(500).json({ error: 'Failed to update language' });
  }
}
```

### Route: `routes/auth.ts`

```typescript
router.post('/update-language', authMiddleware, authController.updateLanguage);
```

---

## Frontend Integration

### api.service.ts

```typescript
async updateLanguage(language: string, script?: string): Promise<{ message: string; user: User }> {
  return this.request<{ message: string; user: User }>(
    '/auth/update-language',
    {
      method: 'POST',
      body: JSON.stringify({ language, script }),
    },
    true // requireAuth
  );
}
```

### OnboardingScreen.tsx

```typescript
const handleLanguageSelect = async (langCode: string) => {
  setSelectedLanguage(langCode);
  
  // Update locally
  await setLanguage(langCode as any);
  
  // Save to database (non-blocking)
  if (user?.id) {
    try {
      const [language, script] = langCode === 'hy-latin' 
        ? ['hy', 'latin'] 
        : [langCode, undefined];
      
      await apiService.updateLanguage(language, script);
      console.log('✓ Language preference saved to database');
    } catch (error) {
      console.warn('Failed to save language to database (local copy persists):', error);
    }
  }
};
```

---

## Migration Steps

1. **Create Table** (PostgreSQL)
   ```sql
   CREATE TABLE user_language_preferences (...)
   ```
   OR add columns to existing `users` table

2. **Add Backend Endpoint**
   - Create controller method: `updateLanguage()`
   - Register route: `POST /api/auth/update-language`

3. **Update Frontend API Service**
   - Add `updateLanguage()` method to `ApiService` class

4. **Update Onboarding**
   - Call `apiService.updateLanguage()` after `setLanguage()`
   - Handle errors gracefully (local AsyncStorage persists)

5. **Deploy**
   - Migrations run on server startup
   - Endpoint live
   - Frontend code live

---

## Data Flow

```
User selects language in Onboarding
    ↓
handleLanguageSelect('en') called
    ↓
setLanguage('en') → Stores in AsyncStorage
    ↓
apiService.updateLanguage('en') → POST to backend
    ↓
Backend validates & inserts into user_language_preferences
    ↓
Returns updated user object
    ↓
App uses language immediately (no reload needed)
```

---

## Benefits

✅ **Persistence** - Language choice survives app uninstall  
✅ **Cross-Device** - User gets their language on new phone  
✅ **Analytics** - Track language preferences by user/region  
✅ **Server Features** - Send notifications in user's language  
✅ **Fallback** - Local AsyncStorage used if API fails  
✅ **Privacy** - Language stored with other user data, no separate tracking  

---

## Testing

### Manual Test Flow
1. Create new account or sign in existing
2. Go through Onboarding
3. Select language (e.g., "Hayeren (Latin)")
4. Check RDS: Should see row in `user_language_preferences` with language='hy', script='latin'
5. Close & reopen app
6. Verify: App loads in Armenian Latin
7. Change language in Settings
8. Verify: RDS updated + app respects change

### API Test
```bash
# After auth token is obtained:
curl -X POST http://localhost:3000/api/auth/update-language \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"language": "hy", "script": "latin"}'
```

---

## Notes

- **Non-Blocking:** Language API call is `await` but doesn't block onboarding flow
- **Fallback:** If API fails, local AsyncStorage persists the choice
- **Default:** New users default to device-detected language (fallback to 'en')
- **Admin Dashboard:** Can later add filtering/analytics by language

---

**Status:** Ready for Backend Implementation  
**Created:** 2026-06-11  
**Maintained by:** Bro Bot 🛰️
