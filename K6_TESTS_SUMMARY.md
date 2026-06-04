# K6 Stress Testing Implementation Summary

## Overview

A comprehensive k6 load testing suite has been created for KinQuest to enable stress testing and performance validation. The suite includes 5 test scenarios that simulate realistic player behavior and test various aspects of the application.

## Tests Created

### 1. **Player Behavior Test** (`k6-tests/player-behavior.js`)
Simulates typical player activities during a scavenger hunt.

**Features**:
- User registration
- Game state retrieval
- Photo submission with AI verification
- Chat messaging
- Leaderboard access

**Configuration**:
- Default: 10 VUs ramping to configured count
- Default duration: 30 seconds
- Customizable via: `VU_COUNT`, `TEST_DURATION`, `RAMP_UP`

**Run**:
```bash
npm run test:k6:player           # 50 VUs for 5m
k6 run k6-tests/player-behavior.js --vus 100 --duration 10m
```

**Metrics tracked**:
- Registration duration
- Challenge fetch duration
- Submission duration
- Chat message duration
- Leaderboard duration
- Error rate

---

### 2. **Spike Load Test** (`k6-tests/spike-load.js`)
Tests system resilience against sudden traffic spikes.

**Load Pattern**:
- 2 minutes: 10 users (warm up)
- 1 minute: 100 users (SPIKE)
- 1 minute: 10 users (cool down)
- 30 seconds: ramp to 0

**Features**:
- Rapid user registration during spike
- Heavy submission load (3 submissions per user)
- Game state queries
- Monitors recovery from spike

**Expected Results**:
- Errors should stay < 15% during spike
- System should recover quickly when spike ends
- Response times may increase 2-3x during spike (acceptable)

**Run**:
```bash
npm run test:k6:spike
k6 run k6-tests/spike-load.js
```

**Metrics tracked**:
- Peak load duration
- Peak error rate
- Spike response times

---

### 3. **Endurance Test** (`k6-tests/endurance.js`)
Tests system stability under sustained load over extended periods.

**Configuration**:
- Default: 20 VUs for 10 minutes
- Customizable via: `VU_COUNT`, `TEST_DURATION`

**Features**:
- Continuous user registration (first iteration)
- Repeated game state queries
- Photo submissions to random items
- Occasional chat messages
- Chat history retrieval

**What to watch**:
- Memory leaks (avg latency rising)
- Connection pool exhaustion (errors increasing over time)
- Query degradation (p95 latency growing)
- Cascading failures

**Run**:
```bash
npm run test:k6:endurance                    # 20 VUs for 10m
k6 run k6-tests/endurance.js --vus 50 --duration 30m
```

**Metrics tracked**:
- Endurance duration per request
- Error count over time
- Requests per second

---

### 4. **Admin Operations Test** (`k6-tests/admin-operations.js`)
Stress-tests admin-specific operations and permissions.

**Load Profile**:
- 5 concurrent admin users
- 6-minute test duration

**Features**:
- Admin password verification
- Challenge creation with random parameters
- Settings retrieval and updates
- Challenge modification
- Challenge deletion

**Use cases**:
- Validate admin operations under concurrent load
- Test permission enforcement at scale
- Identify bottlenecks in admin workflows

**Run**:
```bash
npm run test:k6:admin
k6 run k6-tests/admin-operations.js -e ADMIN_PASSWORD=securepass
```

**Metrics tracked**:
- Admin operation duration
- Admin error rate

---

### 5. **Chat Load Test** (`k6-tests/chat-load.js`)
Focuses on chat system performance and WebSocket stress testing.

**Load Profile**:
- Ramps from 0 to 20 concurrent users over 1 minute
- Sustained for 2 minutes
- 30-second cool down

**Features**:
- User registration
- Rapid chat message posting (5 messages per user)
- Chat history retrieval
- WebSocket connection testing (when available)
- Various message types and content

**Predefined messages**:
- "Great find! 📸"
- "Love this challenge!"
- "Just completed mine too"
- "This is so much fun!"
- And more...

**Run**:
```bash
npm run test:k6:chat
k6 run k6-tests/chat-load.js
```

**Metrics tracked**:
- Chat message duration
- Chat error rate
- WebSocket connection success

---

## Supporting Documentation

### 📖 Included Guides

| Document | Purpose |
|----------|---------|
| `README.md` | Detailed test documentation, configuration, and CI/CD integration |
| `QUICK_START.md` | Fast reference for running tests and interpreting basic results |
| `RESULTS_INTERPRETATION.md` | Comprehensive guide to understanding k6 metrics and output |
| `run-tests.sh` | Interactive test runner script with multiple scenarios |

### 📚 Quick Reference

- **README.md**: Full documentation with all options
- **QUICK_START.md**: Quick command reference
- **RESULTS_INTERPRETATION.md**: How to read and analyze results
- **run-tests.sh**: Bash script for running tests

---

## NPM Scripts

Added to `package.json`:

```bash
npm run test:k6:smoke          # 5 VUs for 1 minute (fastest)
npm run test:k6:player         # 50 VUs for 5 minutes
npm run test:k6:spike          # Spike test with 10→100→10 pattern
npm run test:k6:endurance      # 20 VUs for 10 minutes
npm run test:k6:admin          # 5 admin VUs for 6 minutes
npm run test:k6:chat           # Chat stress test
npm run test:k6:all            # Run all tests in sequence
npm run test:k6:runner         # Interactive test runner
```

---

## Installation & Setup

### Prerequisites

```bash
# Install k6
brew install k6                    # macOS
sudo apt-get install k6           # Ubuntu/Debian
choco install k6                  # Windows
# Or download from https://k6.io/docs/getting-started/installation/
```

### Quick Start

```bash
# 1. Start backend
docker compose up -d
npm run dev

# 2. Run smoke test (1 minute)
npm run test:k6:smoke

# 3. View results in terminal output
```

### Typical Testing Flow

```bash
# Quick validation (5 minutes)
npm run test:k6:player

# Full suite before deployment (20+ minutes)
npm run test:k6:all

# Monitor system while testing
# In another terminal:
docker compose logs -f app
# In yet another:
top -l 1
```

---

## Test Metrics & Thresholds

Each test includes sensible defaults:

```javascript
thresholds: {
  'http_req_duration': ['p(95)<500', 'p(99)<1000'],
  'http_req_failed': ['rate<0.1'],
}
```

Meaning:
- 95% of requests should complete in < 500ms
- 99% of requests should complete in < 1000ms
- Error rate should stay below 10%

**Note**: Spike tests have more lenient thresholds (rate<15%) as temporary degradation is expected.

---

## Custom Test Configuration

### Via Environment Variables

```bash
# Using bash
export BASE_URL=http://api.example.com
export VU_COUNT=100
export TEST_DURATION=15m
npm run test:k6:player

# Using inline
BASE_URL=http://api.example.com VU_COUNT=100 npm run test:k6:player
```

### Via CLI Arguments

```bash
k6 run k6-tests/player-behavior.js \
  --vus 150 \
  --duration 20m \
  -e BASE_URL=https://kinquest.narcolepsy.ninja \
  -e ADMIN_PASSWORD=mypass
```

### Via Script Modification

Edit the test file directly:

```javascript
export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '10s', target: 0 },
  ],
};
```

---

## Monitoring During Tests

### Test Progress
```bash
# In terminal running k6
# See live metrics updating every ~10 seconds
http_reqs....................: 1234 23.5/s
http_req_duration............: avg=245ms p(95)=450ms
```

### Application Logs
```bash
docker compose logs -f app
```

### System Resources
```bash
top          # macOS
htop         # Linux (install if needed)
```

### Database Connections
```bash
docker compose exec -T db psql -U postgres -d postgres -c \
  "SELECT count(*) FROM pg_stat_activity WHERE state != 'idle';"
```

---

## Common Usage Patterns

### Development (Before Every Commit)
```bash
npm run test:k6:smoke          # 1 minute for quick feedback
```

### Pre-Release
```bash
npm run test:k6:all            # Complete test suite
```

### Performance Baseline
```bash
k6 run k6-tests/player-behavior.js --out=json=baseline.json
# After optimization:
k6 run k6-tests/player-behavior.js --out=json=after.json
# Compare: cat baseline.json vs after.json
```

### Continuous Integration
```bash
# In CI pipeline
k6 run k6-tests/player-behavior.js \
  -e BASE_URL=$STAGING_URL \
  --summary-export=results.json
```

### Load Finding (Identify Breaking Point)
```bash
for vus in 10 20 50 100 200 500; do
  echo "Testing with $vus VUs..."
  k6 run k6-tests/player-behavior.js --vus $vus --duration 2m
  sleep 30
done
```

---

## File Structure

```
k6-tests/
├── README.md                      # Comprehensive guide
├── QUICK_START.md                # Quick reference
├── RESULTS_INTERPRETATION.md      # Results analysis guide
├── run-tests.sh                  # Test runner script
├── player-behavior.js            # Main player test
├── spike-load.js                 # Spike test
├── endurance.js                  # Endurance test
├── admin-operations.js           # Admin test
└── chat-load.js                  # Chat test
```

---

## Key Metrics to Monitor

### Per Endpoint
- Registration: 100-200ms typical
- Game State: 50-100ms typical
- Photo Submission: 400-800ms (includes AI)
- Chat: 100-200ms typical
- Admin Ops: 150-300ms typical

### System Level
- Error Rate: < 1% ideal, < 5% acceptable
- p(95) Latency: Should not exceed 500ms
- Throughput: Monitor for degradation over time
- Memory: Check for growth over test duration

---

## Troubleshooting

### "Connection refused"
```bash
# Backend not running
docker compose up -d
npm run dev
# Wait for "ready in XXms"
```

### "Too many open files" (Linux)
```bash
ulimit -n 65536
npm run test:k6:player
```

### High Error Rate
Check application logs: `docker compose logs app`
Check database: `docker compose logs db`
Reduce VU count and try again

### Timeouts
1. Increase timeout in test configuration
2. Check if backend is overloaded
3. Reduce image quality in tests
4. Check network connectivity

---

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: K6 Load Tests
  run: |
    npm install -g k6
    docker compose up -d
    k6 run k6-tests/player-behavior.js \
      -e BASE_URL=https://kinquest.narcolepsy.ninja \
      --summary-export=results.json
    docker compose down
  continue-on-error: true
```

### GitLab CI Example
```yaml
k6-load-test:
  image: grafana/k6:latest
  script:
    - docker compose up -d
    - k6 run k6-tests/player-behavior.js -e BASE_URL=https://kinquest.narcolepsy.ninja
    - docker compose down
  artifacts:
    reports:
      performance: results.json
```

---

## Performance Optimization Tips

Based on k6 results, optimize:

1. **High Response Times**
   - Add database indexes
   - Implement caching
   - Optimize queries
   - Profile with APM tools

2. **High Error Rate**
   - Check connection pool limits
   - Verify timeout configurations
   - Review error logs
   - Test with smaller load

3. **Memory Leaks**
   - Profile with `top` or `heapdump`
   - Look for event listener accumulation
   - Check for circular references
   - Use memory profilers

4. **Database Bottleneck**
   - Monitor slow query log
   - Add missing indexes
   - Consider connection pooling
   - Optimize N+1 queries

---

## References

- **k6 Documentation**: https://k6.io/docs/
- **k6 API**: https://k6.io/docs/javascript-api/
- **Performance Testing Guide**: https://k6.io/docs/test-types/
- **Best Practices**: https://k6.io/docs/testing-guides/

---

## Next Steps

1. ✅ **Review**: Read `QUICK_START.md`
2. ✅ **Install**: Install k6
3. ✅ **Run**: `npm run test:k6:smoke`
4. ✅ **Analyze**: Read results with `RESULTS_INTERPRETATION.md`
5. ✅ **Optimize**: Use insights to improve performance
6. ✅ **Integrate**: Add to CI/CD pipeline
7. ✅ **Monitor**: Run regularly to track performance

---

**Created**: June 2026  
**Test Suite Version**: 1.0  
**Compatible with**: k6 0.50+
