import express from "express";
import path from "path";
import http from "http";
import https from "https";
import { createHash } from "crypto";
import fs from "fs";
import { promises as fsp } from "fs";
import os from "os";
import { spawn } from "child_process";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Inject ws as global WebSocket for Supabase Realtime on Node.js 20
import { WebSocket as NodeWebSocket } from "ws";
if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = NodeWebSocket;
}

// Import our central, resilient Database Manager
import {
  initializeDatabase,
  getAppState,
  authRegisterPlayer,
  ensureProfileExists,
  updatePlayerProfile,
  createScavengerChallenge,
  deleteScavengerChallenge,
  updateScavengerChallenge,
  submitHunterProof,
  deleteHunterSubmission,
  manuallyApproveSubmission,
  updateSubmissionPoints,
  Submission,
  ScavengerItem,
  saveChatMessage,
  getChatMessages,
  deleteMessage,
  markMessagesAsRead,
  muteUser,
  unmuteUser,
  bootUser,
  ChatMessage,
  saveSlideshow,
  getSlideshow,
  getAllSlideshows,
  deleteSlideshow,
  Slideshow,
  getAppSettings,
  saveAppSettings,
  AppSettings,
  restoreFromBackup,
  completeTutorial
} from "./db-manager";
import {
  hasActiveAdminPassword,
  verifyAdminPassword,
  createOrReuseAdminSession,
  getActiveSessionsCount,
  changeAdminPassword,
  updateAdminSessionActivity,
  endAdminSession
} from "./password-manager";
import {
  createOrReuseUserSession,
  refreshUserSession,
  endUserSession,
  hasActiveUserSession
} from "./session-manager";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const OLLAMA_SERVER_URL = (process.env.OLLAMA_SERVER_URL || "http://localhost:11434").trim();
const OLLAMA_MODEL = (process.env.OLLAMA_MODEL || "llama3.1").trim();
const OLLAMA_API_KEY = (process.env.OLLAMA_API_KEY || "").trim();
const OLLAMA_REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS || 15000) || 15000);
const OLLAMA_SCRIPT_MODE = (process.env.OLLAMA_SCRIPT_MODE || "offload_if_presenton").trim().toLowerCase();
const PRESENTON_SERVER_URL = (process.env.PRESENTON_SERVER_URL || "").trim();
const PRESENTON_API_KEY = (process.env.PRESENTON_API_KEY || "").trim();
const PRESENTON_USERNAME = (process.env.PRESENTON_USERNAME || "").trim();
const PRESENTON_PASSWORD = (process.env.PRESENTON_PASSWORD || "").trim();
const PRESENTON_AUTH_MODE = (process.env.PRESENTON_AUTH_MODE || "auto").trim().toLowerCase();
const PRESENTON_LOGIN_PATH = (process.env.PRESENTON_LOGIN_PATH || "/api/v1/auth/jwt/login").trim();
const PRESENTON_GENERATE_PATH = (process.env.PRESENTON_GENERATE_PATH || "/api/v1/ppt/presentation/generate").trim();
const PRESENTON_REQUEST_TIMEOUT_MS = Math.max(3000, Number(process.env.PRESENTON_REQUEST_TIMEOUT_MS || 25000) || 25000);
const SKIP_PRESENTON_ON_CONSTRAINED_RENDER = (process.env.SKIP_PRESENTON_ON_CONSTRAINED_RENDER || "true").trim().toLowerCase() !== "false";
const NAVIDROME_SERVER_URL = (process.env.NAVIDROME_SERVER_URL || "").trim();
const NAVIDROME_USERNAME = (process.env.NAVIDROME_USERNAME || "").trim();
const NAVIDROME_PASSWORD = (process.env.NAVIDROME_PASSWORD || "").trim();
const NAVIDROME_API_VERSION = "1.16.1";
const NAVIDROME_CLIENT_NAME = "kinquest";

let presentonJwtTokenCache: { token: string; issuedAtMs: number } | null = null;

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

function normalizeServerUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function normalizeApiPath(raw: string, fallback: string): string {
  const value = (raw || "").trim();
  if (!value) return fallback;
  return value.startsWith("/") ? value : `/${value}`;
}

function buildAuthHeaders(auth: { apiKey?: string; username?: string; password?: string }): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = (auth.apiKey || "").trim();
  const username = (auth.username || "").trim();
  const password = auth.password || "";

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["X-API-Key"] = apiKey;
    return headers;
  }

  if (username) {
    const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
    headers.Authorization = `Basic ${token}`;
  }

  return headers;
}

function buildPresentonAuthHeaders(): Record<string, string> {
  const config = buildPresentonAuthConfig();
  if (config.username) {
    return buildAuthHeaders({ username: config.username, password: config.password });
  }
  if (config.apiKey) {
    return buildAuthHeaders({ apiKey: config.apiKey });
  }
  return {};
}

function buildPresentonAuthConfig(): { apiKey?: string; username?: string; password?: string } {
  const mode = PRESENTON_AUTH_MODE;
  const apiKeyConfig = PRESENTON_API_KEY ? { apiKey: PRESENTON_API_KEY } : {};
  const basicConfig = PRESENTON_USERNAME
    ? { username: PRESENTON_USERNAME, password: PRESENTON_PASSWORD }
    : {};

  if (mode === "basic") return basicConfig;
  if (mode === "api_key" || mode === "apikey" || mode === "bearer") return apiKeyConfig;
  if (mode === "jwt" || mode === "local") return {};
  if (mode === "none") return {};

  // Auto mode prefers local login flow when username/password are configured.
  if (PRESENTON_USERNAME) return {};
  return apiKeyConfig;
}

async function getPresentonJwtBearerToken(baseUrl: string): Promise<string> {
  const now = Date.now();
  // Keep token fresh enough without decoding JWT expiry.
  if (presentonJwtTokenCache && now - presentonJwtTokenCache.issuedAtMs < 45 * 60 * 1000) {
    return presentonJwtTokenCache.token;
  }

  if (!PRESENTON_USERNAME || !PRESENTON_PASSWORD) {
    throw new Error("Presenton JWT auth requires PRESENTON_USERNAME and PRESENTON_PASSWORD");
  }

  const loginPath = normalizeApiPath(PRESENTON_LOGIN_PATH, "/api/v1/auth/jwt/login");
  const form = new URLSearchParams();
  form.set("username", PRESENTON_USERNAME);
  form.set("password", PRESENTON_PASSWORD);

  const response = await withTimeout(
    fetch(`${baseUrl}${loginPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }),
    15000,
    "Presenton JWT login"
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Presenton JWT login failed (${response.status}) at ${loginPath}: ${body}`);
  }

  const payload: any = await response.json();
  const accessToken = String(payload?.access_token || "").trim();
  if (!accessToken) {
    throw new Error("Presenton JWT login returned no access_token");
  }

  presentonJwtTokenCache = {
    token: accessToken,
    issuedAtMs: now,
  };

  return accessToken;
}

async function buildPresentonRequestHeaders(baseUrl: string): Promise<Record<string, string>> {
  const mode = PRESENTON_AUTH_MODE;

  if (mode === "none") {
    return {};
  }

  if (mode === "jwt" || mode === "local") {
    const token = await getPresentonJwtBearerToken(baseUrl);
    return { Authorization: `Bearer ${token}` };
  }

  if (mode === "basic") {
    return buildAuthHeaders({ username: PRESENTON_USERNAME, password: PRESENTON_PASSWORD });
  }

  if (mode === "api_key" || mode === "apikey" || mode === "bearer") {
    return buildAuthHeaders({ apiKey: PRESENTON_API_KEY });
  }

  // auto
  if (PRESENTON_USERNAME && PRESENTON_PASSWORD) {
    try {
      const token = await getPresentonJwtBearerToken(baseUrl);
      return { Authorization: `Bearer ${token}` };
    } catch (jwtErr: any) {
      console.warn("Presenton auto auth JWT login failed, trying Basic auth:", jwtErr?.message || jwtErr);
      return buildAuthHeaders({ username: PRESENTON_USERNAME, password: PRESENTON_PASSWORD });
    }
  }

  if (PRESENTON_API_KEY) {
    return buildAuthHeaders({ apiKey: PRESENTON_API_KEY });
  }

  return {};
}

async function callOllamaText(prompt: string): Promise<{ text: string; model: string }> {
  const baseUrl = normalizeServerUrl(OLLAMA_SERVER_URL);
  if (!baseUrl) {
    throw new Error("OLLAMA_SERVER_URL is not configured");
  }

  const model = OLLAMA_MODEL || "llama3.1";
  const response = await withTimeout(
    fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders({ apiKey: OLLAMA_API_KEY }),
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    }),
    OLLAMA_REQUEST_TIMEOUT_MS,
    "Ollama generation"
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${body}`);
  }

  const payload: any = await response.json();
  const text = typeof payload?.response === "string" ? payload.response.trim() : "";
  if (!text) {
    throw new Error("Ollama returned an empty response");
  }

  return {
    text,
    model: typeof payload?.model === "string" && payload.model.trim().length > 0 ? payload.model.trim() : model,
  };
}

async function writeRemoteVideoToSlideshow(slideshowId: string, videoUrl: string): Promise<{ outputPath: string; outputUrl: string }> {
  const cleanId = sanitizeSlideshowId(slideshowId);
  if (!cleanId) throw new Error("Invalid slideshow id");

  const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
  const videosDir = path.join(uploadsDir, "slideshows");
  await fsp.mkdir(videosDir, { recursive: true });

  const outputPath = path.join(videosDir, `${cleanId}.mp4`);
  const outputUrl = `/api/slideshows/video/${cleanId}.mp4`;

  const response = await withTimeout(fetch(videoUrl), 90000, "Presenton video download");
  if (!response.ok) {
    throw new Error(`Presenton video download failed with status ${response.status}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(outputPath, data);

  return { outputPath, outputUrl };
}

async function writeVideoBytesToSlideshow(slideshowId: string, base64Bytes: string): Promise<{ outputPath: string; outputUrl: string }> {
  const cleanId = sanitizeSlideshowId(slideshowId);
  if (!cleanId) throw new Error("Invalid slideshow id");

  const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
  const videosDir = path.join(uploadsDir, "slideshows");
  await fsp.mkdir(videosDir, { recursive: true });

  const outputPath = path.join(videosDir, `${cleanId}.mp4`);
  const outputUrl = `/api/slideshows/video/${cleanId}.mp4`;
  await fsp.writeFile(outputPath, Buffer.from(base64Bytes, "base64"));

  return { outputPath, outputUrl };
}

async function callPresentonSlideshow(
  slideshowId: string,
  script: string,
  sourceSlides: Array<{ submissionId: string; imageUrl: string; missionTitle: string; missionDescription: string; username: string }>,
  playerTotals: Array<{ username: string; score: number }>
): Promise<{ videoUrl: string | null; slidesPlan: Array<{ submissionId: string; overlayText: string; durationSeconds: number; transition: string }> | null }> {
  const baseUrl = normalizeServerUrl(PRESENTON_SERVER_URL);
  if (!baseUrl) {
    return { videoUrl: null, slidesPlan: null };
  }

  const generatePath = normalizeApiPath(PRESENTON_GENERATE_PATH, "/api/v1/ppt/presentation/generate");
  const looksLikeLocalGenerateApi = /\/api\/(v1\/ppt\/presentation|v3\/presentation)\/generate(?:\/async)?$/.test(generatePath);
  const presentonBody = looksLikeLocalGenerateApi
    ? {
        // Local self-hosted API shape from Presenton docs.
        content: script,
        n_slides: Math.max(3, Math.min(sourceSlides.length + 2, 20)),
        language: "English",
        template: "general",
        standard_template: "general",
        export_as: "pptx",
      }
    : {
        // Legacy/custom integration shape for deployments exposing a direct slideshow endpoint.
        slideshowId,
        script,
        outputFormat: "mp4",
        aiProvider: "ollama",
        aiModel: OLLAMA_MODEL,
        slides: sourceSlides,
        scoreboard: playerTotals,
      };

  const presentonAuthHeaders = await buildPresentonRequestHeaders(baseUrl);

  const sendPresentonRequest = async (headers: Record<string, string>) =>
    withTimeout(
      fetch(`${baseUrl}${generatePath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(presentonBody),
      }),
      PRESENTON_REQUEST_TIMEOUT_MS,
      "Presenton slideshow generation"
    );

  let response = await sendPresentonRequest(presentonAuthHeaders);

  if (!response.ok && response.status === 401 && PRESENTON_AUTH_MODE === "auto" && Object.keys(presentonAuthHeaders).length > 0) {
    // Some local setups are explicitly unauthenticated; retry once without auth.
    response = await sendPresentonRequest({});
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Presenton request failed (${response.status}) at ${generatePath} [authMode=${PRESENTON_AUTH_MODE}]: ${body}`);
  }

  const payload: any = await response.json();

  const presentationPath = typeof payload?.path === "string" ? payload.path.trim() : "";
  if (presentationPath) {
    const absolutePath = presentationPath.startsWith("http")
      ? presentationPath
      : `${baseUrl}${presentationPath.startsWith("/") ? "" : "/"}${presentationPath}`;

    if (/\.mp4(\?|$)/i.test(absolutePath)) {
      const written = await writeRemoteVideoToSlideshow(slideshowId, absolutePath);
      return { videoUrl: written.outputUrl, slidesPlan: null };
    }

    // Standard local API returns pptx/pdf paths; KinQuest then falls back to local MP4 rendering.
    return { videoUrl: null, slidesPlan: null };
  }

  const directVideoUrl =
    (typeof payload?.videoUrl === "string" && payload.videoUrl) ||
    (typeof payload?.result?.videoUrl === "string" && payload.result.videoUrl) ||
    null;
  if (directVideoUrl) {
    const written = await writeRemoteVideoToSlideshow(slideshowId, directVideoUrl);
    return { videoUrl: written.outputUrl, slidesPlan: null };
  }

  const base64Video =
    (typeof payload?.videoBytesBase64 === "string" && payload.videoBytesBase64) ||
    (typeof payload?.videoBytes === "string" && payload.videoBytes) ||
    (typeof payload?.result?.videoBytesBase64 === "string" && payload.result.videoBytesBase64) ||
    null;
  if (base64Video) {
    const written = await writeVideoBytesToSlideshow(slideshowId, base64Video);
    return { videoUrl: written.outputUrl, slidesPlan: null };
  }

  const rawSlides = Array.isArray(payload?.slidesPlan)
    ? payload.slidesPlan
    : Array.isArray(payload?.result?.slidesPlan)
      ? payload.result.slidesPlan
      : Array.isArray(payload?.slides)
        ? payload.slides
        : [];

  const slidesPlan = rawSlides
    .map((row: any) => ({
      submissionId: String(row?.submissionId || "").trim(),
      overlayText: String(row?.overlayText || "").trim(),
      durationSeconds: Math.max(2, Math.min(Number(row?.durationSeconds) || 5, 8)),
      transition: String(row?.transition || "fade").trim().toLowerCase(),
    }))
    .filter((row: any) => row.submissionId.length > 0);

  return {
    videoUrl: null,
    slidesPlan: slidesPlan.length ? slidesPlan : null,
  };
}

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

function sanitizeSlideshowId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "");
}

function sanitizeAudioBasename(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "");
}

function parseRequestedSongQueries(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => String(entry || "").trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 8);
  }

  if (typeof raw === "string") {
    return raw
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 8);
  }

  return [];
}

function buildNavidromeAuthParams(): URLSearchParams | null {
  if (!NAVIDROME_USERNAME || !NAVIDROME_PASSWORD) {
    return null;
  }

  const salt = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const token = createHash("md5").update(`${NAVIDROME_PASSWORD}${salt}`).digest("hex");

  const params = new URLSearchParams();
  params.set("u", NAVIDROME_USERNAME);
  params.set("s", salt);
  params.set("t", token);
  params.set("v", NAVIDROME_API_VERSION);
  params.set("c", NAVIDROME_CLIENT_NAME);
  params.set("f", "json");
  return params;
}

async function navidromeGetJson(endpointPath: string, extraParams: Record<string, string>): Promise<any | null> {
  const base = normalizeServerUrl(NAVIDROME_SERVER_URL);
  const authParams = buildNavidromeAuthParams();
  if (!base || !authParams) return null;

  const params = new URLSearchParams(authParams);
  Object.entries(extraParams).forEach(([key, value]) => {
    params.set(key, value);
  });

  const url = `${base}${endpointPath}?${params.toString()}`;
  try {
    const response = await withTimeout(fetch(url), 10000, "Navidrome request");
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function formatDurationLabel(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function estimateSlideshowDurationSeconds(
  slideshow: Slideshow,
  submissions: Record<string, Submission>,
  items: Record<string, ScavengerItem>
): number {
  let previousMissionKey: string | null = null;
  let slideCount = 0;
  let baseDurationSeconds = 0;

  slideshow.submissionIds.forEach((subId) => {
    const submission = submissions[subId];
    if (!submission?.imageUrl) return;

    const item = items[submission.itemId];
    const missionTitle = normalizeMissionCardText(item?.title || "Mission") || "Mission";
    const missionDescription = normalizeMissionCardText(item?.description || "");
    const missionKey = `${submission.itemId}::${missionTitle}::${missionDescription}`;

    if (missionKey !== previousMissionKey) {
      previousMissionKey = missionKey;
      slideCount += 1;
      baseDurationSeconds += 4;
    }

    slideCount += 1;
    baseDurationSeconds += 5;
  });

  if (slideCount > 0) {
    slideCount += 1;
    baseDurationSeconds += 6;
  }

  const transitionSeconds = slideCount > 1 ? (PI_CONSTRAINED_RENDER ? 0.45 : 0.8) : 0;
  return baseDurationSeconds + transitionSeconds;
}

function estimateSlideshowDurationFromSubmissionPayload(
  submissions: Array<{ id?: string; title?: string; description?: string; imageUrl?: string }>
): number {
  let previousMissionKey: string | null = null;
  let slideCount = 0;
  let baseDurationSeconds = 0;

  submissions.forEach((submission, index) => {
    const imageUrl = String(submission?.imageUrl || "").trim();
    if (!imageUrl) return;

    const missionTitle = normalizeMissionCardText(submission?.title || "Mission") || "Mission";
    const missionDescription = normalizeMissionCardText(submission?.description || "");
    const missionKey = `${missionTitle}::${missionDescription}`;

    if (missionKey !== previousMissionKey) {
      previousMissionKey = missionKey;
      slideCount += 1;
      baseDurationSeconds += 4;
    }

    // Keep per-photo duration consistent with render endpoint.
    slideCount += 1;
    baseDurationSeconds += 5;
  });

  if (slideCount > 0) {
    slideCount += 1;
    baseDurationSeconds += 6;
  }

  const transitionSeconds = slideCount > 1 ? (PI_CONSTRAINED_RENDER ? 0.45 : 0.8) : 0;
  return baseDurationSeconds + transitionSeconds;
}

function parseSongQueryEntry(raw: string): { artistHint: string; titleHint: string; searchQuery: string } {
  const trimmed = String(raw || "").trim();

  // Formats: "Artist - Title"  or  "Title by Artist"
  const dashMatch = trimmed.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    const artistHint = dashMatch[1].trim();
    const titleHint = dashMatch[2].trim();
    return { artistHint, titleHint, searchQuery: `${titleHint} ${artistHint}` };
  }

  const byMatch = trimmed.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    const titleHint = byMatch[1].trim();
    const artistHint = byMatch[2].trim();
    return { artistHint, titleHint, searchQuery: `${titleHint} ${artistHint}` };
  }

  return { artistHint: "", titleHint: trimmed, searchQuery: trimmed };
}

function artistMatchScore(candidateArtist: string, hintArtist: string): number {
  if (!hintArtist) return 1; // no hint — all candidates equally valid
  const a = candidateArtist.toLowerCase();
  const b = hintArtist.toLowerCase();
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  return 0;
}

async function searchNavidromeSong(query: string): Promise<{ id: string; title: string; artist: string; durationSeconds?: number } | null> {
  const parsed = parseSongQueryEntry(query);

  const payload = await navidromeGetJson("/rest/search3", {
    query: parsed.searchQuery,
    songCount: "10",
    artistCount: "0",
    albumCount: "0",
  });

  const root = payload?.["subsonic-response"];
  const result = root?.searchResult3;
  const songs = Array.isArray(result?.song) ? result.song : [];
  if (!songs.length) return null;

  // Pick the candidate with the best artist match when a hint was provided.
  let best = songs[0];
  if (parsed.artistHint) {
    let bestScore = -1;
    for (const song of songs) {
      const score = artistMatchScore(String(song?.artist || ""), parsed.artistHint);
      if (score > bestScore) {
        bestScore = score;
        best = song;
      }
    }
  }

  const id = String(best?.id || "").trim();
  if (!id) return null;

  return {
    id,
    title: String(best?.title || parsed.titleHint).trim(),
    artist: String(best?.artist || "Unknown Artist").trim(),
    durationSeconds: Number.isFinite(Number(best?.duration)) ? Math.max(0, Number(best.duration)) : undefined,
  };
}

async function downloadNavidromeSongToTemp(songId: string, tmpDir: string, hint: string): Promise<string | null> {
  const base = normalizeServerUrl(NAVIDROME_SERVER_URL);
  const authParams = buildNavidromeAuthParams();
  if (!base || !authParams) return null;

  const params = new URLSearchParams(authParams);
  params.set("id", songId);
  const url = `${base}/rest/stream.view?${params.toString()}`;

  try {
    const response = await withTimeout(fetch(url), 20000, "Navidrome stream download");
    if (!response.ok) return null;

    const ext = (response.headers.get("content-type") || "").includes("ogg") ? "ogg" : "mp3";
    const safeBase = sanitizeAudioBasename(hint) || `song_${Date.now()}`;
    const outputPath = path.join(tmpDir, `navidrome_${safeBase}_${songId}.${ext}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await fsp.writeFile(outputPath, bytes);
    return outputPath;
  } catch {
    return null;
  }
}

async function concatAudioFiles(audioFiles: string[], outputPath: string): Promise<boolean> {
  if (!audioFiles.length) return false;
  if (audioFiles.length === 1) {
    await fsp.copyFile(audioFiles[0], outputPath);
    return true;
  }

  const inputArgs = audioFiles.flatMap((audio) => ["-i", audio]);
  const concatInputs = audioFiles.map((_, idx) => `[${idx}:a]`).join("");
  const filter = `${concatInputs}concat=n=${audioFiles.length}:v=0:a=1[aout]`;

  return await new Promise<boolean>((resolve) => {
    const proc = spawn("ffmpeg", [
      "-y",
      ...inputArgs,
      "-filter_complex", filter,
      "-map", "[aout]",
      "-c:a", "mp3",
      "-b:a", "192k",
      outputPath,
    ]);

    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

async function resolveBackgroundMusicTrack(tmpDir: string, requestedSongQueries: string[]): Promise<{ filePath: string | null; source: string }> {
  const requested = requestedSongQueries
    .map((entry) => String(entry || "").trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 8);

  if (requested.length > 0) {
    const downloadedTracks: string[] = [];

    for (const requestedSong of requested) {
      const found = await searchNavidromeSong(requestedSong);
      if (!found) {
        console.warn(`[SlideshowRender] Navidrome song not found for query: ${requestedSong}`);
        continue;
      }

      const downloaded = await downloadNavidromeSongToTemp(found.id, tmpDir, `${found.title}_${found.artist}`);
      if (!downloaded) {
        console.warn(`[SlideshowRender] Failed to download Navidrome song: ${found.title} - ${found.artist}`);
        continue;
      }

      downloadedTracks.push(downloaded);
    }

    if (downloadedTracks.length > 0) {
      const stitchedPath = path.join(tmpDir, "requested_playlist.mp3");
      const stitched = await concatAudioFiles(downloadedTracks, stitchedPath);
      if (stitched) {
        return { filePath: stitchedPath, source: `navidrome:${downloadedTracks.length}_tracks` };
      }
      return { filePath: downloadedTracks[0], source: "navidrome:single_track" };
    }
  }

  const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
  const fallbackCandidates = [
    process.env.SLIDESHOW_BGM_FILE || "",
    path.join(uploadsDir, "slideshow-bgm.mp3"),
    path.join(process.cwd(), "assets", "slideshow-bgm.mp3"),
    path.join(uploadsDir, "slideshows", "kinquest-ambient-cinematic-6m30.mp3"),
    path.join(uploadsDir, "slideshows", "kinquest-ambient-6m30.mp3"),
  ].filter(Boolean);
  const selected = fallbackCandidates.find((candidate) => fs.existsSync(candidate)) || null;

  return {
    filePath: selected,
    source: selected ? "fallback:file" : "fallback:silence",
  };
}

async function previewRequestedSongs(requestedSongQueries: string[]): Promise<{
  requested: string[];
  matches: Array<{ query: string; found: boolean; title?: string; artist?: string; durationSeconds?: number; durationLabel?: string }>;
  matchedDurationSeconds: number;
  matchedDurationLabel: string;
  fallbackSource: "file" | "silence";
}> {
  const requested = requestedSongQueries
    .map((entry) => String(entry || "").trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 8);

  const matches: Array<{ query: string; found: boolean; title?: string; artist?: string; durationSeconds?: number; durationLabel?: string }> = [];
  let matchedDurationSeconds = 0;

  for (const query of requested) {
    const found = await searchNavidromeSong(query);
    if (found) {
      const durationSeconds = Number(found.durationSeconds) || 0;
      matchedDurationSeconds += durationSeconds;
      matches.push({
        query,
        found: true,
        title: found.title,
        artist: found.artist,
        durationSeconds,
        durationLabel: formatDurationLabel(durationSeconds),
      });
    } else {
      matches.push({ query, found: false });
    }
  }

  const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
  const fallbackCandidates = [
    process.env.SLIDESHOW_BGM_FILE || "",
    path.join(uploadsDir, "slideshow-bgm.mp3"),
    path.join(process.cwd(), "assets", "slideshow-bgm.mp3"),
    path.join(uploadsDir, "slideshows", "kinquest-ambient-cinematic-6m30.mp3"),
    path.join(uploadsDir, "slideshows", "kinquest-ambient-6m30.mp3"),
  ].filter(Boolean);
  const hasFallbackFile = fallbackCandidates.some((candidate) => fs.existsSync(candidate));

  return {
    requested,
    matches,
    matchedDurationSeconds,
    matchedDurationLabel: formatDurationLabel(matchedDurationSeconds),
    fallbackSource: hasFallbackFile ? "file" : "silence",
  };
}

function buildFinalScoreboardOverlay(
  playerTotals: Array<{ username: string; score: number }>
): string {
  const scoringPlayers = playerTotals.filter((entry) => Number(entry.score) > 0);
  const standingsLines = scoringPlayers.length
    ? scoringPlayers.map((entry, idx) => `${idx + 1}. ${entry.username} - ${entry.score} pts`)
    : ["No player scores yet"];

  return [
    "Final Standings",
    ...standingsLines,
  ].join("\n");
}

function wrapMultilineTextForCard(text: string, maxCharsPerLine: number, maxLines: number): string {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (!normalized) return "";

  const rawLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const wrappedLines: string[] = [];

  for (const rawLine of rawLines) {
    if (wrappedLines.length >= maxLines) break;

    const remainingLineBudget = maxLines - wrappedLines.length;
    const wrapped = wrapTextForCard(rawLine, maxCharsPerLine, remainingLineBudget);
    if (!wrapped) continue;

    const parts = wrapped.split("\n").filter((part) => part.trim().length > 0);
    for (const part of parts) {
      if (wrappedLines.length >= maxLines) break;
      wrappedLines.push(part);
    }
  }

  if (!wrappedLines.length) return "";

  if (rawLines.length > wrappedLines.length) {
    const last = wrappedLines[wrappedLines.length - 1] || "";
    wrappedLines[wrappedLines.length - 1] = `${last.slice(0, Math.max(0, maxCharsPerLine - 3)).trimEnd()}...`;
  }

  return wrappedLines.join("\n");
}

function placeLastSentenceOnOwnLine(text: string): string {
  const compact = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) return "";

  const matches = Array.from(compact.matchAll(/[.!?]["')\]]*\s+/g));
  if (!matches.length) {
    return compact;
  }

  const last = matches[matches.length - 1];
  const splitAt = (last.index ?? 0) + last[0].length;
  const head = compact.slice(0, splitAt).trim();
  const tail = compact.slice(splitAt).trim();

  if (!tail) {
    return compact;
  }

  return `${head}\n${tail}`;
}

// ========== RESILIENCE HELPERS FOR RASPBERRY PI ==========
// These helpers prevent server crashes by adding timeouts, concurrency control, and memory safeguards

/**
 * Wrap a promise with a timeout. If the promise doesn't resolve within the timeout,
 * reject with a timeout error.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string = "Operation timed out"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${timeoutMessage} (${timeoutMs}ms timeout)`)), timeoutMs)
    )
  ]);
}

/**
 * Manages concurrent slideshow rendering operations.
 * On Raspberry Pi, only 1 render should run at a time to prevent OOM.
 */
class SlideshowRenderQueue {
  private queue: Array<{
    id: string;
    fn: () => Promise<any>;
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }> = [];
  private running = 0;
  private readonly maxConcurrent = 1; // Pi can only handle 1 render at a time
  private readonly maxQueueLength = 10; // Prevent unbounded queue growth

  async enqueue<T>(id: string, fn: () => Promise<T>): Promise<T> {
    if (this.queue.length >= this.maxQueueLength) {
      throw new Error("Slideshow render queue is full. Please wait and try again.");
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ id, fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { id, fn, resolve, reject } = this.queue.shift()!;

    try {
      console.log(`[SlideshowQueue] Processing render ${id} (queue: ${this.queue.length})`);
      const result = await fn();
      resolve(result);
    } catch (err) {
      console.error(`[SlideshowQueue] Render ${id} failed:`, err);
      reject(err);
    } finally {
      this.running--;
      this.processQueue();
    }
  }
}

const slideshowRenderQueue = new SlideshowRenderQueue();

/**
 * Check available memory before starting memory-intensive operations.
 * Helps prevent OOM crashes on Raspberry Pi.
 */
function checkAvailableMemory(requiredMb: number = 256): boolean {
  const freeMem = os.freemem() / (1024 * 1024); // Convert to MB
  const available = freeMem > requiredMb;
  if (!available) {
    console.warn(`[Memory Check] Only ${Math.round(freeMem)}MB available, need ${requiredMb}MB`);
  }
  return available;
}

function isLikelyRaspberryPi(): boolean {
  if (process.env.KINQUEST_FORCE_PI_RENDER_PROFILE === "1") return true;
  if (process.env.KINQUEST_FORCE_PI_RENDER_PROFILE === "0") return false;

  const arch = os.arch();
  const armArch = arch === "arm" || arch === "arm64";
  if (!armArch) return false;

  try {
    const modelPath = "/proc/device-tree/model";
    if (fs.existsSync(modelPath)) {
      const model = fs.readFileSync(modelPath, "utf8").toLowerCase();
      if (model.includes("raspberry pi")) return true;
    }
  } catch {
    // Continue checking other hardware markers below.
  }

  try {
    const cpuInfoPath = "/proc/cpuinfo";
    if (fs.existsSync(cpuInfoPath)) {
      const cpuInfo = fs.readFileSync(cpuInfoPath, "utf8").toLowerCase();
      if (
        cpuInfo.includes("raspberry pi") ||
        cpuInfo.includes("bcm270") ||
        cpuInfo.includes("bcm271") ||
        cpuInfo.includes("bcm283")
      ) {
        return true;
      }
    }
  } catch {
    // No additional system hints available.
  }

  // Do not treat generic ARM servers as Raspberry Pi.
  return false;
}

const PI_CONSTRAINED_RENDER = isLikelyRaspberryPi();

function capSlidesForConstrainedRender<T>(slides: T[], maxSlides: number): T[] {
  if (slides.length <= maxSlides) return slides;

  const safeMax = Math.max(2, maxSlides);
  const indices: number[] = [];
  for (let i = 0; i < safeMax; i += 1) {
    indices.push(Math.round((i * (slides.length - 1)) / (safeMax - 1)));
  }

  const uniqueSorted = Array.from(new Set(indices)).sort((a, b) => a - b);
  return uniqueSorted.map((idx) => slides[idx]).filter((entry): entry is T => entry !== undefined);
}

const AI_JUDGE_MODEL_COST_USD_PER_SUBMISSION: Record<"gemini-3.5-flash" | "gemini-2.0-flash", number> = {
  "gemini-3.5-flash": 0.0025,
  "gemini-2.0-flash": 0.0015,
};

function normalizeAiJudgeModel(raw: unknown): "gemini-3.5-flash" | "gemini-2.0-flash" {
  return raw === "gemini-2.0-flash" ? "gemini-2.0-flash" : "gemini-3.5-flash";
}

function normalizeSlideshowModel(raw: unknown): string {
  const model = typeof raw === "string" ? raw.trim() : "";
  if (!model) return OLLAMA_MODEL || "llama3.1";
  return model;
}

async function fetchAvailableSlideshowModels(): Promise<string[]> {
  return [OLLAMA_MODEL || "llama3.1"];
}

async function resolveImagePathForRender(imageUrl: string, tmpDir: string): Promise<string | null> {
  const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";

  // Fast path for local uploads.
  if (imageUrl.startsWith("/api/uploads/")) {
    const filename = imageUrl.slice("/api/uploads/".length);
    const candidate = path.resolve(path.join(uploadsDir, filename));
    const uploadsRoot = path.resolve(uploadsDir);
    if (!candidate.startsWith(uploadsRoot)) return null;
    if (!fs.existsSync(candidate)) return null;
    return candidate;
  }

  // Support absolute local paths under uploads root.
  if (imageUrl.startsWith("/")) {
    const candidate = path.resolve(imageUrl);
    const uploadsRoot = path.resolve(uploadsDir);
    if (candidate.startsWith(uploadsRoot) && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback: download external URL to temp file.
  if (/^https?:\/\//i.test(imageUrl)) {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const filePath = path.join(tmpDir, `remote_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`);
    const data = Buffer.from(await response.arrayBuffer());
    await fsp.writeFile(filePath, data);
    return filePath;
  }

  return null;
}

function wrapTextForCard(text: string, maxCharsPerLine: number, maxLines: number): string {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const words = cleaned.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!word) continue;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
      if (lines.length >= maxLines) break;
    }

    if (word.length > maxCharsPerLine) {
      lines.push(word.slice(0, maxCharsPerLine));
      if (lines.length >= maxLines) break;
      current = word.slice(maxCharsPerLine);
    } else {
      current = word;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (!lines.length) return "";

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, maxCharsPerLine - 3)).trimEnd()}...`;
  }

  return lines.join("\n");
}

function normalizeMissionCardText(raw: unknown): string {
  return String(raw || "")
    // Handle escaped newline sequences from serialized payloads.
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    // Handle literal newline/control characters.
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    // Strip zero-width and direction/control formatting marks.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    // Handle visible control pictures that can show as boxed glyphs.
    .replace(/[\u240D\u240A]/g, "\n")
    .replace(/[\u2400-\u2421\u25A0-\u25FF\uFFFD]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeOverlayTextForFfmpeg(raw: unknown): string {
  return String(raw || "")
    // Handle escaped newline sequences from serialized payloads.
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/\u0085/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    // Handle visible control pictures that render as boxed glyphs in drawtext.
    .replace(/[\u2400-\u2421\u25A0-\u25FF\uFFFD]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Final sanitization before writing text to disk for FFmpeg drawtext. Strips any control char except LF. */
function sanitizeTextForFfmpegFile(text: string): string {
  return String(text || "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/[\u2400-\u2421\u25A0-\u25FF\uFFFD]/g, "")
    .replace(/[^\n\x20-\x7E\u00A0-\uFFFF]/g, "")
    .trim();
}

// Temporary deep debug for mission-card text artifacts in rendered video overlays.
const ENABLE_MISSION_TEXT_BYTE_DEBUG = (process.env.KINQUEST_MISSION_TEXT_DEBUG || "1").trim() !== "0";

function formatUtf8ByteHex(text: string): string {
  const bytes = Buffer.from(String(text || ""), "utf8");
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

function logMissionTextByteDebug(
  slideshowId: string,
  slideIndex: number,
  title: string,
  description: string
) {
  if (!ENABLE_MISSION_TEXT_BYTE_DEBUG) return;

  const titleHex = formatUtf8ByteHex(title);
  const descriptionHex = formatUtf8ByteHex(description);

  console.log(
    `[MISSION_TEXT_DEBUG] slideshow=${slideshowId} slide=${slideIndex} title_json=${JSON.stringify(title)} title_hex=${titleHex}`
  );
  console.log(
    `[MISSION_TEXT_DEBUG] slideshow=${slideshowId} slide=${slideIndex} description_json=${JSON.stringify(description)} description_hex=${descriptionHex}`
  );
}

async function renderSlideshowMp4(
  slideshowId: string,
  slides: Array<{ imageUrl?: string; overlayText?: string; durationSeconds?: number; transition?: string; isTitleCard?: boolean }>,
  options?: { requestedSongQueries?: string[] }
): Promise<{ outputPath: string; outputUrl: string }> {
  if (!slides.length) {
    throw new Error("No images available to render slideshow video");
  }

  const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
  const videosDir = path.join(uploadsDir, "slideshows");
  await fsp.mkdir(videosDir, { recursive: true });

  const cleanId = sanitizeSlideshowId(slideshowId);
  if (!cleanId) throw new Error("Invalid slideshow id");

  const outputPath = path.join(videosDir, `${cleanId}.mp4`);
  const outputUrl = `/api/slideshows/video/${cleanId}.mp4`;

  const maxSlides = PI_CONSTRAINED_RENDER ? 45 : 90;
  const safeSlides = capSlidesForConstrainedRender(slides, maxSlides);
  if (safeSlides.length < slides.length) {
    console.warn(`[SlideshowRender] Reduced slide count from ${slides.length} to ${safeSlides.length} for safer rendering`);
  }

  const requiredMemoryMb = PI_CONSTRAINED_RENDER ? 700 : 512;
  if (!checkAvailableMemory(requiredMemoryMb)) {
    throw new Error(`Insufficient free memory for slideshow render. Need at least ${requiredMemoryMb}MB available.`);
  }

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "kinquest-slideshow-"));

  try {
    const resolvedSlides: Array<{ imagePath: string | null; overlayText: string; durationSeconds: number; transition: string; isTitleCard: boolean }> = [];
    for (const slide of safeSlides) {
      let resolved: string | null = null;
      if (slide.imageUrl) {
        resolved = await resolveImagePathForRender(slide.imageUrl, tmpDir);
      }
      const isTitleCard = slide.isTitleCard === true;
      if (!resolved && !isTitleCard) continue;
      resolvedSlides.push({
        imagePath: resolved,
        overlayText: normalizeOverlayTextForFfmpeg(slide.overlayText),
        durationSeconds: Math.max(2, Math.min(Number(slide.durationSeconds) || 5, 8)),
        transition: String(slide.transition || "fade").toLowerCase(),
        isTitleCard,
      });
    }

    if (!resolvedSlides.length) {
      throw new Error("Could not resolve slideshow images for rendering");
    }

    // xfade can stall on some constrained ARM FFmpeg builds; prefer concat there for stable playback.
    // Prefer hard cuts for maximum playback compatibility across browsers/devices.
    const transitionSeconds = 0;
    const totalDurationSeconds = resolvedSlides.reduce((sum, s) => sum + s.durationSeconds, 0) + transitionSeconds;
    const fadeOutStart = Math.max(totalDurationSeconds - 1.5, 0);

    const renderWidth = PI_CONSTRAINED_RENDER ? 960 : 1280;
    const renderHeight = PI_CONSTRAINED_RENDER ? 540 : 720;
    const renderFps = PI_CONSTRAINED_RENDER ? 24 : 30;
    const renderAudioBitrate = PI_CONSTRAINED_RENDER ? "96k" : "160k";
    const renderPreset = PI_CONSTRAINED_RENDER ? "ultrafast" : "veryfast";
    const renderCrf = PI_CONSTRAINED_RENDER ? "29" : "24";
    const renderThreads = PI_CONSTRAINED_RENDER ? "1" : "2";
    const titleFontSize = PI_CONSTRAINED_RENDER ? 44 : 64;
    const descriptionFontSize = PI_CONSTRAINED_RENDER ? 28 : 40;
    const overlayFontSize = PI_CONSTRAINED_RENDER ? 24 : 34;

    const musicResolution = await resolveBackgroundMusicTrack(tmpDir, options?.requestedSongQueries || []);
    const selectedBackgroundMusic = musicResolution.filePath;

    const audioInputArgs = selectedBackgroundMusic
      ? ["-stream_loop", "-1", "-i", selectedBackgroundMusic]
      : ["-f", "lavfi", "-t", String(totalDurationSeconds), "-i", "anullsrc=r=44100:cl=stereo"];
    const audioMapSpecifier = `${resolvedSlides.length}:a`;
    const audioFilter = selectedBackgroundMusic
      ? `volume=${PI_CONSTRAINED_RENDER ? "0.18" : "0.22"},afade=t=in:st=0:d=1.2,afade=t=out:st=${fadeOutStart}:d=1.5`
      : `afade=t=in:st=0:d=1.2,afade=t=out:st=${fadeOutStart}:d=1.5`;

    if (selectedBackgroundMusic) {
      console.log("[SlideshowRender] Using background music track:", selectedBackgroundMusic, `(${musicResolution.source})`);
    } else {
      console.log("[SlideshowRender] No background music track found; using silence track", `(${musicResolution.source})`);
    }

    const ffmpegInputs: string[] = [];
    resolvedSlides.forEach((slide) => {
      const clipDurationSeconds = slide.durationSeconds + transitionSeconds;
      if (slide.isTitleCard) {
        ffmpegInputs.push("-f", "lavfi", "-t", String(clipDurationSeconds), "-i", `color=c=0x111827:s=${renderWidth}x${renderHeight}`);
      } else {
        ffmpegInputs.push("-loop", "1", "-t", String(clipDurationSeconds), "-i", String(slide.imagePath));
      }
    });

    const scalePadFilter = `scale=${renderWidth}:${renderHeight}:force_original_aspect_ratio=decrease,pad=${renderWidth}:${renderHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
    const videoLabelParts: string[] = [];
    const fontCandidates = [
      process.env.FFMPEG_FONTFILE || "",
      "/usr/share/fonts/TTF/DejaVuSans.ttf",
      "/usr/share/fonts/dejavu/DejaVuSans.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    ].filter(Boolean);
    const selectedFontFile = fontCandidates.find((candidate) => fs.existsSync(candidate));

    if (!selectedFontFile) {
      throw new Error("No usable font file found for FFmpeg drawtext. Set FFMPEG_FONTFILE or install ttf-dejavu.");
    }

    const escapedFontFile = selectedFontFile.replace(/'/g, "'\\''");

    resolvedSlides.forEach((slide, idx) => {
      const textFilePath = path.join(tmpDir, `overlay_${idx}.txt`);

      if (slide.isTitleCard) {
        const [rawTitle, ...rawDescriptionParts] = normalizeOverlayTextForFfmpeg(slide.overlayText).split("\n");
        const titleText = String(rawTitle || "").trim();
        const title = wrapTextForCard(titleText, 30, 2);
        const rawDescriptionText = rawDescriptionParts.join("\n").trim();
        const shouldPreserveExplicitLines = titleText.toLowerCase() === "final standings";
        const descriptionInput = shouldPreserveExplicitLines
          ? rawDescriptionText
          : placeLastSentenceOnOwnLine(rawDescriptionText);
        const description = wrapMultilineTextForCard(descriptionInput, 48, 6);
        const sanitizedTitle = sanitizeTextForFfmpegFile(title || "");
        const sanitizedDescription = sanitizeTextForFfmpegFile(description || "");
        const titleLines = sanitizedTitle.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
        const descriptionLines = sanitizedDescription.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);

        const titleTextFilePath = path.join(tmpDir, `overlay_${idx}_title.txt`);
        const descriptionTextFilePath = path.join(tmpDir, `overlay_${idx}_description.txt`);
        fs.writeFileSync(titleTextFilePath, sanitizedTitle, "utf8");
        fs.writeFileSync(descriptionTextFilePath, sanitizedDescription, "utf8");
        logMissionTextByteDebug(slideshowId, idx, sanitizedTitle, sanitizedDescription);

        const drawMissionTextFilters: string[] = [];
        const titleBaseY = 72;
        const titleLineHeight = Math.round(titleFontSize * 1.2);
        const descriptionBaseY = 210;
        const descriptionLineHeight = Math.round(descriptionFontSize * 1.22);

        if (titleLines.length === 0) {
          const drawTitle = `drawtext=fontfile='${escapedFontFile}':textfile='${titleTextFilePath.replace(/'/g, "'\\''")}':fontcolor=white:fontsize=${titleFontSize}:borderw=4:bordercolor=black@0.70:shadowcolor=black@0.45:shadowx=2:shadowy=2:x=(w-text_w)/2:y=${titleBaseY}`;
          drawMissionTextFilters.push(drawTitle);
        } else {
          titleLines.forEach((line, lineIdx) => {
            const linePath = path.join(tmpDir, `overlay_${idx}_title_line_${lineIdx}.txt`);
            fs.writeFileSync(linePath, sanitizeTextForFfmpegFile(line), "utf8");
            drawMissionTextFilters.push(
              `drawtext=fontfile='${escapedFontFile}':textfile='${linePath.replace(/'/g, "'\\''")}':fontcolor=white:fontsize=${titleFontSize}:borderw=4:bordercolor=black@0.70:shadowcolor=black@0.45:shadowx=2:shadowy=2:x=(w-text_w)/2:y=${titleBaseY + lineIdx * titleLineHeight}`
            );
          });
        }

        if (descriptionLines.length === 0) {
          const drawDescription = `drawtext=fontfile='${escapedFontFile}':textfile='${descriptionTextFilePath.replace(/'/g, "'\\''")}':fontcolor=white:fontsize=${descriptionFontSize}:borderw=3:bordercolor=black@0.65:shadowcolor=black@0.40:shadowx=2:shadowy=2:x=(w-text_w)/2:y=${descriptionBaseY}`;
          drawMissionTextFilters.push(drawDescription);
        } else {
          descriptionLines.forEach((line, lineIdx) => {
            const linePath = path.join(tmpDir, `overlay_${idx}_description_line_${lineIdx}.txt`);
            fs.writeFileSync(linePath, sanitizeTextForFfmpegFile(line), "utf8");
            drawMissionTextFilters.push(
              `drawtext=fontfile='${escapedFontFile}':textfile='${linePath.replace(/'/g, "'\\''")}':fontcolor=white:fontsize=${descriptionFontSize}:borderw=3:bordercolor=black@0.65:shadowcolor=black@0.40:shadowx=2:shadowy=2:x=(w-text_w)/2:y=${descriptionBaseY + lineIdx * descriptionLineHeight}`
            );
          });
        }

        videoLabelParts.push(`[${idx}:v]${scalePadFilter},${drawMissionTextFilters.join(",")},fps=${renderFps},format=rgba[v${idx}]`);
      } else {
        fs.writeFileSync(textFilePath, sanitizeTextForFfmpegFile(normalizeOverlayTextForFfmpeg(slide.overlayText)), "utf8");
        const drawText = `drawtext=fontfile='${escapedFontFile}':textfile='${textFilePath.replace(/'/g, "'\\''")}':fontcolor=white:fontsize=${overlayFontSize}:line_spacing=8:borderw=3:bordercolor=black@0.65:shadowcolor=black@0.45:shadowx=2:shadowy=2:x=w-text_w-40:y=h-text_h-32`;
        videoLabelParts.push(`[${idx}:v]${scalePadFilter},${drawText},fps=${renderFps},format=rgba[v${idx}]`);
      }
    });

    let filterComplex = "";
    if (resolvedSlides.length === 1) {
      filterComplex = `${videoLabelParts.join(";")};[v0]format=yuv420p[vfinal]`;
    } else if (transitionSeconds > 0) {
      let currentLabel = "v0";
      let cumulativeOffset = resolvedSlides[0]?.durationSeconds || 0;
      for (let idx = 1; idx < resolvedSlides.length; idx += 1) {
        const previous = currentLabel;
        const next = `v${idx}`;
        const output = `vx${idx}`;
        const transitionName = [
          "fade",
          "wipeleft",
          "wiperight",
          "slideleft",
          "slideright",
          "circlecrop",
          "smoothleft",
          "smoothright"
        ].includes(resolvedSlides[idx].transition)
          ? resolvedSlides[idx].transition
          : "fade";
        videoLabelParts.push(`[${previous}][${next}]xfade=transition=${transitionName}:duration=${transitionSeconds}:offset=${cumulativeOffset}[${output}]`);
        cumulativeOffset += resolvedSlides[idx].durationSeconds;
        currentLabel = output;
      }
      filterComplex = `${videoLabelParts.join(";")};[${currentLabel}]format=yuv420p[vfinal]`;
    } else {
      const concatInputs = resolvedSlides.map((_, idx) => `[v${idx}]`).join("");
      filterComplex = `${videoLabelParts.join(";")};${concatInputs}concat=n=${resolvedSlides.length}:v=1:a=0,format=yuv420p[vfinal]`;
    }

    // RESILIENCE: Add timeout protection for FFmpeg to prevent hung processes on Raspberry Pi
    const FFMPEG_TIMEOUT_MS = 300000; // 5 minutes - reasonable for even high-res on Pi
    const ffmpegPromise = new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-y",
        ...ffmpegInputs,
        ...audioInputArgs,
        "-filter_complex", filterComplex,
        "-map", "[vfinal]",
        "-map", audioMapSpecifier,
        "-shortest",
        "-r", String(renderFps),
        "-c:v", "libx264",
        "-profile:v", "baseline",
        "-level", "3.1",
        "-g", String(renderFps * 2),
        "-keyint_min", String(renderFps),
        "-sc_threshold", "0",
        "-preset", renderPreset,
        "-crf", renderCrf,
        "-threads", renderThreads,
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", renderAudioBitrate,
        "-af", audioFilter,
        "-pix_fmt", "yuv420p",
        "-maxrate", PI_CONSTRAINED_RENDER ? "1200k" : "2200k",
        "-bufsize", PI_CONSTRAINED_RENDER ? "2400k" : "4400k",
        "-movflags", "+faststart",
        outputPath
      ]);

      let stderr = "";
      ffmpeg.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      ffmpeg.on("error", (err: any) => {
        if (err?.code === "ENOENT") {
          reject(new Error("FFmpeg is not installed on the server"));
          return;
        }
        reject(err);
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}`));
      });

      // Set timeout to kill process if it runs too long
      const timeout = setTimeout(() => {
        ffmpeg.kill("SIGKILL");
        reject(new Error(`FFmpeg rendering timeout (${FFMPEG_TIMEOUT_MS}ms). Process killed to prevent Pi lockup.`));
      }, FFMPEG_TIMEOUT_MS);

      ffmpeg.on("close", () => clearTimeout(timeout));
    });

    await ffmpegPromise;

    return { outputPath, outputUrl };
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
}

// ========== SERVER LOGGING SYSTEM ==========
// In-memory circular buffer for server logs (last 1000 entries)
const MAX_LOG_ENTRIES = 1000;
interface LogEntry {
  timestamp: string;
  level: "log" | "error" | "warn" | "info";
  message: string;
}
const logBuffer: LogEntry[] = [];

interface CpuTimesSnapshot {
  idle: number;
  total: number;
}

interface TopProcessUsage {
  pid: number;
  command: string;
  cpuPercent: number;
  memoryPercent: number;
  rssMb: number;
}

let lastCpuSnapshot: CpuTimesSnapshot[] | null = null;

// Capture console output
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

const addLogEntry = (level: "log" | "error" | "warn" | "info", args: any[]) => {
  const message = args.map(arg => {
    if (typeof arg === "object") {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(" ");

  const timestamp = new Date().toISOString().split("T")[1].split(".")[0]; // HH:MM:SS format
  const entry: LogEntry = { timestamp, level, message };
  
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift(); // Remove oldest entry
  }
};

console.log = (...args: any[]) => {
  originalLog(...args);
  addLogEntry("log", args);
};

console.error = (...args: any[]) => {
  originalError(...args);
  addLogEntry("error", args);
};

console.warn = (...args: any[]) => {
  originalWarn(...args);
  addLogEntry("warn", args);
};

console.info = (...args: any[]) => {
  originalInfo(...args);
  addLogEntry("info", args);
};

function takeCpuSnapshot(): CpuTimesSnapshot[] {
  return os.cpus().map((core) => {
    const times = core.times;
    const total = times.user + times.nice + times.sys + times.idle + times.irq;
    return {
      idle: times.idle,
      total,
    };
  });
}

function computeUsagePercent(previous: CpuTimesSnapshot, current: CpuTimesSnapshot): number {
  const totalDelta = current.total - previous.total;
  const idleDelta = current.idle - previous.idle;
  if (totalDelta <= 0) return 0;
  const usage = ((totalDelta - idleDelta) / totalDelta) * 100;
  return Number(Math.max(0, Math.min(100, usage)).toFixed(1));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCpuUsageMetrics(): Promise<{ totalUsagePercent: number; perCoreUsagePercent: Array<{ core: number; usagePercent: number }> }> {
  let previous = lastCpuSnapshot;
  if (!previous) {
    previous = takeCpuSnapshot();
    await delay(250);
  }

  let current = takeCpuSnapshot();

  // If both samples were captured too close together, wait briefly for meaningful deltas.
  const totalDelta = current.reduce((sum, snap, idx) => sum + (snap.total - (previous?.[idx]?.total ?? 0)), 0);
  if (totalDelta <= 0) {
    await delay(150);
    current = takeCpuSnapshot();
  }

  const perCoreUsagePercent = current.map((snap, idx) => ({
    core: idx,
    usagePercent: computeUsagePercent(previous?.[idx] ?? snap, snap),
  }));

  lastCpuSnapshot = current;

  const totalUsagePercent = Number(
    (
      perCoreUsagePercent.reduce((sum, core) => sum + core.usagePercent, 0) /
      Math.max(1, perCoreUsagePercent.length)
    ).toFixed(1)
  );

  return { totalUsagePercent, perCoreUsagePercent };
}

function getTopProcesses(limit: number = 5): Promise<TopProcessUsage[]> {
  return new Promise((resolve) => {
    const ps = spawn("ps", ["-eo", "pid,comm,%cpu,%mem,rss", "--sort=-%cpu"]);
    let stdout = "";

    ps.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    ps.on("error", (err) => {
      console.warn("Failed to read process usage via ps:", err);
      resolve([]);
    });

    ps.on("close", (code) => {
      if (code !== 0) {
        resolve([]);
        return;
      }

      const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => !!line);

      const rows = lines.slice(1, limit + 1);
      const parsed = rows
        .map((row) => {
          const parts = row.split(/\s+/);
          if (parts.length < 5) return null;

          const pid = Number(parts[0]);
          const command = parts[1];
          const cpuPercent = Number(parts[2]);
          const memoryPercent = Number(parts[3]);
          const rssKb = Number(parts[4]);

          if (!Number.isFinite(pid) || !command) return null;

          return {
            pid,
            command,
            cpuPercent: Number((Number.isFinite(cpuPercent) ? cpuPercent : 0).toFixed(1)),
            memoryPercent: Number((Number.isFinite(memoryPercent) ? memoryPercent : 0).toFixed(1)),
            rssMb: Number(((Number.isFinite(rssKb) ? rssKb : 0) / 1024).toFixed(1)),
          } satisfies TopProcessUsage;
        })
        .filter((entry): entry is TopProcessUsage => !!entry)
        .slice(0, limit);

      resolve(parsed);
    });
  });
}

async function probeServiceConnectivity(
  baseUrl: string,
  paths: string[],
  auth: { apiKey?: string; username?: string; password?: string }
): Promise<{ configured: boolean; reachable: boolean; endpoint: string | null; statusCode: number | null; latencyMs: number | null; error: string | null }> {
  const normalizedBase = normalizeServerUrl(baseUrl || "");
  if (!normalizedBase) {
    return {
      configured: false,
      reachable: false,
      endpoint: null,
      statusCode: null,
      latencyMs: null,
      error: "not_configured",
    };
  }

  let lastError: string | null = null;
  for (const pathSuffix of paths) {
    const endpoint = `${normalizedBase}${pathSuffix}`;
    const started = Date.now();
    try {
      const response = await withTimeout(
        fetch(endpoint, {
          method: "GET",
          headers: {
            ...buildAuthHeaders(auth),
          },
        }),
        5000,
        `Health check ${endpoint}`
      );

      const latencyMs = Date.now() - started;
      return {
        configured: true,
        reachable: true,
        endpoint,
        statusCode: response.status,
        latencyMs,
        error: null,
      };
    } catch (err: any) {
      lastError = err?.message || "request_failed";
    }
  }

  return {
    configured: true,
    reachable: false,
    endpoint: null,
    statusCode: null,
    latencyMs: null,
    error: lastError,
  };
}

async function validateAdminUserFromQuery(req: express.Request, res: express.Response): Promise<boolean> {
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;
  if (!userId) {
    res.status(400).json({ error: "userId query parameter is required" });
    return false;
  }

  try {
    const state = await getAppState();
    const requestingUser = state.users[userId];
    if (!requestingUser || requestingUser.role !== "admin") {
      res.status(403).json({ error: "Only admin users can access server diagnostics" });
      return false;
    }
    return true;
  } catch (err: any) {
    res.status(500).json({ error: "Failed to verify admin access", details: err?.message || "unknown error" });
    return false;
  }
}

// 1. Database status route - now exclusively Supabase
app.get("/api/db-status", (req, res) => {
  res.json({
    status: "supabase_required"
  });
});

// Server logs endpoints (admin only)
app.get("/api/server-logs", async (req, res) => {
  if (!(await validateAdminUserFromQuery(req, res))) return;
  res.json({ logs: logBuffer });
});

app.delete("/api/server-logs", async (req, res) => {
  if (!(await validateAdminUserFromQuery(req, res))) return;
  logBuffer.length = 0;
  res.json({ message: "Logs cleared" });
});

app.get("/api/admin/resource-monitor", async (req, res) => {
  if (!(await validateAdminUserFromQuery(req, res))) return;

  try {
    const cpu = await getCpuUsageMetrics();
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    const memoryUsagePercent = Number(((usedBytes / Math.max(1, totalBytes)) * 100).toFixed(1));
    const topProcesses = await getTopProcesses(5);

    res.json({
      timestamp: new Date().toISOString(),
      cpu,
      memory: {
        totalBytes,
        usedBytes,
        freeBytes,
        usagePercent: memoryUsagePercent,
      },
      topProcesses,
    });
  } catch (err: any) {
    console.error("Failed to gather resource monitor data:", err);
    res.status(500).json({ error: "Failed to retrieve resource monitor data", details: err?.message || "unknown error" });
  }
});

app.get("/api/admin/ai-health", async (req, res) => {
  if (!(await validateAdminUserFromQuery(req, res))) return;

  try {
    const [ollama, presenton] = await Promise.all([
      probeServiceConnectivity(OLLAMA_SERVER_URL, ["/api/tags", "/"], { apiKey: OLLAMA_API_KEY }),
      probeServiceConnectivity(PRESENTON_SERVER_URL, ["/health", "/api/health", "/"], {
        ...buildPresentonAuthConfig(),
      }),
    ]);

    const overallOk = ollama.reachable && (!presenton.configured || presenton.reachable);
    res.status(overallOk ? 200 : 503).json({
      overallOk,
      services: {
        ollama,
        presenton,
      },
      configured: {
        ollamaModel: OLLAMA_MODEL,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      overallOk: false,
      error: err?.message || "Failed to run AI health checks",
      timestamp: new Date().toISOString(),
    });
  }
});

// App settings endpoints
app.get("/api/settings", (req, res) => {
  res.json(getAppSettings());
});

app.get("/api/ai-model-catalog", async (_req, res) => {
  const slideshowModels = await fetchAvailableSlideshowModels();
  res.json({
    aiJudgeModels: Object.entries(AI_JUDGE_MODEL_COST_USD_PER_SUBMISSION).map(([model, estimatedCostUsdPerSubmission]) => ({
      model,
      estimatedCostUsdPerSubmission,
    })),
    slideshowModels: slideshowModels.map((model) => ({
      model,
      baseUsd: null,
      perPhotoUsd: null,
      provider: "ollama",
      serverUrl: normalizeServerUrl(OLLAMA_SERVER_URL),
    })),
    slideshowProvider: {
      provider: "ollama_presenton",
      ollamaServerUrl: normalizeServerUrl(OLLAMA_SERVER_URL),
      presentonServerUrl: normalizeServerUrl(PRESENTON_SERVER_URL),
    },
  });
});

app.post("/api/settings", (req, res) => {
  const { name, icon, mapMode, defaultLat, defaultLng, defaultRadius, aiPromptCriteria, aiJudgeModel, aiVerificationEnabled, allowForceSubmit, activeInviteCode, inviteRequired, imageCompressionMaxDim, imageCompressionQuality, showTitle, showLogo, chatDisabledByAdmin } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "App name must be a non-empty string" });
  }
  const normalizedMapMode =
    mapMode === "satellite_labels" || mapMode === "missions_only" || mapMode === "disabled"
      ? mapMode
      : "original";

  const updated: AppSettings = {
    name: name.trim(),
    icon: icon || null,
    mapMode: normalizedMapMode,
    defaultLat: defaultLat !== undefined ? Number(defaultLat) : undefined,
    defaultLng: defaultLng !== undefined ? Number(defaultLng) : undefined,
    defaultRadius: defaultRadius !== undefined ? Number(defaultRadius) : undefined,
    aiPromptCriteria: aiPromptCriteria !== undefined ? String(aiPromptCriteria).trim() : undefined,
    aiJudgeModel: aiJudgeModel !== undefined ? normalizeAiJudgeModel(aiJudgeModel) : undefined,
    aiVerificationEnabled: aiVerificationEnabled !== undefined ? !!aiVerificationEnabled : undefined,
    allowForceSubmit: allowForceSubmit !== undefined ? !!allowForceSubmit : undefined,
    activeInviteCode: activeInviteCode !== undefined ? String(activeInviteCode).trim().toLowerCase() : undefined,
    inviteRequired: inviteRequired !== undefined ? !!inviteRequired : undefined,
    imageCompressionMaxDim: imageCompressionMaxDim !== undefined ? Number(imageCompressionMaxDim) : undefined,
    imageCompressionQuality: imageCompressionQuality !== undefined ? Number(imageCompressionQuality) : undefined,
    showTitle: showTitle !== undefined ? !!showTitle : undefined,
    showLogo: showLogo !== undefined ? !!showLogo : undefined,
    chatDisabledByAdmin: chatDisabledByAdmin !== undefined ? !!chatDisabledByAdmin : undefined
  };
  saveAppSettings(updated);
  res.json({ success: true, settings: updated });
});

// Storage info endpoint: disk space and expected image payload size
app.get("/api/storage-info", async (req, res) => {
  try {
    const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
    const settings = getAppSettings();
    
    // Get disk space using statfs
    const stats = await fs.promises.statfs(uploadsDir.split("/")[1] ? "/" : uploadsDir);
    const freeBytes = stats.bavail * stats.bsize;
    const totalBytes = stats.blocks * stats.bsize;
    const usedBytes = totalBytes - (stats.bfree * stats.bsize);
    
    // Calculate estimated image payload size based on compression settings
    const maxDim = settings.imageCompressionMaxDim || 800;
    const quality = settings.imageCompressionQuality || 0.7;
    
    // Empirical formula: pixel_count^0.7 * quality_factor
    // At 800px and 0.7 quality: ~90KB average
    const pixelArea = maxDim * maxDim;
    const estimatedKb = Math.round((Math.pow(pixelArea / 1000000, 0.7) * 100) * quality);
    const estimatedBytes = estimatedKb * 1024;
    
    // Calculate how many images could fit
    const imagesRemainingCapacity = Math.floor(freeBytes / estimatedBytes);
    
    res.json({
      freeBytes,
      totalBytes,
      usedBytes,
      freeGb: (freeBytes / (1024 ** 3)).toFixed(2),
      usedGb: (usedBytes / (1024 ** 3)).toFixed(2),
      totalGb: (totalBytes / (1024 ** 3)).toFixed(2),
      estimatedImageSizeKb: estimatedKb,
      imageCompressionMaxDim: maxDim,
      imageCompressionQuality: quality,
      imagesRemainingCapacity
    });
  } catch (err: any) {
    console.error("Failed to get storage info:", err);
    res.status(500).json({ error: "Failed to retrieve storage info", details: err.message });
  }
});

// 2. Fetch live integrated state of play
app.get("/api/game-state", async (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;

  if (sessionId && userId) {
    const validSession = hasActiveUserSession(sessionId, userId);
    if (!validSession) {
      return res.status(401).json({ error: "Session expired or invalid" });
    }
  }

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

// 2.5 Full game-data backup snapshot (admin only)
app.get("/api/admin/backup", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;

  if (!userId) {
    return res.status(400).json({ error: "userId query parameter is required" });
  }

  try {
    const state = await getAppState();
    const requestingUser = state.users[userId];
    if (!requestingUser || requestingUser.role !== "admin") {
      return res.status(403).json({ error: "Only admin users can download a backup" });
    }

    const settings = getAppSettings();

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: requestingUser.username,
      version: 1,
      settings,
      users: Object.values(state.users),
      items: Object.values(state.items),
      submissions: Object.values(state.submissions),
      messages: state.messages,
      slideshows: Object.values(state.slideshows),
    };

    const filename = `kinquest-backup-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(backup, null, 2));
  } catch (err: any) {
    console.error("Backup error:", err);
    return res.status(500).json({ error: "Failed to generate backup", details: err?.message || "Unknown error" });
  }
});

// 2.6 Restore game data from backup (admin only)
app.post("/api/admin/restore", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;
  const backup = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId query parameter is required" });
  }

  if (!backup || typeof backup !== "object") {
    return res.status(400).json({ error: "Backup data is required in request body" });
  }

  try {
    const state = await getAppState();
    const requestingUser = state.users[userId];
    if (!requestingUser || requestingUser.role !== "admin") {
      return res.status(403).json({ error: "Only admin users can restore a backup" });
    }

    const result = await restoreFromBackup(backup);
    return res.json({
      success: true,
      message: "Backup restored successfully",
      restored: result
    });
  } catch (err: any) {
    console.error("Restore error:", err);
    return res.status(500).json({ error: "Failed to restore backup", details: err?.message || "Unknown error" });
  }
});

// 3. Authenticate / register callsing profile
app.post("/api/auth/admin-verify", (req, res) => {
  const { password, existingSessionId } = req.body;
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
    return res.json({ success: true, passwordConfigured: false, sessionId: null });
  }

  if (!envMatch && !storeMatch) {
    return res.status(401).json({ error: "Invalid admin password" });
  }

  // Password verified - create a new session
  try {
    const session = createOrReuseAdminSession(
      typeof existingSessionId === "string" && existingSessionId.trim().length > 0
        ? existingSessionId.trim()
        : undefined
    );
    res.json({
      success: true,
      passwordConfigured: true,
      sessionId: session.id,
      activeSessions: getActiveSessionsCount()
    });
  } catch (err: any) {
    // Session limit reached
    const activeSessions = getActiveSessionsCount();
    res.status(429).json({ 
      error: err.message || "Admin session limit reached",
      activeSessions,
      maxSessions: 2
    });
  }
});

// Refresh admin session activity (sliding expiration)
app.post("/api/auth/admin-session/refresh", (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const ok = updateAdminSessionActivity(sessionId);
  if (!ok) {
    return res.status(401).json({ error: "Admin session is invalid or expired" });
  }

  res.json({ success: true, sessionId, activeSessions: getActiveSessionsCount() });
});

// Explicitly terminate an admin session
app.post("/api/auth/admin-session/logout", (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }

  endAdminSession(sessionId);
  res.json({ success: true, activeSessions: getActiveSessionsCount() });
});

app.get("/api/auth/admin-session/status", (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  const currentSessionActive = sessionId ? updateAdminSessionActivity(sessionId) : false;

  res.json({
    activeSessions: getActiveSessionsCount(),
    currentSessionId: sessionId || null,
    currentSessionActive,
    maxSessions: 2
  });
});

app.post("/api/auth/session/refresh", (req, res) => {
  const { sessionId, userId } = req.body;
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId is required" });
  }

  const session = refreshUserSession(sessionId, userId);
  if (!session) {
    return res.status(401).json({ error: "User session is invalid or expired" });
  }

  res.json({
    success: true,
    sessionId: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt
  });
});

app.post("/api/auth/session/logout", (req, res) => {
  const { sessionId, userId } = req.body;
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "sessionId is required" });
  }

  endUserSession(sessionId, typeof userId === "string" ? userId : undefined);
  res.json({ success: true });
});

// Change admin password endpoint
app.post("/api/admin/change-password", (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || typeof currentPassword !== "string") {
    return res.status(400).json({ error: "Current password is required" });
  }
  
  if (!newPassword || typeof newPassword !== "string") {
    return res.status(400).json({ error: "New password is required" });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }
  
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: "New password must be different from current password" });
  }
  
  try {
    changeAdminPassword(currentPassword, newPassword, "Admin changed password");
    res.json({ success: true, message: "Admin password changed successfully" });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to change admin password" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const { username, role, existingSessionId } = req.body;
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    return res.status(400).json({ error: "Username string is required" });
  }

  try {
    const user = await authRegisterPlayer(username.trim(), role);
    const normalizedRole = user.role === "admin" ? "admin" : "user";
    const session = createOrReuseUserSession(
      user.id,
      normalizedRole,
      typeof existingSessionId === "string" && existingSessionId.trim().length > 0
        ? existingSessionId.trim()
        : undefined
    );

    // Keep backwards compatibility by preserving user fields at top level.
    res.json({
      ...user,
      sessionId: session.id,
      sessionExpiresAt: session.expiresAt
    });
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

// Mark tutorial as complete for user
app.post("/api/tutorial/complete", async (req, res) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const result = await completeTutorial(userId);
    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true, profile: result });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to mark tutorial complete", details: err.message });
  }
});

// 4. Create custom scavenge check items
app.post("/api/challenges", async (req, res) => {
  const { title, description, points, category, icon, lat, lng, radius, createdBy, enforceGeofence } = req.body;

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
      radius: radius ? Number(radius) : null,
      createdBy: createdBy || undefined,
      enforceGeofence: enforceGeofence !== false
    });
    res.json(newItem);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save challenge description", details: err.message });
  }
});

// Delete a mission - admin or creator only
app.delete("/api/challenges/:id", async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!id || !userId) {
    return res.status(400).json({ error: "Missing challenge ID or user ID" });
  }

  try {
    const db = await getAppState();
    const item = db.items[id];

    if (!item) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const user = db.users[userId];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check permissions: admin or creator
    const isAdmin = user.role === "admin";
    const isCreator = item.createdBy === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: "You don't have permission to delete this mission" });
    }

    // Delete from database
    const success = await deleteScavengerChallenge(id);
    
    if (!success) {
      return res.status(500).json({ error: "Failed to delete mission" });
    }

    res.json({ success: true, message: "Mission deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete mission", details: err.message });
  }
});

// Update a specific challenge
app.put("/api/challenges/:id", async (req, res) => {
  const { id } = req.params;
  const { userId, title, description, points, category, icon, lat, lng, radius, enforceGeofence } = req.body;

  if (!id || !userId) {
    return res.status(400).json({ error: "Missing challenge ID or user ID" });
  }

  try {
    const db = await getAppState();
    const item = db.items[id];

    if (!item) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const user = db.users[userId];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check permissions: admin or creator
    const isAdmin = user.role === "admin";
    const isCreator = item.createdBy === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: "You don't have permission to edit this mission" });
    }

    // Prepare updates
    const updates: Partial<ScavengerItem> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (points !== undefined) updates.points = Number(points) || 10;
    if (category !== undefined) updates.category = category;
    if (icon !== undefined) updates.icon = icon;
    if (lat !== undefined) updates.lat = lat ? Number(lat) : null;
    if (lng !== undefined) updates.lng = lng ? Number(lng) : null;
    if (radius !== undefined) updates.radius = radius ? Number(radius) : null;
    if (enforceGeofence !== undefined) updates.enforceGeofence = !!enforceGeofence;

    // Update in database
    const updatedItem = await updateScavengerChallenge(id, updates);
    
    if (!updatedItem) {
      return res.status(500).json({ error: "Failed to update mission" });
    }

    res.json({ success: true, message: "Mission updated successfully", item: updatedItem });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update mission", details: err.message });
  }
});

// 5. Submit capture proof & trigger AI evaluation logic
app.post("/api/verify-submission", async (req, res) => {
  try {
    const { userId, itemId, imageBase64, userLat, userLng, forceSubmit, submissionId } = req.body;

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

    // Check if this is a force-submit of an existing rejected submission
    if (submissionId && forceSubmit === true) {
      const db = await getAppState();
      const existingSub = db.submissions[submissionId];
      
      if (existingSub && existingSub.status === "rejected") {
        // Update the existing submission instead of creating a new one
        existingSub.status = "approved";
        existingSub.forcedApproval = true;
        existingSub.aiExplanation = "Admin force-approved this submission.";
        existingSub.pointsAwarded = item.points; // Base points only, no creativity bonus for force-approval
        
        await submitHunterProof(existingSub, item.points);
        
        // Fetch updated user stats
        const freshDb = await getAppState();
        const updatedUser = freshDb.users[userId] || user;

        return res.json({
          isMatch: true,
          explanation: "Admin force-approved this submission.",
          confidence: 100,
          submission: existingSub,
          user: updatedUser
        });
      }
    }

    // Solve GPS metrics if geofenced
    let distanceMeters: number | null = null;
    let locationFailed = false;
    let gpsExplanation = "";

    if (item.enforceGeofence !== false && item.lat !== null && item.lng !== null && item.radius !== null) {
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
        pointsAwarded: 0,
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
    const aiJudgeModel = normalizeAiJudgeModel(currentSettings.aiJudgeModel);

    // Check if AI verification is disabled - auto-approve if so
    if (currentSettings.aiVerificationEnabled === false) {
      const subId2 = `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const autoApprovedSubmission: Submission = {
        id: subId2,
        userId: user.id,
        username: user.username,
        itemId: itemId,
        imageUrl: imageUrl,
        status: "approved",
        aiExplanation: "AI verification is currently disabled. Submission auto-approved by system.",
        pointsAwarded: item.points,
        createdAt: new Date().toISOString(),
        userLat: userLat ? Number(userLat) : null,
        userLng: userLng ? Number(userLng) : null,
        distanceMeters: distanceMeters
      };

      await submitHunterProof(autoApprovedSubmission, item.points);

      // Fetch updated user stats
      const freshDb = await getAppState();
      const updatedUser = freshDb.users[user.id] || user;

      return res.json({
        isMatch: true,
        explanation: "AI verification is currently disabled. Submission auto-approved by system.",
        confidence: 100,
        submission: autoApprovedSubmission,
        user: updatedUser
      });
    }

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
4. For creative submissions that go above and beyond, award bonus points by rating creativity on 0-100 scale.

You MUST respond strictly in valid JSON matching this schema:
{
  "isMatch": boolean,
  "explanation": "Referee explanation (1-2 sentences)",
  "confidence": number (integer 0-100 score indicating certainty),
  "creativityScore": number (integer 0-100; bonus points for creative approaches. 0=literal match, 50=creative twist, 100=amazingly creative)
}`;

    // Helper to check if error is a Gemini rate limit error
    function isGeminiRateLimitError(err: any): boolean {
      const errorMessage = String(err?.message || "").toLowerCase();
      const errorCode = err?.code || err?.status || "";
      
      // Check for common Gemini API rate limit indicators
      return (
        errorCode === 429 ||
        errorCode === "429" ||
        errorMessage.includes("rate limit") ||
        errorMessage.includes("quota") ||
        errorMessage.includes("too many requests") ||
        errorMessage.includes("resource exhausted") ||
        errorMessage.includes("RESOURCE_EXHAUSTED")
      );
    }

    let parsedResult = { isMatch: false, explanation: "Verification service timed out. Please try again.", confidence: 0, creativityScore: 0 };
    let rateLimited = false;
    
    try {
      const response = await ai.models.generateContent({
        model: aiJudgeModel,
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
              },
              creativityScore: {
                type: Type.INTEGER,
                description: "Creativity bonus score (0 to 100) for above-and-beyond submissions"
              }
            },
            required: ["isMatch", "explanation", "confidence", "creativityScore"]
          }
        }
      });
      parsedResult = JSON.parse((response.text || "{}").trim());
    } catch (aiErr: any) {
      console.error("Gemini AI API scanning error:", aiErr);
      
      // Check if this is a rate limit error
      if (isGeminiRateLimitError(aiErr)) {
        rateLimited = true;
        console.warn("⚠️ Gemini rate limit detected. Saving submission as pending for retry.");
      }
      
      // Keep gameplay flowing when external AI is unreachable:
      // queue only true rate-limits, otherwise gracefully approve.
      if (!rateLimited) {
        parsedResult = {
          isMatch: true, // fallback to gracious approval in sandbox on live API congestion
          explanation: "The AI scanner experienced a connection hiccup, but because of your explorer spirit, the GPS referee verified your coordinates and approved your hunt!",
          confidence: 100,
          creativityScore: 0
        };
      }
    }


    // If rate-limited: save as pending for server-side retry
    if (rateLimited) {
      const retryReason = "rate_limit";
      const pendingSubmission: Submission = {
        id: subId,
        userId: user.id,
        username: user.username,
        itemId: itemId,
        imageUrl: imageUrl,
        status: "pending",
        aiExplanation: `Submission queued for verification. The AI referee is temporarily overloaded. Your photo will be reviewed automatically.`,
        pointsAwarded: 0,
        createdAt: new Date().toISOString(),
        userLat: userLat ? Number(userLat) : null,
        userLng: userLng ? Number(userLng) : null,
        distanceMeters: distanceMeters,
        retryCount: 0,
        retryReason: retryReason,
        nextRetryAt: new Date(Date.now() + 30000).toISOString() // Retry in 30 seconds
      };

      await submitHunterProof(pendingSubmission, 0);

      // Fetch updated user stats
      const freshDb = await getAppState();
      const updatedUser = freshDb.users[user.id] || user;

      return res.json({
        isMatch: null, // Explicitly indicate pending state
        explanation: `Submission received and queued. The AI referee will review it within a few minutes.`,
        confidence: 0,
        submission: pendingSubmission,
        user: updatedUser,
        status: "pending",
        retryReason: retryReason
      });
    }

    const isMatch = parsedResult.isMatch === true;
    
    // Check if user wants to force submit a rejected image and if that's allowed
    const canForceSubmit = forceSubmit === true && currentSettings.allowForceSubmit === true && isMatch === false;
    
    // Calculate points awarded with creativity bonus capped at 10% of base points
    let pointsAwarded = 0;
    if (isMatch || canForceSubmit) {
      const basePoints = item.points || 10;
      // Creativity bonus: 0-10% of base points based on creativityScore (0-100)
      const creativityBonus = (basePoints * (parsedResult.creativityScore || 0)) / 1000; // creativityScore * 0.1 / 100
      pointsAwarded = basePoints + creativityBonus;
    }
    
    const finalSubmission: Submission = {
      id: subId,
      userId: user.id,
      username: user.username,
      itemId: itemId,
      imageUrl: imageUrl,
      status: canForceSubmit ? "approved" : (isMatch ? "approved" : "rejected"),
      aiExplanation: parsedResult.explanation,
      pointsAwarded: pointsAwarded,
      forcedApproval: canForceSubmit ? true : undefined,
      createdAt: new Date().toISOString(),
      userLat: userLat ? Number(userLat) : null,
      userLng: userLng ? Number(userLng) : null,
      distanceMeters: distanceMeters
    };

    // Commit to Database
    await submitHunterProof(finalSubmission, pointsAwarded);

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

// 6.1 Manual Admin Approval of submissions
app.post("/api/submissions/:subId/manual-approve", async (req, res) => {
  const { subId } = req.params;
  const { status, points } = req.body;

  if (!status || !["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be 'approved' or 'rejected'" });
  }

  try {
    const updated = await manuallyApproveSubmission(subId, status as "approved" | "rejected", points);
    if (!updated) {
      return res.status(404).json({ error: "Submission not found" });
    }
    res.json({ success: true, submission: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update submission", details: err.message });
  }
});

// 6.1b Update points for an already-approved submission (admin only)
app.post("/api/submissions/:subId/update-points", async (req, res) => {
  const { subId } = req.params;
  const { points } = req.body;

  if (points === undefined || typeof points !== "number" || points < 0) {
    return res.status(400).json({ error: "Invalid points value" });
  }

  try {
    const updated = await updateSubmissionPoints(subId, points);
    if (!updated) {
      return res.status(404).json({ error: "Submission not found" });
    }
    res.json({ success: true, submission: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update submission points", details: err.message });
  }
});

// 6.2 Retry pending submission (for rate-limited or timed-out submissions)
app.post("/api/submissions/:subId/retry", async (req, res) => {
  const { subId } = req.params;

  try {
    const db = await getAppState();
    const submission = db.submissions[subId];

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (submission.status !== "pending") {
      return res.status(400).json({ error: "Only pending submissions can be retried" });
    }

    // Get the item and user details
    const item = db.items[submission.itemId];
    const user = db.users[submission.userId];

    if (!item || !user) {
      return res.status(404).json({ error: "Associated item or user not found" });
    }

    // Reconstruct image part from stored image URL or base64
    let imagePart: any = null;
    
    // If imageUrl is a base64 string (starts with data:), use it directly
    if (submission.imageUrl.startsWith("data:")) {
      const match = submission.imageUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        imagePart = {
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        };
      }
    } else {
      // If it's a URL, we can't easily retry without fetching the image
      console.warn("Cannot retry submission with URL-based image, would need to fetch first");
      return res.status(400).json({ error: "Image data not available for retry. Please resubmit." });
    }

    if (!imagePart) {
      return res.status(400).json({ error: "Could not process image for retry" });
    }

    const currentSettings = getAppSettings();
    const aiJudgeModel = normalizeAiJudgeModel(currentSettings.aiJudgeModel);
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
4. For creative submissions that go above and beyond, award bonus points by rating creativity on 0-100 scale.

You MUST respond strictly in valid JSON matching this schema:
{
  "isMatch": boolean,
  "explanation": "Referee explanation (1-2 sentences)",
  "confidence": number (integer 0-100 score indicating certainty),
  "creativityScore": number (integer 0-100; bonus points for creative approaches. 0=literal match, 50=creative twist, 100=amazingly creative)
}`;

    let parsedResult = { isMatch: false, explanation: "Verification service timed out. Please try again.", confidence: 0, creativityScore: 0 };
    let rateLimited = false;

    try {
      const response = await ai.models.generateContent({
        model: aiJudgeModel,
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
              },
              creativityScore: {
                type: Type.INTEGER,
                description: "Creativity bonus score (0 to 100) for above-and-beyond submissions"
              }
            },
            required: ["isMatch", "explanation", "confidence", "creativityScore"]
          }
        }
      });
      parsedResult = JSON.parse((response.text || "{}").trim());
    } catch (aiErr: any) {
      console.error("Gemini retry error:", aiErr);
      
      // Check if this is still a rate limit error
      const isRateLimitError = (
        aiErr?.code === 429 ||
        String(aiErr?.message || "").toLowerCase().includes("rate limit") ||
        String(aiErr?.message || "").toLowerCase().includes("resource exhausted")
      );

      if (isRateLimitError) {
        // Still rate limited, update retry timestamp
        const retryCount = (submission.retryCount || 0) + 1;
        const maxRetries = 5;
        
        if (retryCount >= maxRetries) {
          // Give up after 5 retries
          submission.status = "rejected";
          submission.aiExplanation = "AI verification service is temporarily unavailable. Please try again later or contact an admin.";
          submission.pointsAwarded = 0;
        } else {
          // Schedule next retry with exponential backoff
          const delayMs = Math.min(60000, 30000 * Math.pow(2, retryCount)); // 30s, 1m, 2m, 4m, 8m
          submission.nextRetryAt = new Date(Date.now() + delayMs).toISOString();
          submission.retryCount = retryCount;
          
          await submitHunterProof(submission, submission.pointsAwarded || 0);
          
          return res.json({
            status: "pending",
            message: `Retry scheduled (attempt ${retryCount}). Next retry in ${Math.round(delayMs / 1000)}s.`,
            submission
          });
        }
      }

      // Other error, fall back to approval
      parsedResult = {
        isMatch: true,
        explanation: "The AI referee had trouble evaluating your submission, but approving it to keep the hunt moving!",
        confidence: 100,
        creativityScore: 0
      };
    }

    const isMatch = parsedResult.isMatch === true;

    // Calculate points awarded with creativity bonus capped at 10% of base points
    let pointsAwarded = 0;
    if (isMatch) {
      const basePoints = item.points || 10;
      const creativityBonus = (basePoints * (parsedResult.creativityScore || 0)) / 1000;
      pointsAwarded = basePoints + creativityBonus;
    }

    // Update submission with retry result
    submission.status = isMatch ? "approved" : "rejected";
    submission.aiExplanation = parsedResult.explanation;
    submission.pointsAwarded = pointsAwarded;
    submission.retryCount = (submission.retryCount || 0) + 1;

    await submitHunterProof(submission, pointsAwarded);

    // Fetch updated user stats
    const freshDb = await getAppState();
    const updatedUser = freshDb.users[submission.userId] || user;

    return res.json({
      success: true,
      isMatch,
      explanation: parsedResult.explanation,
      confidence: parsedResult.confidence,
      submission,
      user: updatedUser
    });
  } catch (err: any) {
    console.error("Retry submission error:", err);
    return res.status(500).json({
      error: "Failed to retry submission",
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

// 6.5 Generate AI slideshow script with animations and music
app.post("/api/slideshow/generate-mission-slides", async (req, res) => {
  try {
    const { submissions, createdBy } = req.body || {};

    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({ error: "No submissions provided for mission slide generation" });
    }

    if (!createdBy) {
      return res.status(400).json({ error: "Admin user ID is required" });
    }

    const state = await getAppState();
    const creatorProfile = state.users[createdBy];
    if (!creatorProfile || creatorProfile.role !== "admin") {
      return res.status(403).json({ error: "Only admin users can generate mission slides" });
    }

    const groupedByMission = new Map<string, Array<{ title: string; description?: string }>>();
    const missionOrder: string[] = [];

    for (const rawSub of submissions) {
      const normalized = {
        title: normalizeMissionCardText(rawSub?.title || "Unknown Mission") || "Unknown Mission",
        description: normalizeMissionCardText(rawSub?.description || ""),
      };

      if (!groupedByMission.has(normalized.title)) {
        groupedByMission.set(normalized.title, []);
        missionOrder.push(normalized.title);
      }
      groupedByMission.get(normalized.title)!.push(normalized);
    }

    const missionCards = missionOrder.map((missionTitle) => {
      const missionSubs = groupedByMission.get(missionTitle) || [];
      const firstDescription = String(missionSubs.find((s) => (s.description || "").trim().length > 0)?.description || "").trim();
      return {
        missionTitle,
        missionDescription: firstDescription || "Mission spotlight",
      };
    });

    const missionSlidesScript = [
      "Mission transition cards to generate:",
      ...missionCards.map((mission, idx) => `${idx + 1}. ${mission.missionTitle} - ${mission.missionDescription}`),
      "",
      "Photo flow:",
      ...missionOrder.flatMap((missionTitle, idx) => {
        const subs = groupedByMission.get(missionTitle) || [];
        return [`Mission ${idx + 1}: ${missionTitle} (${subs.length} photos)`];
      }),
    ].join("\n");

    return res.json({
      success: true,
      missionSlidesScript,
      missionCards,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Mission slide generation error:", err);
    return res.status(500).json({
      error: "Failed to generate mission slides",
      details: err.message || "Unknown error",
    });
  }
});

app.post("/api/slideshow/generate-leaderboard-slide", async (req, res) => {
  try {
    const { createdBy } = req.body || {};
    if (!createdBy) {
      return res.status(400).json({ error: "Admin user ID is required" });
    }

    const state = await getAppState();
    const creatorProfile = state.users[createdBy];
    if (!creatorProfile || creatorProfile.role !== "admin") {
      return res.status(403).json({ error: "Only admin users can generate leaderboard slides" });
    }

    const playerTotals = Object.values(state.users)
      .map((u) => ({ username: String(u.username || "").trim(), score: Number(u.score) || 0 }))
      .filter((u) => u.username.length > 0)
      .sort((a, b) => b.score - a.score);

    const nonZeroStandings = playerTotals.filter((entry) => entry.score > 0);
    const leaderboardSlideScript = [
      "Final leaderboard slide:",
      "Title: Final Standings",
      ...(nonZeroStandings.length
        ? nonZeroStandings.map((entry, idx) => `${idx + 1}. ${entry.username} - ${entry.score} pts`)
        : ["No player scores yet"]),
    ].join("\n");

    return res.json({
      success: true,
      leaderboardSlideScript,
      standings: nonZeroStandings,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Leaderboard slide generation error:", err);
    return res.status(500).json({
      error: "Failed to generate leaderboard slide",
      details: err.message || "Unknown error",
    });
  }
});

app.post("/api/slideshow/generate", async (req, res) => {
  try {
    const { submissions, createdBy, title, promptTemplate, includeMissionNarration, missionSlidesScript, leaderboardSlideScript, songQueries } = req.body;
    const chosenSlideshowModel = normalizeSlideshowModel(req.body?.slideshowModel);
    const requestedSongQueries = parseRequestedSongQueries(songQueries);

    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({ error: "No submissions provided for slideshow generation" });
    }

    // RESILIENCE: Limit submissions to prevent memory exhaustion on Raspberry Pi
    const MAX_SUBMISSIONS_FOR_SLIDESHOW = 200;
    if (submissions.length > MAX_SUBMISSIONS_FOR_SLIDESHOW) {
      return res.status(400).json({
        error: `Too many submissions. Maximum ${MAX_SUBMISSIONS_FOR_SLIDESHOW} allowed, received ${submissions.length}.`,
        hint: "Consider creating multiple slideshows or selecting fewer photos."
      });
    }

    if (!createdBy) {
      return res.status(400).json({ error: "Admin user ID is required" });
    }

    const state = await getAppState();
    const creatorProfile = state.users[createdBy];
    if (!creatorProfile || creatorProfile.role !== "admin") {
      return res.status(403).json({ error: "Only admin users can generate slideshows" });
    }

    // Group by mission title while preserving first-seen mission order.
    const groupedByMission = new Map<string, Array<{ id: string; imageUrl: string; title: string; description?: string; username: string }>>();
    const missionOrder: string[] = [];

    for (const rawSub of submissions) {
      const normalized = {
        id: String(rawSub?.id || ""),
        imageUrl: String(rawSub?.imageUrl || ""),
        title: String(rawSub?.title || "Unknown Mission"),
        description: rawSub?.description ? String(rawSub.description) : "",
        username: String(rawSub?.username || "Unknown Player"),
      };

      if (!groupedByMission.has(normalized.title)) {
        groupedByMission.set(normalized.title, []);
        missionOrder.push(normalized.title);
      }
      groupedByMission.get(normalized.title)!.push(normalized);
    }

    const groupedSections: string[] = [];
    const orderedSubmissions: Array<{ id: string; imageUrl: string; title: string; description?: string; username: string }> = [];
    const missionCards: Array<{ missionTitle: string; missionDescription: string }> = [];
    missionOrder.forEach((missionTitle, missionIdx) => {
      const missionSubs = groupedByMission.get(missionTitle) || [];
      const firstDescription = String(missionSubs.find((s) => (s.description || "").trim().length > 0)?.description || "").trim();
      missionCards.push({
        missionTitle,
        missionDescription: firstDescription || "Mission spotlight",
      });
      groupedSections.push(`Mission ${missionIdx + 1}: ${missionTitle}`);
      missionSubs.forEach((sub, subIdx) => {
        groupedSections.push(`  - Photo ${subIdx + 1}: captured by ${sub.username}${sub.description ? ` | mission description: ${sub.description}` : ""}`);
        orderedSubmissions.push(sub);
      });
    });

    const submissionsList = groupedSections.join("\n");

    const playerTotals = Object.values(state.users)
      .map((u) => ({ username: String(u.username || "").trim(), score: Number(u.score) || 0 }))
      .filter((u) => u.username.length > 0)
      .sort((a, b) => b.score - a.score);
    const playerTotalsText = playerTotals.length
      ? playerTotals.map((entry, idx) => `${idx + 1}. ${entry.username}: ${entry.score} pts`).join("\n")
      : "No player totals available";

    const defaultPrompt = `You are an expert multimedia producer specializing in creating family reunion slideshows.

I have a collection of photos from a family scavenger hunt. Here are the photos grouped by mission:
{{PHOTO_LIST}}

Please generate a detailed slideshow script that includes:

0. **Mission Intro Cards**: Before each mission photo group, insert a non-image card showing that mission title and description
1. **Mission Group Structure**: Keep photos grouped by mission while suggesting timing (2-4 seconds per slide)
2. **Transitions**: Recommend transitions between slides and between mission groups
3. **Music Recommendations**: Suggest 2-3 background music tracks that fit the full story arc
4. **Timing & Pacing**: Provide duration estimate and pacing guidance by mission group
5. **Animation Effects**: Suggest text overlay animations for mission title and photographer names
6. **Color Grading**: Suggest filters or adjustments to maintain visual consistency
7. **Voiceover Suggestions**: Optional brief commentary between mission groups

Format your response as a professional production guide that a video editor or slideshow software operator could follow.

Make it uplifting and celebratory, suitable for a family reunion event.

Important output requirements:
- This script will be used to generate an MP4 slideshow.
- Include clear guidance for title cards, per-photo overlays, and pacing.`;

    // Admin can edit prompt before generation. If token omitted, append grouped list safely.
    const basePrompt = typeof promptTemplate === "string" && promptTemplate.trim().length > 0
      ? promptTemplate.trim()
      : defaultPrompt;
    const slideshowPrompt = basePrompt.includes("{{PHOTO_LIST}}")
      ? basePrompt.replace("{{PHOTO_LIST}}", submissionsList)
      : `${basePrompt}\n\nMission-grouped photo list:\n${submissionsList}`;

    const slideshowPromptWithScores = `${slideshowPrompt}\n\nCurrent player point totals:\n${playerTotalsText}\n\nRender instructions: include transition slides between each mission that show title + description, and end with ONE closing scoreboard slide that lists only players with points (omit users at 0 points). Put each scoring player on a separate line.`;

    const buildMissionSlidesScript = () => {
      return [
        "Mission transition cards to generate:",
        ...missionCards.map((mission, idx) => `${idx + 1}. ${mission.missionTitle} - ${mission.missionDescription}`),
        "",
        "Photo flow:",
        ...missionOrder.flatMap((missionTitle, idx) => {
          const subs = groupedByMission.get(missionTitle) || [];
          return [`Mission ${idx + 1}: ${missionTitle} (${subs.length} photos)`];
        }),
      ].join("\n");
    };

    const buildLeaderboardSlideScript = () => {
      const nonZeroStandings = playerTotals.filter((entry) => entry.score > 0);
      return [
        "Final leaderboard slide:",
        "Title: Final Standings",
        ...(nonZeroStandings.length
          ? nonZeroStandings.map((entry, idx) => `${idx + 1}. ${entry.username} - ${entry.score} pts`)
          : ["No player scores yet"]),
      ].join("\n");
    };

    let script = "";
    let usedAiModel = "presenton-mission-grouped";
    let usedFallbackScript = false;
    const providedMissionSlidesScript = typeof missionSlidesScript === "string" ? missionSlidesScript.trim() : "";
    const providedLeaderboardSlideScript = typeof leaderboardSlideScript === "string" ? leaderboardSlideScript.trim() : "";

    const buildGroupedSlideshowCacheKey = () => {
      const normalizedMissions = missionCards.map((mission) => ({
        missionTitle: mission.missionTitle.trim(),
        missionDescription: mission.missionDescription.trim(),
      }));
      const normalizedStandings = playerTotals
        .filter((entry) => entry.score > 0)
        .map((entry) => ({ username: entry.username.trim(), score: entry.score }));
      const normalizedSubmissionOrder = orderedSubmissions
        .map((sub) => String(sub.id || "").trim())
        .filter((id) => id.length > 0);

      const payload = {
        version: "mission_grouped_v3",
        missions: normalizedMissions,
        standings: normalizedStandings,
        submissionOrder: normalizedSubmissionOrder,
        providedMissionSlidesScript,
        providedLeaderboardSlideScript,
      };

      return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
    };

    const cacheKey = buildGroupedSlideshowCacheKey();
    const cacheTag = `[cache:mission-grouped:${cacheKey}]`;

    try {
      const allSlideshows = await getAllSlideshows();
      const cachedSlideshow = allSlideshows.find((row) => String(row.description || "").includes(cacheTag));

      if (cachedSlideshow) {
        const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
        const cleanId = sanitizeSlideshowId(cachedSlideshow.id);
        const cachedVideoPath = cleanId ? path.join(uploadsDir, "slideshows", `${cleanId}.mp4`) : "";
        let cachedVideoUrl: string | null = null;

        if (cachedVideoPath) {
          try {
            await fsp.access(cachedVideoPath, fs.constants.R_OK);
            cachedVideoUrl = `/api/slideshows/video/${cleanId}.mp4`;
          } catch {
            cachedVideoUrl = null;
          }
        }

        return res.json({
          success: true,
          slideshow: cachedSlideshow,
          photoCount: orderedSubmissions.length,
          generation: {
            aiModel: "presenton-cache-hit",
            requestedMode: "mp4_only",
            usedFallbackScript: false,
            costEstimate: null,
            geminiApiUsageCostEstimate: null,
            slideshowModel: chosenSlideshowModel,
            slideshowProvider: "ollama_presenton",
            narrationRequested: false,
            narrationGeneratedByAi: false,
            cacheHit: true,
            video: {
              created: !!cachedVideoUrl,
              videoUrl: cachedVideoUrl,
              mode: "local_ffmpeg",
              aiModel: "presenton-cache-hit",
              usedFallbackPlan: !cachedVideoUrl,
              error: cachedVideoUrl ? null : "Cached slideshow exists but MP4 is not available",
            }
          },
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (cacheErr: any) {
      console.warn("Slideshow cache lookup failed, continuing with generation:", cacheErr?.message || cacheErr);
    }

    const presentonConfigured = normalizeServerUrl(PRESENTON_SERVER_URL).length > 0;
    const skipOllamaScriptGeneration =
      OLLAMA_SCRIPT_MODE === "disabled" ||
      (OLLAMA_SCRIPT_MODE === "offload_if_presenton" && presentonConfigured);

    script = [
      "KinQuest Mission Group Slideshow Plan",
      "",
      providedMissionSlidesScript || buildMissionSlidesScript(),
      "",
      providedLeaderboardSlideScript || buildLeaderboardSlideScript(),
      "",
      "Keep photos grouped by mission with a mission card before each group and one final leaderboard slide at the end.",
    ].join("\n");
    if (!presentonConfigured) {
      usedFallbackScript = true;
      usedAiModel = "local-mission-grouped";
    }

    let narrationGeneratedByAi = false;
    if (includeMissionNarration === true && missionOrder.length > 0 && !skipOllamaScriptGeneration) {
      let narratorOverlayMap: Record<string, string> = {};
      try {
        const narrationPrompt = [
          "Create short narrator overlay lines for each mission title below.",
          "Keep each line under 24 words.",
          "Return strict JSON with shape: { \"overlays\": [{ \"missionTitle\": string, \"narration\": string }] }",
          "",
          "Mission titles:",
          ...missionOrder.map((missionTitle, idx) => `${idx + 1}. ${missionTitle}`),
        ].join("\n");

        const narratorResponse = await callOllamaText(narrationPrompt);
        const parsed = JSON.parse((narratorResponse.text || "{}").trim());
        const overlays = Array.isArray(parsed?.overlays) ? parsed.overlays : [];
        overlays.forEach((entry: any) => {
          const missionTitle = String(entry?.missionTitle || "").trim();
          const narration = String(entry?.narration || "").trim();
          if (missionTitle && narration) {
            narratorOverlayMap[missionTitle] = narration;
          }
        });
        narrationGeneratedByAi = true;
      } catch (overlayErr: any) {
        console.warn("Narrator overlay generation failed, using fallback lines:", overlayErr?.message || overlayErr);
      }

      missionOrder.forEach((missionTitle) => {
        if (!narratorOverlayMap[missionTitle]) {
          narratorOverlayMap[missionTitle] = `Now we move into ${missionTitle}, where this chapter of the family adventure unfolds.`;
        }
      });

      script = [
        script,
        "",
        "MISSION_NARRATOR_OVERLAYS_JSON_START",
        JSON.stringify(narratorOverlayMap, null, 2),
        "MISSION_NARRATOR_OVERLAYS_JSON_END",
      ].join("\n");
    }

    // Save slideshow to database
    const slideshowId = `slideshow_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const slideshow: Slideshow = {
      id: slideshowId,
      title: title || `Family Slideshow - ${new Date().toLocaleDateString()}`,
      description: `${cacheTag} Presenton mission-group slideshow`,
      script: script,
      submissionIds: orderedSubmissions.map((s) => s.id),
      createdBy: createdBy,
      createdAt: new Date().toISOString(),
      isPublished: true,
    };

    await saveSlideshow(slideshow);

    const sourceSlides = orderedSubmissions
      .map((sub) => ({
        submissionId: sub.id,
        imageUrl: sub.imageUrl,
        missionTitle: normalizeMissionCardText(sub.title || "Unknown Mission") || "Unknown Mission",
        missionDescription: normalizeMissionCardText(sub.description || sub.title || ""),
        username: sub.username || "Unknown Player",
      }))
      .filter((entry) => !!entry.submissionId && !!entry.imageUrl);

    const buildGroupedFallbackSlides = () => {
      const slides: Array<{ imageUrl?: string; overlayText: string; durationSeconds: number; transition: string; isTitleCard?: boolean }> = [];
      let previousMissionKey: string | null = null;

      sourceSlides.forEach((source) => {
        const missionKey = `${source.missionTitle}||${source.missionDescription}`;
        if (missionKey !== previousMissionKey) {
          previousMissionKey = missionKey;
          slides.push({
            overlayText: `${source.missionTitle}\n${source.missionDescription}`.trim(),
            durationSeconds: 4,
            transition: "fade",
            isTitleCard: true,
          });
        }

        slides.push({
          imageUrl: source.imageUrl,
          overlayText: source.username,
          durationSeconds: 5,
          transition: "fade",
        });
      });

      if (slides.length) {
        slides.push({
          overlayText: buildFinalScoreboardOverlay(playerTotals),
          durationSeconds: 6,
          transition: "fade",
          isTitleCard: true,
        });
      }

      return slides;
    };

    let videoGeneration: {
      created: boolean;
      videoUrl: string | null;
      mode: "presenton_remote" | "presenton_plan_local_render" | "local_ffmpeg";
      aiModel: string;
      usedFallbackPlan: boolean;
      error: string | null;
    } = {
      created: false,
      videoUrl: null,
      mode: "local_ffmpeg",
      aiModel: usedAiModel,
      usedFallbackPlan: false,
      error: null,
    };

    const renderSlidesFromPlanRows = (
      rows: Array<{ submissionId: string; overlayText: string; durationSeconds: number; transition: string }>
    ) => {
      const imageBySubmissionId = new Map(sourceSlides.map((slide) => [slide.submissionId, slide]));
      const renderSlides: Array<{ imageUrl?: string; overlayText: string; durationSeconds: number; transition: string; isTitleCard?: boolean }> = [];
      let previousMissionKey: string | null = null;

      rows.forEach((row) => {
        const source = imageBySubmissionId.get(row.submissionId);
        if (!source) return;

        const missionKey = `${source.missionTitle}||${source.missionDescription}`;
        if (missionKey !== previousMissionKey) {
          previousMissionKey = missionKey;
          renderSlides.push({
            overlayText: `${source.missionTitle}\n${source.missionDescription}`.trim(),
            durationSeconds: 4,
            transition: "fade",
            isTitleCard: true,
          });
        }

        renderSlides.push({
          imageUrl: source.imageUrl,
          overlayText: row.overlayText || source.username,
          durationSeconds: row.durationSeconds,
          transition: row.transition,
        });
      });

      if (renderSlides.length) {
        renderSlides.push({
          overlayText: buildFinalScoreboardOverlay(playerTotals),
          durationSeconds: 6,
          transition: "fade",
          isTitleCard: true,
        });
      }

      return renderSlides;
    };

    if (sourceSlides.length > 0) {
      const shouldAttemptPresenton = presentonConfigured && !(PI_CONSTRAINED_RENDER && SKIP_PRESENTON_ON_CONSTRAINED_RENDER);

      if (shouldAttemptPresenton) {
        try {
          const presentonResult = await callPresentonSlideshow(slideshow.id, script, sourceSlides, playerTotals);

          if (presentonResult.videoUrl) {
            videoGeneration = {
              created: true,
              videoUrl: presentonResult.videoUrl,
              mode: "presenton_remote",
              aiModel: usedAiModel,
              usedFallbackPlan: false,
              error: null,
            };
          } else if (presentonResult.slidesPlan?.length) {
            const renderSlides = renderSlidesFromPlanRows(presentonResult.slidesPlan);
            if (!renderSlides.length) {
              throw new Error("Presenton returned an empty slideshow plan");
            }

            const rendered = await slideshowRenderQueue.enqueue(slideshow.id, () =>
              renderSlideshowMp4(slideshow.id, renderSlides, { requestedSongQueries })
            );

            videoGeneration = {
              created: true,
              videoUrl: rendered.outputUrl,
              mode: "presenton_plan_local_render",
              aiModel: usedAiModel,
              usedFallbackPlan: false,
              error: null,
            };
          }
        } catch (presentonErr: any) {
          console.warn("Presenton generation failed, falling back to local MP4 render:", presentonErr?.message || presentonErr);
        }
      } else if (presentonConfigured) {
        console.log("Skipping Presenton for constrained render host; using local MP4 pipeline");
      }

      if (!videoGeneration.created) {
        try {
          const fallbackSlides = buildGroupedFallbackSlides();
          if (!fallbackSlides.length) {
            throw new Error("No slides available for local MP4 render");
          }
          const rendered = await slideshowRenderQueue.enqueue(slideshow.id, () =>
            renderSlideshowMp4(slideshow.id, fallbackSlides, { requestedSongQueries })
          );
          videoGeneration = {
            created: true,
            videoUrl: rendered.outputUrl,
            mode: "local_ffmpeg",
            aiModel: usedAiModel,
            usedFallbackPlan: true,
            error: null,
          };
        } catch (localRenderErr: any) {
          console.error("Local slideshow render failed:", localRenderErr);
          videoGeneration = {
            created: false,
            videoUrl: null,
            mode: "local_ffmpeg",
            aiModel: usedAiModel,
            usedFallbackPlan: true,
            error: localRenderErr?.message || "Failed to render slideshow video",
          };
        }
      }
    } else {
      videoGeneration.error = "No valid image URLs available to render slideshow video";
    }

    res.json({
      success: true,
      slideshow: slideshow,
      photoCount: orderedSubmissions.length,
      generation: {
        aiModel: usedAiModel,
        requestedMode: "mp4_only",
        usedFallbackScript,
        costEstimate: null,
        geminiApiUsageCostEstimate: null,
        slideshowModel: chosenSlideshowModel,
        slideshowProvider: "ollama_presenton",
        narrationRequested: includeMissionNarration === true,
        narrationGeneratedByAi,
        video: videoGeneration
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Slideshow generation error:", err);
    res.status(500).json({
      error: "Failed to generate slideshow script",
      details: err.message || "AI service error",
    });
  }
});

app.post("/api/slideshows/:id/render-mp4", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, songQueries } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const state = await getAppState();
    const requestingUser = state.users[userId];
    if (!requestingUser || requestingUser.role !== "admin") {
      return res.status(403).json({ error: "Only admin users can render slideshow videos" });
    }

    const slideshow = await getSlideshow(id);
    if (!slideshow) {
      return res.status(404).json({ error: "Slideshow not found" });
    }

    const submissionById = new Map(Object.values(state.submissions).map((s) => [s.id, s]));
    const itemById = new Map(Object.values(state.items).map((it) => [it.id, it]));
    const scoreEntries = Object.values(state.users)
      .map((u) => ({ username: String(u.username || "").trim(), score: Number(u.score) || 0 }))
      .filter((u) => u.username.length > 0)
      .sort((a, b) => b.score - a.score);
    const finalScoreOverlayText = buildFinalScoreboardOverlay(scoreEntries);

    const slides: Array<{ imageUrl?: string; overlayText: string; durationSeconds?: number; transition?: string; isTitleCard?: boolean }> = [];
    let previousMissionKey: string | null = null;

    slideshow.submissionIds.forEach((subId) => {
      const submission = submissionById.get(subId);
      if (!submission?.imageUrl) return;

      const item = itemById.get(submission.itemId);
      const missionTitle = normalizeMissionCardText(item?.title || "Mission") || "Mission";
      const missionDescription = normalizeMissionCardText(item?.description || "");
      const missionKey = `${submission.itemId}::${missionTitle}::${missionDescription}`;

      if (missionKey !== previousMissionKey) {
        previousMissionKey = missionKey;
        slides.push({
          overlayText: `${missionTitle}\n${missionDescription}`.trim(),
          durationSeconds: 4,
          transition: "fade",
          isTitleCard: true,
        });
      }

      slides.push({
        imageUrl: submission.imageUrl,
        overlayText: submission.username,
        durationSeconds: 5,
      });
    });

    if (slides.length) {
      slides.push({
        overlayText: finalScoreOverlayText,
        durationSeconds: 6,
        transition: "fade",
        isTitleCard: true,
      });
    }

    if (!slides.length) {
      return res.status(400).json({ error: "No slideshow images available for rendering" });
    }

    // RESILIENCE: Check memory before starting intensive render
    if (!checkAvailableMemory(512)) {
      return res.status(503).json({ 
        error: "Insufficient server memory for rendering",
        hint: "Please wait and try again or reduce the number of slides"
      });
    }

    // RESILIENCE: Queue rendering operations to prevent concurrent renders from crashing the Pi
    const requestedSongQueries = parseRequestedSongQueries(songQueries);

    const rendered = await slideshowRenderQueue.enqueue(slideshow.id, () => 
      renderSlideshowMp4(slideshow.id, slides, { requestedSongQueries })
    );

    return res.json({
      success: true,
      slideshowId: slideshow.id,
      videoUrl: rendered.outputUrl,
      imageCount: slides.length,
      songQueriesUsed: requestedSongQueries,
    });
  } catch (err: any) {
    console.error("Slideshow MP4 render error:", err);
    const message = err?.message || "Failed to render slideshow MP4";
    const status = message.includes("FFmpeg is not installed") ? 503 : 500;
    return res.status(status).json({ error: "Failed to render slideshow MP4", details: message });
  }
});

app.post("/api/slideshow/song-match-preview", async (req, res) => {
  try {
    const { userId, songQueries, submissions } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const state = await getAppState();
    const requestingUser = state.users[userId];
    if (!requestingUser || requestingUser.role !== "admin") {
      return res.status(403).json({ error: "Only admin users can preview song matches" });
    }

    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({ error: "At least one selected submission is required for preview" });
    }

    const requestedSongQueries = parseRequestedSongQueries(songQueries);
    const preview = await previewRequestedSongs(requestedSongQueries);
    const estimatedSlideshowDurationSeconds = estimateSlideshowDurationFromSubmissionPayload(submissions);

    return res.json({
      success: true,
      requested: preview.requested,
      matches: preview.matches,
      foundCount: preview.matches.filter((m) => m.found).length,
      matchedDurationSeconds: preview.matchedDurationSeconds,
      matchedDurationLabel: preview.matchedDurationLabel,
      estimatedSlideshowDurationSeconds,
      estimatedSlideshowDurationLabel: formatDurationLabel(estimatedSlideshowDurationSeconds),
      fallbackSource: preview.fallbackSource,
    });
  } catch (err: any) {
    console.error("Song match preview error (modal):", err);
    return res.status(500).json({ error: "Failed to preview song matches", details: err?.message || "Unknown error" });
  }
});

app.patch("/api/slideshows/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, title, description, script, isPublished } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const state = await getAppState();
    const requestingUser = state.users[userId];
    if (!requestingUser || requestingUser.role !== "admin") {
      return res.status(403).json({ error: "Only admin users can edit slideshows" });
    }

    const slideshow = await getSlideshow(id);
    if (!slideshow) {
      return res.status(404).json({ error: "Slideshow not found" });
    }

    const updated: Slideshow = {
      ...slideshow,
      title: title !== undefined ? String(title) : slideshow.title,
      description: description !== undefined ? String(description) : slideshow.description,
      script: script !== undefined ? String(script) : slideshow.script,
      isPublished: isPublished !== undefined ? !!isPublished : slideshow.isPublished,
    };

    await saveSlideshow(updated);
    return res.json({ success: true, slideshow: updated });
  } catch (err: any) {
    console.error("Slideshow update error:", err);
    return res.status(500).json({ error: "Failed to update slideshow", details: err?.message || "Unknown error" });
  }
});

app.post("/api/slideshows/:id/gemini-create", async (req, res) => {
  return res.status(410).json({
    error: "Gemini slideshow endpoint has been retired",
    details: "Use /api/slideshow/generate for Ollama + Presenton MP4 generation, or /api/slideshows/:id/render-mp4 for local MP4 rendering."
  });
});

app.get("/api/slideshows/video/:filename", (req, res) => {
  const { filename } = req.params;
  const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
  const videosDir = path.join(uploadsDir, "slideshows");
  const filePath = path.join(videosDir, filename);

  const resolvedPath = path.resolve(filePath);
  const resolvedVideosDir = path.resolve(videosDir);
  if (!resolvedPath.startsWith(resolvedVideosDir)) {
    return res.status(403).json({ error: "Access denied" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Video not found" });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=86400",
    });
    return fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  res.writeHead(200, {
    "Content-Length": fileSize,
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  });
  return fs.createReadStream(filePath).pipe(res);
});

app.get("/api/slideshows/:id/video-status", async (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = sanitizeSlideshowId(id);
    if (!cleanId) {
      return res.status(400).json({ error: "Invalid slideshow id" });
    }

    const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
    const videosDir = path.join(uploadsDir, "slideshows");
    const filePath = path.join(videosDir, `${cleanId}.mp4`);
    const exists = fs.existsSync(filePath);

    return res.json({
      exists,
      videoUrl: exists ? `/api/slideshows/video/${cleanId}.mp4` : null
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to check video status", details: err?.message || "Unknown error" });
  }
});

// 7. Get all published slideshows
app.get("/api/slideshows", async (req, res) => {
  try {
    const slideshows = await getAllSlideshows();
    res.json(slideshows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch slideshows", details: err.message });
  }
});

// 7a. Get specific slideshow by ID
app.get("/api/slideshows/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const slideshow = await getSlideshow(id);
    if (!slideshow) {
      return res.status(404).json({ error: "Slideshow not found" });
    }
    res.json(slideshow);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch slideshow", details: err.message });
  }
});

app.delete("/api/slideshows/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const state = await getAppState();
    const requestingUser = state.users[userId];
    if (!requestingUser || requestingUser.role !== "admin") {
      return res.status(403).json({ error: "Only admin users can delete slideshows" });
    }

    const slideshow = await getSlideshow(id);
    if (!slideshow) {
      return res.status(404).json({ error: "Slideshow not found" });
    }

    await deleteSlideshow(id);

    const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
    const videosDir = path.join(uploadsDir, "slideshows");
    const cleanId = sanitizeSlideshowId(id);
    if (cleanId) {
      const videoPath = path.join(videosDir, `${cleanId}.mp4`);
      await fsp.rm(videoPath, { force: true });
    }

    return res.json({ success: true, slideshowId: id });
  } catch (err: any) {
    console.error("Slideshow delete error:", err);
    return res.status(500).json({ error: "Failed to delete slideshow", details: err?.message || "Unknown error" });
  }
});

// 8. Get chat messages logs
app.get("/api/chat-history", async (req, res) => {
  try {
    const logs = await getChatMessages();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch chat logs", details: err.message });
  }
});

// 8.1 Admin or message owner delete message
app.delete("/api/messages/:messageId", async (req, res) => {
  const { messageId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    // Get the message
    const messages = await getChatMessages();
    const message = messages.find(m => m.id === messageId);
    
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Verify user is either admin or the message owner
    const db = await getAppState();
    const user = db.users[userId];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const isAdmin = user.role === "admin";
    const isOwner = message.senderId === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    const success = await deleteMessage(messageId, userId);
    if (success) {
      res.json({ success: true, message: "Message deleted" });
    } else {
      res.status(404).json({ error: "Message not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete message", details: err.message });
  }
});

// 8.2 Mark messages as read
app.post("/api/messages/mark-read", async (req, res) => {
  const { userId, messageIds } = req.body;

  if (!userId || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ error: "Missing userId or messageIds" });
  }

  try {
    const success = await markMessagesAsRead(messageIds, userId);
    if (success) {
      res.json({ success: true, message: "Messages marked as read" });
    } else {
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to mark messages as read", details: err.message });
  }
});

// 8.3 Admin mute user
app.post("/api/users/:userId/mute", async (req, res) => {
  const { userId } = req.params;
  const { adminId, mutedUntil } = req.body;

  if (!adminId) {
    return res.status(400).json({ error: "Missing adminId" });
  }

  try {
    // Verify user is admin
    const db = await getAppState();
    const admin = db.users[adminId];
    if (!admin) {
      return res.status(404).json({ error: "Admin user not found" });
    }
    if (admin.role !== "admin") {
      return res.status(403).json({ error: "Only admins can mute users" });
    }

    const success = await muteUser(userId, mutedUntil || null);
    res.json({ success, message: `User muted${mutedUntil ? " until " + mutedUntil : ""}` });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to mute user", details: err.message });
  }
});

// 8.3 Admin unmute user
app.delete("/api/users/:userId/mute", async (req, res) => {
  const { userId } = req.params;
  const { adminId } = req.body;

  if (!adminId) {
    return res.status(400).json({ error: "Missing adminId" });
  }

  try {
    // Verify user is admin
    const db = await getAppState();
    const admin = db.users[adminId];
    if (!admin) {
      return res.status(404).json({ error: "Admin user not found" });
    }
    if (admin.role !== "admin") {
      return res.status(403).json({ error: "Only admins can unmute users" });
    }

    const success = await unmuteUser(userId);
    res.json({ success, message: "User unmuted" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to unmute user", details: err.message });
  }
});

// 8.4 Admin boot (kick) user from game
app.post("/api/users/:userId/boot", async (req, res) => {
  const { userId } = req.params;
  const { adminId } = req.body;

  if (!adminId) {
    return res.status(400).json({ error: "Missing adminId" });
  }

  try {
    // Verify user is admin
    const db = await getAppState();
    const admin = db.users[adminId];
    if (!admin) {
      return res.status(404).json({ error: "Admin user not found" });
    }
    if (admin.role !== "admin") {
      return res.status(403).json({ error: "Only admins can boot users" });
    }

    const success = await bootUser(userId);
    res.json({ success, message: "User booted from game" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to boot user", details: err.message });
  }
});

// 8. Serve uploaded submission images
// ========== SATELLITE TILE CACHE SYSTEM ==========
// Tiles are fetched from ESRI World Imagery and stored on disk so the server
// can serve them to clients on a local network without any internet access.

const TILE_CACHE_DIR = process.env.TILE_CACHE_DIR || path.join(process.cwd(), "tile-cache");
const TILE_SOURCES = {
  original: "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
  imagery: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  labels: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
} as const;
type TileLayerName = keyof typeof TILE_SOURCES;
const TILE_UPSTREAM_TIMEOUT_MS = Number(process.env.TILE_UPSTREAM_TIMEOUT_MS || 1800);
const TILE_CACHE_MAX_AGE_SECONDS = 31536000; // 1 year
const tileContentTypeCache = new Map<string, string>();
const TRANSPARENT_TILE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+H9kAAAAASUVORK5CYII=",
  "base64"
);

function getCurrentMapMode(): NonNullable<AppSettings["mapMode"]> {
  const mode = getAppSettings().mapMode;
  if (mode === "satellite_labels" || mode === "missions_only" || mode === "disabled") {
    return mode;
  }
  return "original";
}

function isTileDownloadModeEnabled(): boolean {
  const mode = getCurrentMapMode();
  return mode === "original" || mode === "satellite_labels";
}

function sendGracefulEmptyTile(res: express.Response, reason: string): void {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Tile-Cache", reason);
  res.status(200).send(TRANSPARENT_TILE_PNG);
}

// Reunion site center + pre-cache config
const PRECACHE_LAT  = 38.80162;
const PRECACHE_LNG  = -111.68307;
const PRECACHE_RADIUS_METERS = 32187; // 20 miles
const PRECACHE_MIN_ZOOM = 13;
const PRECACHE_MAX_ZOOM = 17;

// Slippy-map tile coordinate helpers
function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}
function latToTileY(lat: number, zoom: number): number {
  const radLat = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(radLat) + 1 / Math.cos(radLat)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}
function getTileBoundsForRadius(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  zoom: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  // Convert radius to rough degree offsets (1 deg lat ≈ 111 km)
  const deltaLat = radiusMeters / 111320;
  const deltaLng = radiusMeters / (111320 * Math.cos((centerLat * Math.PI) / 180));

  const minX = lngToTileX(centerLng - deltaLng, zoom);
  const maxX = lngToTileX(centerLng + deltaLng, zoom);
  const minY = latToTileY(centerLat + deltaLat, zoom); // note: tile Y increases southward
  const maxY = latToTileY(centerLat - deltaLat, zoom);

  return { minX, maxX, minY, maxY };
}

async function fetchAndCacheTile(z: number, x: number, y: number): Promise<void> {
  await fetchAndCacheTileForLayer("imagery", z, x, y);
}

function getTileCachePaths(layer: TileLayerName, z: number, x: number, y: number) {
  const tileDir = path.join(TILE_CACHE_DIR, layer, String(z), String(x));
  const dataPath = path.join(tileDir, `${y}.tile`);
  const metaPath = path.join(tileDir, `${y}.json`);
  return { tileDir, dataPath, metaPath };
}

function getLegacyImageryTilePathCandidates(z: number, x: number, y: number): string[] {
  const base = path.join(TILE_CACHE_DIR, String(z), String(x), String(y));
  return [`${base}.jpg`, `${base}.jpeg`, `${base}.png`, `${base}.tile`];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function guessTileContentType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return "image/png";
}

async function getCachedTileContentType(dataPath: string, metaPath: string): Promise<string> {
  const cached = tileContentTypeCache.get(metaPath);
  if (cached) return cached;

  if (await fileExists(metaPath)) {
    try {
      const metadata = JSON.parse(await fsp.readFile(metaPath, "utf8")) as { contentType?: string };
      const contentType = metadata.contentType || guessTileContentType(dataPath);
      tileContentTypeCache.set(metaPath, contentType);
      return contentType;
    } catch {
      // If metadata is corrupted, fall back to extension-based guess.
    }
  }

  const fallbackType = guessTileContentType(dataPath);
  tileContentTypeCache.set(metaPath, fallbackType);
  return fallbackType;
}

function getTileSourceUrl(layer: TileLayerName, z: number, x: number, y: number): string {
  return TILE_SOURCES[layer].replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(x));
}

async function fetchTileFromUpstream(
  layer: TileLayerName,
  z: number,
  x: number,
  y: number,
  timeoutMs: number
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const url = getTileSourceUrl(layer, z, x, y);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "KinQuest-TileCache/1.0" },
      signal: controller.signal
    });

    if (!upstream.ok) {
      return null;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get("content-type") || "image/png";
    return { buffer, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAndCacheTileForLayer(
  layer: TileLayerName,
  z: number,
  x: number,
  y: number
): Promise<void> {
  const { tileDir, dataPath, metaPath } = getTileCachePaths(layer, z, x, y);

  if (await fileExists(dataPath) && await fileExists(metaPath)) return;

  const tileResponse = await fetchTileFromUpstream(layer, z, x, y, 12_000);
  if (!tileResponse) {
    console.warn(`[TileCache] ${layer} miss z=${z} x=${x} y=${y}: upstream unavailable`);
    return;
  }

  const { buffer, contentType } = tileResponse;
  fs.mkdirSync(tileDir, { recursive: true });
  fs.writeFileSync(dataPath, buffer);
  fs.writeFileSync(metaPath, JSON.stringify({ contentType }));
  tileContentTypeCache.set(metaPath, contentType);
}

async function preCacheReunionTiles(): Promise<void> {
  if (!isTileDownloadModeEnabled()) {
    console.log(`[TileCache] Skipping pre-cache because map mode is '${getCurrentMapMode()}'.`);
    return;
  }

  console.log(`[TileCache] Starting pre-cache for (${PRECACHE_LAT}, ${PRECACHE_LNG}) ±${PRECACHE_RADIUS_METERS}m zoom ${PRECACHE_MIN_ZOOM}-${PRECACHE_MAX_ZOOM}`);
  let total = 0;
  let downloaded = 0;
  const layers: TileLayerName[] = ["original", "imagery", "labels"];

  for (let z = PRECACHE_MIN_ZOOM; z <= PRECACHE_MAX_ZOOM; z++) {
    const { minX, maxX, minY, maxY } = getTileBoundsForRadius(PRECACHE_LAT, PRECACHE_LNG, PRECACHE_RADIUS_METERS, z);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (const layer of layers) {
          total++;
          const layerPaths = getTileCachePaths(layer, z, x, y);
          const hasTile = await fileExists(layerPaths.dataPath) && await fileExists(layerPaths.metaPath);
          if (hasTile) continue;

          await fetchAndCacheTileForLayer(layer, z, x, y);

          const nowCached = await fileExists(layerPaths.dataPath) && await fileExists(layerPaths.metaPath);
          if (nowCached) {
            downloaded++;
          }

          await new Promise(r => setTimeout(r, 30));
        }
      }
    }
  }
  console.log(`[TileCache] Pre-cache complete. ${downloaded} new tiles downloaded, ${total - downloaded} already cached.`);
}

// Tile proxy endpoint with explicit layer: serves from disk cache or fetches live and caches
app.get("/tiles/:layer/:z/:x/:y", async (req, res) => {
  const mapMode = getCurrentMapMode();
  if (mapMode === "disabled") {
    return res.status(503).json({ error: "Map functionality is disabled by admin settings" });
  }

  const layer = req.params.layer as TileLayerName;
  if (layer !== "original" && layer !== "imagery" && layer !== "labels") {
    return res.status(400).json({ error: "Invalid tile layer" });
  }

  const z = parseInt(req.params.z, 10);
  const x = parseInt(req.params.x, 10);

  // Strip extension that Leaflet appends
  const yRaw = req.params.y.replace(/\.(png|jpg|jpeg)$/, "");
  const y = parseInt(yRaw, 10);

  if (isNaN(z) || isNaN(x) || isNaN(y) || z < 0 || z > 22 || x < 0 || y < 0) {
    return res.status(400).json({ error: "Invalid tile coordinates" });
  }

  const { tileDir, dataPath, metaPath } = getTileCachePaths(layer, z, x, y);

  // Security: ensure resolved path is inside tile cache dir
  const resolvedTilePath = path.resolve(dataPath);
  const resolvedCacheDir = path.resolve(TILE_CACHE_DIR);
  if (!resolvedTilePath.startsWith(resolvedCacheDir)) {
    return res.status(403).json({ error: "Access denied" });
  }

  if (await fileExists(dataPath) && await fileExists(metaPath)) {
    const contentType = await getCachedTileContentType(dataPath, metaPath);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", `public, max-age=${TILE_CACHE_MAX_AGE_SECONDS}, immutable`);
    res.setHeader("X-Tile-Cache", "hit");
    return fs.createReadStream(dataPath).pipe(res);
  }

  // Backward compatibility for legacy imagery caches at tile-cache/{z}/{x}/{y}.jpg.
  if (layer === "imagery") {
    const legacyCandidates = getLegacyImageryTilePathCandidates(z, x, y);
    for (const legacyPath of legacyCandidates) {
      if (await fileExists(legacyPath)) {
        res.setHeader("Content-Type", guessTileContentType(legacyPath));
        res.setHeader("Cache-Control", `public, max-age=${TILE_CACHE_MAX_AGE_SECONDS}, immutable`);
        res.setHeader("X-Tile-Cache", "legacy-hit");
        return fs.createReadStream(legacyPath).pipe(res);
      }
    }
  }

  if (!isTileDownloadModeEnabled()) {
    return sendGracefulEmptyTile(res, "map-mode-no-download");
  }

  // Not cached — try to fetch live and cache for next time
  const tileResponse = await fetchTileFromUpstream(layer, z, x, y, TILE_UPSTREAM_TIMEOUT_MS);
  if (!tileResponse) {
    return sendGracefulEmptyTile(res, "miss-unavailable");
  }

  const { buffer, contentType } = tileResponse;
  fs.mkdirSync(tileDir, { recursive: true });
  fs.writeFileSync(dataPath, buffer);
  fs.writeFileSync(metaPath, JSON.stringify({ contentType }));
  tileContentTypeCache.set(metaPath, contentType);

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", `public, max-age=${TILE_CACHE_MAX_AGE_SECONDS}, immutable`);
  res.setHeader("X-Tile-Cache", "miss-fetch");
  return res.send(buffer);
});

// Backward-compatible imagery route
app.get("/tiles/:z/:x/:y", async (req, res) => {
  const { z, x, y } = req.params;
  return res.redirect(302, `/tiles/imagery/${z}/${x}/${y}`);
});

// Kick off tile pre-caching in the background after server starts
// Wrapped in setTimeout so it doesn't block the event loop at startup
setTimeout(() => {
  if (!isTileDownloadModeEnabled()) {
    console.log(`[TileCache] Startup pre-cache skipped for map mode '${getCurrentMapMode()}'.`);
    return;
  }
  preCacheReunionTiles().catch(err => console.error("[TileCache] Pre-cache error:", err));
}, 5000);

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
  // CORS headers to prevent cross-origin blocking
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

  const sslCertPath = process.env.SSL_CERT_PATH;
  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslCaPath = process.env.SSL_CA_PATH;
  const serverProtocolMode = (process.env.SERVER_PROTOCOL || "auto").toLowerCase();
  const httpPort = Number(process.env.HTTP_PORT || PORT);
  const httpsPort = Number(process.env.HTTPS_PORT || (serverProtocolMode === "both" ? 3443 : PORT));

  const isValidMode = ["auto", "http", "https", "both"].includes(serverProtocolMode);
  if (!isValidMode) {
    throw new Error(`Invalid SERVER_PROTOCOL value: ${serverProtocolMode}. Use one of auto|http|https|both.`);
  }

  let tlsOptions: https.ServerOptions | null = null;
  if (sslCertPath && sslKeyPath) {
    try {
      const key = fs.readFileSync(sslKeyPath);
      const cert = fs.readFileSync(sslCertPath);
      const ca = sslCaPath ? fs.readFileSync(sslCaPath) : undefined;
      tlsOptions = { key, cert, ca };
    } catch (err) {
      if (serverProtocolMode === "https") {
        throw new Error(`Failed to load SSL certificate or key for HTTPS mode: ${err}`);
      }
      console.error("Failed to load SSL certificate or key, HTTPS will be disabled:", err);
    }
  } else if (sslCertPath || sslKeyPath) {
    if (serverProtocolMode === "https") {
      throw new Error("SERVER_PROTOCOL=https requires both SSL_CERT_PATH and SSL_KEY_PATH.");
    }
    console.warn("Incomplete SSL configuration detected. Set both SSL_CERT_PATH and SSL_KEY_PATH to enable HTTPS.");
  }

  let enableHttp = false;
  let enableHttps = false;

  if (serverProtocolMode === "http") {
    enableHttp = true;
  } else if (serverProtocolMode === "https") {
    enableHttps = true;
  } else if (serverProtocolMode === "both") {
    enableHttp = true;
    enableHttps = true;
  } else {
    // auto mode: prefer HTTPS when certs are configured, otherwise run HTTP.
    enableHttps = !!tlsOptions;
    enableHttp = !enableHttps;
  }

  if (enableHttps && !tlsOptions) {
    if (serverProtocolMode === "both") {
      console.warn("SERVER_PROTOCOL=both but HTTPS is unavailable; starting HTTP only.");
      enableHttps = false;
      enableHttp = true;
    } else {
      throw new Error("HTTPS requested but SSL_CERT_PATH/SSL_KEY_PATH are not valid.");
    }
  }

  if (enableHttp && enableHttps && httpPort === httpsPort) {
    throw new Error(`HTTP_PORT and HTTPS_PORT cannot be the same value (${httpPort}) when SERVER_PROTOCOL=both.`);
  }

  const webServers: Array<{ server: http.Server | https.Server; protocol: "http" | "https"; port: number }> = [];

  if (enableHttp) {
    webServers.push({
      server: http.createServer(app),
      protocol: "http",
      port: httpPort,
    });
  }

  if (enableHttps && tlsOptions) {
    webServers.push({
      server: https.createServer(tlsOptions, app),
      protocol: "https",
      port: httpsPort,
    });
    console.log(`HTTPS enabled with cert: ${sslCertPath}`);
  }

  const wsServers = webServers.map(({ server }) => new WebSocketServer({ server }));

  const activeSockets = new Map<any, { userId: string; username: string }>();

  const sendToAllWsClients = (payload: string) => {
    const sentClients = new Set<any>();
    wsServers.forEach((wsServer) => {
      wsServer.clients.forEach((client) => {
        if (client.readyState === 1 && !sentClients.has(client)) {
          sentClients.add(client);
          client.send(payload);
        }
      });
    });
  };

  const registerWsHandlers = (wss: WebSocketServer) => {
    wss.on("connection", (ws) => {
      console.log("WebSocket client connected.");

      ws.on("message", async (data: string) => {
        try {
          const payload = JSON.parse(data);
          console.log("Server received message from client:", payload);
          if (!payload.type) {
            console.log("Message has no type, ignoring");
            return;
          }

          if (payload.type === "join") {
            const { userId, username } = payload;
            console.log("Client joining:", { userId, username });
            if (userId && username) {
              // Ensure profile exists for this user before allowing them to send messages
              try {
                await ensureProfileExists(userId, username);
                console.log("Profile ensured for user:", userId);
              } catch (err) {
                console.error("Failed to ensure profile exists:", err);
                // Don't prevent join if profile creation fails - we'll let the message send attempt fail
              }
              activeSockets.set(ws, { userId, username });
              console.log("Added socket to activeSockets, total active:", activeSockets.size);
              // Broadcast active user list
              broadcastOnlineUsers(wsServers, activeSockets);
            }
          } else if (payload.type === "send_message") {
            const { userId, username, receiverId, text } = payload;
            console.log("Received send_message event:", { userId, username, receiverId, textLength: text?.length });
            
            if (!userId || !text || text.trim() === "") {
              console.log("Rejecting message: missing userId, text, or text is empty");
              return;
            }

            const chatMsg = {
              id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              senderId: userId,
              senderName: username || "Explorer",
              receiverId: receiverId || null,
              text: text.trim(),
              createdAt: new Date().toISOString()
            };

            console.log("Creating chat message:", chatMsg);
            // Save message to database/file
            await saveChatMessage(chatMsg);
            console.log("Message saved successfully");

            // Broadcast appropriately
            const rawBroadcast = JSON.stringify({
              type: "message",
              message: chatMsg
            });

            if (!receiverId) {
              // Shout box - broadcast to ALL
              console.log("Broadcasting to all clients (shout box)");
              sendToAllWsClients(rawBroadcast);
            } else {
              // Private message - send only to sender and receiver
              console.log("Broadcasting to specific recipients (DM), searching in", activeSockets.size, "active sockets");
              activeSockets.forEach((info, clientSocket) => {
                if (info.userId === receiverId || info.userId === userId) {
                  if (clientSocket.readyState === 1) {
                    console.log("Sending DM to:", info.userId);
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
        console.log("Remaining active sockets:", activeSockets.size);
        broadcastOnlineUsers(wsServers, activeSockets);
      });

      ws.on("error", (err) => {
        console.error("WebSocket socket error:", err);
      });
    });
  };

  wsServers.forEach((wss) => registerWsHandlers(wss));

  await Promise.all(
    webServers.map(({ server, protocol, port }) =>
      new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "0.0.0.0", () => {
          console.log(`Self-hosted Scavenger Hunt with WebSockets started on ${protocol}://0.0.0.0:${port}`);
          resolve();
        });
      }),
    ),
  );
}

function broadcastOnlineUsers(wsServers: WebSocketServer[], activeSockets: Map<any, { userId: string; username: string }>) {
  const usersMap = new Map<string, { id: string; username: string }>();
  activeSockets.forEach((info) => {
    usersMap.set(info.userId, { id: info.userId, username: info.username });
  });
  const onlineList = Array.from(usersMap.values());
  const payload = JSON.stringify({
    type: "online_users",
    users: onlineList
  });
  const sentClients = new Set<any>();
  wsServers.forEach((wss) => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && !sentClients.has(client)) {
        sentClients.add(client);
        client.send(payload);
      }
    });
  });
}

startServer();
