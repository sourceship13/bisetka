#!/bin/bash

# Configure React Native for Physical Device Development

set -euo pipefail

echo "📱 Configuring for physical device..."

# Usage: ./setup-physical-device.sh [METRO_IP]
# Prefer Wi-Fi IP (en0) for physical iOS devices, then fallback.
OVERRIDE_IP="${1:-}"
MAC_IP=""

if [ -n "$OVERRIDE_IP" ]; then
    MAC_IP="$OVERRIDE_IP"
fi

if [ -z "$MAC_IP" ]; then
    MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || true)
fi

if [ -z "$MAC_IP" ]; then
    ACTIVE_IF=$(route get default 2>/dev/null | awk '/interface:/{print $2}')
    if [ -n "${ACTIVE_IF:-}" ]; then
        MAC_IP=$(ipconfig getifaddr "$ACTIVE_IF" 2>/dev/null || true)
    fi
fi

if [ -z "$MAC_IP" ]; then
    for IFACE in en1 en5 en6 en7 en8 en16; do
        MAC_IP=$(ipconfig getifaddr "$IFACE" 2>/dev/null || true)
        if [ -n "$MAC_IP" ]; then
            break
        fi
    done
fi

if [ -z "$MAC_IP" ]; then
    echo "❌ Could not detect Mac IP address"
    exit 1
fi

echo "✅ Mac IP: $MAC_IP"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_PATH="$SCRIPT_DIR/ios/bisetka/Info.plist"

if [ -f "$PLIST_PATH" ]; then
    /usr/libexec/PlistBuddy -c "Delete :MetroHost" "$PLIST_PATH" >/dev/null 2>&1 || true
    /usr/libexec/PlistBuddy -c "Add :MetroHost string $MAC_IP" "$PLIST_PATH"
    echo "✅ Updated iOS MetroHost in Info.plist"
fi

# Update .env file
cat > .env << EOF
# Development server configuration
METRO_HOST=$MAC_IP
BACKEND_URL=http://$MAC_IP:3000
EOF

echo "✅ Updated .env file"
echo ""
echo "📝 Next steps:"
echo "1. Make sure Metro is running: npm start"
echo "2. Make sure backend is running: cd ../bisetka-backend && npm run dev"
echo "3. Your iPhone must be on the same WiFi network"
echo "4. Run: npm run ios:physical"
echo ""
echo "🔌 Metro will be available at: http://$MAC_IP:8081"
echo "🎮 Backend will be available at: http://$MAC_IP:3000"
