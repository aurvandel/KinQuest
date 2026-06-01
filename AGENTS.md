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

KinQuest uses a **dual-database system**:
- **Primary**: Supabase (PostgreSQL) in production
- **Fallback**: Local JSON file (`db.json`) when Supabase is unavailable

The application gracefully falls back from Supabase to local storage, but **if schemas diverge, data corruption and sync issues will occur**.

### Example: The createdBy Incident

When we added mission creator tracking:

1. ✅ **Added to local schema** (`db.json`): `createdBy` field
2. ✅ **Added to TypeScript types** (`types.ts`): `createdBy?: string`
3. ❌ **FORGOT to add to Supabase schema**: No migration was run

**Result**: 
```
Supabase challenge write issue, saving locally: {
  code: 'PGRST204',
  message: "Column 'createdBy' of relation 'items' does not exist"
}
```

The app fell back to local storage but created an invisible sync gap.

### How to Prevent This

**When adding a new field or table:**

1. **Update the local schema first** (`db.json` structure)
2. **Update TypeScript types** (`src/types.ts`)
3. **Update the SQL schema** (`supabase/init.sql`)
4. **Run the migration immediately** on the running database:
   ```bash
   docker compose exec -T db psql -U postgres -d postgres -c "ALTER TABLE table_name ADD COLUMN column_name TYPE;"
   ```
5. **Test both paths**: Ensure creation works with and without Supabase running

### Schema Verification Checklist

Before committing changes that touch data:

- [ ] New fields exist in `supabase/init.sql`
- [ ] New fields exist in `db-manager.ts` (local fallback)
- [ ] New fields exist in `src/types.ts` (TypeScript)
- [ ] Both local and Supabase code paths handle the field
- [ ] Migration has been applied to the running database
- [ ] Tested mission creation with Supabase running
- [ ] Tested mission creation with Supabase down (local fallback)

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

The `db-manager.ts` file implements a robust pattern:

```typescript
export async function createScavengerChallenge(
  item: Omit<ScavengerItem, "id">
): Promise<ScavengerItem> {
  // 1. Create object with new ID
  const newItem: ScavengerItem = {
    id: itemId,
    ...item
  };

  // 2. Detect database mode
  const mode = getDbMode();

  // 3. Save to local as backup
  if (mode === "local_fallback" || !supabase) {
    const db = loadLocalDb();
    db.items[itemId] = newItem;
    saveLocalDb(db);
    return newItem;
  }

  // 4. Try Supabase (include ONLY schema-matching fields)
  try {
    const row = {
      id: newItem.id,
      title: newItem.title,
      // ⚠️ IMPORTANT: Only include fields that exist in Supabase schema
      // Do NOT include fields like 'createdBy' if they're not in the table
    };
    const { error } = await supabase.from("items").insert(row);
    if (error) throw error;
    return newItem; // Return full object with all fields
  } catch (err) {
    // 5. Fall back gracefully
    console.error("Supabase write issue, saving locally:", err);
    const db = loadLocalDb();
    db.items[itemId] = newItem;
    saveLocalDb(db);
    return newItem; // Return full object even though only local saved
  }
}
```

**Key principle**: The returned object can have more fields than what Supabase knows about (because local has them), but the Supabase insert must only include fields that exist in the schema.

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

Always test both code paths:

```bash
# Test with Supabase running
npm run dev
# Create a mission - should save to both Supabase and local

# Test with Supabase down
docker compose stop supabase-local-kong
npm run dev
# Create a mission - should save to local fallback only
docker compose start supabase-local-kong
# Verify mission appears after Supabase comes back up
```

## Common Pitfalls

❌ **Adding field to TypeScript but not to Supabase schema**
- Will work locally, break in production

❌ **Adding field to Supabase but not to local fallback**
- Will work with Supabase up, lose data when it's down

❌ **Inserting unsupported fields into Supabase**
- Causes silent failures that fall back to local (data inconsistency)

❌ **Not running migrations on the running database**
- Schema in `init.sql` updates on fresh containers, but existing ones are out of sync

✅ **The Safe Approach**:
1. Update all three: `init.sql`, `types.ts`, `db-manager.ts`
2. Run migration command
3. Test both with and without Supabase
4. Verify data in both storage systems

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
| `db-manager.ts` | Database layer | Both Supabase and local paths |
| `server.ts` | API endpoints | Request handling, validation |
| `db.json` | Local fallback database | Manual testing without Supabase |

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
