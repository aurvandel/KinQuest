# Claude AI Instructions for KinQuest Development

## Overview

You are assisting with development on **KinQuest**, a family reunion scavenger hunt application. Refer to [AGENTS.md](./AGENTS.md) for critical patterns and constraints.

## Critical Rule: Database Schema Synchronization ⚠️

**READ AGENTS.md FIRST**, specifically the "Database Architecture" section.

When making ANY changes that involve data structures:
1. **Check AGENTS.md** for the schema patterns
2. **Always update Supabase schema first** (`supabase/init.sql`)
3. **Update TypeScript types** (`src/types.ts`) to match
4. **Always run migrations on running databases** to keep them in sync
5. **Use snake_case in SQL, camelCase in TypeScript**

This is the #1 cause of bugs in KinQuest.

## Key Files & Their Purpose

From AGENTS.md's "Key Files to Remember" table:

| File | Purpose |
|------|---------|
| `supabase/init.sql` | SQL schema definition - update here first for new tables/columns |
| `src/types.ts` | TypeScript interfaces - update after init.sql |
| `db-manager.ts` | Database operations - implement CRUD functions for Supabase |
| `server.ts` | API endpoints - handle requests and delegate to db-manager |

## Standard Development Workflow

When implementing a new feature that touches data:

1. **Schema First**: Update `supabase/init.sql` with new tables/columns
2. **Types**: Update `src/types.ts` with TypeScript interfaces
3. **Database Layer**: Update `db-manager.ts` with create/read/update functions
4. **API Layer**: Add endpoints to `server.ts` that call db-manager functions
5. **UI Layer**: Create React components in `src/components/`
6. **Migrations**: Run `docker compose exec -T db psql -U postgres -d postgres -c "..."`
7. **Test**: Verify with Supabase running

## Supabase Architecture

KinQuest uses **Supabase exclusively** for all data persistence. Data is stored in PostgreSQL and accessed via the Supabase client.

Key points:
- All data persists to Supabase
- No local fallback database
- TypeScript uses camelCase, Supabase uses snake_case
- Always convert field names when inserting/updating

See AGENTS.md "Database Function Pattern" for code examples.

## Common Development Tasks

### Adding a new mission field
1. Add column to `supabase/init.sql`
2. Add to `ScavengerItem` interface in `src/types.ts`
3. Update Supabase insert logic in `db-manager.ts` with snake_case field name
4. Run migration command
5. Test

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

# Query the database to verify data
docker compose exec -T db psql -U postgres -d postgres -c "SELECT * FROM items;"

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
  
  // 2. Prepare row for Supabase (convert to snake_case)
  const row = {
    id: item.id,
    field_name: item.fieldName,  // Note: snake_case
    // ... other fields
  };
  
  // 3. Insert into Supabase
  const { error } = await supabase!.from("table").insert(row);
  if (error) throw error;
  
  return item;  // Return with camelCase for frontend
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

## Field Name Conventions

**TypeScript/Frontend**: camelCase (e.g., `createdBy`, `userId`, `itemTitle`)
**Supabase/SQL**: snake_case (e.g., `created_by`, `user_id`, `item_title`)

Always convert when inserting/updating to Supabase:
```typescript
// Frontend object (camelCase)
const user = { createdAt: "2024-01-01", userId: "123" };

// Supabase row (snake_case)
const row = {
  created_at: user.createdAt,
  user_id: user.userId
};
```

## Schema Change Checklist

Before committing schema changes:
- [ ] Field added to `supabase/init.sql`
- [ ] Field added to TypeScript interface in `src/types.ts`
- [ ] Field handled in `db-manager.ts` (with snake_case conversion)
- [ ] Migration run: `docker compose exec -T db psql -U postgres -d postgres -c "..."`
- [ ] Tested creation with Supabase running
- [ ] Data verified in Supabase

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

**Remember**: The golden rule is **schema alignment**. When in doubt, check AGENTS.md.
