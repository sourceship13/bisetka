#!/bin/bash
# Mapbox Setup Script for Bisetka

echo "🗺️  Mapbox Setup for Global View"
echo "=================================="
echo ""

# Check if Mapbox token is in .env
if grep -q "MAPBOX_ACCESS_TOKEN" .env; then
  echo "✅ Mapbox token found in .env"
else
  echo "❌ No Mapbox token found in .env"
  echo ""
  echo "📝 Get a FREE token:"
  echo "   1. Go to https://account.mapbox.com/auth/signup/"
  echo "   2. Sign up (takes 30 seconds)"
  echo "   3. Copy your 'Public access token'"
  echo "   4. Add to .env: MAPBOX_ACCESS_TOKEN=pk.your_token_here"
  echo ""
  read -p "Press Enter when you've added the token to .env..."
fi

# Configure iOS
echo ""
echo "📱 Configuring iOS..."
INFO_PLIST="ios/bisetka/Info.plist"

if grep -q "MGLMapboxAccessToken" "$INFO_PLIST"; then
  echo "✅ iOS already configured"
else
  echo "Adding Mapbox token to Info.plist..."
  
  # Add before closing </dict></plist>
  sed -i '' '/<\/dict>/i\
	<key>MGLMapboxAccessToken</key>\
	<string>$(MAPBOX_ACCESS_TOKEN)</string>
' "$INFO_PLIST"
  
  echo "✅ iOS configured"
fi

# Pod install
echo ""
echo "📦 Installing iOS dependencies..."
cd ios
pod install
cd ..
echo "✅ Pods installed"

echo ""
echo "🎉 Mapbox setup complete!"
echo ""
echo "Next steps:"
echo "  1. Make sure you added MAPBOX_ACCESS_TOKEN to .env"
echo "  2. Run: npm run ios"
echo "  3. Tap the green earth button"
echo "  4. See the beautiful 3D globe! 🌍"
echo ""
