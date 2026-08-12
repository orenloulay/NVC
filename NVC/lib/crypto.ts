import {
  randomBytes,
  randomUUID,
  randomInt,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";

export function newId(): string {
  return randomUUID();
}

// Password hashing with scrypt (built into Node — no native dependency).
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = scryptSync(password, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// 6-digit numeric code for email verification / 2FA.
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// Codes are stored hashed, never in plaintext.
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function verifyCode(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
