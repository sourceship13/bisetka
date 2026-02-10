#!/bin/bash

# Configure React Native for Physical Device Development

echo "📱 Configuring for physical device..."

# Get Mac IP
MAC_IP=$(ifconfig en16 | grep "inet " | awk '{print $2}')

if [ -z "$MAC_IP" ]; then
    echo "❌ Could not detect Mac IP address"
    exit 1
fi

echo "✅ Mac IP: $MAC_IP"

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
