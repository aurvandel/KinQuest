#!/bin/bash

# K6 Test Data Cleanup Script
# Removes test data created during k6 stress testing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 K6 Test Cleanup Script${NC}"
echo "================================"

# Check if we should do full reset or selective cleanup
FULL_RESET="${1:-false}"

if [ "$FULL_RESET" == "full" ]; then
  echo -e "${YELLOW}Full reset requested - resetting database and clearing uploads${NC}"
  
  # Stop containers
  echo "Stopping Docker Compose..."
  docker compose down -v 2>/dev/null || true
  
  # Clear uploads directory
  echo "Clearing uploads directory..."
  rm -rf uploads/* 2>/dev/null || true
  
  # Restart containers with fresh database
  echo "Starting fresh Docker Compose stack..."
  docker compose up -d
  
  echo -e "${GREEN}✅ Full reset complete!${NC}"
  echo "Database is fresh and uploads cleared"
  exit 0
fi

# Otherwise do selective cleanup (remove test data only)
echo -e "${YELLOW}Selective cleanup - removing test data only${NC}"

# Check if database is running
if ! docker compose ps | grep -q db; then
  echo -e "${RED}❌ Database container not running${NC}"
  echo "Start with: docker compose up -d"
  exit 1
fi

echo -e "${YELLOW}Cleaning up Supabase database (Docker PostgreSQL)...${NC}"
echo ""

# Create a temporary SQL file with all cleanup commands
CLEANUP_SQL=$(cat <<'EOF'
-- Disable foreign key checks temporarily
SET CONSTRAINTS ALL DEFERRED;

-- Delete test submissions (all test patterns)
DELETE FROM submissions WHERE 
  user_id LIKE 'player_%' OR
  user_id LIKE 'spike_user_%' OR
  user_id LIKE 'chattester_%' OR
  user_id LIKE 'endurance_%' OR
  user_id LIKE 'testplayer%' OR
  username LIKE 'player_%' OR
  username LIKE 'spike_%' OR
  username LIKE 'chattester_%' OR
  username LIKE 'endurance_%' OR
  username LIKE 'testplayer%';

-- Delete test chat messages (all test patterns)
DELETE FROM messages WHERE
  sender_id LIKE 'player_%' OR
  sender_id LIKE 'spike_user_%' OR
  sender_id LIKE 'chattester_%' OR
  sender_id LIKE 'endurance_%' OR
  sender_id LIKE 'testplayer%' OR
  sender_name LIKE 'player_%' OR
  sender_name LIKE 'spike_%' OR
  sender_name LIKE 'chattester_%' OR
  sender_name LIKE 'endurance_%' OR
  sender_name LIKE 'testplayer%' OR
  receiver_id LIKE 'player_%' OR
  receiver_id LIKE 'spike_user_%' OR
  receiver_id LIKE 'chattester_%' OR
  receiver_id LIKE 'endurance_%' OR
  receiver_id LIKE 'testplayer%';

-- Delete test items/challenges created by test users
DELETE FROM items WHERE
  created_by IN (
    SELECT id FROM profiles WHERE
      id LIKE 'player_%' OR
      id LIKE 'spike_user_%' OR
      id LIKE 'chattester_%' OR
      id LIKE 'endurance_%' OR
      id LIKE 'testplayer%' OR
      username LIKE 'player_%' OR
      username LIKE 'spike_%' OR
      username LIKE 'chattester_%' OR
      username LIKE 'endurance_%' OR
      username LIKE 'testplayer%' OR
      username LIKE 'admin_test%'
  ) OR
  title LIKE '%TEST_ADMIN%' OR
  description LIKE '%TEST_ADMIN%';

-- Delete test users (all test patterns)
DELETE FROM profiles WHERE
  id LIKE 'player_%' OR
  id LIKE 'spike_user_%' OR
  id LIKE 'chattester_%' OR
  id LIKE 'endurance_%' OR
  id LIKE 'testplayer%' OR
  username LIKE 'player_%' OR
  username LIKE 'spike_%' OR
  username LIKE 'chattester_%' OR
  username LIKE 'endurance_%' OR
  username LIKE 'testplayer%' OR
  username LIKE 'admin_test%';

-- Re-enable foreign key checks
SET CONSTRAINTS ALL IMMEDIATE;
EOF
)

# Execute cleanup
echo "Running comprehensive cleanup..."
docker compose exec -T db psql -U postgres -d postgres << SQL
$CLEANUP_SQL
SQL

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Database cleanup completed successfully${NC}"
else
  echo -e "${RED}✗ Database cleanup encountered issues${NC}"
fi

# Reset admin settings to defaults
echo "Resetting admin settings..."

# Default settings object
DEFAULT_SETTINGS='{
  "name": "KinQuest",
  "icon": null,
  "defaultLat": 41.9076,
  "defaultLng": -111.3800,
  "defaultRadius": 2500,
  "aiPromptCriteria": "Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!",
  "activeInviteCode": "watkins",
  "inviteRequired": true,
  "aiVerificationEnabled": true,
  "allowForceSubmit": false,
  "imageCompressionMaxDim": 800,
  "imageCompressionQuality": 0.7
}'

# Write default settings to file
echo "$DEFAULT_SETTINGS" > settings.json

# Try to reset settings via API if server is running
echo "Attempting to reset settings via API..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "  ✓ Server is running, resetting settings via API..."
  curl -X POST http://localhost:3000/api/settings \
    -H "Content-Type: application/json" \
    -d "$DEFAULT_SETTINGS" \
    2>/dev/null || echo "  ⚠ Settings API call failed (server may not be ready yet)"
else
  echo "  ℹ Server not running, settings will be loaded from file on next start"
fi

# Clear uploads directory
echo "Clearing uploads directory..."
rm -rf uploads/* 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo "Test data has been removed from the database"
echo ""
echo "📝 Settings have been reset to defaults in settings.json"
echo "⚠️  ${YELLOW}If the server is running, restart it to load fresh settings:${NC}"
echo "    pkill -f 'npm run dev' && npm run dev"
echo ""
echo "Statistics:"
docker compose exec -T db psql -U postgres -d postgres -c \
  "SELECT (SELECT COUNT(*) FROM profiles) as total_users, 
          (SELECT COUNT(*) FROM items) as total_challenges,
          (SELECT COUNT(*) FROM submissions) as total_submissions, 
          (SELECT COUNT(*) FROM messages) as total_messages;" \
  2>/dev/null || true
