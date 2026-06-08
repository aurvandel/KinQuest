# KinQuest Development Agents & Patterns

## About KinQuest

**KinQuest** is a family reunion scavenger hunt application that combines real-time AI-powered photo verification, GPS-based geofencing, live leaderboards, and interactive maps. The app enables families to collaborate on creative hunts with point rewards, category-based missions, and a built-in chat system. 

Key capabilities:
- Create and manage photo/GPS scavenger hunt missions
- Gemini AI verifies photo submissions in real-time
- Geofence challenges with configurable radius boundaries
- Live leaderboard with family member rankings
- WebSocket-powered chat for real-time communication
- Admin dashboard for game configuration and invite management
- Dual-database system: Supabase primary + local JSON fallback

---

This document outlines important patterns, conventions, and critical constraints for developers working on KinQuest.

## 🚨 CRITICAL: Database Schema Synchronization

**The most important rule: Local and Supabase database schemas MUST stay in sync.**

### Why This Matters

KinQuest uses **Supabase (PostgreSQL)** as the exclusive database backend. All data operations require Supabase connectivity.

Schema consistency is critical because all data structures must match the PostgreSQL schema defined in `supabase/init.sql`.

### Example: The createdBy Incident

When a field was added to TypeScript but not to Supabase:

1. ✅ **Added to TypeScript types** (`types.ts`): `createdBy?: string`
2. ❌ **FORGOT to add to Supabase schema**: No migration was run

**Result**: 
```
Supabase error: {
  code: 'PGRST204',
  message: "Column 'createdBy' of relation 'items' does not exist"
}
```

Without a fallback, the application would fail immediately, making the error obvious during development.

### How to Prevent This

**When adding a new field or table:**

1. **Update the SQL schema** (`supabase/init.sql`)
2. **Update TypeScript types** (`src/types.ts`)
3. **Update db-manager.ts** to handle the new field
4. **Run the migration immediately** on the running database:
   ```bash
   docker compose exec -T db psql -U postgres -d postgres -c "ALTER TABLE table_name ADD COLUMN column_name TYPE;"
   ```
5. **Test**: Ensure creation works with Supabase running

### Schema Verification Checklist

Before committing changes that touch data:

- [ ] New fields exist in `supabase/init.sql`
- [ ] New fields exist in `src/types.ts` (TypeScript)
- [ ] New fields handled in `db-manager.ts` (Supabase insert/select)
- [ ] Migration has been applied to the running database
- [ ] Tested with Supabase running

### Key Tables & Migration Points

**items (Scavenger Hunt Missions)**
- Local: `db.items[id]`
- Supabase: `items` table
- Critical fields: `id`, `title`, `description`, `points`, `category`, `icon`, `lat`, `lng`, `radius`, `created_by`
- Location: `db-manager.ts` (createScavengerChallenge)

**profiles (Users)**
- Local: `db.users[id]`
- Supabase: `profiles` table
- Location: `db-manager.ts` (authRegisterPlayer, updatePlayerProfile)

**submissions (Photo Proofs)**
- Local: `db.submissions[id]`
- Supabase: `submissions` table
- Location: `db-manager.ts` (submitHunterProof)

**messages (Chat)**
- Local: `db.messages[id]`
- Supabase: `messages` table
- Location: `db-manager.ts` (saveChatMessage)

## Database Layer Pattern

The `db-manager.ts` file implements a straightforward pattern:

```typescript
export async function createScavengerChallenge(
  item: Omit<ScavengerItem, "id">
): Promise<ScavengerItem> {
  // 1. Create object with new ID
  const newItem: ScavengerItem = {
    id: itemId,
    ...item
  };

  // 2. Insert to Supabase (include ONLY schema-matching fields)
  try {
    const row = {
      id: newItem.id,
      title: newItem.title,
      // ⚠️ IMPORTANT: Only include fields that exist in Supabase schema
      // Field names use snake_case in database, camelCase in objects
    };
    const { error } = await supabase!.from("items").insert(row);
    if (error) throw error;
    return newItem;
  } catch (err: any) {
    console.error("Failed to create item:", err);
    throw err; // Errors propagate - no fallback
  }
}
```

**Key principle**: Only include fields in the Supabase insert that exist in the schema. Field names must use snake_case for database columns and convert to camelCase in returned objects.

## API Layer Pattern

When creating new endpoints, follow this pattern:

```typescript
app.post("/api/challenges", async (req, res) => {
  const { title, description, points, category, icon, lat, lng, radius, createdBy } = req.body;

  if (!title || !description || !points) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const newItem = await createScavengerChallenge({
      title,
      description,
      points: Number(points) || 10,
      category: category || "General",
      icon: icon || "Sparkles",
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      radius: radius ? Number(radius) : null,
      createdBy: createdBy || undefined // Pass through to db layer
    });
    res.json(newItem);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save challenge", details: err.message });
  }
});
```

## Testing Database Changes

Always test with Supabase running:

```bash
# Start the full stack
docker compose up -d

# Run development server
npm run dev

# Create a mission - should save to Supabase
# Verify in Supabase Dashboard or check server logs for success
```

## Common Pitfalls

❌ **Adding field to TypeScript but not to Supabase schema**
- Application will crash with schema mismatch error

❌ **Inserting unsupported fields into Supabase**
- Causes immediate write failures that developers see during testing

❌ **Not running migrations on the running database**
- Schema in `init.sql` updates on fresh containers, but existing ones are out of sync

✅ **The Safe Approach**:
1. Update `init.sql` with the new column/table
2. Update TypeScript types in `types.ts`
3. Update `db-manager.ts` to include the field in Supabase operations
4. Run migration command on running database
5. Test creation with Supabase running

## Schema Change Process (Step-by-Step)

### Adding a new field to items table

1. **Update init.sql**:
   ```sql
   ALTER TABLE items ADD COLUMN created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL;
   CREATE INDEX idx_items_created_by ON items(created_by);
   ```

2. **Update types.ts**:
   ```typescript
   export interface ScavengerItem {
     // ... existing fields
     createdBy?: string; // New field
   }
   ```

3. **Update db-manager.ts** (local fallback):
   ```typescript
   const newItem: ScavengerItem = {
     // ... existing fields
     createdBy: item.createdBy
   };
   ```

4. **Update db-manager.ts** (Supabase insert):
   ```typescript
   const row = {
     // ... existing fields
     created_by: newItem.createdBy || null  // Note: snake_case in DB
   };
   ```

5. **Run migration on running database**:
   ```bash
   docker compose exec -T db psql -U postgres -d postgres -c \
     "ALTER TABLE items ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL;"
   ```

6. **Test**:
   - Create a mission with Supabase running
   - Stop Supabase, create another mission
   - Restart Supabase and verify both missions exist

## Key Files to Remember

| File | Purpose | Critical For |
|------|---------|--------------|
| `supabase/init.sql` | SQL schema definition | New tables/columns, indexes |
| `src/types.ts` | TypeScript interfaces | Type safety, all fields |
| `db-manager.ts` | Database layer | Supabase operations, schema alignment |
| `server.ts` | API endpoints | Request handling, validation |

## When to Add to Agents.md

Update this file when:
- Adding a new data model/table
- Creating a new critical pattern
- Discovering a schema sync issue
- Defining new constraints or rules

Do NOT update this file for:
- Bug fixes (unless they reveal a pattern flaw)
- Minor refactoring
- Feature flags or temporary workarounds

---

**Last Updated**: June 1, 2026  
**Critical Incident**: createdBy field sync issue - resolved with proper schema migration
