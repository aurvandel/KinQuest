import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface ScavengerItem {
  id: string;
  title: string;
  description: string;
  points: number;
  category: string;
  icon: string;
  lat: number | null;
  lng: number | null;
  radius: number | null;
}

export interface PlayerProfile {
  id: string;
  username: string;
  displayName?: string;
  score: number;
  completedCount: number;
  createdAt: string;
  role?: "user" | "admin";
  permissions?: {
    shareLocation?: boolean;
    allowNotifications?: boolean;
    makePrivate?: boolean;
    extendedAiJudge?: boolean;
  };
}

export interface Submission {
  id: string;
  userId: string;
  username: string;
  itemId: string;
  imageUrl: string;
  status: "pending" | "approved" | "rejected";
  aiExplanation?: string;
  createdAt: string;
  userLat?: number | null;
  userLng?: number | null;
  distanceMeters?: number | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string | null; // null for public shoutbox, user_id string for private message
  text: string;
  createdAt: string;
}

export interface DbStore {
  users: { [id: string]: PlayerProfile };
  items: { [id: string]: ScavengerItem };
  submissions: { [id: string]: Submission };
  messages: ChatMessage[];
}

// Default initial items
const DEFAULT_ITEMS: ScavengerItem[] = [
  {
    id: "item_gen_gap",
    title: "Generation Gap Smiles",
    description: "Capture a heart-warming photo of two family members together: one from the oldest generation and one from the youngest generation smiling!",
    points: 100,
    category: "Family",
    icon: "Users",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_family_heirloom",
    title: "Relic of the Elders",
    description: "Locate and photograph a treasured heirloom, a vintage black-and-white family photo, an ancient diary, or a handwritten recipe card.",
    points: 80,
    category: "History",
    icon: "Heart",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_cousins_selfie",
    title: "The Multi-Clan Cousin Shot",
    description: "Take a group selfie with at least three cousins representing at least two different family branches or lineages!",
    points: 75,
    category: "Family",
    icon: "Camera",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_bbq_boss",
    title: "The Grill Master / Feast Chief",
    description: "Snap an action shot of our champion family chef/grill master managing the food, serving beverages, or cutting the reunion cake!",
    points: 50,
    category: "Food",
    icon: "Flame",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_ uncanny_lookalikes",
    title: "Uncanny Family Lookalikes",
    description: "Photograph two family members side-by-side who look amazingly alike! Let the AI referee judge the facial similarities.",
    points: 60,
    category: "Genetic",
    icon: "Laugh",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_retro_moves",
    title: "Old School Cool",
    description: "Get an action photo of someone showing off a fun vintage dance move (disco point, hand jive, twist) or wearing a legendary retro outfit!",
    points: 70,
    category: "Entertainment",
    icon: "Music",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_group_hug",
    title: "Group Hug Extravaganza",
    description: "A wide group hug or silly squad picture featuring at least 5 laughing relatives in a single shot!",
    points: 90,
    category: "Joy",
    icon: "Sparkles",
    lat: null,
    lng: null,
    radius: null
  },
  {
    id: "item_reunion_recreation",
    title: "Nature Walk Keepsake",
    description: "Find an attractive stone, pinecone, five-pointed leaf, or flower right outside our reunion headquarters venue.",
    points: 40,
    category: "Nature",
    icon: "Leaf",
    lat: 40.7829,
    lng: -73.9654,
    radius: 500
  },
  {
    id: "item_family_mascot",
    title: "Reunion Mascot/Pet",
    description: "Take a picture of any pet participating in the reunion, or a warm plush animal/toy brought by the children.",
    points: 45,
    category: "Animal",
    icon: "Footprints",
    lat: 40.7812,
    lng: -73.9665,
    radius: 1000
  }
];

const DB_FILE = path.join(process.cwd(), "db.json");

// Dynamic state tracker for external reporting in frontend
export let databaseMode: "supabase" | "local_fallback" = "local_fallback";
export let supabaseErrorDescription: string | null = null;

let supabase: SupabaseClient | null = null;

// Initialize connection logic lazily
export function getDbMode() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (url && key) {
    if (!supabase) {
      try {
        supabase = createClient(url, key, {
          auth: { persistSession: false }
        });
        databaseMode = "supabase";
        supabaseErrorDescription = null;
      } catch (err: any) {
        console.error("Failed to construct Supabase Client:", err);
        databaseMode = "local_fallback";
        supabaseErrorDescription = `Invalid configuration arguments: ${err.message}`;
      }
    } else {
      databaseMode = "supabase";
    }
  } else {
    databaseMode = "local_fallback";
  }
  return databaseMode;
}

// ----------------------------------------------------
// File-based Storage engine (Dynamic Local Fallback)
// ----------------------------------------------------
function loadLocalDb(): DbStore {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(content) as DbStore;
      if (!parsed.users) parsed.users = {};

      const adminId = "user_admin";
      if (!parsed.users[adminId]) {
        parsed.users[adminId] = {
          id: adminId,
          username: "admin",
          displayName: "Grand Host Admin",
          score: 0,
          completedCount: 0,
          createdAt: new Date().toISOString(),
          role: "admin",
          permissions: {
            shareLocation: true,
            allowNotifications: true,
            makePrivate: false,
            extendedAiJudge: true
          }
        };
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), "utf-8");
        } catch (e) {
          console.error("Failed writing seeded local file db:", e);
        }
      }

      if (!parsed.items || Object.keys(parsed.items).length === 0) {
        parsed.items = {};
        DEFAULT_ITEMS.forEach(it => {
          parsed.items[it.id] = it;
        });
      }
      if (!parsed.submissions) parsed.submissions = {};
      if (!parsed.messages) parsed.messages = [];
      return parsed;
    }
  } catch (err) {
    console.error("Failed to load local fallback db.json, generating default templates.", err);
  }

  const initialItems: { [id: string]: ScavengerItem } = {};
  DEFAULT_ITEMS.forEach(it => {
    initialItems[it.id] = it;
  });

  const empty: DbStore = {
    users: {
      "user_admin": {
        id: "user_admin",
        username: "admin",
        displayName: "Grand Host Admin",
        score: 0,
        completedCount: 0,
        createdAt: new Date().toISOString(),
        role: "admin",
        permissions: {
          shareLocation: true,
          allowNotifications: true,
          makePrivate: false,
          extendedAiJudge: true
        }
      }
    },
    items: initialItems,
    submissions: {},
    messages: []
  };
  saveLocalDb(empty);
  return empty;
}

function saveLocalDb(store: DbStore) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed writing to local file db:", err);
  }
}

// ----------------------------------------------------
// Dynamic DB manager Hub API
// ----------------------------------------------------

export async function initializeDatabase() {
  const mode = getDbMode();
  if (mode === "local_fallback") {
    console.log("Database initialized: LOCAL FILE FALLBACK mode active.");
    return;
  }

  try {
    console.log("Checking Supabase connection and tables...");
    // Let's check if the table "items" has records, if it fails, throw table-not-found error gracefully
    const { data, error } = await supabase!.from("items").select("id").limit(1);
    
    if (error) {
      if (error.code === "42P01") {
        databaseMode = "local_fallback";
        supabaseErrorDescription = "Relation (tables) do not exist yet. Please run the SQL initialization script in your Supabase Dashboard SQL Editor!";
        console.warn("Supabase check alert:", supabaseErrorDescription);
        return;
      }
      throw error;
    }

    // Seeding logic if items table is empty
    const { count, error: countErr } = await supabase!.from("items").select("id", { count: "exact", head: true });
    if (!countErr && count === 0) {
      console.log("Supabase challenge index is currently empty. Seeding defaults...");
      const mappedItems = DEFAULT_ITEMS.map(it => ({
        id: it.id,
        title: it.title,
        description: it.description,
        points: it.points,
        category: it.category,
        icon: it.icon,
        lat: it.lat,
        lng: it.lng,
        radius: it.radius
      }));
      await supabase!.from("items").insert(mappedItems);
    }

    // Pre-seed default admin profiles if missing
    try {
      const { data: adminExists } = await supabase!
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1);

      if (!adminExists || adminExists.length === 0) {
        const { data: adminUserCheck } = await supabase!
          .from("profiles")
          .select("id")
          .ilike("username", "admin")
          .limit(1);

        if (!adminUserCheck || adminUserCheck.length === 0) {
          console.log("Pre-seeding one initial admin in Supabase...");
          const adminRow = {
            id: "user_admin",
            username: "admin",
            display_name: "Grand Host Admin",
            role: "admin",
            score: 0,
            completed_count: 0,
            created_at: new Date().toISOString(),
            permissions: JSON.stringify({
              shareLocation: true,
              allowNotifications: true,
              makePrivate: false,
              extendedAiJudge: true
            })
          };
          await supabase!.from("profiles").insert(adminRow);
        }
      }
    } catch (profileSeedErr) {
      console.warn("Could not pre-seed profile admin in Supabase (possibly migration in progress):", profileSeedErr);
    }
    
    console.log("Supabase successfully initialized, hydrated, and active!");
  } catch (err: any) {
    console.error("Supabase live diagnostic fail. Falling back gracefully to local file storage. Error:", err);
    databaseMode = "local_fallback";
    supabaseErrorDescription = `Connection or query error: ${err.message || JSON.stringify(err)}`;
  }
}

export async function getAppState(): Promise<DbStore> {
  const mode = getDbMode();
  if (mode === "local_fallback" || !supabase) {
    return loadLocalDb();
  }

  try {
    // 1. Fetch profiles
    const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
    if (pErr) throw pErr;

    // 2. Fetch items
    const { data: items, error: iErr } = await supabase.from("items").select("*");
    if (iErr) throw iErr;

    // 3. Fetch submissions
    const { data: subs, error: sErr } = await supabase.from("submissions").select("*");
    if (sErr) throw sErr;

    // Map into DbStore JSON layout
    const usersMap: { [id: string]: PlayerProfile } = {};
    profiles?.forEach(u => {
      let parsedPerm = undefined;
      if (u.permissions) {
        if (typeof u.permissions === "string") {
          try {
            parsedPerm = JSON.parse(u.permissions);
          } catch {
            parsedPerm = undefined;
          }
        } else {
          parsedPerm = u.permissions;
        }
      }
      usersMap[u.id] = {
        id: u.id,
        username: u.username,
        displayName: u.display_name || u.displayName || undefined,
        score: u.score ?? 0,
        completedCount: u.completed_count ?? 0,
        createdAt: u.created_at,
        role: u.role || undefined,
        permissions: parsedPerm
      };
    });

    const itemsMap: { [id: string]: ScavengerItem } = {};
    items?.forEach(it => {
      itemsMap[it.id] = {
        id: it.id,
        title: it.title,
        description: it.description,
        points: it.points ?? 10,
        category: it.category ?? "General",
        icon: it.icon ?? "Sparkles",
        lat: it.lat,
        lng: it.lng,
        radius: it.radius
      };
    });

    // Seed default items in itemsMap if they weren't in supabase table
    if (Object.keys(itemsMap).length === 0) {
      DEFAULT_ITEMS.forEach(it => {
        itemsMap[it.id] = it;
      });
    }

    const subsMap: { [id: string]: Submission } = {};
    subs?.forEach(sb => {
      subsMap[sb.id] = {
        id: sb.id,
        userId: sb.user_id,
        username: sb.username,
        itemId: sb.item_id,
        imageUrl: sb.image_url,
        status: sb.status || "pending",
        aiExplanation: sb.ai_explanation,
        createdAt: sb.created_at,
        userLat: sb.user_lat,
        userLng: sb.user_lng,
        distanceMeters: sb.distance_meters
      };
    });

    const msgsList = await getChatMessages();

    return {
      users: usersMap,
      items: itemsMap,
      submissions: subsMap,
      messages: msgsList
    };
  } catch (err) {
    console.error("Supabase fetch failure, fall back dynamically to cached local storage:", err);
    // Dynamic runtime fallback so live gameplay never halts!
    databaseMode = "local_fallback";
    supabaseErrorDescription = "Supabase query crashed. Falling back to offline cache!";
    return loadLocalDb();
  }
}

export async function authRegisterPlayer(username: string, registerRole?: "user" | "admin"): Promise<PlayerProfile> {
  const mode = getDbMode();
  const cleanName = username.trim();
  const isTargetAdmin = cleanName.toLowerCase() === "admin";
  // Use registerRole parameter if provided, otherwise default based on username
  const assignedRole = registerRole || (isTargetAdmin ? "admin" : "user");
  console.log("authRegisterPlayer:", { cleanName, registerRole, isTargetAdmin, assignedRole, mode });

  if (mode === "local_fallback" || !supabase) {
    const db = loadLocalDb();
    let existingUser = Object.values(db.users).find(
      u => u.username.toLowerCase() === cleanName.toLowerCase()
    );

    if (existingUser) {
      if (existingUser.role !== assignedRole) {
        console.log("Updating existing user role:", { username: existingUser.username, oldRole: existingUser.role, newRole: assignedRole });
        existingUser.role = assignedRole;
        saveLocalDb(db);
      }
      console.log("Returning existing user:", { username: existingUser.username, role: existingUser.role });
      return existingUser;
    }

    const uid = isTargetAdmin ? "user_admin" : `user_${Math.floor(Math.random() * 899999 + 100000)}`;
    const newUser: PlayerProfile = {
      id: uid,
      username: isTargetAdmin ? "admin" : cleanName,
      displayName: isTargetAdmin ? "Grand Host Admin" : undefined,
      score: 0,
      completedCount: 0,
      createdAt: new Date().toISOString(),
      role: assignedRole,
      permissions: {
        shareLocation: true,
        allowNotifications: true,
        makePrivate: false,
        extendedAiJudge: isTargetAdmin
      }
    };
    db.users[uid] = newUser;
    saveLocalDb(db);
    return newUser;
  }

  try {
    // Look up user
    const { data: existing, error: findErr } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", cleanName)
      .limit(1);

    if (findErr) throw findErr;

    if (existing && existing.length > 0) {
      const u = existing[0];
      let parsedPerm = undefined;
      if (u.permissions) {
        if (typeof u.permissions === "string") {
          try { parsedPerm = JSON.parse(u.permissions); } catch { parsedPerm = undefined; }
        } else {
          parsedPerm = u.permissions;
        }
      }

      // Use registerRole parameter if provided, otherwise enforce based on username
      let finalRole = registerRole || assignedRole;
      // Special case: if username is "admin" and no explicit role given, force admin
      if (isTargetAdmin && !registerRole) {
        finalRole = "admin";
      }

      if (finalRole !== u.role) {
        await supabase.from("profiles").update({ role: finalRole }).eq("id", u.id);
      }

      return {
        id: u.id,
        username: u.username,
        displayName: u.display_name || u.displayName || undefined,
        score: u.score ?? 0,
        completedCount: u.completed_count ?? 0,
        createdAt: u.created_at,
        role: finalRole as "user" | "admin",
        permissions: parsedPerm
      };
    }

    // Register new user
    const uid = isTargetAdmin ? "user_admin" : `user_${Math.floor(Math.random() * 899999 + 100000)}`;
    const isAdminUser = assignedRole === "admin";
    const newUserRow = {
      id: uid,
      username: isTargetAdmin ? "admin" : cleanName,
      display_name: isTargetAdmin ? "Grand Host Admin" : cleanName,
      score: 0,
      completed_count: 0,
      created_at: new Date().toISOString(),
      role: assignedRole,
      permissions: JSON.stringify({
        shareLocation: true,
        allowNotifications: true,
        makePrivate: false,
        extendedAiJudge: isAdminUser
      })
    };

    const { error: insErr } = await supabase.from("profiles").insert(newUserRow);
    if (insErr) {
      console.warn("Supabase profile insert has custom columns issue, dropping them:", insErr);
      const baseRow = {
        id: uid,
        username: isTargetAdmin ? "admin" : cleanName,
        score: 0,
        completed_count: 0,
        created_at: new Date().toISOString()
      };
      await supabase.from("profiles").insert(baseRow);
    }

    return {
      id: uid,
      username: isTargetAdmin ? "admin" : cleanName,
      displayName: isTargetAdmin ? "Grand Host Admin" : undefined,
      score: 0,
      completedCount: 0,
      createdAt: newUserRow.created_at,
      role: assignedRole,
      permissions: {
        shareLocation: true,
        allowNotifications: true,
        makePrivate: false,
        extendedAiJudge: isAdminUser
      }
    };
  } catch (err) {
    console.error("Supabase user register crash, falling back to local storage:", err);
    const db = loadLocalDb();
    let existingUser = Object.values(db.users).find(
      u => u.username.toLowerCase() === cleanName.toLowerCase()
    );
    
    // If user exists and we have an explicit role to assign, update it
    if (existingUser) {
      if (registerRole && existingUser.role !== registerRole) {
        existingUser.role = registerRole;
        existingUser.permissions = existingUser.permissions || {};
        existingUser.permissions.extendedAiJudge = registerRole === "admin";
        saveLocalDb(db);
      }
      return existingUser;
    }

    const uid = isTargetAdmin ? "user_admin" : `user_cache_${Math.floor(Math.random() * 899999 + 100000)}`;
    const isAdminUser = assignedRole === "admin";
    const newUser: PlayerProfile = {
      id: uid,
      username: isTargetAdmin ? "admin" : cleanName,
      displayName: isTargetAdmin ? "Grand Host Admin" : undefined,
      score: 0,
      completedCount: 0,
      createdAt: new Date().toISOString(),
      role: assignedRole,
      permissions: {
        shareLocation: true,
        allowNotifications: true,
        makePrivate: false,
        extendedAiJudge: isAdminUser
      }
    };
    db.users[uid] = newUser;
    saveLocalDb(db);
    return newUser;
  }
}

export async function createScavengerChallenge(item: Omit<ScavengerItem, "id">): Promise<ScavengerItem> {
  const itemId = `challenge_${Date.now()}`;
  const newItem: ScavengerItem = {
    id: itemId,
    title: item.title,
    description: item.description,
    points: item.points,
    category: item.category,
    icon: item.icon,
    lat: item.lat,
    lng: item.lng,
    radius: item.radius
  };

  const mode = getDbMode();
  if (mode === "local_fallback" || !supabase) {
    const db = loadLocalDb();
    db.items[itemId] = newItem;
    saveLocalDb(db);
    return newItem;
  }

  try {
    const row = {
      id: itemId,
      title: newItem.title,
      description: newItem.description,
      points: newItem.points,
      category: newItem.category,
      icon: newItem.icon,
      lat: newItem.lat,
      lng: newItem.lng,
      radius: newItem.radius
    };

    const { error } = await supabase.from("items").insert(row);
    if (error) throw error;
    return newItem;
  } catch (err) {
    console.error("Supabase challenge write issue, saving locally:", err);
    const db = loadLocalDb();
    db.items[itemId] = newItem;
    saveLocalDb(db);
    return newItem;
  }
}

export async function submitHunterProof(
  sub: Submission,
  incrementPoints: number
): Promise<Submission> {
  const mode = getDbMode();
  if (mode === "local_fallback" || !supabase) {
    const db = loadLocalDb();
    db.submissions[sub.id] = sub;

    // Update player stats
    if (sub.status === "approved" && db.users[sub.userId]) {
      db.users[sub.userId].score += incrementPoints;
      db.users[sub.userId].completedCount += 1;
    }
    saveLocalDb(db);
    return sub;
  }

  try {
    // 1. Save Submissions row
    const row = {
      id: sub.id,
      user_id: sub.userId,
      username: sub.username,
      item_id: sub.itemId,
      image_url: sub.imageUrl,
      status: sub.status,
      ai_explanation: sub.aiExplanation,
      created_at: sub.createdAt,
      user_lat: sub.userLat,
      user_lng: sub.userLng,
      distance_meters: sub.distanceMeters
    };

    const { error: sErr } = await supabase.from("submissions").insert(row);
    if (sErr) throw sErr;

    // 2. Perform score increment if approved
    if (sub.status === "approved") {
      // Get current profile metrics
      const { data: prof, error: getErr } = await supabase
        .from("profiles")
        .select("score, completed_count")
        .eq("id", sub.userId)
        .single();

      if (!getErr && prof) {
        const newScore = (prof.score ?? 0) + incrementPoints;
        const newCount = (prof.completed_count ?? 0) + 1;

        await supabase
          .from("profiles")
          .update({ score: newScore, completed_count: newCount })
          .eq("id", sub.userId);
      }
    }

    return sub;
  } catch (err) {
    console.error("Supabase submission error, storing locally:", err);
    const db = loadLocalDb();
    db.submissions[sub.id] = sub;
    if (sub.status === "approved" && db.users[sub.userId]) {
      db.users[sub.userId].score += incrementPoints;
      db.users[sub.userId].completedCount += 1;
    }
    saveLocalDb(db);
    return sub;
  }
}

export async function deleteHunterSubmission(subId: string): Promise<boolean> {
  const mode = getDbMode();
  if (mode === "local_fallback" || !supabase) {
    const db = loadLocalDb();
    const submission = db.submissions[subId];
    if (!submission) return false;

    if (submission.status === "approved") {
      const user = db.users[submission.userId];
      const item = db.items[submission.itemId];
      if (user && item) {
        user.score = Math.max(0, user.score - item.points);
        user.completedCount = Math.max(0, user.completedCount - 1);
      }
    }

    delete db.submissions[subId];
    saveLocalDb(db);
    return true;
  }

  try {
    // Read submission detail to resolve score deduction
    const { data: sub, error: getErr } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", subId)
      .single();

    if (getErr || !sub) return false;

    // Deduct
    if (sub.status === "approved") {
      const { data: item } = await supabase.from("items").select("points").eq("id", sub.item_id).single();
      const { data: prof } = await supabase.from("profiles").select("score, completed_count").eq("id", sub.user_id).single();
      
      if (prof && item) {
        const newScore = Math.max(0, (prof.score ?? 0) - (item.points ?? 10));
        const newCount = Math.max(0, (prof.completed_count ?? 0) - 1);

        await supabase
          .from("profiles")
          .update({ score: newScore, completed_count: newCount })
          .eq("id", sub.user_id);
      }
    }

    // Delete submission
    const { error: delErr } = await supabase.from("submissions").delete().eq("id", subId);
    if (delErr) throw delErr;

    return true;
  } catch (err) {
    console.error("Supabase deletion crash, processing locally:", err);
    const db = loadLocalDb();
    const submission = db.submissions[subId];
    if (!submission) return false;

    if (submission.status === "approved") {
      const user = db.users[submission.userId];
      const item = db.items[submission.itemId];
      if (user && item) {
        user.score = Math.max(0, user.score - item.points);
        user.completedCount = Math.max(0, user.completedCount - 1);
      }
    }

    delete db.submissions[subId];
    saveLocalDb(db);
    return true;
  }
}

export async function saveChatMessage(msg: ChatMessage): Promise<ChatMessage> {
  const mode = getDbMode();
  if (mode === "local_fallback" || !supabase) {
    const db = loadLocalDb();
    db.messages.push(msg);
    if (db.messages.length > 400) {
      db.messages = db.messages.slice(-400);
    }
    saveLocalDb(db);
    return msg;
  }

  try {
    const row = {
      id: msg.id,
      sender_id: msg.senderId,
      sender_name: msg.senderName,
      receiver_id: msg.receiverId,
      text: msg.text,
      created_at: msg.createdAt
    };
    const { error } = await supabase.from("messages").insert(row);
    if (error) {
      // If table doesn't exist, just use fallback
      throw error;
    }
    return msg;
  } catch (err) {
    console.warn("Supabase message insert failed, fallback to local storage:", err);
    const db = loadLocalDb();
    db.messages.push(msg);
    if (db.messages.length > 400) {
      db.messages = db.messages.slice(-400);
    }
    saveLocalDb(db);
    return msg;
  }
}

export async function getChatMessages(): Promise<ChatMessage[]> {
  const mode = getDbMode();
  if (mode === "local_fallback" || !supabase) {
    const db = loadLocalDb();
    return db.messages || [];
  }

  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(400);
    if (error) throw error;
    
    return (data || []).map(m => ({
      id: m.id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      receiverId: m.receiver_id,
      text: m.text,
      createdAt: m.created_at
    }));
  } catch (err) {
    console.warn("Supabase message retrieve failed, fallback to local storage:", err);
    const db = loadLocalDb();
    return db.messages || [];
  }
}

export interface AppSettings {
  name: string;
  icon: string | null;
  defaultLat?: number;
  defaultLng?: number;
  defaultRadius?: number;
  aiPromptCriteria?: string;
  activeInviteCode?: string;
  inviteRequired?: boolean;
}

const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

export function getAppSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return {
        name: parsed.name || "KinQuest",
        icon: parsed.icon || null,
        defaultLat: Number(parsed.defaultLat) || 40.7850,
        defaultLng: Number(parsed.defaultLng) || -73.9682,
        defaultRadius: Number(parsed.defaultRadius) || 500,
        aiPromptCriteria: parsed.aiPromptCriteria || "Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!",
        activeInviteCode: parsed.activeInviteCode || "reunion-2026",
        inviteRequired: parsed.inviteRequired !== undefined ? !!parsed.inviteRequired : true
      };
    }
  } catch (err) {
    console.error("Failed to load app settings:", err);
  }
  return {
    name: "KinQuest",
    icon: null,
    defaultLat: 40.7850,
    defaultLng: -73.9682,
    defaultRadius: 500,
    aiPromptCriteria: "Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!",
    activeInviteCode: "reunion-2026",
    inviteRequired: true
  };
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save app settings:", err);
  }
}

export async function updatePlayerProfile(
  userId: string,
  updates: {
    displayName?: string;
    role?: "user" | "admin";
    permissions?: {
      shareLocation?: boolean;
      allowNotifications?: boolean;
      makePrivate?: boolean;
      extendedAiJudge?: boolean;
    };
  }
): Promise<PlayerProfile | null> {
  const db = loadLocalDb();
  let user = db.users[userId];
  
  if (user) {
    if (updates.displayName !== undefined) user.displayName = updates.displayName;
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.permissions !== undefined) user.permissions = updates.permissions;
    saveLocalDb(db);
  }

  const mode = getDbMode();
  if (mode === "local_fallback" || !supabase) {
    return user || null;
  }

  try {
    const serializedPermissions = updates.permissions ? JSON.stringify(updates.permissions) : undefined;
    const updRow: any = {};
    if (updates.displayName !== undefined) updRow.display_name = updates.displayName;
    if (updates.role !== undefined) updRow.role = updates.role;
    if (serializedPermissions !== undefined) updRow.permissions = serializedPermissions;

    if (Object.keys(updRow).length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .update(updRow)
        .eq("id", userId)
        .select("*");
      
      if (error) {
        console.warn("Supabase profile update warning / col may be missing:", error);
      } else if (data && data.length > 0) {
        const u = data[0];
        let parsedPerm = undefined;
        if (u.permissions) {
          if (typeof u.permissions === "string") {
            try { parsedPerm = JSON.parse(u.permissions); } catch { parsedPerm = undefined; }
          } else {
            parsedPerm = u.permissions;
          }
        }
        return {
          id: u.id,
          username: u.username,
          displayName: u.display_name || u.displayName || undefined,
          score: u.score ?? 0,
          completedCount: u.completed_count ?? 0,
          createdAt: u.created_at,
          role: u.role || undefined,
          permissions: parsedPerm
        };
      }
    }
  } catch (err) {
    console.warn("Catch-all profile update warning:", err);
  }
  return user || null;
}

