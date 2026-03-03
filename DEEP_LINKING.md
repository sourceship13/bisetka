# Deep Linking Implementation for Bisetka

## Overview

Bisetka now supports deep linking using the custom URL scheme `bisetka://`. This allows you to open specific screens in the app from external sources like websites, emails, SMS, or other apps.

## URL Scheme

**Scheme**: `bisetka://`

All deep links must start with `bisetka://` followed by the path to the screen.

## Supported Deep Link Paths

### Authentication & Onboarding
- **Login**: `bisetka://login`
- **Username Selection**: `bisetka://username-selection`
- **Onboarding**: `bisetka://onboarding`

### Main Screens
- **Home**: `bisetka://home`
- **Leaderboard**: `bisetka://leaderboard`

### Games

#### Single Player Games
- **Blot**: `bisetka://blot`
- **Baazar Blot**: `bisetka://baazar-blot`
- **Nardi**: `bisetka://nardi`
- **Chess**: `bisetka://chess`
- **Checkers**: `bisetka://checkers`
- **Mrotsi**: `bisetka://mrotsi`
- **Poker**: `bisetka://poker`
- **Billiards**: `bisetka://billiards`
- **Slots**: `bisetka://slots`

#### Multiplayer Games
- **Multiplayer Blot**: `bisetka://multiplayer-blot/{userId}`
  - Optional query params: `?mode=ai&difficulty=medium&joinCode=ABC123`
  - Modes: `ai`, `menu`, `private-create`, `private-join`, `random`
  - Difficulties: `easy`, `medium`, `hard`
  - Example: `bisetka://multiplayer-blot/user123?mode=private-join&joinCode=GAME456`

- **Multiplayer Baazar Blot**: `bisetka://multiplayer-baazar-blot/{userId}`

- **Multiplayer Chess**: `bisetka://multiplayer-chess/{userId}`

- **Multiplayer Mrotsi**: `bisetka://multiplayer-mrotsi/{userId}`
  - Optional query params: `?mode=ranked&joinCode=XYZ789`
  - Example: `bisetka://multiplayer-mrotsi/user123?mode=casual&joinCode=ROOM999`

### Game Management
- **Game Mode Selection**: `bisetka://game-mode/{gameType}`
  - Example: `bisetka://game-mode/blot`
  
- **Game Info**: `bisetka://game-info/{gameType}`
  - Example: `bisetka://game-info/chess`
  
- **Session Status**: `bisetka://session-status/{gameType}`
  - Example: `bisetka://session-status/poker`

### Chat & Social
- **Global Chat**: `bisetka://global-chat`
- **DM List**: `bisetka://dm-list`
- **Direct Message Chat**: `bisetka://dm/{chatId}`
  - Example: `bisetka://dm/chat123`
  
- **Chat Rooms List**: `bisetka://chat-rooms`
- **Specific Chat Room**: `bisetka://chat-room/{roomId}`
  - Example: `bisetka://chat-room/room456`

## Platform Configuration

### Android
The deep link configuration is set in `android/app/src/main/AndroidManifest.xml`:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="bisetka" />
</intent-filter>
```

### iOS
The URL scheme is registered in `ios/bisetka/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>bisetka</string>
        </array>
        <key>CFBundleURLName</key>
        <string>com.nolimit.bisetka</string>
    </dict>
</array>
```

## Testing Deep Links

### iOS Simulator
```bash
xcrun simctl openurl booted "bisetka://home"
xcrun simctl openurl booted "bisetka://multiplayer-blot/user123?mode=ai&difficulty=hard"
```

### Android Emulator
```bash
adb shell am start -W -a android.intent.action.VIEW -d "bisetka://home"
adb shell am start -W -a android.intent.action.VIEW -d "bisetka://dm/chat123"
```

### Physical Devices
1. **Via Safari/Chrome**: Type the deep link URL in the browser address bar
2. **Via Notes/Messages**: Tap on a deep link in a message or note
3. **Via Terminal** (for connected devices):
   - iOS: `xcrun devicectl device process launch --device <device-id> --url "bisetka://home"`
   - Android: Use the adb command above

## Examples

### Joining a Private Game
Share this link with a friend to invite them to a private game:
```
bisetka://multiplayer-blot/user789?mode=private-join&joinCode=BATTLE123
```

### Opening Direct Message
Link to a specific DM conversation:
```
bisetka://dm/chat456
```

### Starting a Ranked Match
Link to start a ranked Mrotsi game:
```
bisetka://multiplayer-mrotsi/user999?mode=ranked
```

### Viewing Game Info
Link to the information page for Chess:
```
bisetka://game-info/chess
```

## Implementation Details

The deep linking is handled by React Navigation's linking configuration in `src/navigation/AppNavigator.tsx`. The `LinkingOptions` object maps URL paths to screen names and handles parameter parsing automatically.

### Adding New Deep Link Routes

To add a new deep link route:

1. Add the screen to `RootStackParamList` type if not already present
2. Add the route to the `linking.config.screens` object:

```typescript
MyNewScreen: {
  path: 'my-route/:paramName',
  parse: {
    paramName: (param: string) => param,
  },
},
```

3. The route will automatically be available at `bisetka://my-route/{paramValue}`

## Security Considerations

- Deep links should only navigate to screens the user has access to
- Authentication state is checked in the AppNavigator before routing
- Sensitive screens (like DMChat) should validate that the user has permission to access the resource
- Always validate and sanitize parameters from deep links before using them

## Future Enhancements

Potential features to add:
- Universal links (https://bisetka.app/...) that work as deep links
- Deep link analytics to track app opens from external sources
- Share sheets for easy deep link sharing from within the app
- QR code generation for deep links (e.g., for tournament invitations)
