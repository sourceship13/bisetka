#!/bin/bash
# Quick Start: Bisetka Hierarchical Locations
# Run this to set up the foundation

set -e

echo "🌍 Bisetka Locations - Quick Start"
echo "==================================="
echo ""

# Check if data directory exists
if [ ! -d "./data" ]; then
  echo "📁 Creating data directory..."
  mkdir -p ./data
fi

# Install axios if not present
echo "📦 Checking dependencies..."
if ! npm list axios > /dev/null 2>&1; then
  echo "Installing axios..."
  npm install axios
fi

echo ""
echo "🚀 Step 1: Fetch Location Data"
echo "This will take ~5 minutes (1 request/sec rate limit)"
echo ""
read -p "Fetch data from OpenStreetMap? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  node scripts/populate-locations.js
  echo ""
  echo "✅ Location data saved to: ./data/bisetka-locations.json"
else
  echo "⏭️  Skipping data fetch"
fi

echo ""
echo "📊 Step 2: Database Setup"
echo "Copy the SQL from NEAREST_BISETKA_API.md and run it in your database"
echo ""
echo "Tables to create:"
echo "  • countries"
echo "  • regions"
echo "  • cities"
echo "  • neighborhoods"
echo "  • bisetka_sessions"
echo "  • user_closest_bisetka"
echo ""

read -p "Press Enter when database is ready..."

echo ""
echo "🔄 Step 3: Import Data"
echo "Run this SQL to import the JSON:"
echo ""
echo "  psql -d bisetka -f scripts/import-locations.sql"
echo ""

read -p "Press Enter when import is complete..."

echo ""
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "  1. Add API endpoints (see NEAREST_BISETKA_API.md)"
echo "  2. Update socket handlers"
echo "  3. Add location permission to app"
echo "  4. Update GlobalView screen"
echo ""
echo "Documentation:"
echo "  • BISETKA_LOCATIONS_MASTERPLAN.md - Overview"
echo "  • NEAREST_BISETKA_API.md - Backend guide"
echo "  • HIERARCHICAL_GLOBE_GUIDE.md - Frontend guide"
echo ""
echo "🎉 Ready to show nearest Bisetkas on the globe!"
