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
- Supabase-backed data persistence with PostgreSQL

---

This document outlines important patterns, conventions, and critical constraints for developers working on KinQuest.

## Database Architecture

KinQuest uses **Supabase exclusively** for all data persistence. All data is stored in PostgreSQL and accessed via the Supabase client.

### Schema Changes

**When adding a new field or table:**

1. **Update the SQL schema** (`supabase/init.sql`)
2. **Update TypeScript types** (`src/types.ts`)
3. **Update db-manager.ts** with new CRUD functions
4. **Run the migration immediately** on the running database:
   ```bash
   docker compose exec -T db psql -U postgres -d postgres -c "ALTER TABLE table_name ADD COLUMN column_name TYPE;"
   ```

### Schema Verification Checklist

Before committing changes that touch data:

- [ ] New fields exist in `supabase/init.sql`
- [ ] New fields exist in `src/types.ts` (TypeScript)
- [ ] Database functions in `db-manager.ts` handle the field
- [ ] Migration has been applied to the running database
- [ ] Tested with Supabase running

### Key Tables

**items (Scavenger Hunt Missions)**
- Supabase table: `items`
- Critical fields: `id`, `title`, `description`, `points`, `category`, `icon`, `lat`, `lng`, `radius`, `created_by`
- Location: [db-manager.ts](db-manager.ts) (createScavengerChallenge, updateScavengerChallenge, deleteScavengerChallenge)

**profiles (Users)**
- Supabase table: `profiles`
- Location: [db-manager.ts](db-manager.ts) (authRegisterPlayer, updatePlayerProfile)

**submissions (Photo Proofs)**
- Supabase table: `submissions`
- Location: [db-manager.ts](db-manager.ts) (submitHunterProof)

**messages (Chat)**
- Supabase table: `messages`
- Location: [db-manager.ts](db-manager.ts) (saveChatMessage)

**slideshows (Generated Slideshows)**
- Supabase table: `slideshows`
- Location: [db-manager.ts](db-manager.ts) (saveSlideshow, getSlideshow, getAllSlideshows)

## Database Function Pattern

The `db-manager.ts` file implements database operations that interact with Supabase:

```typescript
export async function createScavengerChallenge(
  item: Omit<ScavengerItem, "id">
): Promise<ScavengerItem> {
  // 1. Create object with new ID
  const newItem: ScavengerItem = {
    id: `challenge_${Date.now()}`,
    ...item
  };

  // 2. Prepare row for Supabase (snake_case field names)
  const row = {
    id: newItem.id,
    title: newItem.title,
    description: newItem.description,
    points: newItem.points,
    category: newItem.category,
    icon: newItem.icon,
    lat: newItem.lat,
    lng: newItem.lng,
    radius: newItem.radius,
    created_by: newItem.createdBy || null
  };

  // 3. Insert into Supabase
  const { error } = await supabase!.from("items").insert(row);
  if (error) throw error;
  
  return newItem;
}
```

**Key principle**: Field names in TypeScript use camelCase, but Supabase column names use snake_case. Always convert when inserting/updating.

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
      createdBy: createdBy || undefined
    });
    res.json(newItem);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save challenge", details: err.message });
  }
});
```

## Testing Database Changes

Test with Supabase running:

```bash
npm run dev
# Create a mission - should save to Supabase
# Query the database to verify data persisted
docker compose exec -T db psql -U postgres -d postgres -c "SELECT * FROM items;"
```

## Common Pitfalls

❌ **Adding field to TypeScript but not to Supabase schema**
- Will compile locally but fail at runtime when writing to database

❌ **Using camelCase field names in Supabase inserts**
- Supabase columns use snake_case, TypeScript uses camelCase
- Always convert: `createdBy` → `created_by`

❌ **Forgetting to run migration on running database**
- Schema in `init.sql` updates on fresh containers, but existing ones are out of sync
- Use `docker compose exec -T db psql` to apply migrations to live database

❌ **Not testing schema changes before committing**
- Always run fresh migrations to verify they work

✅ **The Safe Approach**:
1. Update `init.sql` first with new columns/tables
2. Update TypeScript types in `src/types.ts`
3. Update database functions in `db-manager.ts`
4. Run migration command on running database
5. Test with actual Supabase

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

3. **Update db-manager.ts** (Supabase insert/update):
   ```typescript
   const row = {
     // ... existing fields
     created_by: newItem.createdBy || null  // Note: snake_case in DB
   };
   const { error } = await supabase!.from("items").insert(row);
   ```

4. **Run migration on running database**:
   ```bash
   docker compose exec -T db psql -U postgres -d postgres -c \
     "ALTER TABLE items ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL;"
   ```

5. **Test**:
   - Create a mission with Supabase running
   - Verify it appears in the database: `docker compose exec -T db psql -U postgres -d postgres -c "SELECT created_by FROM items;"`

## Key Files to Remember

| File | Purpose | Critical For |
|------|---------|--------------|
| [supabase/init.sql](supabase/init.sql) | SQL schema definition | New tables/columns, indexes |
| [src/types.ts](src/types.ts) | TypeScript interfaces | Type safety, all fields |
| [db-manager.ts](db-manager.ts) | Database operations | CRUD functions for all tables |
| [server.ts](server.ts) | API endpoints | Request handling, validation |

## When to Update AGENTS.md

Update this file when:
- Adding a new data model/table
- Creating a new critical pattern
- Discovering a schema issue
- Defining new conventions for the team

Do NOT update for:
- Bug fixes (unless they reveal a pattern issue)
- Minor refactoring
- Feature flags or temporary workarounds

---

**Last Updated**: July 1, 2026  
**Current Status**: Supabase-only architecture (exclusive data persistence)
