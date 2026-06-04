# K6 Test Data Cleanup

After running k6 stress tests, test data (users, submissions, chat messages, uploaded images) persists in the database and file system. This guide explains how to clean up.

## Cleanup Scope

### ✅ Automatically Cleaned

The cleanup script removes all test data from **Supabase** (self-hosted in Docker):
- ✅ Test user records
- ✅ Test submissions  
- ✅ Test chat messages  
- ✅ Challenges created by test users  
- ✅ Admin settings (reset to defaults)
- ✅ Uploaded files

### Option 1: Selective Cleanup (Remove Test Data Only)
```bash
npm run test:k6:cleanup
# or
bash k6-tests/cleanup.sh
```

**What it does:**
- Removes users created with test prefixes (`player_*`, `spike_*`, `chattester_*`, `endurance_*`, `testplayer*`)
- Removes challenges created by test users
- Removes submissions from test users
- Removes chat messages from test users
- Resets admin settings to defaults (clears any test configuration changes)
- Clears the `uploads/` directory
- Keeps production data intact

**Use this when:** You want to rerun tests without accumulating old data

### Option 2: Full Reset (Complete Database Reset)
```bash
npm run test:k6:cleanup-full
# or
bash k6-tests/cleanup.sh full
```

**What it does:**
- Stops Docker Compose stack
- Removes all database volumes (fresh database)
- Clears `uploads/` directory
- Restarts Docker Compose with a clean database

**Use this when:**
- You want a completely fresh environment
- You accidentally broke something during testing
- You're starting over from scratch

## Cleanup Workflow Examples

### After Running a Single Test
```bash
# Run smoke test
npm run test:k6:smoke

# Clean up test data
npm run test:k6:cleanup

# Run another test
npm run test:k6:player
```

### After Running Full Test Suite
```bash
# Run all tests
npm run test:k6:all

# Clean up all test data
npm run test:k6:cleanup

# Or full reset if something went wrong
npm run test:k6:cleanup-full
```

### Continuous Testing Loop
```bash
# Start fresh
npm run test:k6:cleanup-full

# Run tests multiple times with cleanup between
for i in {1..3}; do
  echo "Test run $i"
  npm run test:k6:player
  npm run test:k6:cleanup
done
```

## What Gets Cleaned Up

### Selective Cleanup
| Item | Criteria | Storage |
|------|----------|---------|
| Users | Username pattern: `player_*`, `spike_*`, `chattester_*`, `endurance_*`, `testplayer*` | Database (profiles table) |
| Challenges | Created by test users | Database (items table) |
| Submissions | From test users | Database (submissions table) |
| Chat Messages | From test users | Database (messages table) || Admin Settings | Reset to defaults | `settings.json` file || Uploads | All files | `uploads/` directory |

### Full Reset
- All users
- All challenges
- All submissions
- All chat messages
- All admin settings
- All app settings
- All uploads
- Entire database is recreated fresh

## Verifying Cleanup

After cleanup, check statistics:

```bash
# View current database stats
docker compose exec -T db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) as users FROM profiles; 
   SELECT COUNT(*) as submissions FROM submissions;
   SELECT COUNT(*) as messages FROM messages;"
```

Or check file system:
```bash
# Should be empty or minimal
ls -la uploads/
```

## Manual Cleanup (Advanced)

If automated cleanup fails, you can manually clean up:

### Delete Specific Test Users
```bash
docker compose exec -T db psql -U postgres -d postgres -c \
  "DELETE FROM profiles WHERE username LIKE 'player_%';"
```

### Delete All Uploads
```bash
rm -rf uploads/*
```

### Full Database Reset
```bash
docker compose down -v
docker compose up -d
```

## Automated Cleanup in CI/CD

Add cleanup to your CI/CD pipeline:

### GitHub Actions Example
```yaml
- name: Cleanup Test Data
  if: always()  # Run even if tests fail
  run: npm run test:k6:cleanup
```

### GitLab CI Example
```yaml
cleanup_test_data:
  stage: cleanup
  script:
    - npm run test:k6:cleanup
  when: always  # Run even if tests fail
```

## Troubleshooting

### "Database container not running"
```bash
docker compose up -d
npm run test:k6:cleanup
```

### "Permission denied" on cleanup.sh
```bash
chmod +x k6-tests/cleanup.sh
npm run test:k6:cleanup
```

### Cleanup script fails with database error
Try full reset instead:
```bash
npm run test:k6:cleanup-full
```

## Best Practices

1. **Always cleanup after testing** - Prevents database bloat
2. **Use selective cleanup** - Preserves any real data
3. **Use full reset** - Between major test sessions
4. **Verify cleanup** - Check stats after cleanup
5. **Automate in CI/CD** - Add cleanup step to pipeline

---

## How It Works

Your KinQuest uses **self-hosted Supabase** with Docker:

```yaml
# docker-compose.yml
db:  # This is Supabase's PostgreSQL database
  image: postgres:15-alpine
  container_name: supabase-local-db
```

When you run `npm run test:k6:cleanup`, the script connects to this Supabase database and deletes all test data:

```bash
docker compose exec -T db psql -U postgres -d postgres -c \
  "DELETE FROM profiles WHERE username LIKE 'player_%' OR ...";
```

**Everything is automatic** - no manual Supabase Dashboard steps needed!
