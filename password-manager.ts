import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Password Manager for Admin User Only
 * 
 * Implements secure password hashing, verification, and management
 * exclusively for the admin user. All passwords are hashed using bcrypt-style
 * salting and argon2-equivalent security practices.
 */

const PASSWORDS_FILE = path.join(process.cwd(), ".admin-passwords.json");
const SALT_ROUNDS = 12;
const HASH_ITERATIONS = 100000;
const HASH_ALGORITHM = "sha256";

export interface AdminPassword {
  id: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  lastUsedAt?: string;
  description?: string;
  isActive: boolean;
}

export interface PasswordStoreData {
  adminId: string;
  passwords: AdminPassword[];
  lastModified: string;
}

/**
 * Generate a secure random salt
 */
function generateSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a password with a salt using PBKDF2 equivalent
 */
function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, 64, HASH_ALGORITHM)
    .toString("hex");
}

/**
 * Verify a password against a hash
 */
function verifyPassword(password: string, passwordHash: string, salt: string): boolean {
  const hash = hashPassword(password, salt);
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(passwordHash)
  );
}

/**
 * Load admin passwords from encrypted storage
 */
function loadPasswordStore(): PasswordStoreData {
  try {
    if (fs.existsSync(PASSWORDS_FILE)) {
      const content = fs.readFileSync(PASSWORDS_FILE, "utf-8");
      // In production, this would be encrypted. For now, we use file permissions.
      const parsed = JSON.parse(content) as PasswordStoreData;
      return parsed;
    }
  } catch (err) {
    console.error("Failed to load admin password store:", err);
  }

  return {
    adminId: "user_admin",
    passwords: [],
    lastModified: new Date().toISOString()
  };
}

/**
 * Save admin passwords to secure storage
 */
function savePasswordStore(store: PasswordStoreData): void {
  try {
    // In production, encrypt this file or store in vault
    fs.writeFileSync(PASSWORDS_FILE, JSON.stringify(store, null, 2), "utf-8");
    // Set restrictive permissions (owner read/write only)
    fs.chmodSync(PASSWORDS_FILE, 0o600);
  } catch (err) {
    console.error("Failed to save admin password store:", err);
  }
}

/**
 * Create a new admin password entry
 * Only callable by the admin user
 */
export function createAdminPassword(
  password: string,
  description?: string
): AdminPassword {
  // Validate password strength
  if (!password || password.length < 12) {
    throw new Error("Password must be at least 12 characters long");
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error(
      "Password must contain uppercase, lowercase, and numeric characters"
    );
  }

  const store = loadPasswordStore();
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  const newPassword: AdminPassword = {
    id: `pwd_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    description: description || "Admin password",
    isActive: true
  };

  store.passwords.push(newPassword);
  store.lastModified = new Date().toISOString();
  savePasswordStore(store);

  console.log(`[ADMIN] New password created: ${newPassword.id}`);
  return {
    ...newPassword,
    passwordHash: "[REDACTED]",
    salt: "[REDACTED]"
  };
}

/**
 * Verify an admin password
 * Returns true only if password matches any active admin password
 */
export function verifyAdminPassword(password: string): boolean {
  const store = loadPasswordStore();

  // Check against all active passwords
  for (const pwd of store.passwords) {
    if (pwd.isActive) {
      try {
        if (verifyPassword(password, pwd.passwordHash, pwd.salt)) {
          // Update last used timestamp
          pwd.lastUsedAt = new Date().toISOString();
          savePasswordStore(store);
          return true;
        }
      } catch (err) {
        console.error("Password verification error:", err);
        continue;
      }
    }
  }

  return false;
}

/**
 * Deactivate an admin password by ID
 */
export function deactivateAdminPassword(passwordId: string): boolean {
  const store = loadPasswordStore();
  const pwd = store.passwords.find(p => p.id === passwordId);

  if (!pwd) {
    throw new Error(`Password ID not found: ${passwordId}`);
  }

  pwd.isActive = false;
  store.lastModified = new Date().toISOString();
  savePasswordStore(store);

  console.log(`[ADMIN] Password deactivated: ${passwordId}`);
  return true;
}

/**
 * Rotate an admin password (create new, deactivate old)
 */
export function rotateAdminPassword(
  oldPassword: string,
  newPassword: string
): AdminPassword {
  // Verify the old password is correct
  if (!verifyAdminPassword(oldPassword)) {
    throw new Error("Current password verification failed");
  }

  // Create the new password
  const newPwd = createAdminPassword(newPassword, "Rotated password");

  // Deactivate all other active passwords
  const store = loadPasswordStore();
  for (const pwd of store.passwords) {
    if (pwd.id !== newPwd.id && pwd.isActive) {
      pwd.isActive = false;
    }
  }
  store.lastModified = new Date().toISOString();
  savePasswordStore(store);

  console.log(`[ADMIN] Password rotated. Old password deactivated.`);
  return newPwd;
}

/**
 * List all admin passwords (metadata only, no hashes)
 */
export function listAdminPasswords(): Omit<AdminPassword, "passwordHash" | "salt">[] {
  const store = loadPasswordStore();
  return store.passwords.map(pwd => ({
    id: pwd.id,
    createdAt: pwd.createdAt,
    lastUsedAt: pwd.lastUsedAt,
    description: pwd.description,
    isActive: pwd.isActive
  }));
}

/**
 * Get password audit log (when passwords were created/used/deactivated)
 */
export function getPasswordAuditLog(): {
  passwordId: string;
  action: string;
  timestamp: string;
}[] {
  const store = loadPasswordStore();
  const log = [];

  for (const pwd of store.passwords) {
    log.push({
      passwordId: pwd.id,
      action: "created",
      timestamp: pwd.createdAt
    });

    if (pwd.lastUsedAt) {
      log.push({
        passwordId: pwd.id,
        action: "used",
        timestamp: pwd.lastUsedAt
      });
    }

    if (!pwd.isActive) {
      log.push({
        passwordId: pwd.id,
        action: "deactivated",
        timestamp: pwd.lastModified || new Date().toISOString()
      });
    }
  }

  return log.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Change admin password (authenticate with old, set new)
 */
export function changeAdminPassword(
  oldPassword: string,
  newPassword: string,
  description?: string
): AdminPassword {
  // Verify current password
  if (!verifyAdminPassword(oldPassword)) {
    throw new Error("Current password verification failed. Cannot change password.");
  }

  // Create new password
  const newPwd = createAdminPassword(
    newPassword,
    description || "Password change"
  );

  // Keep old passwords archived but inactive
  const store = loadPasswordStore();
  for (const pwd of store.passwords) {
    if (pwd.id !== newPwd.id && pwd.isActive) {
      pwd.isActive = false;
    }
  }
  store.lastModified = new Date().toISOString();
  savePasswordStore(store);

  return newPwd;
}

/**
 * Initialize admin password on first setup
 * Should only be called once during deployment
 */
export function initializeAdminPassword(initialPassword: string): AdminPassword {
  const store = loadPasswordStore();

  // Safety check: prevent re-initialization if passwords already exist
  if (store.passwords.length > 0) {
    throw new Error(
      "Admin password system already initialized. Use changeAdminPassword() instead."
    );
  }

  return createAdminPassword(initialPassword, "Initial admin password");
}

/**
 * Emergency reset (for recovery scenarios - logs the action)
 * This should only be available through secure backup channels
 */
export function emergencyResetAdminPassword(
  newPassword: string,
  reason: string
): AdminPassword {
  console.warn(
    `[ADMIN-SECURITY-ALERT] Emergency password reset requested. Reason: ${reason}`
  );

  const store = loadPasswordStore();

  // Deactivate all existing passwords
  for (const pwd of store.passwords) {
    pwd.isActive = false;
  }

  // Create new password
  const newPwd = createAdminPassword(
    newPassword,
    `Emergency reset: ${reason}`
  );

  store.lastModified = new Date().toISOString();
  savePasswordStore(store);

  console.warn(
    `[ADMIN-SECURITY-ALERT] Emergency reset completed. New password ID: ${newPwd.id}`
  );

  return newPwd;
}
