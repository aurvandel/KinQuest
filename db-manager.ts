import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================
// Reunion and Configuration Types
// ============================================
export interface Reunion {
  id: string;
  name: string;
  adminId: string;
  inviteCode: string;
  inviteRequired: boolean;
  icon?: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
  defaultRadius?: number | null;
  aiPromptCriteria?: string;
  aiVerificationEnabled: boolean;
  allowForceSubmit: boolean;
  imageCompressionMaxDim: number;
  imageCompressionQuality: number;
  showTitle: boolean;
  showLogo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScavengerItem {
  createdBy: null;
  id: string;
  reunionId: string;
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
  reunionId: string;
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
  pointsAwarded: number;
  id: string;
  reunionId: string;
  userId: string;
  username: string;
  itemId: string;
  imageUrl: string;
  status: "pending" | "approved" | "rejected";
  aiExplanation?: string;
  forcedApproval?: boolean;
  createdAt: string;
  userLat?: number | null;
  userLng?: number | null;
  distanceMeters?: number | null;
  retryCount?: number; // Track retry attempts for rate-limited submissions
  retryReason?: "rate_limit" | "timeout" | "error"; // Reason why submission is pending
  nextRetryAt?: string; // ISO timestamp when next retry should occur
}

export interface ChatMessage {
  id: string;
  reunionId: string;
  senderId: string;
  senderName: string;
  receiverId: string | null; // null for public shoutbox, user_id string for private message
  text: string;
  createdAt: string;
  isDeleted?: boolean; // Marked for deletion by moderator
  deletedAt?: string; // When message was deleted
  deletedBy?: string; // Admin user ID who deleted it
  isRead?: boolean; // Whether the recipient has read this DM
}

export interface Slideshow {
  id: string;
  reunionId: string;
  title: string;
  description?: string;
  script: string;
  submissionIds: string[];
  createdBy: string; // Admin user ID who generated it
  createdAt: string;
  isPublished: boolean;
}

export interface DbStore {
  reunions: { [id: string]: Reunion };
  users: { [id: string]: PlayerProfile };
  items: { [id: string]: ScavengerItem };
  submissions: { [id: string]: Submission };
  messages: ChatMessage[];
  slideshows: { [id: string]: Slideshow };
}

// Default initial items (with placeholder reunionId - will be populated per reunion)
const DEFAULT_ITEMS: ScavengerItem[] = [
  {
      id: "item_gen_gap",
      reunionId: "",
      title: "Generation Gap Smiles",
      description: "Capture a heart-warming photo of two family members together: one from the oldest generation and one from the youngest generation smiling!",
      points: 100,
      category: "Family",
      icon: "Users",
      lat: null,
      lng: null,
      radius: null,
      createdBy: null
  },
  {
      id: "item_family_heirloom",
      reunionId: "",
      title: "Relic of the Elders",
      description: "Locate and photograph a treasured heirloom, a vintage black-and-white family photo, an ancient diary, or a handwritten recipe card.",
      points: 80,
      category: "History",
      icon: "Heart",
      lat: null,
      lng: null,
      radius: null,
      createdBy: null
  },
  {
      id: "item_cousins_selfie",
      reunionId: "",
      title: "The Multi-Clan Cousin Shot",
      description: "Take a group selfie with at least three cousins representing at least two different family branches or lineages!",
      points: 75,
      category: "Family",
      icon: "Camera",
      lat: null,
      lng: null,
      radius: null,
      createdBy: null
  },
  {
      id: "item_bbq_boss",
      reunionId: "",
      title: "The Grill Master / Feast Chief",
      description: "Snap an action shot of our champion family chef/grill master managing the food, serving beverages, or cutting the reunion cake!",
      points: 50,
      category: "Food",
      icon: "Flame",
      lat: null,
      lng: null,
      radius: null,
      createdBy: null
  },
  {
      id: "item_ uncanny_lookalikes",
      reunionId: "",
      title: "Uncanny Family Lookalikes",
      description: "Photograph two family members side-by-side who look amazingly alike! Let the AI referee judge the facial similarities.",
      points: 60,
      category: "Genetic",
      icon: "Laugh",
      lat: null,
      lng: null,
      radius: null,
      createdBy: null
  },
  {
      id: "item_retro_moves",
      reunionId: "",
      title: "Old School Cool",
      description: "Get an action photo of someone showing off a fun vintage dance move (disco point, hand jive, twist) or wearing a legendary retro outfit!",
      points: 70,
      category: "Entertainment",
      icon: "Music",
      lat: null,
      lng: null,
      radius: null,
      createdBy: null
  },
  {
      id: "item_group_hug",
      reunionId: "",
      title: "Group Hug Extravaganza",
      description: "A wide group hug or silly squad picture featuring at least 5 laughing relatives in a single shot!",
      points: 90,
      category: "Joy",
      icon: "Sparkles",
      lat: null,
      lng: null,
      radius: null,
      createdBy: null
  },
  {
      id: "item_reunion_recreation",
      reunionId: "",
      title: "Nature Walk Keepsake",
      description: "Find an attractive stone, pinecone, five-pointed leaf, or flower right outside our reunion headquarters venue.",
      points: 40,
      category: "Nature",
      icon: "Leaf",
      lat: 40.7829,
      lng: -73.9654,
      radius: 500,
      createdBy: null
  },
  {
      id: "item_family_mascot",
      reunionId: "",
      title: "Reunion Mascot/Pet",
      description: "Take a picture of any pet participating in the reunion, or a warm plush animal/toy brought by the children.",
      points: 45,
      category: "Animal",
      icon: "Footprints",
      lat: 40.7812,
      lng: -73.9665,
      radius: 1000,
      createdBy: null
  }
];

// Supabase client instance
// Note: File system fallback has been removed - app now relies exclusively on Supabase
let supabase: SupabaseClient | null = null;

// Initialize Supabase client if not already initialized
export function getDbMode(): "supabase" {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !key) {
    throw new Error(
      "Supabase configuration is required. Please set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) environment variables."
    );
  }

  if (!supabase) {
    supabase = createClient(url, key, {
      auth: { persistSession: false }
    });
  }
  return "supabase";
}

// ============================================
// Reunion Management Functions
// ============================================

export async function createReunion(data: Omit<Reunion, "id" | "createdAt" | "updatedAt">): Promise<Reunion> {
  const now = new Date().toISOString();
  const id = `reunion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const reunion: Reunion = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now
  };

  try {
    const { error } = await supabase!.from("reunions").insert({
      id: reunion.id,
      name: reunion.name,
      admin_id: reunion.adminId,
      invite_code: reunion.inviteCode,
      invite_required: reunion.inviteRequired,
      icon: reunion.icon || null,
      default_lat: reunion.defaultLat || null,
      default_lng: reunion.defaultLng || null,
      default_radius: reunion.defaultRadius || null,
      ai_prompt_criteria: reunion.aiPromptCriteria,
      ai_verification_enabled: reunion.aiVerificationEnabled,
      allow_force_submit: reunion.allowForceSubmit,
      image_compression_max_dim: reunion.imageCompressionMaxDim,
      image_compression_quality: reunion.imageCompressionQuality,
      show_title: reunion.showTitle,
      show_logo: reunion.showLogo,
      created_at: reunion.createdAt,
      updated_at: reunion.updatedAt
    });
    if (error) throw error;
    return reunion;
  } catch (err: any) {
    console.error("Failed to create reunion:", err);
    throw err;
  }
}

export async function getReunion(reunionId: string): Promise<Reunion | null> {
  try {
    const { data, error } = await supabase!
      .from("reunions")
      .select("*")
      .eq("id", reunionId)
      .single();
    
    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      adminId: data.admin_id,
      inviteCode: data.invite_code,
      inviteRequired: data.invite_required,
      icon: data.icon,
      defaultLat: data.default_lat,
      defaultLng: data.default_lng,
      defaultRadius: data.default_radius,
      aiPromptCriteria: data.ai_prompt_criteria,
      aiVerificationEnabled: data.ai_verification_enabled,
      allowForceSubmit: data.allow_force_submit,
      imageCompressionMaxDim: data.image_compression_max_dim,
      imageCompressionQuality: data.image_compression_quality,
      showTitle: data.show_title,
      showLogo: data.show_logo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (err: any) {
    console.error("Failed to get reunion:", err);
    throw err;
  }
}

export async function getReunionByInviteCode(inviteCode: string): Promise<Reunion | null> {
  try {
    const { data, error } = await supabase!
      .from("reunions")
      .select("*")
      .eq("invite_code", inviteCode.toLowerCase())
      .single();
    
    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      adminId: data.admin_id,
      inviteCode: data.invite_code,
      inviteRequired: data.invite_required,
      icon: data.icon,
      defaultLat: data.default_lat,
      defaultLng: data.default_lng,
      defaultRadius: data.default_radius,
      aiPromptCriteria: data.ai_prompt_criteria,
      aiVerificationEnabled: data.ai_verification_enabled,
      allowForceSubmit: data.allow_force_submit,
      imageCompressionMaxDim: data.image_compression_max_dim,
      imageCompressionQuality: data.image_compression_quality,
      showTitle: data.show_title,
      showLogo: data.show_logo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (err: any) {
    console.error("Failed to get reunion by invite code:", err);
    throw err;
  }
}

export async function getAllReunionsForAdmin(adminId: string): Promise<Reunion[]> {
  try {
    const { data, error } = await supabase!
      .from("reunions")
      .select("*")
      .eq("admin_id", adminId);
    
    if (error) throw error;
    if (!data) return [];

    return data.map(d => ({
      id: d.id,
      name: d.name,
      adminId: d.admin_id,
      inviteCode: d.invite_code,
      inviteRequired: d.invite_required,
      icon: d.icon,
      defaultLat: d.default_lat,
      defaultLng: d.default_lng,
      defaultRadius: d.default_radius,
      aiPromptCriteria: d.ai_prompt_criteria,
      aiVerificationEnabled: d.ai_verification_enabled,
      allowForceSubmit: d.allow_force_submit,
      imageCompressionMaxDim: d.image_compression_max_dim,
      imageCompressionQuality: d.image_compression_quality,
      showTitle: d.show_title,
      showLogo: d.show_logo,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));
  } catch (err: any) {
    console.error("Failed to get reunions for admin:", err);
    throw err;
  }
}

export async function updateReunion(reunionId: string, updates: Partial<Reunion>): Promise<Reunion | null> {
  try {
    const current = await getReunion(reunionId);
    if (!current) return null;

    const updated: Reunion = {
      ...current,
      ...updates,
      id: current.id, // Never allow ID change
      createdAt: current.createdAt, // Never allow createdAt change
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase!
      .from("reunions")
      .update({
        name: updated.name,
        invite_code: updated.inviteCode,
        invite_required: updated.inviteRequired,
        icon: updated.icon,
        default_lat: updated.defaultLat,
        default_lng: updated.defaultLng,
        default_radius: updated.defaultRadius,
        ai_prompt_criteria: updated.aiPromptCriteria,
        ai_verification_enabled: updated.aiVerificationEnabled,
        allow_force_submit: updated.allowForceSubmit,
        image_compression_max_dim: updated.imageCompressionMaxDim,
        image_compression_quality: updated.imageCompressionQuality,
        show_title: updated.showTitle,
        show_logo: updated.showLogo,
        updated_at: updated.updatedAt
      })
      .eq("id", reunionId);
    
    if (error) throw error;
    return updated;
  } catch (err: any) {
    console.error("Failed to update reunion:", err);
    throw err;
  }
}

export async function seedDefaultChallengesForReunion(reunionId: string): Promise<void> {
  try {
    const seedItems = DEFAULT_ITEMS.map((item) => ({
      id: `${item.id}_${reunionId}`,
      reunion_id: reunionId,
      title: item.title,
      description: item.description,
      points: item.points,
      category: item.category,
      icon: item.icon,
      lat: item.lat,
      lng: item.lng,
      radius: item.radius,
      created_by: null
    }));

    const { error } = await supabase!.from("items").insert(seedItems);
    if (error) throw error;
    console.log(`✅ Seeded ${seedItems.length} default challenges for reunion ${reunionId}`);
  } catch (err: any) {
    console.error("Failed to seed default challenges:", err);
    throw err;
  }
}

export async function deleteReunion(reunionId: string): Promise<boolean> {
  try {
    const { error } = await supabase!
      .from("reunions")
      .delete()
      .eq("id", reunionId);
    
    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Failed to delete reunion:", err);
    throw err;
  }
}

// ============================================
// Database initialization
// All data is persisted to Supabase only
export async function initializeDatabase() {
  getDbMode(); // Ensure Supabase client is initialized

  try {
    console.log("Checking Supabase connection and tables...");
    // Let's check if the table "items" has records
    const { data, error } = await supabase!.from("items").select("id").limit(1);
    
    if (error) {
      if (error.code === "42P01") {
        console.warn(
          "Supabase error: Relation (tables) do not exist yet. Please run the SQL initialization script in your Supabase Dashboard SQL Editor!"
        );
        return;
      }
      throw error;
    }

    // Seeding logic if items table is empty
    const { count, error: countErr } = await supabase!.from("items").select("id", { count: "exact", head: true });
    if (!countErr && count === 0) {
      console.log("Supabase challenge index is currently empty. Seeding defaults...");
      const defaultReunionId = "reunion_default";
      const mappedItems = DEFAULT_ITEMS.map(it => ({
        id: it.id,
        reunion_id: defaultReunionId,
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

    // Default reunion has been removed - admins must create all reunions explicitly

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
            reunion_id: "reunion_default",
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
    console.error("Supabase initialization error:", err);
    throw err;
  }
}

export async function getAppState(): Promise<DbStore> {
  try {
    // 1. Fetch profiles
    const { data: profiles, error: pErr } = await supabase!.from("profiles").select("*");
    if (pErr) throw pErr;

    // 2. Fetch items
    const { data: items, error: iErr } = await supabase!.from("items").select("*");
    if (iErr) throw iErr;

    // 3. Fetch submissions
    const { data: subs, error: sErr } = await supabase!.from("submissions").select("*");
    if (sErr) throw sErr;

    // 4. Fetch slideshows
    const { data: slides, error: slErr } = await supabase!.from("slideshows").select("*");
    if (slErr) throw slErr;

    // 5. Fetch reunions
    const { data: reunions, error: rErr } = await supabase!.from("reunions").select("*");
    if (rErr) throw rErr;

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
        reunionId: u.reunion_id || "",
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
        reunionId: it.reunion_id,
        title: it.title,
        description: it.description,
        points: it.points ?? 10,
        category: it.category ?? "General",
        icon: it.icon ?? "Sparkles",
        lat: it.lat,
        lng: it.lng,
        radius: it.radius,
        createdBy: it.created_by
      };
    });

    // Seed default items in itemsMap if they weren't in supabase table
    if (Object.keys(itemsMap).length === 0) {
      DEFAULT_ITEMS.forEach(it => {
        // Add reunionId from first reunion if available
        const itemWithReunion = { ...it, reunionId: reunions?.[0]?.id || "" };
        itemsMap[it.id] = itemWithReunion;
      });
    }

    const subsMap: { [id: string]: Submission } = {};
    subs?.forEach((sb: any) => {
      subsMap[sb.id] = {
        id: sb.id,
        reunionId: sb.reunion_id,
        userId: sb.user_id,
        username: sb.username,
        itemId: sb.item_id,
        imageUrl: sb.image_url,
        status: sb.status || "pending",
        aiExplanation: sb.ai_explanation,
        pointsAwarded: sb.points_awarded,
        createdAt: sb.created_at,
        userLat: sb.user_lat,
        userLng: sb.user_lng,
        distanceMeters: sb.distance_meters
      };
    });

    const msgsList = await getChatMessages();
    
    const slideshowsMap: { [id: string]: Slideshow } = {};
    slides?.forEach(slide => {
      slideshowsMap[slide.id] = {
        id: slide.id,
        reunionId: slide.reunion_id || "",
        title: slide.title,
        description: slide.description,
        script: slide.script,
        submissionIds: slide.submission_ids || [],
        createdBy: slide.created_by,
        createdAt: slide.created_at,
        isPublished: slide.is_published ?? false
      };
    });

    const reunionsMap: { [id: string]: Reunion } = {};
    reunions?.forEach(r => {
      reunionsMap[r.id] = {
        id: r.id,
        name: r.name,
        adminId: r.admin_id,
        inviteCode: r.invite_code,
        inviteRequired: r.invite_required ?? true,
        icon: r.icon,
        defaultLat: r.default_lat,
        defaultLng: r.default_lng,
        defaultRadius: r.default_radius,
        aiPromptCriteria: r.ai_prompt_criteria,
        aiVerificationEnabled: r.ai_verification_enabled ?? true,
        allowForceSubmit: r.allow_force_submit ?? false,
        imageCompressionMaxDim: r.image_compression_max_dim ?? 800,
        imageCompressionQuality: r.image_compression_quality ?? 0.7,
        showTitle: r.show_title ?? true,
        showLogo: r.show_logo ?? true,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });

    return {
      users: usersMap,
      items: itemsMap,
      submissions: subsMap,
      messages: msgsList,
      slideshows: slideshowsMap,
      reunions: reunionsMap
    };
  } catch (err) {
    console.error("Supabase fetch failure:", err);
    throw err;
  }
}

export async function authRegisterPlayer(
  username: string,
  registerRole?: "user" | "admin",
  reunionId?: string
): Promise<PlayerProfile> {
  const cleanName = username.trim();
  const isTargetAdmin = cleanName.toLowerCase() === "admin";
  // Use registerRole parameter if provided, otherwise default based on username
  const assignedRole = registerRole || (isTargetAdmin ? "admin" : "user");
  console.log("authRegisterPlayer:", { cleanName, registerRole, isTargetAdmin, assignedRole });

  try {
    // Look up user
    const { data: existing, error: findErr } = await supabase!
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

      const profileUpdates: { role?: "user" | "admin"; reunion_id?: string | null } = {};
      if (finalRole !== u.role) {
        profileUpdates.role = finalRole;
      }
      if (reunionId && reunionId !== u.reunion_id) {
        profileUpdates.reunion_id = reunionId;
      }
      if (Object.keys(profileUpdates).length > 0) {
        await supabase!.from("profiles").update(profileUpdates).eq("id", u.id);
      }

      return {
        id: u.id,
        username: u.username,
        displayName: u.display_name || u.displayName || undefined,
        reunionId: reunionId || u.reunion_id || "",
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
      reunion_id: reunionId || null,
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

    const { error: insErr } = await supabase!.from("profiles").insert(newUserRow);
    if (insErr) {
      console.warn("Supabase profile insert has custom columns issue, dropping them:", insErr);
      const baseRow = {
        id: uid,
        username: isTargetAdmin ? "admin" : cleanName,
        score: 0,
        completed_count: 0,
        created_at: new Date().toISOString()
      };
      await supabase!.from("profiles").insert(baseRow);
    }

    return {
      id: uid,
      username: isTargetAdmin ? "admin" : cleanName,
      displayName: isTargetAdmin ? "Grand Host Admin" : undefined,
      reunionId: reunionId || "",
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
    console.error("Supabase user register error:", err);
    throw err;
  }
}

export async function ensureProfileExists(userId: string, username: string): Promise<PlayerProfile> {
  try {
    // Check if profile exists by ID
    const { data: existing, error: findErr } = await supabase!
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .limit(1);

    if (findErr) throw findErr;

    // If profile exists, return it
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
      return {
        id: u.id,
        username: u.username,
        displayName: u.display_name || undefined,
        reunionId: u.reunion_id || "",
        score: u.score ?? 0,
        completedCount: u.completed_count ?? 0,
        createdAt: u.created_at,
        role: (u.role || "user") as "user" | "admin",
        permissions: parsedPerm
      };
    }

    // Create new profile
    const newUserRow = {
      id: userId,
      username: username.trim(),
      display_name: username.trim(),
      score: 0,
      completed_count: 0,
      created_at: new Date().toISOString(),
      role: "user",
      permissions: JSON.stringify({
        shareLocation: true,
        allowNotifications: true,
        makePrivate: false,
        extendedAiJudge: false
      })
    };

    const { error: insErr } = await supabase!.from("profiles").insert(newUserRow);
    if (insErr) {
      console.warn("Supabase profile insert error, trying minimal fields:", insErr);
      const baseRow = {
        id: userId,
        username: username.trim(),
        score: 0,
        completed_count: 0,
        created_at: new Date().toISOString()
      };
      await supabase!.from("profiles").insert(baseRow);
    }

    return {
      id: userId,
      username: username.trim(),
      displayName: username.trim(),
      reunionId: "",
      score: 0,
      completedCount: 0,
      createdAt: newUserRow.created_at,
      role: "user",
      permissions: {
        shareLocation: true,
        allowNotifications: true,
        makePrivate: false,
        extendedAiJudge: false
      }
    };
  } catch (err) {
    console.error("Error ensuring profile exists:", err);
    throw err;
  }
}

export async function createScavengerChallenge(item: Omit<ScavengerItem, "id">): Promise<ScavengerItem> {
  const itemId = `challenge_${Date.now()}`;
  const newItem: ScavengerItem = {
    id: itemId,
    reunionId: item.reunionId,
    title: item.title,
    description: item.description,
    points: item.points,
    category: item.category,
    icon: item.icon,
    lat: item.lat,
    lng: item.lng,
    radius: item.radius,
    createdBy: item.createdBy
  };

  try {
    const row = {
      id: itemId,
      reunion_id: newItem.reunionId,
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

    const { error } = await supabase!.from("items").insert(row);
    if (error) throw error;
    return newItem;
  } catch (err) {
    console.error("Supabase challenge write error:", err);
    throw err;
  }
}

export async function deleteScavengerChallenge(itemId: string): Promise<boolean> {
  try {
    // Delete associated submissions from Supabase first
    const { error: subErr } = await supabase!
      .from("submissions")
      .delete()
      .eq("item_id", itemId);
    
    if (subErr) throw subErr;

    // Delete the item
    const { error: itemErr } = await supabase!
      .from("items")
      .delete()
      .eq("id", itemId);
    
    if (itemErr) throw itemErr;
    return true;
  } catch (err) {
    console.error("Supabase deletion error:", err);
    throw err;
  }
}

export async function updateScavengerChallenge(
  itemId: string,
  updates: Partial<ScavengerItem>
): Promise<ScavengerItem | null> {
  try {
    const updateRow: any = {};
    if (updates.title !== undefined) updateRow.title = updates.title;
    if (updates.description !== undefined) updateRow.description = updates.description;
    if (updates.points !== undefined) updateRow.points = updates.points;
    if (updates.category !== undefined) updateRow.category = updates.category;
    if (updates.icon !== undefined) updateRow.icon = updates.icon;
    if (updates.lat !== undefined) updateRow.lat = updates.lat;
    if (updates.lng !== undefined) updateRow.lng = updates.lng;
    if (updates.radius !== undefined) updateRow.radius = updates.radius;

    const { data, error } = await supabase!
      .from("items")
      .update(updateRow)
      .eq("id", itemId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      reunionId: data.reunion_id,
      title: data.title,
      description: data.description,
      points: data.points ?? 10,
      category: data.category ?? "General",
      icon: data.icon ?? "Sparkles",
      lat: data.lat,
      lng: data.lng,
      radius: data.radius,
      createdBy: data.created_by
    };
  } catch (err) {
    console.error("Supabase update error:", err);
    throw err;
  }
}

export async function submitHunterProof(
  sub: Submission,
  incrementPoints: number
): Promise<Submission> {
  try {
    // 1. Save Submissions row
    const row = {
      id: sub.id,
      reunion_id: sub.reunionId,
      user_id: sub.userId,
      username: sub.username,
      item_id: sub.itemId,
      image_url: sub.imageUrl,
      status: sub.status,
      ai_explanation: sub.aiExplanation,
      points_awarded: sub.pointsAwarded ?? 0,
      created_at: sub.createdAt,
      user_lat: sub.userLat,
      user_lng: sub.userLng,
      distance_meters: sub.distanceMeters
    };

    const { error: sErr } = await supabase!.from("submissions").insert(row);
    if (sErr) throw sErr;

    // 2. Perform score increment if approved
    if (sub.status === "approved") {
      // Get current profile metrics
      const { data: prof, error: getErr } = await supabase!
        .from("profiles")
        .select("score, completed_count")
        .eq("id", sub.userId)
        .single();

      if (!getErr && prof) {
        const newScore = (prof.score ?? 0) + incrementPoints;
        const newCount = (prof.completed_count ?? 0) + 1;

        await supabase!
          .from("profiles")
          .update({ score: newScore, completed_count: newCount })
          .eq("id", sub.userId);
      }
    }

    return sub;
  } catch (err) {
    console.error("Supabase submission error:", err);
    throw err;
  }
}

export async function deleteHunterSubmission(subId: string): Promise<boolean> {
  try {
    // Read submission detail to resolve score deduction
    const { data: sub, error: getErr } = await supabase!
      .from("submissions")
      .select("*")
      .eq("id", subId)
      .single();

    if (getErr || !sub) return false;

    // Delete image file from disk if it exists and is not a base64 string
    if (sub.image_url && !sub.image_url.startsWith("data:")) {
      try {
        // Extract filename from URL (format: /api/uploads/{filename})
        const urlParts = sub.image_url.split("/");
        const filename = urlParts[urlParts.length - 1];
        
        if (filename) {
          const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
          const filePath = path.join(uploadsDir, filename);
          
          // Delete file if it exists
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted image file: ${filePath}`);
          }
        }
      } catch (fileErr) {
        console.warn(`Failed to delete image file for submission ${subId}:`, fileErr);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Deduct
    if (sub.status === "approved") {
      const { data: item } = await supabase!.from("items").select("points").eq("id", sub.item_id).single();
      const { data: prof } = await supabase!.from("profiles").select("score, completed_count").eq("id", sub.user_id).single();
      
      if (prof && item) {
        const newScore = Math.max(0, (prof.score ?? 0) - (item.points ?? 10));
        const newCount = Math.max(0, (prof.completed_count ?? 0) - 1);

        await supabase!
          .from("profiles")
          .update({ score: newScore, completed_count: newCount })
          .eq("id", sub.user_id);
      }
    }

    // Delete submission
    const { error: delErr } = await supabase!.from("submissions").delete().eq("id", subId);
    if (delErr) throw delErr;

    return true;
  } catch (err) {
    console.error("Supabase deletion error:", err);
    throw err;
  }
}

export async function manuallyApproveSubmission(
  subId: string,
  newStatus: "approved" | "rejected",
  points?: number
): Promise<Submission | null> {
  try {
    // Get current submission
    const { data: sub, error: getErr } = await supabase!
      .from("submissions")
      .select("*")
      .eq("id", subId)
      .single();

    if (getErr || !sub) return null;

    const oldStatus = sub.status;
    
    // Get item for points
    const { data: item } = await supabase!
      .from("items")
      .select("points")
      .eq("id", sub.item_id)
      .single();

    // Get current user profile
    const { data: prof } = await supabase!
      .from("profiles")
      .select("score, completed_count")
      .eq("id", sub.user_id)
      .single();

    // Update submission
    const updateData: any = { status: newStatus, forced_approval: true };
    if (points !== undefined && newStatus === "approved") {
      updateData.points_awarded = points;
    }
    const { error: updateErr } = await supabase!
      .from("submissions")
      .update(updateData)
      .eq("id", subId);

    if (updateErr) throw updateErr;

    // Handle score updates - use pointsAwarded if available
    if (item && prof) {
      let newScore = prof.score ?? 0;
      let newCount = prof.completed_count ?? 0;
      const pointsValue = sub.points_awarded ?? (item.points ?? 10);

      if (newStatus === "approved" && oldStatus !== "approved") {
        newScore += pointsValue;
        newCount += 1;
      } else if (newStatus !== "approved" && oldStatus === "approved") {
        newScore = Math.max(0, newScore - pointsValue);
        newCount = Math.max(0, newCount - 1);
      }

      await supabase!
        .from("profiles")
        .update({ score: newScore, completed_count: newCount })
        .eq("id", sub.user_id);
    }

    // Return updated submission
    return {
      id: sub.id,
      reunionId: sub.reunion_id || "",
      userId: sub.user_id,
      username: sub.username,
      itemId: sub.item_id,
      imageUrl: sub.image_url,
      status: newStatus,
      aiExplanation: sub.ai_explanation,
      pointsAwarded: points !== undefined ? points : sub.points_awarded,
      forcedApproval: true,
      createdAt: sub.created_at,
      userLat: sub.user_lat,
      userLng: sub.user_lng,
      distanceMeters: sub.distance_meters
    };
  } catch (err) {
    console.error("Supabase manual approval error:", err);
    throw err;
  }
}

export async function saveChatMessage(msg: ChatMessage): Promise<ChatMessage> {
  try {
    const row = {
      id: msg.id,
      reunion_id: msg.reunionId || null,
      sender_id: msg.senderId,
      sender_name: msg.senderName,
      receiver_id: msg.receiverId,
      text: msg.text,
      created_at: msg.createdAt,
      is_deleted: msg.isDeleted || false,
      deleted_at: msg.deletedAt || null,
      deleted_by: msg.deletedBy || null,
      is_read: msg.isRead || false
    };
    const { error } = await supabase!.from("messages").insert(row);
    if (error) {
      throw error;
    }
    return msg;
  } catch (err) {
    console.warn("Supabase message insert error:", err);
    throw err;
  }
}

export async function getChatMessages(reunionId?: string): Promise<ChatMessage[]> {
  try {
    let query = supabase!
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(400);

    if (reunionId) {
      query = query.eq("reunion_id", reunionId);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map(m => ({
      id: m.id,
      reunionId: m.reunion_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      receiverId: m.receiver_id,
      text: m.text,
      createdAt: m.created_at,
      isDeleted: m.is_deleted || false,
      deletedAt: m.deleted_at,
      deletedBy: m.deleted_by,
      isRead: m.is_read || false
    }));
  } catch (err) {
    console.warn("Supabase message retrieve error:", err);
    throw err;
  }
}

// Delete a message (admin only)
export async function deleteMessage(messageId: string, deleterId: string): Promise<boolean> {
  try {
    const { error } = await supabase!
      .from("messages")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: deleterId
      })
      .eq("id", messageId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("Failed to delete message:", err);
    throw err;
  }
}

// Mark messages as read
export async function markMessagesAsRead(messageIds: string[], userId: string, reunionId?: string): Promise<boolean> {
  try {
    let query: any = supabase!
      .from("messages")
      .update({ is_read: true })
      .in("id", messageIds);

    if (reunionId) {
      query = query.eq("reunion_id", reunionId);
    }

    const { error } = await query;
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("Failed to mark messages as read:", err);
    throw err;
  }
}

// Mute a user
export async function muteUser(userId: string, mutedUntil?: string): Promise<boolean> {
  try {
    const { error } = await supabase!
      .from("profiles")
      .update({
        is_muted: true,
        muted_until: mutedUntil || null
      })
      .eq("id", userId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("Failed to mute user:", err);
    throw err;
  }
}

// Unmute a user
export async function unmuteUser(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase!
      .from("profiles")
      .update({
        is_muted: false,
        muted_until: null
      })
      .eq("id", userId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("Failed to unmute user:", err);
    throw err;
  }
}

// Boot (kick) a user from the game
export async function bootUser(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase!
      .from("profiles")
      .update({
        is_booted: true,
        booted_at: new Date().toISOString()
      })
      .eq("id", userId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("Failed to boot user:", err);
    throw err;
  }
}

export async function saveSlideshow(slideshow: Slideshow): Promise<Slideshow> {
  try {
    // Save to Supabase
    const { error } = await supabase!
      .from("slideshows")
      .upsert([{
        id: slideshow.id,
        reunion_id: slideshow.reunionId,
        title: slideshow.title,
        description: slideshow.description,
        script: slideshow.script,
        submission_ids: slideshow.submissionIds,
        created_by: slideshow.createdBy,
        created_at: slideshow.createdAt,
        is_published: slideshow.isPublished
      }])
      .select();
    
    if (error) throw error;
    return slideshow;
  } catch (err) {
    console.error("Supabase slideshow save error:", err);
    throw err;
  }
}

export async function getSlideshow(id: string): Promise<Slideshow | null> {
  try {
    const { data, error } = await supabase!
      .from("slideshows")
      .select("*")
      .eq("id", id)
      .single();
    
    if (error) throw error;
    if (!data) return null;
    
    return {
      id: data.id,
      reunionId: data.reunion_id,
      title: data.title,
      description: data.description,
      script: data.script,
      submissionIds: data.submission_ids,
      createdBy: data.created_by,
      createdAt: data.created_at,
      isPublished: data.is_published
    };
  } catch (err) {
    console.warn("Supabase slideshow retrieve error:", err);
    throw err;
  }
}

export async function getAllSlideshows(reunionId?: string): Promise<Slideshow[]> {
  try {
    let query = supabase!
      .from("slideshows")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (reunionId) {
      query = query.eq("reunion_id", reunionId);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map(s => ({
      id: s.id,
      reunionId: s.reunion_id,
      title: s.title,
      description: s.description,
      script: s.script,
      submissionIds: s.submission_ids,
      createdBy: s.created_by,
      createdAt: s.created_at,
      isPublished: s.is_published
    }));
  } catch (err) {
    console.warn("Supabase slideshow retrieve error:", err);
    throw err;
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
  aiVerificationEnabled?: boolean;
  allowForceSubmit?: boolean;
  imageCompressionMaxDim?: number;
  imageCompressionQuality?: number;
  showTitle?: boolean;
  showLogo?: boolean;
}

const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

export function getAppSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return {
        name: parsed.name || "KinQuest",
        icon: parsed.icon || "/kinquest_logo.png",
        defaultLat: Number(parsed.defaultLat) || 41.9076,
        defaultLng: Number(parsed.defaultLng) || -111.3800,
        defaultRadius: Number(parsed.defaultRadius) || 200,
        aiPromptCriteria: parsed.aiPromptCriteria || "Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!",
        activeInviteCode: parsed.activeInviteCode || "stewart-test",
        inviteRequired: parsed.inviteRequired !== undefined ? !!parsed.inviteRequired : true,
        aiVerificationEnabled: parsed.aiVerificationEnabled !== undefined ? !!parsed.aiVerificationEnabled : true,
        allowForceSubmit: parsed.allowForceSubmit !== undefined ? !!parsed.allowForceSubmit : false,
        imageCompressionMaxDim: Number(parsed.imageCompressionMaxDim) || 800,
        imageCompressionQuality: Number(parsed.imageCompressionQuality) || 0.7,
        showTitle: parsed.showTitle !== undefined ? !!parsed.showTitle : true,
        showLogo: parsed.showLogo !== undefined ? !!parsed.showLogo : true
      };
    }
  } catch (err) {
    console.error("Failed to load app settings:", err);
  }
  return {
    name: "KinQuest",
    icon: "/kinquest_logo.png",
    defaultLat: 41.9076,
    defaultLng: -111.3800,
    defaultRadius: 2500,
    aiPromptCriteria: "Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!",
    activeInviteCode: "stewart-test",
    inviteRequired: true,
    aiVerificationEnabled: true,
    allowForceSubmit: false,
    imageCompressionMaxDim: 800,
    imageCompressionQuality: 0.7,
    showTitle: true,
    showLogo: true
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
  try {
    const serializedPermissions = updates.permissions ? JSON.stringify(updates.permissions) : undefined;
    const updRow: any = {};
    if (updates.displayName !== undefined) updRow.display_name = updates.displayName;
    if (updates.role !== undefined) updRow.role = updates.role;
    if (serializedPermissions !== undefined) updRow.permissions = serializedPermissions;

    if (Object.keys(updRow).length > 0) {
      const { data, error } = await supabase!
        .from("profiles")
        .update(updRow)
        .eq("id", userId)
        .select("*");
      
      if (error) {
        console.warn("Supabase profile update error:", error);
        throw error;
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
          reunionId: u.reunion_id || "",
          score: u.score ?? 0,
          completedCount: u.completed_count ?? 0,
          createdAt: u.created_at,
          role: u.role || undefined,
          permissions: parsedPerm
        };
      }
    }
    return null;
  } catch (err) {
    console.warn("Supabase profile update error:", err);
    throw err;
  }
}

