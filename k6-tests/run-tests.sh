#!/bin/bash

# K6 Test Runner - Comprehensive stress testing orchestration
# Usage: ./run-tests.sh [test-type] [options]

set -e

# Change to parent directory (where k6-tests folder is located)
cd "$(dirname "$0")/.."

BASE_URL="${BASE_URL:-https://kinquest.narcolepsy.ninja}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-password}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test functions
run_player_behavior() {
  echo -e "${GREEN}🎮 Running Player Behavior Test${NC}"
  echo "Configuration: ${VU_COUNT} VUs, ${TEST_DURATION} duration"
  
  k6 run k6-tests/player-behavior.js \
    -e BASE_URL="$BASE_URL" \
    -e VU_COUNT="${VU_COUNT:-10}" \
    -e TEST_DURATION="${TEST_DURATION:-30s}" \
    -e RAMP_UP="${RAMP_UP:-5s}"
}

run_spike_test() {
  echo -e "${GREEN}⚡ Running Spike Load Test${NC}"
  echo "Pattern: Ramp 2m → Spike to 100 VUs for 1m → Cool down 1m"
  
  k6 run k6-tests/spike-load.js \
    -e BASE_URL="$BASE_URL"
}

run_endurance() {
  echo -e "${GREEN}⏱️  Running Endurance Test${NC}"
  echo "Configuration: ${VU_COUNT} VUs for ${TEST_DURATION} duration"
  
  k6 run k6-tests/endurance.js \
    -e BASE_URL="$BASE_URL" \
    -e VU_COUNT="${VU_COUNT:-20}" \
    -e TEST_DURATION="${TEST_DURATION:-10m}"
}

run_admin_ops() {
  echo -e "${GREEN}👨‍💼 Running Admin Operations Test${NC}"
  
  k6 run k6-tests/admin-operations.js \
    -e BASE_URL="$BASE_URL" \
    -e ADMIN_PASSWORD="$ADMIN_PASSWORD"
}

run_image_upload() {
  echo -e "${GREEN}📸 Running Image Upload & Serving Test${NC}"
  
  k6 run k6-tests/image-upload-serve.js \
    -e BASE_URL="$BASE_URL"
}

run_all_tests() {
  echo -e "${GREEN}🚀 Running All Tests in Sequence${NC}"
  
  run_player_behavior
  echo -e "${YELLOW}Test 1/5 complete - waiting 30s...${NC}"
  sleep 30
  
  run_admin_ops
  echo -e "${YELLOW}Test 2/5 complete - waiting 30s...${NC}"
  sleep 30
  
  run_image_upload
  echo -e "${YELLOW}Test 3/5 complete - waiting 30s...${NC}"
  sleep 30
  
  run_endurance
  echo -e "${YELLOW}Test 4/5 complete - waiting 30s...${NC}"
  sleep 30
  
  run_spike_test
  echo -e "${YELLOW}Test 5/5 complete${NC}"
}

run_quick_smoke() {
  echo -e "${GREEN}💨 Running Quick Smoke Test (1m)${NC}"
  
  k6 run k6-tests/player-behavior.js \
    -e BASE_URL="$BASE_URL" \
    -e VU_COUNT="5" \
    -e TEST_DURATION="1m"
}

show_help() {
  cat <<EOF
K6 Test Runner for KinQuest
Usage: ./k6-tests/run-tests.sh [COMMAND] [OPTIONS]

COMMANDS:
  player        Run player behavior test
  spike         Run spike load test
  endurance     Run endurance test (10m default)
  admin         Run admin operations test
  images        Run image upload & serving test
  smoke         Quick 1-minute smoke test
  all           Run all tests in sequence
  help          Show this help message

OPTIONS:
  BASE_URL=url              Backend URL (default: https://kinquest.narcolepsy.ninja)
  VU_COUNT=num              Number of virtual users (default: 10-20)
  TEST_DURATION=duration    Test duration (default: 30s-10m)
  ADMIN_PASSWORD=pass       Admin password (default: password)
  RAMP_UP=duration          Ramp up time (default: 5s)

EXAMPLES:
  # Quick smoke test
  ./k6-tests/run-tests.sh smoke

  # Player behavior with 50 VUs for 5 minutes
  ./k6-tests/run-tests.sh player VU_COUNT=50 TEST_DURATION=5m

  # Endurance test for 30 minutes
  ./k6-tests/run-tests.sh endurance TEST_DURATION=30m

  # All tests with custom backend URL
  ./k6-tests/run-tests.sh all BASE_URL=http://api.example.com

  # Admin operations with custom password
  ./k6-tests/run-tests.sh admin ADMIN_PASSWORD=mysecurepass

EOF
}

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
  echo -e "${RED}❌ k6 is not installed${NC}"
  echo "Install k6 from https://k6.io/docs/getting-started/installation/"
  exit 1
fi

# Parse arguments
COMMAND="${1:-help}"

# Export environment variables for subsequent commands
export BASE_URL ADMIN_PASSWORD

case "$COMMAND" in
  player)
    shift
    for arg in "$@"; do export "$arg"; done
    run_player_behavior
    ;;
  spike)
    shift
    for arg in "$@"; do export "$arg"; done
    run_spike_test
    ;;
  endurance)
    shift
    for arg in "$@"; do export "$arg"; done
    run_endurance
    ;;
  admin)
    shift
    for arg in "$@"; do export "$arg"; done
    run_admin_ops
    ;;
  images)
    shift
    for arg in "$@"; do export "$arg"; done
    run_image_upload
    ;;
  smoke)
    shift
    for arg in "$@"; do export "$arg"; done
    run_quick_smoke
    ;;
  all)
    shift
    for arg in "$@"; do export "$arg"; done
    run_all_tests
    ;;
  help)
    show_help
    ;;
  *)
    echo -e "${RED}Unknown command: $COMMAND${NC}"
    show_help
    exit 1
    ;;
esac
