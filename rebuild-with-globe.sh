#!/bin/bash
# Rebuild app with Mapbox globe

echo "🌍 Rebuilding Bisetka with 3D Globe..."
echo ""

# Check if token is set
TOKEN=$(grep "MAPBOX_ACCESS_TOKEN" .env | cut -d'=' -f2)
if [ "$TOKEN" == "YOUR_TOKEN_HERE" ] || [ -z "$TOKEN" ]; then
  echo "❌ No Mapbox token found!"
  echo ""
  echo "Get a FREE token:"
  echo "1. Go to: https://account.mapbox.com/auth/signup/"
  echo "2. Copy your Default public token"
  echo "3. Add to .env: MAPBOX_ACCESS_TOKEN=pk.your_token..."
  echo ""
  exit 1
fi

echo "✅ Mapbox token found"
echo ""

# Clean Metro cache
echo "🧹 Cleaning Metro cache..."
rm -rf node_modules/.cache
watchman watch-del-all 2>/dev/null
echo "✅ Cache cleared"
echo ""

# iOS build
echo "📱 Building for iOS..."
cd ios
xcodebuild clean -workspace bisetka.xcworkspace -scheme bisetka
cd ..
echo "✅ iOS clean complete"
echo ""

# Run on device
echo "🚀 Launching on device..."
npm run ios:physical

echo ""
echo "✅ Done! Tap the green earth button to see the 3D globe! 🌍"
