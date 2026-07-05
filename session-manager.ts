import crypto from "crypto";
import fs from "fs";
import path from "path";

const USER_SESSIONS_FILE = path.join(process.cwd(), ".user-sessions.json");
const USER_SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface UserSession {
  id: string;
  userId: string;
  role: "user" | "admin";
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

interface UserSessionStore {
  sessions: UserSession[];
  lastModified: string;
}

function loadUserSessionStore(): UserSessionStore {
  try {
    if (fs.existsSync(USER_SESSIONS_FILE)) {
      const content = fs.readFileSync(USER_SESSIONS_FILE, "utf-8");
      return JSON.parse(content) as UserSessionStore;
    }
  } catch (err) {
    console.error("Failed to load user session store:", err);
  }

  return {
    sessions: [],
    lastModified: new Date().toISOString()
  };
}

function saveUserSessionStore(store: UserSessionStore): void {
  try {
    fs.writeFileSync(USER_SESSIONS_FILE, JSON.stringify(store, null, 2), "utf-8");
    fs.chmodSync(USER_SESSIONS_FILE, 0o600);
  } catch (err) {
    console.error("Failed to save user session store:", err);
  }
}

function cleanupExpiredUserSessions(store: UserSessionStore): void {
  const now = Date.now();
  store.sessions = store.sessions.filter(
    (session) => new Date(session.expiresAt).getTime() > now
  );
}

export function createOrReuseUserSession(
  userId: string,
  role: "user" | "admin",
  existingSessionId?: string
): UserSession {
  const store = loadUserSessionStore();
  cleanupExpiredUserSessions(store);

  const now = new Date();
  if (existingSessionId) {
    const existing = store.sessions.find(
      (session) => session.id === existingSessionId && session.userId === userId
    );
    if (existing) {
      existing.lastActivityAt = now.toISOString();
      existing.expiresAt = new Date(now.getTime() + USER_SESSION_TIMEOUT_MS).toISOString();
      existing.role = role;
      store.lastModified = now.toISOString();
      saveUserSessionStore(store);
      return existing;
    }
  }

  const newSession: UserSession = {
    id: `usess_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    userId,
    role,
    createdAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + USER_SESSION_TIMEOUT_MS).toISOString()
  };

  store.sessions.push(newSession);
  store.lastModified = now.toISOString();
  saveUserSessionStore(store);
  return newSession;
}

export function refreshUserSession(sessionId: string, userId: string): UserSession | null {
  const store = loadUserSessionStore();
  cleanupExpiredUserSessions(store);

  const session = store.sessions.find(
    (entry) => entry.id === sessionId && entry.userId === userId
  );

  if (!session) {
    store.lastModified = new Date().toISOString();
    saveUserSessionStore(store);
    return null;
  }

  const now = new Date();
  session.lastActivityAt = now.toISOString();
  session.expiresAt = new Date(now.getTime() + USER_SESSION_TIMEOUT_MS).toISOString();
  store.lastModified = now.toISOString();
  saveUserSessionStore(store);
  return session;
}

export function hasActiveUserSession(sessionId: string, userId: string): boolean {
  const store = loadUserSessionStore();
  cleanupExpiredUserSessions(store);
  const found = store.sessions.some(
    (session) => session.id === sessionId && session.userId === userId
  );
  store.lastModified = new Date().toISOString();
  saveUserSessionStore(store);
  return found;
}

export function endUserSession(sessionId: string, userId?: string): boolean {
  const store = loadUserSessionStore();
  cleanupExpiredUserSessions(store);

  const index = store.sessions.findIndex((session) => {
    if (userId) {
      return session.id === sessionId && session.userId === userId;
    }
    return session.id === sessionId;
  });

  if (index === -1) {
    return false;
  }

  store.sessions.splice(index, 1);
  store.lastModified = new Date().toISOString();
  saveUserSessionStore(store);
  return true;
}

export function getActiveUserSessionsCount(): number {
  const store = loadUserSessionStore();
  cleanupExpiredUserSessions(store);
  store.lastModified = new Date().toISOString();
  saveUserSessionStore(store);
  return store.sessions.length;
}
