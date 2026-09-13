/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from "crypto";

/**
 * Derives a deterministic 32-byte binary key from the configured environment secret.
 * Strict fail-closed policy: throws immediately if CALENDAR_TOKEN_ENCRYPTION_KEY is missing or < 32 characters.
 */
export function getEncryptionKey(): Buffer {
  const secret = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "CALENDAR_TOKEN_ENCRYPTION_KEY environment variable is missing or too short (must be >= 32 chars). Set this secret before connecting or encrypting Google Calendar tokens."
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext refresh token using AES-256-GCM authenticated encryption.
 * Output format: <16-byte-iv-hex>:<16-byte-auth-tag-hex>:<ciphertext-hex>
 */
export function encryptRefreshToken(plainToken: string): string {
  if (!plainToken) {
    throw new Error("Cannot encrypt empty or null refresh token.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainToken, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM encrypted token string.
 * Validates integrity via the GCM authentication tag.
 */
export function decryptRefreshToken(encryptedPayload: string): string {
  if (!encryptedPayload) {
    throw new Error("Cannot decrypt empty or null payload.");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted token payload format. Expected iv:authTag:ciphertext.");
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  if (iv.length !== 16 || authTag.length !== 16) {
    throw new Error("Invalid IV or Auth Tag length in encrypted token payload.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    return decrypted.toString("utf8");
  } catch (error: any) {
    throw new Error(`Token decryption failed: authentication tag verification failure or corrupted ciphertext. (${error.message})`);
  }
}
