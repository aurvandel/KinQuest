# Claude AI Instructions for KinQuest Development

## Overview

You are assisting with development on **KinQuest**, a family reunion scavenger hunt application. Refer to [AGENTS.md](./AGENTS.md) for critical patterns and constraints.

## Critical Rule: Database Schema Synchronization ⚠️

**READ AGENTS.md FIRST**, specifically the "Database Schema Synchronization" section.

When making ANY changes that involve data structures:
1. **Check AGENTS.md** for the critical constraint
2. **Never add a field to TypeScript without updating Supabase schema**
3. **Always run migrations on running databases**
4. **Test both with Supabase up and down**

This is the #1 cause of bugs in KinQuest.

## Key Files & Their Purpose

From AGENTS.md's "Key Files to Remember" table:

| File | Purpose |
|------|---------|
| `supabase/init.sql` | SQL schema definition - update here first for new tables/columns |
| `src/types.ts` | TypeScript interfaces - update after init.sql |
| `db-manager.ts` | Database layer - implement both Supabase and local paths |
| `server.ts` | API endpoints - handle requests and delegate to db-manager |
| `db.json` | Local fallback database - verify data persists here |

## Standard Development Workflow

When implementing a new feature that touches data:

1. **Schema First**: Update `supabase/init.sql` with new tables/columns
2. **Types**: Update `src/types.ts` with TypeScript interfaces
3. **Database Layer**: Update `db-manager.ts` with create/read/update functions
4. **API Layer**: Add endpoints to `server.ts` that call db-manager functions
5. **UI Layer**: Create React components in `src/components/`
6. **Migrations**: Run `docker compose exec -T db psql -U postgres -d postgres -c "..."`
7. **Test**: Verify with Supabase running, then with it stopped

## Dual-Database System

KinQuest intelligently handles two storage systems:

- **Supabase (Primary)**: PostgreSQL database for production
- **Local Fallback**: `db.json` when Supabase is unavailable

The database layer in `db-manager.ts` implements this pattern:
- Try Supabase first
- On error, fall back to local storage
- Return the same object shape regardless of storage path
- Both paths must handle the same fields

See AGENTS.md "Database Layer Pattern" for code examples.

## Common Development Tasks

### Adding a new mission field
1. Add column to `supabase/init.sql`
2. Add to `ScavengerItem` interface in `src/types.ts`
3. Include in both local and Supabase paths in `db-manager.ts`
4. Run migration command
5. Test both storage paths

### Creating an admin feature
1. Add to `AdminSettingsModal.tsx`
2. Add state variables to `App.tsx`
3. Create API endpoint in `server.ts`
4. Update `db-manager.ts` if persisting data
5. Update `AGENTS.md` if establishing new patterns

### Adding user permissions
1. Add permission field to `profiles` table in `init.sql`
2. Update `PlayerProfile` interface in `types.ts`
3. Implement permission checks in API endpoints
4. Add UI toggles to `UserSettingsModal.tsx`

## Testing & Validation

```bash
# Full build to catch schema errors early
npm run build

# Test with Docker stack running
docker compose up -d
npm run dev

# Test with Supabase down
docker compose stop supabase-local-kong
# Should still work with local fallback

# Reset Docker stack (fresh schema)
docker compose down -v
docker compose up -d
```

## Code Patterns

### Database Function Pattern
```typescript
export async function createSomething(data: SomeData): Promise<SomeData> {
  // 1. Create object with ID
  const item: SomeData = { id: generateId(), ...data };
  
  // 2. Check database mode
  const mode = getDbMode();
  
  // 3. Try local if fallback mode
  if (mode === "local_fallback" || !supabase) {
    const db = loadLocalDb();
    db.collection[item.id] = item;
    saveLocalDb(db);
    return item;
  }
  
  // 4. Try Supabase
  try {
    const { error } = await supabase.from("table").insert({...});
    if (error) throw error;
    return item;
  } catch (err) {
    // 5. Fall back gracefully
    const db = loadLocalDb();
    db.collection[item.id] = item;
    saveLocalDb(db);
    return item;
  }
}
```

### API Endpoint Pattern
```typescript
app.post("/api/endpoint", async (req, res) => {
  const { field1, field2 } = req.body;
  
  if (!field1) {
    return res.status(400).json({ error: "Missing required field" });
  }
  
  try {
    const result = await dbFunction({ field1, field2 });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to complete operation", details: err.message });
  }
});
```

## Schema Change Checklist

Before committing schema changes:
- [ ] Field added to `supabase/init.sql`
- [ ] Field added to TypeScript interface in `src/types.ts`
- [ ] Field handled in `db-manager.ts` (local path)
- [ ] Field handled in `db-manager.ts` (Supabase path)
- [ ] Migration run: `docker compose exec -T db psql -U postgres -d postgres -c "..."`
- [ ] Tested creation with Supabase running
- [ ] Tested creation with Supabase stopped
- [ ] Data verified in both `db.json` and Supabase

## References

- **AGENTS.md**: Critical patterns and database schema rules
- **README.md**: Feature overview and setup instructions
- **src/types.ts**: All data structure definitions
- **db-manager.ts**: Database operation implementations
- **server.ts**: API endpoint definitions

## When to Update AGENTS.md

Update AGENTS.md when you:
- Add a new data model/table
- Create a new critical pattern
- Discover and resolve a schema sync issue
- Define new conventions for the team

Do NOT update for bug fixes, minor refactoring, or feature flags.

---

**Remember**: The golden rule is **database schema synchronization**. When in doubt, check AGENTS.md.
