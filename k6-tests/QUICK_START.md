# K6 Test Suite - Quick Reference

## Available Test Scripts

### 📝 Test Files Created

| Test | File | Purpose | Duration | VUs |
|------|------|---------|----------|-----|
| **Player Behavior** | `player-behavior.js` | Typical player activities | 30s-5m | 10-50 |
| **Spike Load** | `spike-load.js` | Sudden traffic spikes | 4m | 10→100→10 |
| **Endurance** | `endurance.js` | Long-term stability | 10m-1h | 20+ |
| **Admin Operations** | `admin-operations.js` | Admin-only features | 6m | 5 |
| **Chat Load** | `chat-load.js` | Chat stress testing | 3.5m | 0→20 |

## Quick Start

### 1. Install k6
```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Or visit https://k6.io/docs/getting-started/installation/
```

### 2. Start Backend
```bash
docker compose up -d
npm run dev
# Wait for "ready in XXms" message
```

### 3. Run Tests

**Quickest (1 minute):**
```bash
npm run test:k6:smoke
```

**Typical Testing (5-10 minutes):**
```bash
npm run test:k6:player
# or
npm run test:k6:admin
```

**Comprehensive (20+ minutes):**
```bash
npm run test:k6:all
```

## NPM Script Commands

```bash
# Smoke test (5 VUs for 1 minute)
npm run test:k6:smoke

# Player behavior (50 VUs for 5 minutes)
npm run test:k6:player

# Spike test (ramps to 100 VUs)
npm run test:k6:spike

# Endurance test (20 VUs for 10 minutes)
npm run test:k6:endurance

# Admin operations (5 admin VUs for 6 minutes)
npm run test:k6:admin

# All tests in sequence (complete suite)
npm run test:k6:all

# Interactive test runner
npm run test:k6:runner
# Then choose: smoke, player, spike, endurance, admin, all, help
```

## CLI Usage Examples

### Using run-tests.sh directly

```bash
# Show help
./k6-tests/run-tests.sh help

# Smoke test
./k6-tests/run-tests.sh smoke

# Player behavior with custom parameters
./k6-tests/run-tests.sh player VU_COUNT=100 TEST_DURATION=10m

# Endurance for 30 minutes
./k6-tests/run-tests.sh endurance TEST_DURATION=30m

# Run all tests with custom backend
./k6-tests/run-tests.sh all BASE_URL=http://api.example.com

# Admin test with custom password
./k6-tests/run-tests.sh admin ADMIN_PASSWORD=securepass123
```

### Direct k6 commands

```bash
# Minimal test
k6 run k6-tests/player-behavior.js --vus 5 --duration 1m

# Standard test
k6 run k6-tests/player-behavior.js --vus 50 --duration 5m

# Heavy load
k6 run k6-tests/player-behavior.js --vus 200 --duration 15m

# With HTML report
k6 run k6-tests/player-behavior.js --out=html=results.html

# With environment variables
k6 run k6-tests/spike-load.js \
  -e BASE_URL=https://kinquest.narcolepsy.ninja \
  --summary-export=summary.json
```

## Test Profiles

### Development (Quick Feedback Loop)
```bash
# 1-2 minutes total
npm run test:k6:smoke
```
**Use for**: Rapid iteration, quick validation

### Integration (Before Commit)
```bash
# 15 minutes total
npm run test:k6:player
npm run test:k6:admin
```
**Use for**: Pre-commit testing, catching basic issues

### Pre-Production (Before Deployment)
```bash
# 30+ minutes total
npm run test:k6:all
```
**Use for**: Full validation, establish baselines

### Continuous (Regular Monitoring)
```bash
# Daily/Weekly scheduled
k6 run k6-tests/endurance.js -e VU_COUNT=50 -e TEST_DURATION=30m
```
**Use for**: Monitoring performance over time, catching regressions

## Monitoring During Tests

### Terminal 1: Run K6 Test
```bash
npm run test:k6:player
```

### Terminal 2: Watch Application Logs
```bash
docker compose logs -f app
```

### Terminal 3: Monitor System Resources
```bash
# macOS
top -l 1

# Linux
top

# Or use htop for better visualization
htop
```

### Terminal 4: Monitor Database
```bash
docker compose exec -T db psql -U postgres -d postgres -c \
  "SELECT pid, usename, state, wait_event, query FROM pg_stat_activity \
   WHERE state != 'idle' ORDER BY query_start DESC;"
```

## Expected Results

### Good Performance
```
http_reqs....................: 5000 27.5/s
http_req_duration............: avg=150ms p(95)=350ms p(99)=500ms
http_req_failed..............: 0.0%
```

### Acceptable Performance
```
http_reqs....................: 4500 25.2/s
http_req_duration............: avg=210ms p(95)=450ms p(99)=800ms
http_req_failed..............: 0.8%
```

### Needs Optimization
```
http_reqs....................: 3000 15.0/s ← Low throughput
http_req_duration............: avg=650ms p(95)=1200ms p(99)=2000ms ← Slow
http_req_failed..............: 3.5% ← Too many errors
```

## Troubleshooting

### "Connection refused"
```bash
# Start backend
docker compose up -d
npm run dev

# Test backend is ready (requires Supabase to be configured)
curl https://kinquest.narcolepsy.ninja/api/game-state
```

### "Too many open files" (Linux)
```bash
ulimit -n 65536
npm run test:k6:player
```

### High error rates
1. Check application logs: `docker compose logs app`
2. Check database: `docker compose logs db`
3. Reduce VU count and duration
4. Check for timeouts in test configuration

### Slow response times
1. Check if database is running: `docker compose ps`
2. Monitor CPU/Memory: `top` or `htop`
3. Check for slow queries in database logs
4. Try with fewer VUs to baseline

## Environment Variables

Set before running tests:

```bash
export BASE_URL=https://kinquest.narcolepsy.ninja
export VU_COUNT=50
export TEST_DURATION=5m
export ADMIN_PASSWORD=mypassword
export RAMP_UP=5s

npm run test:k6:player
```

Or inline:
```bash
BASE_URL=http://api.example.com npm run test:k6:player
```

## Files in k6-tests/

```
k6-tests/
├── README.md                      # Detailed guide
├── QUICK_START.md                # This file
├── RESULTS_INTERPRETATION.md      # How to read results
├── run-tests.sh                  # Test runner script
├── player-behavior.js            # Main player behavior test
├── spike-load.js                 # Spike load test
├── endurance.js                  # Endurance test
├── admin-operations.js           # Admin operations test
└── chat-load.js                  # Chat load test
```

## Next Steps

1. **Run smoke test**: `npm run test:k6:smoke`
2. **Review README**: `cat k6-tests/README.md`
3. **Read results guide**: `cat k6-tests/RESULTS_INTERPRETATION.md`
4. **Run full suite**: `npm run test:k6:all`
5. **Analyze bottlenecks** using RESULTS_INTERPRETATION.md

---

**Pro Tip**: Always run tests with production-like data volumes for most realistic results. The larger your dataset, the more realistic the performance metrics.
