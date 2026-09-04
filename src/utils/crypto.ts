export interface EncryptedPayload {
  salt: string;
  iv: string;
  iterations: number;
  ciphertext: string;
}

const DEFAULT_ITERATIONS = 150_000;

function requireSubtle(): SubtleCrypto {
  if (!crypto?.subtle) {
    throw new Error("Web Crypto unavailable — open this app over HTTPS.");
  }
  return crypto.subtle;
}

function toBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<CryptoKey> {
  const subtle = requireSubtle();
  const material = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptToken(
  passphrase: string,
  plaintext: string
): Promise<EncryptedPayload> {
  const subtle = requireSubtle();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, DEFAULT_ITERATIONS);
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    iterations: DEFAULT_ITERATIONS,
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptToken(
  passphrase: string,
  payload: EncryptedPayload
): Promise<string> {
  const subtle = requireSubtle();
  const key = await deriveKey(passphrase, fromBase64(payload.salt), payload.iterations);
  try {
    const plaintext = await subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.ciphertext)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error("Incorrect passphrase");
  }
}

// A deterministic lookup key for the cloud vault: derived from the passphrase so
// the same passphrase always finds the same vault, but never sent in plaintext.
// Uses PBKDF2 with a fixed salt and the same iteration count as encryption, so
// brute-forcing the key is just as expensive as brute-forcing the ciphertext.
const VAULT_LOOKUP_SALT = "crackerbox-vault-lookup-v1";

export async function deriveVaultLookupKey(passphrase: string): Promise<string> {
  const subtle = requireSubtle();
  const material = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(VAULT_LOOKUP_SALT), iterations: DEFAULT_ITERATIONS },
    material,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Separate, deterministic lookup key for the cloud backup payload (projects +
// chat), so it never collides with the token vault. Same passphrase-derived
// scheme; brute-forcing costs the same as the vault.
const BACKUP_LOOKUP_SALT = "crackerbox-backup-lookup-v1";

export async function deriveBackupLookupKey(passphrase: string): Promise<string> {
  const subtle = requireSubtle();
  const material = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(BACKUP_LOOKUP_SALT), iterations: DEFAULT_ITERATIONS },
    material,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
