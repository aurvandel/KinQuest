import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { WebSocket as NodeWebSocket } from "ws";
export interface ScavengerItem {
  createdBy: null;
  id: string;
  title: string;
  description: string;
  points: number;
  category: string;
  icon: string;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  enforceGeofence?: boolean;
}

// Inject ws as global WebSocket for Supabase Realtime on Node.js 20
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as any).WebSocket = NodeWebSocket;
}
export interface PlayerProfile {
  id: string;
  username: string;
  displayName?: string;
  score: number;
  completedCount: number;
  createdAt: string;
  role?: "user" | "admin";
  tutorialCompleted?: boolean;
  tutorialCompletedAt?: string | null;
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
  title: string;
  description?: string;
  script: string;
  submissionIds: string[];
  createdBy?: string | null; // Admin user ID who generated it
  createdAt: string;
  isPublished: boolean;
  isHidden: boolean;
  isDefaultExpanded: boolean;
}

export interface MissionSlideshowPlan {
  id: string;
  title: string;
  missionSlidesScript: string;
  renderPlan: Record<string, unknown> | null;
  missionCardPlans: Array<Record<string, unknown>>;
  missionCardImages: Array<Record<string, unknown>>;
  createdBy?: string | null;
  createdAt: string;
}

export interface DbStore {
  users: { [id: string]: PlayerProfile };
  items: { [id: string]: ScavengerItem };
  submissions: { [id: string]: Submission };
  messages: ChatMessage[];
  slideshows: { [id: string]: Slideshow };
}



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
    try {
      supabase = createClient(url, key, {
        auth: { persistSession: false }
      });
    } catch (err: any) {
      console.error("Failed to initialize Supabase with realtime:", err.message);
      // Try again without realtime
      console.error("Supabase WebSocket error - providing ws transport");
      supabase = createClient(url, key, {
        auth: { persistSession: false },
        realtime: {
          params: {
            eventsPerSecond: 0
          },
          transport: NodeWebSocket as any
        }
      });
    }
  }
  return "supabase";
}

// ----------------------------------------------------
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
    console.error("Supabase initialization error:", err);
    throw err;
  }
}

export async function getAppState(): Promise<DbStore> {
  try {
    // Ensure Supabase client is initialized
    if (!supabase) {
      getDbMode();
    }

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
        tutorialCompleted: u.tutorial_completed === true,
        tutorialCompletedAt: u.tutorial_completed_at || null,
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
        radius: it.radius,
        createdBy: it.created_by,
        enforceGeofence: it.enforce_geofence !== false
      };
    });

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
        title: slide.title,
        description: slide.description,
        script: slide.script,
        submissionIds: slide.submission_ids || [],
        createdBy: slide.created_by,
        createdAt: slide.created_at,
        isPublished: slide.is_published ?? false,
        isHidden: slide.is_hidden ?? false,
        isDefaultExpanded: slide.is_default_expanded ?? false
      };
    });

    return {
      users: usersMap,
      items: itemsMap,
      submissions: subsMap,
      messages: msgsList,
      slideshows: slideshowsMap
    };
  } catch (err) {
    console.error("Supabase fetch failure:", err);
    throw err;
  }
}

export async function authRegisterPlayer(username: string, registerRole?: "user" | "admin"): Promise<PlayerProfile> {
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

      if (finalRole !== u.role) {
        await supabase!.from("profiles").update({ role: finalRole }).eq("id", u.id);
      }

      return {
        id: u.id,
        username: u.username,
        displayName: u.display_name || u.displayName || undefined,
        score: u.score ?? 0,
        completedCount: u.completed_count ?? 0,
        createdAt: u.created_at,
        role: finalRole as "user" | "admin",
        tutorialCompleted: u.tutorial_completed === true,
        tutorialCompletedAt: u.tutorial_completed_at || null,
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
      tutorial_completed: false,
      tutorial_completed_at: null,
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
      score: 0,
      completedCount: 0,
      createdAt: newUserRow.created_at,
      role: assignedRole,
      tutorialCompleted: false,
      tutorialCompletedAt: null,
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
        score: u.score ?? 0,
        completedCount: u.completed_count ?? 0,
        createdAt: u.created_at,
        role: (u.role || "user") as "user" | "admin",
        tutorialCompleted: u.tutorial_completed === true,
        tutorialCompletedAt: u.tutorial_completed_at || null,
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
      tutorial_completed: false,
      tutorial_completed_at: null,
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
      score: 0,
      completedCount: 0,
      createdAt: newUserRow.created_at,
      role: "user",
      tutorialCompleted: false,
      tutorialCompletedAt: null,
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
    title: item.title,
    description: item.description,
    points: item.points,
    category: item.category,
    icon: item.icon,
    lat: item.lat,
    lng: item.lng,
    radius: item.radius,
    createdBy: item.createdBy,
    enforceGeofence: item.enforceGeofence !== false
  };

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
      radius: newItem.radius,
      created_by: newItem.createdBy || null,
      enforce_geofence: newItem.enforceGeofence !== false
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
    if (updates.enforceGeofence !== undefined) updateRow.enforce_geofence = updates.enforceGeofence;

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
      title: data.title,
      description: data.description,
      points: data.points ?? 10,
      category: data.category ?? "General",
      icon: data.icon ?? "Sparkles",
      lat: data.lat,
      lng: data.lng,
      radius: data.radius,
      createdBy: data.created_by,
      enforceGeofence: data.enforce_geofence !== false
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

export async function updateSubmissionPoints(
  subId: string,
  newPoints: number
): Promise<Submission | null> {
  try {
    // Get current submission
    const { data: sub, error: getErr } = await supabase!
      .from("submissions")
      .select("*")
      .eq("id", subId)
      .single();

    if (getErr || !sub) return null;

    // Only allow updating approved submissions
    if (sub.status !== "approved") {
      throw new Error("Can only update points for approved submissions");
    }

    const oldPoints = sub.points_awarded ?? 0;
    const pointsDifference = newPoints - oldPoints;

    // Update submission with new points
    const { error: updateErr } = await supabase!
      .from("submissions")
      .update({ points_awarded: newPoints })
      .eq("id", subId);

    if (updateErr) throw updateErr;

    // Update user's score with the difference
    const { data: prof } = await supabase!
      .from("profiles")
      .select("score")
      .eq("id", sub.user_id)
      .single();

    if (prof) {
      const newScore = Math.max(0, (prof.score ?? 0) + pointsDifference);
      await supabase!
        .from("profiles")
        .update({ score: newScore })
        .eq("id", sub.user_id);
    }

    // Return updated submission
    return {
      id: sub.id,
      userId: sub.user_id,
      username: sub.username,
      itemId: sub.item_id,
      imageUrl: sub.image_url,
      status: sub.status,
      aiExplanation: sub.ai_explanation,
      pointsAwarded: newPoints,
      forcedApproval: sub.forced_approval,
      createdAt: sub.created_at,
      userLat: sub.user_lat,
      userLng: sub.user_lng,
      distanceMeters: sub.distance_meters
    };
  } catch (err) {
    console.error("Supabase update submission points error:", err);
    throw err;
  }
}

export async function saveChatMessage(msg: ChatMessage): Promise<ChatMessage> {
  try {
    const row = {
      id: msg.id,
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

export async function getChatMessages(): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase!
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
export async function markMessagesAsRead(messageIds: string[], userId: string): Promise<boolean> {
  try {
    const { error } = await supabase!
      .from("messages")
      .update({
        is_read: true
      })
      .in("id", messageIds);
    
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
    if (slideshow.isDefaultExpanded) {
      const { error: clearDefaultError } = await supabase!
        .from("slideshows")
        .update({ is_default_expanded: false })
        .neq("id", slideshow.id);
      if (clearDefaultError) throw clearDefaultError;
    }

    // Save to Supabase
    const { error } = await supabase!
      .from("slideshows")
      .upsert([{
        id: slideshow.id,
        title: slideshow.title,
        description: slideshow.description,
        script: slideshow.script,
        submission_ids: slideshow.submissionIds,
        created_by: slideshow.createdBy === 'admin' ? null : (slideshow.createdBy || null),
        created_at: slideshow.createdAt,
        is_published: slideshow.isPublished,
        is_hidden: slideshow.isHidden,
        is_default_expanded: slideshow.isDefaultExpanded
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
      title: data.title,
      description: data.description,
      script: data.script,
      submissionIds: data.submission_ids,
      createdBy: data.created_by,
      createdAt: data.created_at,
      isPublished: data.is_published,
      isHidden: data.is_hidden ?? false,
      isDefaultExpanded: data.is_default_expanded ?? false
    };
  } catch (err) {
    console.warn("Supabase slideshow retrieve error:", err);
    throw err;
  }
}

export async function getAllSlideshows(includeHidden = false): Promise<Slideshow[]> {
  try {
    let query = supabase!
      .from("slideshows")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (!includeHidden) {
      query = query.eq("is_hidden", false);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    
    return (data || []).map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      script: s.script,
      submissionIds: s.submission_ids,
      createdBy: s.created_by,
      createdAt: s.created_at,
      isPublished: s.is_published,
      isHidden: s.is_hidden ?? false,
      isDefaultExpanded: s.is_default_expanded ?? false
    }));
  } catch (err) {
    console.warn("Supabase slideshow retrieve error:", err);
    throw err;
  }
}

export async function deleteSlideshow(id: string): Promise<boolean> {
  try {
    const { error } = await supabase!
      .from("slideshows")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("Supabase slideshow delete error:", err);
    throw err;
  }
}

export async function saveMissionSlideshowPlan(plan: MissionSlideshowPlan): Promise<MissionSlideshowPlan> {
  try {
    const { error } = await supabase!
      .from("mission_slideshow_plans")
      .upsert([{
        id: plan.id,
        title: plan.title,
        mission_slides_script: plan.missionSlidesScript,
        render_plan: plan.renderPlan,
        mission_card_plans: plan.missionCardPlans,
        mission_card_images: plan.missionCardImages,
        created_by: plan.createdBy || null,
        created_at: plan.createdAt,
      }])
      .select();

    if (error) throw error;
    return plan;
  } catch (err) {
    console.error("Supabase mission slideshow plan save error:", err);
    throw err;
  }
}

export async function getMissionSlideshowPlans(createdBy?: string): Promise<MissionSlideshowPlan[]> {
  try {
    let query = supabase!
      .from("mission_slideshow_plans")
      .select("*")
      .order("created_at", { ascending: false });
    if (createdBy) query = query.eq("created_by", createdBy);
    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((plan) => ({
      id: plan.id,
      title: plan.title,
      missionSlidesScript: plan.mission_slides_script,
      renderPlan: plan.render_plan || null,
      missionCardPlans: Array.isArray(plan.mission_card_plans) ? plan.mission_card_plans : [],
      missionCardImages: Array.isArray(plan.mission_card_images) ? plan.mission_card_images : [],
      createdBy: plan.created_by,
      createdAt: plan.created_at,
    }));
  } catch (err) {
    console.warn("Supabase mission slideshow plan retrieve error:", err);
    throw err;
  }
}

export interface AppSettings {
  name: string;
  icon: string | null;
  mapMode?: "original" | "satellite_labels" | "missions_only" | "disabled";
  defaultLat?: number;
  defaultLng?: number;
  defaultRadius?: number;
  aiPromptCriteria?: string;
  aiJudgeProvider?: "ollama" | "gemini" | "openai";
  aiJudgeModel?: string;
  activeInviteCode?: string;
  inviteRequired?: boolean;
  aiVerificationEnabled?: boolean;
  allowForceSubmit?: boolean;
  imageCompressionMaxDim?: number;
  imageCompressionQuality?: number;
  showTitle?: boolean;
  showLogo?: boolean;
  chatDisabledByAdmin?: boolean;
  readOnlyMode?: boolean;
}

const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

export function getAppSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      const rawMapMode = parsed.mapMode;
      const parsedMapMode =
        rawMapMode === "satellite_labels" || rawMapMode === "missions_only" || rawMapMode === "disabled"
          ? rawMapMode
          : "original";
      const parsedAiJudgeProvider = parsed.aiJudgeProvider === "ollama" || parsed.aiJudgeProvider === "openai"
        ? parsed.aiJudgeProvider
        : "gemini";
      const parsedAiJudgeModel = typeof parsed.aiJudgeModel === "string" && parsed.aiJudgeModel.trim()
        ? parsed.aiJudgeModel.trim()
        : parsedAiJudgeProvider === "ollama"
          ? "llama3.1"
          : parsedAiJudgeProvider === "openai"
            ? "gpt-4o-mini"
            : "gemini-2.5-flash";
      return {
        name: parsed.name || "KinQuest",
        icon: parsed.icon || "/kinquest_logo.png",
        mapMode: parsedMapMode,
        defaultLat: Number(parsed.defaultLat) || 41.9076,
        defaultLng: Number(parsed.defaultLng) || -111.3800,
        defaultRadius: Number(parsed.defaultRadius) || 200,
        aiPromptCriteria: parsed.aiPromptCriteria || "Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!",
        aiJudgeProvider: parsedAiJudgeProvider,
        aiJudgeModel: parsedAiJudgeModel,
        activeInviteCode: parsed.activeInviteCode || "watkins",
        inviteRequired: parsed.inviteRequired !== undefined ? !!parsed.inviteRequired : true,
        aiVerificationEnabled: parsed.aiVerificationEnabled !== undefined ? !!parsed.aiVerificationEnabled : true,
        allowForceSubmit: parsed.allowForceSubmit !== undefined ? !!parsed.allowForceSubmit : false,
        imageCompressionMaxDim: Number(parsed.imageCompressionMaxDim) || 800,
        imageCompressionQuality: Number(parsed.imageCompressionQuality) || 0.7,
        showTitle: parsed.showTitle !== undefined ? !!parsed.showTitle : true,
        showLogo: parsed.showLogo !== undefined ? !!parsed.showLogo : true,
        chatDisabledByAdmin: parsed.chatDisabledByAdmin !== undefined ? !!parsed.chatDisabledByAdmin : false,
        readOnlyMode: parsed.readOnlyMode !== undefined ? !!parsed.readOnlyMode : false
      };
    }
  } catch (err) {
    console.error("Failed to load app settings:", err);
  }
  return {
    name: "KinQuest",
    icon: "/kinquest_logo.png",
    mapMode: "original",
    defaultLat: 41.9076,
    defaultLng: -111.3800,
    defaultRadius: 2500,
    aiPromptCriteria: "Friendly, warm, and playful AI Referee. High-spirited, encouraging 1-2 sentence description celebrating family members and awarding bonus points for reunion spirit!",
    aiJudgeProvider: "gemini",
    aiJudgeModel: "gemini-2.5-flash",
    activeInviteCode: "watkins",
    inviteRequired: true,
    aiVerificationEnabled: true,
    allowForceSubmit: false,
    imageCompressionMaxDim: 800,
    imageCompressionQuality: 0.7,
    showTitle: true,
    showLogo: true,
    chatDisabledByAdmin: false,
    readOnlyMode: false
  };
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save app settings:", err);
  }
}

export async function restoreFromBackup(backup: any): Promise<{
  users: number;
  items: number;
  submissions: number;
  messages: number;
  slideshows: number;
}> {
  // Validate backup structure
  if (!backup || typeof backup !== "object") {
    throw new Error("Invalid backup format");
  }

  if (!backup.version || !Array.isArray(backup.users) || !Array.isArray(backup.items)) {
    throw new Error("Invalid backup format: missing required fields");
  }

  // Ensure Supabase is initialized
  getDbMode();

  if (!supabase) {
    throw new Error("Database connection not initialized");
  }

  console.log("Starting restore operation...");

  // Step 1: Clear existing data - delete in correct order to respect foreign keys
  try {
    await supabase.from("submissions").delete().neq("id", "");
    await supabase.from("messages").delete().neq("id", "");
    await supabase.from("slideshows").delete().neq("id", "");
    await supabase.from("items").delete().neq("id", "");
    await supabase.from("profiles").delete().neq("id", "");
    console.log("Cleared existing data");
  } catch (err: any) {
    console.warn("Warning during data cleanup:", err?.message);
  }

  const result = {
    users: 0,
    items: 0,
    submissions: 0,
    messages: 0,
    slideshows: 0
  };

  // Step 2: Restore users
  if (backup.users && backup.users.length > 0) {
    const usersToInsert = backup.users.map((u: any) => ({
      id: u.id,
      username: u.username,
      display_name: u.displayName || u.display_name,
      score: u.score ?? 0,
      completed_count: u.completedCount ?? u.completed_count ?? 0,
      created_at: u.createdAt || u.created_at,
      role: u.role || "user",
      permissions: typeof u.permissions === "object" ? JSON.stringify(u.permissions) : u.permissions
    }));
    const { error: userErr } = await supabase.from("profiles").insert(usersToInsert);
    if (userErr) throw new Error(`Failed to restore users: ${userErr.message}`);
    result.users = usersToInsert.length;
    console.log(`Restored ${usersToInsert.length} users`);
  }

  // Step 3: Restore items
  if (backup.items && backup.items.length > 0) {
    const itemsToInsert = backup.items.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      points: item.points ?? 10,
      category: item.category || "General",
      icon: item.icon || "Sparkles",
      lat: item.lat,
      lng: item.lng,
      radius: item.radius,
      created_by: item.createdBy || item.created_by,
      enforce_geofence: item.enforceGeofence !== undefined ? !!item.enforceGeofence : (item.enforce_geofence !== false)
    }));
    const { error: itemErr } = await supabase.from("items").insert(itemsToInsert);
    if (itemErr) throw new Error(`Failed to restore items: ${itemErr.message}`);
    result.items = itemsToInsert.length;
    console.log(`Restored ${itemsToInsert.length} items`);
  }

  // Step 4: Restore submissions
  if (backup.submissions && backup.submissions.length > 0) {
    const submissionsToInsert = backup.submissions.map((sub: any) => ({
      id: sub.id,
      user_id: sub.userId || sub.user_id,
      username: sub.username,
      item_id: sub.itemId || sub.item_id,
      image_url: sub.imageUrl || sub.image_url,
      status: sub.status || "pending",
      ai_explanation: sub.aiExplanation || sub.ai_explanation,
      points_awarded: sub.pointsAwarded ?? sub.points_awarded ?? 0,
      created_at: sub.createdAt || sub.created_at,
      user_lat: sub.userLat || sub.user_lat,
      user_lng: sub.userLng || sub.user_lng,
      distance_meters: sub.distanceMeters || sub.distance_meters
    }));
    const { error: subErr } = await supabase.from("submissions").insert(submissionsToInsert);
    if (subErr) throw new Error(`Failed to restore submissions: ${subErr.message}`);
    result.submissions = submissionsToInsert.length;
    console.log(`Restored ${submissionsToInsert.length} submissions`);
  }

  // Step 5: Restore messages
  if (backup.messages && backup.messages.length > 0) {
    const messagesToInsert = backup.messages.map((msg: any) => ({
      id: msg.id,
      sender_id: msg.senderId || msg.sender_id,
      sender_name: msg.senderName || msg.sender_name,
      receiver_id: msg.receiverId || msg.receiver_id,
      text: msg.text,
      created_at: msg.createdAt || msg.created_at,
      is_deleted: msg.isDeleted || false,
      deleted_at: msg.deletedAt || msg.deleted_at,
      deleted_by: msg.deletedBy || msg.deleted_by,
      is_read: msg.isRead || false
    }));
    const { error: msgErr } = await supabase.from("messages").insert(messagesToInsert);
    if (msgErr) throw new Error(`Failed to restore messages: ${msgErr.message}`);
    result.messages = messagesToInsert.length;
    console.log(`Restored ${messagesToInsert.length} messages`);
  }

  // Step 6: Restore slideshows
  if (backup.slideshows && backup.slideshows.length > 0) {
    const slideshowsToInsert = backup.slideshows.map((slide: any) => ({
      id: slide.id,
      title: slide.title,
      description: slide.description,
      script: slide.script,
      submission_ids: Array.isArray(slide.submissionIds) ? slide.submissionIds : slide.submission_ids,
      created_by: slide.createdBy || slide.created_by,
      created_at: slide.createdAt || slide.created_at,
      is_published: slide.isPublished ?? false,
      is_hidden: slide.isHidden ?? slide.is_hidden ?? false,
      is_default_expanded: slide.isDefaultExpanded ?? slide.is_default_expanded ?? false
    }));
    const { error: slideErr } = await supabase.from("slideshows").insert(slideshowsToInsert);
    if (slideErr) throw new Error(`Failed to restore slideshows: ${slideErr.message}`);
    result.slideshows = slideshowsToInsert.length;
    console.log(`Restored ${slideshowsToInsert.length} slideshows`);
  }

  // Step 7: Restore settings if provided
  if (backup.settings && typeof backup.settings === "object") {
    try {
      saveAppSettings(backup.settings);
      console.log("Restored settings");
    } catch (settingsErr: any) {
      console.warn("Warning: Could not restore settings:", settingsErr?.message);
    }
  }

  console.log("Restore operation completed successfully");
  return result;
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
          score: u.score ?? 0,
          completedCount: u.completed_count ?? 0,
          createdAt: u.created_at,
          role: u.role || undefined,
          tutorialCompleted: u.tutorial_completed === true,
          tutorialCompletedAt: u.tutorial_completed_at || null,
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

export async function completeTutorial(userId: string): Promise<PlayerProfile | null> {
  try {
    const now = new Date().toISOString();
    const updRow = {
      tutorial_completed: true,
      tutorial_completed_at: now
    };

    // Try Supabase first
    if (supabase) {
      const { data, error } = await supabase
        .from("profiles")
        .update(updRow)
        .eq("id", userId)
        .select("*");
      
      if (error) throw error;
      
      if (data && data.length > 0) {
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
          tutorialCompleted: u.tutorial_completed === true,
          tutorialCompletedAt: u.tutorial_completed_at || null,
          permissions: parsedPerm
        };
      }
    }
    
    return null;
  } catch (err) {
    console.warn("Failed to complete tutorial:", err);
    throw err;
  }
}

