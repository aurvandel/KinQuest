# K6 Stress Testing Guide for KinQuest

This directory contains k6 load testing scripts to simulate realistic player behavior and stress-test the KinQuest application.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6

# Or download from: https://k6.io/docs/getting-started/installation/
```

## Test Scenarios

### 1. Player Behavior Test (`player-behavior.js`)
**Purpose**: Simulates typical player activities during normal gameplay
**Load Profile**: Ramp up gradually to configured VU count
**What it tests**:
- User registration
- Getting game state and challenges
- Photo submissions (AI verification)
- Chat messages
- Leaderboard access

**Run**:
```bash
k6 run k6-tests/player-behavior.js
```

**With custom parameters**:
```bash
k6 run k6-tests/player-behavior.js \
  --vus 50 \
  --duration 2m \
  -e BASE_URL=https://kinquest.narcolepsy.ninja \
  -e TEST_DURATION=2m \
  -e VU_COUNT=50
```

### 2. Spike Load Test (`spike-load.js`)
**Purpose**: Tests system behavior during sudden traffic spikes
**Load Profile**: Steady low load → sudden spike → return to low
**Peak VUs**: Up to 100 concurrent users
**Key metrics**: How gracefully does the system handle unexpected load?

**Run**:
```bash
k6 run k6-tests/spike-load.js
```

Expected load pattern:
- 2 minutes: 10 users (warm up)
- 1 minute: 100 users (SPIKE)
- 1 minute: 10 users (cool down)
- 30 seconds: ramp down to 0

### 3. Endurance Test (`endurance.js`)
**Purpose**: Tests system stability under sustained load over time
**Load Profile**: Constant load for extended period
**Duration**: Default 10 minutes (configurable)
**What to watch**: Memory leaks, connection timeouts, gradual degradation

**Run**:
```bash
k6 run k6-tests/endurance.js -e VU_COUNT=20 -e TEST_DURATION=10m
```

For longer endurance:
```bash
k6 run k6-tests/endurance.js -e VU_COUNT=30 -e TEST_DURATION=1h
```

### 4. Admin Operations Test (`admin-operations.js`)
**Purpose**: Tests admin-specific operations under concurrent load
**Load Profile**: Small number of admin users (5) doing various operations
**What it tests**:
- Admin password verification
- Creating new challenges
- Updating game settings
- Modifying challenges
- Deleting challenges

**Run**:
```bash
k6 run k6-tests/admin-operations.js -e ADMIN_PASSWORD=yourpassword
```

### 5. Chat Load Test (`chat-load.js`)
**Purpose**: Tests chat system under concurrent user load
**Load Profile**: Ramp up to 20 concurrent chat users
**What it tests**:
- User registration
- Rapid chat message posting
- Chat history retrieval
- WebSocket connection attempts
- Message delivery under load

**Run**:
```bash
k6 run k6-tests/chat-load.js
```

## Running Tests with Environment Variables

Set environment variables before running:

```bash
# Set base URL, VU count, and duration
export BASE_URL=https://kinquest.narcolepsy.ninja
export VU_COUNT=50
export TEST_DURATION=5m
export ADMIN_PASSWORD=password

k6 run k6-tests/player-behavior.js
```

Or pass inline:
```bash
k6 run k6-tests/player-behavior.js \
  -e BASE_URL=https://kinquest.narcolepsy.ninja \
  -e VU_COUNT=100 \
  -e TEST_DURATION=10m
```

## Load Testing Progression

### Quick Test (1-2 minutes)
```bash
# Fast feedback - test basic functionality
k6 run k6-tests/player-behavior.js -e VU_COUNT=10 -e TEST_DURATION=1m
```

### Moderate Load Test (5-10 minutes)
```bash
# Test sustained performance
k6 run k6-tests/player-behavior.js -e VU_COUNT=50 -e TEST_DURATION=5m
```

### Heavy Load Test (15+ minutes)
```bash
# Test breaking points and stability
k6 run k6-tests/player-behavior.js -e VU_COUNT=200 -e TEST_DURATION=15m
```

## Output & Results

K6 provides real-time metrics:

```
http_reqs....................: 12345 34.2/s
http_req_duration............: avg=120ms  p(90)=250ms p(95)=350ms p(99)=800ms
http_req_failed..............: 1.23%
http_req_duration {name:Register}: avg=200ms
http_req_duration {name:Submission}: avg=450ms
```

Key metrics to monitor:
- **http_req_duration**: Response time (should stay under thresholds)
- **http_req_failed**: Error rate (lower is better)
- **vus**: Current number of active virtual users
- **iterations**: Total requests completed

## Performance Thresholds

Each test has built-in threshold checks:

```javascript
thresholds: {
  'http_req_duration': ['p(95)<500', 'p(99)<1000'],  // 95th percentile < 500ms
  'http_req_failed': ['rate<0.1'],                    // Less than 10% errors
}
```

If thresholds are exceeded, k6 will exit with failure status.

## Recording Results

Generate HTML reports:

```bash
# Run test with HTML reporting
k6 run k6-tests/player-behavior.js --out=html=results.html

# View results
open results.html
```

Or use JSON output for integration with CI/CD:
```bash
k6 run k6-tests/player-behavior.js --out=json=results.json
```

## Docker Setup for Testing

Ensure your KinQuest stack is running:

```bash
# Start the full stack
docker compose up -d

# Verify backend is running
curl https://kinquest.narcolepsy.ninja/api/db-status

# Run tests
k6 run k6-tests/player-behavior.js
```

Stop the stack:
```bash
docker compose down
```

## Common Issues

### "Connection refused"
**Cause**: Backend not running
**Fix**: 
```bash
docker compose up -d
npm run dev
# Wait for "ready in XXms"
```

### "Timeout waiting for response"
**Cause**: Server overloaded or slow image processing
**Fix**: Increase timeout in test scripts or reduce VU count

### "Too many open files" (Linux)
**Cause**: System limit reached
**Fix**:
```bash
ulimit -n 65536
k6 run k6-tests/player-behavior.js
```

### High error rates during image upload
**Cause**: AI processing bottleneck
**Fix**: Reduce image complexity in test, or optimize Gemini API calls

## Debugging

Run test with verbose logging:
```bash
k6 run k6-tests/player-behavior.js --verbose -e BASE_URL=https://kinquest.narcolepsy.ninja
```

Check specific VU behavior:
```bash
k6 run k6-tests/player-behavior.js --summary-export=summary.json
cat summary.json
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Run K6 Load Tests
  run: |
    docker compose up -d
    k6 run k6-tests/player-behavior.js \
      -e BASE_URL=https://kinquest.narcolepsy.ninja \
      -e VU_COUNT=50 \
      -e TEST_DURATION=5m
    docker compose down
```

## Test Customization

Modify test parameters in the script files:

```javascript
export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Ramp up to 50 VUs
    { duration: '2m', target: 50 },   // Hold at 50 for 2 minutes
    { duration: '10s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],  // 95th percentile < 500ms
    'http_req_failed': ['rate<0.1'],     // Error rate < 10%
  },
};
```

## Monitoring During Tests

In another terminal, monitor the backend:

```bash
# Watch Docker logs
docker compose logs -f app

# Monitor system resources
top

# Check database connections
docker compose exec -T db psql -U postgres -d postgres -c \
  "SELECT count(*) FROM pg_stat_activity;"
```

## Next Steps

1. **Establish Baselines**: Run tests against a known-good version to establish performance baselines
2. **Test Regularly**: Run tests as part of your CI/CD pipeline
3. **Optimize Based on Results**: Use results to identify bottlenecks
4. **Scale Testing**: Gradually increase load to find breaking points

---

**Last Updated**: June 2026
