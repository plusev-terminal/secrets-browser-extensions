/**
@license
Copyright (c) 2025 trading_peter
*/

// Key management for the zero-knowledge secrets vault.
//
// Hierarchy:
//   MasterKey     = Argon2id(masterPassword, vault.kdfSalt, vault.kdfParams)
//   Verifier      = AES-GCM(MasterKey, VERIFIER_MAGIC) — verifies password
//   Per-entry DEK = random 32B
//   WrappedDEK    = AES-GCM(MasterKey, DEK) — stored server-side alongside ciphertext
//   Ciphertext    = AES-GCM(DEK, payloadJSON) — stored server-side
//
// The MasterKey never leaves the browser and never touches the server in any
// form (only the Verifier does, which is a sealed blob). The per-entry DEKs
// are also client-only — only their wrapped form is sent over the wire.
//
// On master-password rotation: re-derive new MasterKey, re-wrap every entry's
// DEK under it, replace Verifier + (optional) WrappedMasterByRecovery. No
// payload re-encryption needed.

import { importAesGcmKey, seal, open, sealWithRaw, openWithRaw, randomBytes, bytesToBase64, base64ToBytes, constantTimeEqual } from './crypto.js';
import { deriveMasterKey, defaultKdfParams } from './kdf.js';

// The plaintext sealed inside the verifier. Decrypting to this exact string
// proves the candidate MasterKey is correct without revealing anything else.
const VERIFIER_MAGIC = 'VAULT_VERIFIER_v1';

// Generate the per-vault KDF inputs the client needs at setup time.
// Returns a plain object suitable for posting to /api/secrets/vaults/create.
export function freshVaultCryptoSetup() {
  const salt = randomBytes(16);

  return {
    kdfSalt: bytesToBase64(salt),
    kdfParams: defaultKdfParams(),
  };
}

// Derive a MasterKey from a user-typed password + the stored base64 salt and
// params object. Used at unlock and at password-rotation time.
export async function masterKeyFromPassword(password, b64Salt, params) {
  const salt = base64ToBytes(b64Salt);

  return await deriveMasterKey(password, salt, params);
}

// Build the verifier blob the server stores. Callers must already hold the
// derived MasterKey. The blob leaks nothing about the password — GCM's tag
// fails to verify under any wrong key.
export async function buildVerifier(masterKey) {
  return await sealWithRaw(masterKey, VERIFIER_MAGIC);
}

// Check a candidate MasterKey against the stored verifier blob. Returns true
// only if the GCM tag verifies AND the decrypted plaintext equals the magic.
// The constant-time compare is belt-and-suspenders: a wrong key fails at the
// GCM step already, but the explicit compare guards against any future
// half-pass scheme.
export async function verifyMasterKey(masterKey, verifierBlob) {
  let opened;

  try {
    opened = await openWithRaw(masterKey, verifierBlob);
  } catch {
    return false;
  }

  const a = new TextEncoder().encode(opened);
  const b = new TextEncoder().encode(VERIFIER_MAGIC);

  return constantTimeEqual(a, b);
}

// Wrap (encrypt) a 32-byte raw DEK under the MasterKey. The wrapped form is
// what the server stores; only the browser with the MasterKey can recover the
// DEK. Returns base64 of (nonce || ciphertext).
export async function wrapDek(masterKey, dekBytes) {
  return await sealWithRaw(masterKey, bytesToBase64(dekBytes));
}

// Unwrap (decrypt) a wrapped DEK back to raw bytes. Throws on wrong MasterKey
// — callers must ensure verifyMasterKey has passed before calling.
export async function unwrapDek(masterKey, wrappedBlob) {
  const b64Dek = await openWithRaw(masterKey, wrappedBlob);

  return base64ToBytes(b64Dek);
}

// Encrypt an entry payload under a fresh DEK. Returns the bundle the server
// stores: { wrappedDek, ciphertext }. The DEK is generated per-call so two
// encryptions of the same payload produce unrelated ciphertexts.
export async function encryptEntry(masterKey, payload) {
  const dek = randomBytes(32);
  const plaintext = JSON.stringify(payload);

  const [wrappedDek, ciphertext] = await Promise.all([
    wrapDek(masterKey, dek),
    sealWithRaw(dek, plaintext),
  ]);

  // Zero out the raw DEK in memory as soon as both wraps complete. JS GC is
  // not deterministic, so this is best-effort — the in-memory plaintext
  // cache is the bigger surface and is scrubbed on lock.
  dek.fill(0);

  return { wrappedDek, ciphertext };
}

// Decrypt an entry's ciphertext under its wrapped DEK. Returns the parsed
// payload object. Throws on any GCM failure (wrong MasterKey or tampering).
export async function decryptEntry(masterKey, wrappedDek, ciphertext) {
  const dek = await unwrapDek(masterKey, wrappedDek);

  try {
    const plaintext = await openWithRaw(dek, ciphertext);

    return JSON.parse(plaintext);
  } finally {
    dek.fill(0);
  }
}

// Re-wrap every DEK under a new MasterKey. Used at password-rotation time.
// The ciphertext payloads are untouched — only the wrapping changes.
//
// Entries is an array of { wrappedDek, ... } objects. Returns a Map of
// entryId → new wrappedDek string.
export async function rewrapEntries(newMasterKey, entries) {
  const out = new Map();

  for (const entry of entries) {
    // Unwrap with the OLD master key first. Caller must pass the old key in
    // via the closure that builds this call — this function only knows the
    // new key. (See SecretsStore.rotateMasterPassword for the orchestration.)
    // Here we just produce the re-wrapped form for already-unwrapped DEKs.
    const dekBytes = base64ToBytes(entry.unwrappedDekB64);

    out.set(entry.id, await wrapDek(newMasterKey, dekBytes));

    dekBytes.fill(0);
  }

  return out;
}
