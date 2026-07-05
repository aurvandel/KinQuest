# K6 Load Test Results Interpretation Guide

This guide explains how to read and interpret k6 test results to identify performance bottlenecks and optimize your KinQuest deployment.

## Key Metrics Explained

### Response Time Metrics

```
http_req_duration....................: avg=245ms p(90)=450ms p(95)=600ms p(99)=1200ms
```

- **avg**: Average response time across all requests
- **p(90)**: 90th percentile - 90% of requests completed within this time
- **p(95)**: 95th percentile - Most requests should be faster than this
- **p(99)**: 99th percentile - Only 1% of requests are slower

**What to look for**:
- ✅ p(95) < 500ms for most endpoints
- ✅ p(99) < 1000ms acceptable for heavy operations
- ⚠️ avg climbing during test = memory leak or degradation
- ❌ p(95) > 1000ms = optimization needed

### Error Rates

```
http_req_failed....................: 1.23%
```

- Number of failed requests (4xx, 5xx status codes)

**What to look for**:
- ✅ < 1% for stable systems
- ✅ < 5% during spike tests acceptable
- ⚠️ > 5% during normal load = investigate failures
- ❌ > 10% = critical issue, immediate action needed

### Throughput

```
http_reqs....................: 45321 12.5/s
```

- Total requests and requests per second (RPS)

**What to look for**:
- Compare RPS against expected user load
- Monitor if RPS drops as test duration increases (degradation)
- Calculate per-VU throughput: Total RPS ÷ VU count

### Virtual Users (VUs)

```
vus..........................: 50
```

Active concurrent users during test. Should match configured stage values.

## Endpoint-Specific Metrics

K6 breaks down metrics by endpoint (tagged with `name`):

```
http_req_duration {name:Register}..................: avg=150ms
http_req_duration {name:Submission}................: avg=450ms
http_req_duration {name:ChatMessage}...............: avg=120ms
```

### Expected Performance by Endpoint

| Endpoint | Typical Response | Peak Load | Notes |
|----------|------------------|-----------|-------|
| Register | 100-200ms | 300-500ms | Database write |
| Get Game State | 50-100ms | 150-300ms | Simple query |
| Photo Submission | 400-800ms | 1-3s | Includes AI processing |
| Chat Message | 100-200ms | 300-500ms | WebSocket variant faster |
| Manual Approve | 200-300ms | 500-800ms | Database update |
| Update Settings | 150-250ms | 400-600ms | Admin operation |

## Reading Test Output

### Typical Ramp-Up Test

```
scenarios: (100.00%) 1 scenario, 50 max VUs, 10m30s total duration
  rampUp: 0 - 50 VUs in 5s over 1m0s (currently 25 VUs)
```

This shows we're halfway through ramp-up (25 of 50 VUs active).

### Real-Time Metrics During Test

```
✓ [0m-5s  http_req_duration: avg=245ms p(95)=450ms p(99)=900ms
✓ [5m-10s] http_req_duration: avg=248ms p(95)=460ms p(99)=920ms
✓ [10m-15s] http_req_duration: avg=250ms p(95)=470ms p(99)=950ms
```

- Stable metrics = healthy system
- Rising p(95) and p(99) = system approaching limits
- Sudden spikes = external factor (garbage collection, network issue)

## Common Performance Patterns

### Pattern 1: Expected - Stable Performance
```
[0m-2m]   avg=220ms p(95)=380ms
[2m-4m]   avg=225ms p(95)=390ms  ← Stable, healthy
[4m-6m]   avg=228ms p(95)=395ms
```
✅ System is handling load well. Can increase VU count safely.

### Pattern 2: Degradation - Memory Leak or Inefficiency
```
[0m-2m]   avg=200ms p(95)=350ms
[2m-4m]   avg=280ms p(95)=450ms
[4m-6m]   avg=400ms p(95)=650ms  ← Getting slower
[6m-8m]   avg=550ms p(95)=950ms
```
⚠️ Performance degrading with time. Likely:
- Memory leak in application
- Connection pool exhaustion
- Database query getting slower
- Disk space filling up

**Action**: Check server logs, memory usage, database connections during test.

### Pattern 3: Hard Ceiling - Resource Limit Hit
```
[0m-2m]   avg=200ms p(95)=350ms throughput=500 req/s
[2m-4m]   avg=210ms p(95)=360ms throughput=490 req/s  ← Throughput dropping
[4m-6m]   avg=520ms p(95)=980ms throughput=280 req/s
[6m-8m]   5.2% errors starting to appear
```
❌ System hit resource limit. Possible causes:
- CPU maxed out
- Database connection pool limit reached
- Memory limit causing swapping
- File descriptor limit

**Action**: 
1. Identify bottleneck (monitor CPU/Memory/DB connections)
2. Optimize slow queries or inefficient code
3. Increase resources if properly optimized
4. Consider horizontal scaling

### Pattern 4: Acceptable for Spike Test
```
Normal Load Phase:
[0m-2m]   throughput=300 req/s avg=250ms errors=0.2%

Spike Phase:
[2m-3m]   throughput=950 req/s avg=680ms errors=4.5%  ← Acceptable spike response
[3m-4m]   throughput=950 req/s avg=700ms errors=4.2%

Recovery Phase:
[4m-5m]   throughput=300 req/s avg=260ms errors=0.3%  ← Quick recovery
```
✅ System degrades gracefully under spike and recovers well.

## Threshold Violations

When k6 exits with non-zero status:
```
FAILED [...] ✗ [threshold exceeded] http_req_duration: p(95)=1200ms expected < 500ms
```

This means:
- 95th percentile response time was 1.2 seconds
- Configured threshold was 500ms
- Test failed to meet performance requirement

**Fix**:
1. Adjust threshold if realistic
2. Or optimize endpoint causing timeout
3. Or increase timeout for heavy operations (like AI processing)

## Comparing Test Runs

Create a baseline test:
```bash
# Run and save results
k6 run k6-tests/player-behavior.js --out=json=baseline.json
```

After changes:
```bash
# Run and compare
k6 run k6-tests/player-behavior.js --out=json=after-changes.json
```

Compare metrics:
```bash
# View baseline
cat baseline.json | grep 'http_req_duration' | tail -1

# View new results
cat after-changes.json | grep 'http_req_duration' | tail -1
```

## Database Specific Metrics to Monitor

During k6 tests, watch database metrics in parallel:

```bash
# In another terminal
docker compose exec -T db psql -U postgres -d postgres -c \
  "SELECT pid, usename, state, query FROM pg_stat_activity WHERE state != 'idle';"
```

Look for:
- Query count rising (queries backing up)
- Long-running queries (> 5s)
- Many idle connections (connection leak)
- High CPU usage on DB (unindexed queries)

## Gemini AI Processing Delays

Photo submission tests may show high latency:

```
http_req_duration {name:Submission}: avg=2500ms p(95)=3200ms
```

This is normal - includes:
- Image upload: 100-200ms
- Image processing/compression: 200-500ms
- Gemini API call: 1000-2000ms
- Database save: 100-200ms

Optimize by:
1. Reducing image resolution in tests if not needed
2. Implementing image caching
3. Using Gemini batch API for bulk processing
4. Async submission processing

## Interpreting Spike Test Results

Expected spike test metrics:

```
Normal Load (0-2m, 10 VUs):
  throughput: 300 req/s
  avg: 200ms
  errors: 0.1%

Spike Peak (2-3m, 100 VUs):
  throughput: 950 req/s ← 3x increase in requests
  avg: 580ms ← 2.9x increase in latency (acceptable)
  errors: 3.2% ← temporary increase acceptable

Recovery (3-4m, 10 VUs):
  throughput: 300 req/s ← back to normal
  avg: 210ms ← back to normal
  errors: 0.2% ← back to normal
```

✅ Good spike behavior: errors < 5%, recovery is quick, no cascading failures

❌ Bad spike behavior: errors > 10%, timeouts, slow recovery, cascading failures

## Taking Action on Results

### If avg latency > 300ms
1. Check which endpoint is slow
2. Profile slow endpoint (check database query time)
3. Add indexes to slow queries
4. Implement caching if appropriate

### If error rate > 1%
1. Check application error logs
2. Look for:
   - Database connection exhaustion
   - Timeout configurations too short
   - Memory issues causing crashes
   - Disk full errors

### If degradation over time
1. Check for memory leaks (top, /proc/PID/status)
2. Monitor file descriptors (lsof)
3. Check database connection pool
4. Look for accumulating data in logs/temp

### If throughput plateaus
1. Identify bottleneck:
   - CPU bound → optimize code or add indexing
   - I/O bound → increase disk speed or add caching
   - Memory bound → reduce working set size
   - Network bound → increase bandwidth or reduce payload

## Tools for Result Analysis

### Pretty print JSON results
```bash
k6 run k6-tests/player-behavior.js --out=json=results.json
cat results.json | jq '.metrics | keys'
```

### Extract specific metric
```bash
cat results.json | jq '.metrics.http_req_duration.values | sort'
```

### Generate HTML report
```bash
# Install html reporter
npm install -g @k6/html-reporter

# Run test and generate report
k6 run k6-tests/player-behavior.js --out=html=report.html
open report.html
```

---

**Remember**: The goal is not to pass arbitrary thresholds, but to understand your system's actual capacity and identify real bottlenecks. Use these metrics to make data-driven optimization decisions.
