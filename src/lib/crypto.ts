import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Blob format: "v1:<iv b64>:<tag b64>:<ciphertext b64>". The version prefix
// leaves room for master-key rotation later.
const VERSION = "v1";
const ALGO = "aes-256-gcm";

let cachedKey: Buffer | null = null;

function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.VAULT_MASTER_KEY;
  if (!raw) throw new Error("VAULT_MASTER_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("VAULT_MASTER_KEY must be 32 bytes, base64-encoded");
  cachedKey = key;
  return key;
}

/** Encrypt `plaintext`, binding it to `aad` (e.g. the owning row id) so blobs can't be swapped between rows. */
export function encrypt(plaintext: string, aad: string, key: Buffer = masterKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decrypt(blob: string, aad: string, key: Buffer = masterKey()): string {
  const [version, iv, tag, ct] = blob.split(":");
  if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error("Malformed secret blob");
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

// Binary format for files: <version byte><iv 12><tag 16><ciphertext>. Same
// cipher and key as the string blobs, just without the base64 overhead.
const BYTES_VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptBytes(plaintext: Buffer, aad: string, key: Buffer = masterKey()): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.from([BYTES_VERSION]), iv, cipher.getAuthTag(), ct]);
}

export function decryptBytes(blob: Buffer, aad: string, key: Buffer = masterKey()): Buffer {
  if (blob.length < 1 + IV_LEN + TAG_LEN || blob[0] !== BYTES_VERSION) throw new Error("Malformed file blob");
  const iv = blob.subarray(1, 1 + IV_LEN);
  const tag = blob.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(1 + IV_LEN + TAG_LEN)), decipher.final()]);
}

/** Fail fast at boot instead of on the first secret read. */
export function assertMasterKey() {
  masterKey();
}
