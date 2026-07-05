import crypto from "crypto";

/**
 * Hash a password using PBKDF2
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(32).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha256")
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, passwordHash: string): boolean {
  try {
    const [salt, hash] = passwordHash.split(":");
    const computedHash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, "sha256")
      .toString("hex");
    return computedHash === hash;
  } catch (e) {
    return false;
  }
}

/**
 * Generate a random admin password for initial setup
 */
export function generateRandomPassword(length: number = 12): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}
