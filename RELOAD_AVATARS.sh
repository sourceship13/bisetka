#!/bin/bash

echo "🧹 Clearing ALL React Native caches..."

cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka

# Clear watchman
watchman watch-del-all

# Clear metro bundler cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*
rm -rf $TMPDIR/react-*

# Clear node cache
rm -rf node_modules/.cache

# Clear build caches
rm -rf android/app/build
rm -rf ios/build

# Clear iOS derived data (if exists)
rm -rf ~/Library/Developer/Xcode/DerivedData/*

echo ""
echo "✅ All caches cleared!"
echo ""
echo "Now run:"
echo "  npm start -- --reset-cache"
echo ""
echo "Or:"
echo "  npx react-native start --reset-cache"
