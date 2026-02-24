#!/bin/bash
# Monitor card generation and auto-standardize when complete

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔍 Monitoring card generation..."
echo "Will auto-standardize when all 52 cards are generated"
echo

while true; do
  count=$(ls -1 *.png 2>/dev/null | wc -l | tr -d ' ')
  echo "$(date '+%H:%M:%S') - $count/52 cards generated"
  
  if [ "$count" -ge 52 ]; then
    echo
    echo "✅ All 52 cards generated!"
    echo "🎴 Running standardization..."
    echo
    bash standardize-cards.sh
    echo
    echo "🎉 Done! All cards are now uniform 700x1000"
    exit 0
  fi
  
  sleep 30
done
