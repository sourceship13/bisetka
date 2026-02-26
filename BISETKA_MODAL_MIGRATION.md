# BisetkaModal Migration Guide

## Overview

Replace all system `Alert.alert()` calls with our custom `BisetkaAlert` for a consistent, themed modal experience throughout the app.

## What's Changed

### Before (System Alert)
```tsx
import { Alert } from 'react-native';

Alert.alert('Error', 'Please enter a background theme prompt');
Alert.alert('Success', 'Background generated!');
```

### After (BisetkaAlert)
```tsx
import { BisetkaAlert } from '../utils/BisetkaAlert';

BisetkaAlert.error('Error', 'Please enter a background theme prompt');
BisetkaAlert.success('Success', 'Background generated!');
```

## API Reference

### BisetkaAlert Methods

#### `BisetkaAlert.alert(title, message, buttons?)`
General purpose alert (info style)

```tsx
BisetkaAlert.alert('Title', 'Message');

// With buttons
BisetkaAlert.alert('Confirm', 'Are you sure?', [
  { text: 'Cancel', onPress: () => {}, style: 'cancel' },
  { text: 'OK', onPress: () => console.log('OK'), style: 'default' }
]);
```

#### `BisetkaAlert.success(title, message, buttons?)`
Success alert (green/teal gradient)

```tsx
BisetkaAlert.success('Success!', 'Operation completed successfully');
```

#### `BisetkaAlert.error(title, message, buttons?)`
Error alert (red gradient)

```tsx
BisetkaAlert.error('Error', 'Something went wrong');
```

#### `BisetkaAlert.warning(title, message, buttons?)`
Warning alert (yellow gradient)

```tsx
BisetkaAlert.warning('Warning', 'Please be careful with this action');
```

### Button Styles

- `default` → Primary button (purple gradient)
- `cancel` → Secondary button (pink gradient)
- `destructive` → Danger button (red gradient)

## Migration Checklist

### Files to Update

Find all files using `Alert.alert()`:

```bash
grep -r "Alert\." src/ --include="*.tsx" --include="*.ts" | grep -v node_modules
```

### Common Patterns

#### 1. Simple Alert
```tsx
// Old
Alert.alert('Error', 'Please enter a value');

// New
BisetkaAlert.error('Error', 'Please enter a value');
```

#### 2. Success Notification
```tsx
// Old
Alert.alert('Success', 'Item saved!');

// New  
BisetkaAlert.success('Success', 'Item saved!');
```

#### 3. Confirmation Dialog
```tsx
// Old
Alert.alert('Delete', 'Are you sure?', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'Delete', style: 'destructive', onPress: handleDelete }
]);

// New
BisetkaAlert.alert('Delete', 'Are you sure?', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'Delete', style: 'destructive', onPress: handleDelete }
]);
```

## Example: CardCustomizationModal Migration

### Before
```tsx
import { Alert } from 'react-native';

const generateBackground = async () => {
  if (!backgroundPrompt.trim()) {
    Alert.alert('Error', 'Please enter a background theme prompt');
    return;
  }

  try {
    const result = await apiGenerateBackground(backgroundPrompt);
    Alert.alert('Success', 'Background generated!');
  } catch (error) {
    Alert.alert('Error', 'Failed to generate background. Please try again.');
  }
};
```

### After
```tsx
import { BisetkaAlert } from '../utils/BisetkaAlert';

const generateBackground = async () => {
  if (!backgroundPrompt.trim()) {
    BisetkaAlert.error('Error', 'Please enter a background theme prompt');
    return;
  }

  try {
    const result = await apiGenerateBackground(backgroundPrompt);
    BisetkaAlert.success('Success', 'Background generated!');
  } catch (error) {
    BisetkaAlert.error('Error', 'Failed to generate background. Please try again.');
  }
};
```

## Design Features

✅ **Themed**: Matches Bisetka's purple/blue gradient aesthetic  
✅ **Animated**: Smooth fade-in animation  
✅ **Icons**: Context-aware icons (✓, ⚠, ✕, ℹ)  
✅ **Gradients**: Beautiful gradient backgrounds and buttons  
✅ **Shadows**: Depth with colored shadows  
✅ **Responsive**: Works on all screen sizes  

## Implementation Details

The modal is rendered at the app root level (`App.tsx`) so it appears above all screens:

```tsx
<AuthProvider>
  <View style={{ flex: 1 }}>
    <AppNavigator />
    <BisetkaAlertContainer />
  </View>
</AuthProvider>
```

## Error Modals Exception

⚠️ **Important**: Only replace Alert calls for **game play notifications** (wins, turns, scores, etc.). 

**DO NOT** replace Alert calls for:
- Error handling / crashes
- Network failures  
- Authentication errors
- Critical system messages

These should continue using system Alert for reliability.

## Next Steps

1. Search for all `Alert.alert()` calls in game screens
2. Replace with appropriate `BisetkaAlert` method
3. Remove `Alert` import from files
4. Test thoroughly on iOS and Android
5. Commit changes

---

**Created**: 2026-02-26  
**Component**: `src/components/BisetkaModal.tsx`  
**Utility**: `src/utils/BisetkaAlert.tsx`
