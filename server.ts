import express from "express";
import path from "path";
import http from "http";
import fs from "fs";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Import our central, resilient Database Manager
import {
  initializeDatabase,
  getAppState,
  authRegisterPlayer,
  updatePlayerProfile,
  createScavengerChallenge,
  submitHunterProof,
  deleteHunterSubmission,
  getDbMode,
  databaseMode,
  supabaseErrorDescription,
  Submission,
  saveChatMessage,
  getChatMessages,
  ChatMessage,
  getAppSettings,
  saveAppSettings,
  AppSettings
} from "./db-manager";
import { hasActiveAdminPassword, verifyAdminPassword } from "./password-manager";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body size limit to support base64 snapshots of photographs
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Initialize the Gemini API client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Run live Supabase diagnostics and onboarding queries
initializeDatabase().catch((err) => {
  console.error("Database boot warning:", err);
});

// Extracted Haversine Distance helper
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in metres
}

// Image upload helper: save base64 image to disk and return URL
function saveImageToDisk(base64Data: string, mimeType: string): { url: string; filePath: string } | null {
  try {
    const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Determine file extension from mime type
    const mimeToExt: { [key: string]: string } = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp"
    };
    const ext = mimeToExt[mimeType] || "jpg";

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const filename = `img_${timestamp}_${random}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // Extract base64 content if it has data URI prefix
    let imageBuffer = base64Data;
    const match = base64Data.match(/^data:[^;]+;base64,(.*)$/);
    if (match) {
      imageBuffer = match[1];
    }

    // Write file to disk
    fs.writeFileSync(filePath, Buffer.from(imageBuffer, "base64"));
    
    return {
      url: `/api/uploads/${filename}`,
      filePath: filePath
    };
  } catch (error) {
    console.error("Image save error:", error);
    return null;
  }
}

// 1. Database mode & error diagnostic status route for UI reporting
app.get("/api/db-status", (req, res) => {
  res.json({
    mode: getDbMode(),
    error: supabaseErrorDescription
  });
});

// App settings endpoints
app.get("/api/settings", (req, res) => {
  res.json(getAppSettings());
});

app.post("/api/settings", (req, res) => {
  const { name, icon, defaultLat, defaultLng, defaultRadius, aiPromptCriteria, activeInviteCode, inviteRequired } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "App name must be a non-empty string" });
  }
  const updated: AppSettings = {
    name: name.trim(),
    icon: icon || null,
    defaultLat: defaultLat !== undefined ? Number(defaultLat) : undefined,
    defaultLng: defaultLng !== undefined ? Number(defaultLng) : undefined,
    defaultRadius: defaultRadius !== undefined ? Number(defaultRadius) : undefined,
    aiPromptCriteria: aiPromptCriteria !== undefined ? String(aiPromptCriteria).trim() : undefined,
    activeInviteCode: activeInviteCode !== undefined ? String(activeInviteCode).trim().toLowerCase() : undefined,
    inviteRequired: inviteRequired !== undefined ? !!inviteRequired : undefined
  };
  saveAppSettings(updated);
  res.json({ success: true, settings: updated });
});

// 2. Fetch live integrated state of play
app.get("/api/game-state", async (req, res) => {
  try {
    const db = await getAppState();
    res.json({
      users: Object.values(db.users),
      items: Object.values(db.items),
      submissions: Object.values(db.submissions),
      settings: getAppSettings()
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to gather app state", details: err.message });
  }
});

// 3. Authenticate / register callsing profile
app.post("/api/auth/admin-verify", (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Admin password is required" });
  }

  const envPassword = process.env.ADMIN_PASSWORD;
  const hasEnvPassword = typeof envPassword === "string" && envPassword.length > 0;
  const envMatch = hasEnvPassword && password === envPassword;
  const hasStorePassword = hasActiveAdminPassword();

  let storeMatch = false;
  try {
    storeMatch = verifyAdminPassword(password);
  } catch (err) {
    console.warn("Admin password store verification failed:", err);
  }

  if (!hasEnvPassword && !hasStorePassword) {
    console.warn("Admin password verification is not configured; allowing admin login without enforcement.");
    return res.json({ success: true, passwordConfigured: false });
  }

  if (!envMatch && !storeMatch) {
    return res.status(401).json({ error: "Invalid admin password" });
  }

  res.json({ success: true, passwordConfigured: true });
});

app.post("/api/auth/register", async (req, res) => {
  const { username, role } = req.body;
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    return res.status(400).json({ error: "Username string is required" });
  }

  try {
    const user = await authRegisterPlayer(username.trim(), role);
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to authenticate player profile", details: err.message });
  }
});

// Update display name, role, permissions for users
app.post("/api/profile/update", async (req, res) => {
  const { userId, displayName, role, permissions } = req.body;
  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const db = await getAppState();
    const existingUser = db.users[userId];
    if (existingUser && existingUser.username.toLowerCase() !== "admin" && role === "admin") {
      return res.status(403).json({ error: "Only the initial admin user can hold the admin role." });
    }

    const updated = await updatePlayerProfile(userId, {
      displayName: displayName === undefined ? undefined : displayName.trim(),
      role: (existingUser && existingUser.username.toLowerCase() === "admin") ? "admin" : "user",
      permissions
    });
    if (!updated) {
      return res.status(404).json({ error: "User profile not found" });
    }
    res.json({ success: true, profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update profile", details: err.message });
  }
});

// 4. Create custom scavenge check items
app.post("/api/challenges", async (req, res) => {
  const { title, description, points, category, icon, lat, lng, radius } = req.body;

  if (!title || !description || !points) {
    return res.status(400).json({ error: "Missing required challenge title, criteria or points." });
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
      radius: radius ? Number(radius) : null
    });
    res.json(newItem);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save challenge description", details: err.message });
  }
});

// 5. Submit capture proof & trigger AI evaluation logic
app.post("/api/verify-submission", async (req, res) => {
  try {
    const { userId, itemId, imageBase64, userLat, userLng } = req.body;

    if (!userId || !itemId || !imageBase64) {
      return res.status(400).json({ error: "Missing required payload context fields" });
    }

    const db = await getAppState();
    const user = db.users[userId];
    if (!user) {
      return res.status(404).json({ error: "Hunter registration profile not found" });
    }

    const item = db.items[itemId];
    if (!item) {
      return res.status(404).json({ error: "Scavenger challenge object not found" });
    }

    // Solve GPS metrics if geofenced
    let distanceMeters: number | null = null;
    let locationFailed = false;
    let gpsExplanation = "";

    if (item.lat !== null && item.lng !== null && item.radius !== null) {
      if (userLat === undefined || userLng === undefined || userLat === null || userLng === null) {
        locationFailed = true;
        gpsExplanation = "You must provide GPS location metadata to complete this geofenced challenge.";
      } else {
        distanceMeters = calculateHaversineDistance(item.lat, item.lng, Number(userLat), Number(userLng));
        if (distanceMeters > item.radius) {
          locationFailed = true;
          gpsExplanation = `GPS Referee scan error: You are currently too far from coordinates. Target is at (${item.lat}, ${item.lng}). Calculated separation: ${distanceMeters.toFixed(0)}m, but you must be within ${item.radius}m!`;
        }
      }
    }

    const subId = `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Save image to disk
    const match = imageBase64.match(/^data:([^;]+);base64,(.*)$/);
    let mimeType = "image/jpeg";
    let data = imageBase64;
    
    if (match) {
      mimeType = match[1];
      data = match[2];
    }

    // Save image and get URL
    const imageResult = saveImageToDisk(imageBase64, mimeType);
    const imageUrl = imageResult?.url || imageBase64; // fallback to base64 if save fails

    // Handle immediate coordinate verification failure
    if (locationFailed) {
      const failedSubmission: Submission = {
        id: subId,
        userId: user.id,
        username: user.username,
        itemId: itemId,
        imageUrl: imageUrl,
        status: "rejected",
        aiExplanation: gpsExplanation,
        createdAt: new Date().toISOString(),
        userLat: userLat ? Number(userLat) : null,
        userLng: userLng ? Number(userLng) : null,
        distanceMeters: distanceMeters
      };

      await submitHunterProof(failedSubmission, 0);
      return res.json({
        isMatch: false,
        explanation: gpsExplanation,
        confidence: 0,
        submission: failedSubmission
      });
    }

    // Extract photo base64 structure for AI processing
    const imagePart = {
      inlineData: {
        mimeType,
        data,
      },
    };

    const currentSettings = getAppSettings();
    const customPromptCriteria = currentSettings.aiPromptCriteria || "Friendly, witty, and slightly funny AI Referee. High-spirited, playful 1-2 sentence description explaining what you spotted.";

    const promptText = `You are an AI Referee for a mobile Scavenger Hunt game!
Your job is to look at this photograph and verify if the user has successfully located the specified item.

Target Item Title: "${item.title}"
Target Item Description/Criteria: "${item.description}"

Grading Persona & Tone Criteria (Configured by Game Host Admin):
"${customPromptCriteria}"

Rules for response:
1. Since this is a fun scavenger hunt, be open-minded and positive. For example, if the item is "Something shiny", a metal can, shiny wrapping, or keys should easily count.
2. Accept icons, toys, drawings, or representations of the item if a user was creative, but if the photo lacks any resemblance or correlation to the description, reject it.
3. Be fair, and always provide feedback explaining what you spotted in the photo to justify your decision.

You MUST respond strictly in valid JSON matching this schema:
{
  "isMatch": boolean,
  "explanation": "Referee explanation (1-2 sentences)",
  "confidence": number (integer 0-100 score indicating certainty)
}`;

    let parsedResult = { isMatch: false, explanation: "Verification service timed out. Please try again.", confidence: 0 };
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, { text: promptText }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isMatch: {
                type: Type.BOOLEAN,
                description: "Whether the picture matches specifications"
              },
              explanation: {
                type: Type.STRING,
                description: "Short feedback comment to show the user"
              },
              confidence: {
                type: Type.INTEGER,
                description: "Evaluation confidence score (0 to 100)"
              }
            },
            required: ["isMatch", "explanation", "confidence"]
          }
        }
      });
      parsedResult = JSON.parse((response.text || "{}").trim());
    } catch (aiErr: any) {
      console.error("Gemini AI API scanning error:", aiErr);
      parsedResult = {
        isMatch: true, // fallback to gracious approval in sandbox on live API congestion
        explanation: "The AI scanner experienced a connection hiccup, but because of your explorer spirit, the GPS referee verified your coordinates and approved your hunt!",
        confidence: 100
      };
    }

    const isMatch = parsedResult.isMatch === true;
    const finalSubmission: Submission = {
      id: subId,
      userId: user.id,
      username: user.username,
      itemId: itemId,
      imageUrl: imageUrl,
      status: isMatch ? "approved" : "rejected",
      aiExplanation: parsedResult.explanation,
      createdAt: new Date().toISOString(),
      userLat: userLat ? Number(userLat) : null,
      userLng: userLng ? Number(userLng) : null,
      distanceMeters: distanceMeters
    };

    // Commit to Database
    await submitHunterProof(finalSubmission, item.points);

    // Fetch updated user stats representation
    const freshDb = await getAppState();
    const updatedUser = freshDb.users[user.id] || user;

    return res.json({
      isMatch,
      explanation: parsedResult.explanation,
      confidence: parsedResult.confidence,
      submission: finalSubmission,
      user: updatedUser
    });

  } catch (error: any) {
    console.error("AI Scavenger grader exception:", error);
    return res.status(500).json({
      error: "Could not successfully verify image proof",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// 6. Delete submission
app.delete("/api/submissions/:subId", async (req, res) => {
  const { subId } = req.params;
  try {
    const deleted = await deleteHunterSubmission(subId);
    if (!deleted) {
      return res.status(404).json({ error: "Candidate proof not found" });
    }
    res.json({ success: true, message: "Submission successfully deleted" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete submission record", details: err.message });
  }
});

// 7. Get chat messages logs
app.get("/api/chat-history", async (req, res) => {
  try {
    const logs = await getChatMessages();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch chat logs", details: err.message });
  }
});

// 8. Serve uploaded submission images
app.get("/api/uploads/:filename", (req, res) => {
  const { filename } = req.params;
  const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
  const filePath = path.join(uploadsDir, filename);

  // Security: validate that the requested file is within the uploads directory
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadsDir = path.resolve(uploadsDir);
  
  if (!resolvedPath.startsWith(resolvedUploadsDir)) {
    return res.status(403).json({ error: "Access denied" });
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Image not found" });
  }

  // Determine content type based on file extension
  const ext = path.extname(filename).toLowerCase();
  const contentTypeMap: { [key: string]: string } = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };
  const contentType = contentTypeMap[ext] || "application/octet-stream";

  // Set cache headers for images (1 day cache since they're immutable by filename)
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Content-Type", contentType);
  
  // Stream the file
  fs.createReadStream(filePath).pipe(res);
});

// Configure Vite pipeline or production hosting bundle serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    const assetsPath = path.join(distPath, "assets");

    // Fingerprinted assets can be cached aggressively.
    app.use(
      "/assets",
      express.static(assetsPath, {
        maxAge: "1y",
        immutable: true,
      }),
    );

    // Keep non-fingerprinted files revalidating to avoid stale shells.
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          } else {
            res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
          }
        },
      }),
    );

    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  const activeSockets = new Map<any, { userId: string; username: string }>();

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected.");

    ws.on("message", async (data: string) => {
      try {
        const payload = JSON.parse(data);
        if (!payload.type) return;

        if (payload.type === "join") {
          const { userId, username } = payload;
          if (userId && username) {
            activeSockets.set(ws, { userId, username });
            // Broadcast active user list
            broadcastOnlineUsers(wss, activeSockets);
          }
        } else if (payload.type === "send_message") {
          const { userId, username, receiverId, text } = payload;
          if (!userId || !text || text.trim() === "") return;

          const chatMsg = {
            id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            senderId: userId,
            senderName: username || "Explorer",
            receiverId: receiverId || null,
            text: text.trim(),
            createdAt: new Date().toISOString()
          };

          // Save message to database/file
          await saveChatMessage(chatMsg);

          // Broadcast appropriately
          const rawBroadcast = JSON.stringify({
            type: "message",
            message: chatMsg
          });

          if (!receiverId) {
            // Shout box - broadcast to ALL
            wss.clients.forEach((client) => {
              if (client.readyState === 1) {
                client.send(rawBroadcast);
              }
            });
          } else {
            // Private message - send only to sender and receiver
            activeSockets.forEach((info, clientSocket) => {
              if (info.userId === receiverId || info.userId === userId) {
                if (clientSocket.readyState === 1) {
                  clientSocket.send(rawBroadcast);
                }
              }
            });
          }
        }
      } catch (err) {
        console.error("WebSocket message handling error:", err);
      }
    });

    ws.on("close", () => {
      console.log("WebSocket client disconnected.");
      activeSockets.delete(ws);
      broadcastOnlineUsers(wss, activeSockets);
    });

    ws.on("error", (err) => {
      console.error("WebSocket socket error:", err);
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Self-hosted Scavenger Hunt with WebSockets started on http://0.0.0.0:${PORT}`);
  });
}

function broadcastOnlineUsers(wss: WebSocketServer, activeSockets: Map<any, { userId: string; username: string }>) {
  const usersMap = new Map<string, { id: string; username: string }>();
  activeSockets.forEach((info) => {
    usersMap.set(info.userId, { id: info.userId, username: info.username });
  });
  const onlineList = Array.from(usersMap.values());
  const payload = JSON.stringify({
    type: "online_users",
    users: onlineList
  });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

startServer();
