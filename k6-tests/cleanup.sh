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
echo "✓ All Supabase tables will be cleaned automatically (no manual steps needed)"
echo ""

# SQL statements to delete test data from Supabase (self-hosted in Docker)
# Delete in order: submissions → messages → items → users
# The 'db' container in docker-compose is the Supabase PostgreSQL database
echo "  • Removing test submissions..."
docker compose exec -T db psql -U postgres -d postgres -c \
  "DELETE FROM submissions WHERE username LIKE 'player_%' OR username LIKE 'spike_%' OR username LIKE 'chattester_%' OR username LIKE 'endurance_%' OR username LIKE 'testplayer%';" \
  2>/dev/null || echo "  • Submissions cleanup may have skipped some entries"

echo "  • Removing test chat messages..."
docker compose exec -T db psql -U postgres -d postgres -c \
  "DELETE FROM messages WHERE sender_name LIKE 'player_%' OR sender_name LIKE 'spike_%' OR sender_name LIKE 'chattester_%' OR sender_name LIKE 'endurance_%' OR sender_name LIKE 'testplayer%';" \
  2>/dev/null || echo "  • Messages cleanup may have skipped some entries"

echo "  • Removing test-created and test-modified challenges..."
docker compose exec -T db psql -U postgres -d postgres -c \
  "DELETE FROM items WHERE created_by IN (SELECT id FROM profiles WHERE username LIKE 'player_%' OR username LIKE 'spike_%' OR username LIKE 'chattester_%' OR username LIKE 'endurance_%' OR username LIKE 'testplayer%') OR title LIKE '%TEST_ADMIN%' OR description LIKE '%TEST_ADMIN%';" \
  2>/dev/null || echo "  • Test challenge removal complete"

echo "  • Removing test users..."
docker compose exec -T db psql -U postgres -d postgres -c \
  "DELETE FROM profiles WHERE username LIKE 'player_%' OR username LIKE 'spike_%' OR username LIKE 'chattester_%' OR username LIKE 'endurance_%' OR username LIKE 'testplayer%';" \
  2>/dev/null || echo "  • Test user cleanup may have encountered an issue"

# Reset admin settings to defaults
echo "Resetting admin settings..."
cat > settings.json << 'EOF'
{
  "name": "KinQuest",
  "icon": null,
  "defaultLat": 41.9076,
  "defaultLng": -111.3800,
  "defaultRadius": 2500,
  "aiPromptCriteria": "Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!",
  "activeInviteCode": "stewart-test",
  "inviteRequired": true,
  "aiVerificationEnabled": true,
  "allowForceSubmit": false,
  "imageCompressionMaxDim": 800,
  "imageCompressionQuality": 0.7
}
EOF

# Clear uploads directory
echo "Clearing uploads directory..."
rm -rf uploads/* 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo "Test data has been removed from the database"
echo ""
echo "Statistics:"
docker compose exec -T db psql -U postgres -d postgres -c \
  "SELECT (SELECT COUNT(*) FROM profiles) as total_users, 
          (SELECT COUNT(*) FROM items) as total_challenges,
          (SELECT COUNT(*) FROM submissions) as total_submissions, 
          (SELECT COUNT(*) FROM messages) as total_messages;" \
  2>/dev/null || true
