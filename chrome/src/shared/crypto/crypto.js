/**
@license
Copyright (c) 2025 trading_peter
*/

// Crypto primitives for the secrets vault. All functions here are pure
// transforms over ArrayBuffer / Uint8Array / base64 strings — they hold no
// state and have no knowledge of vaults or entries. The keys.js module layers
// the zero-knowledge key wrapping on top of these.
//
// AES-GCM is exposed natively by WebCrypto (SubtleCrypto). Argon2id is NOT —
// see kdf.js for the @noble/hashes Argon2id implementation.
//
// Security notes:
// - GCM nonce is 12 bytes, randomly generated per encryption. Never reused.
// - Plaintext inputs are encoded as UTF-8 JSON before encryption. Callers pass
//   already-serialised strings; this module never calls JSON.stringify.
// - Return values are base64 so they can be stored as opaque text columns.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function bytesToBase64(bytes) {
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

export function randomBytes(length) {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  return bytes;
}

// Imports a 32-byte raw key into the WebCrypto AES-GCM key object that seal/open
// consume. All key wrapping and payload encryption in this vault goes through
// this helper.
export async function importAesGcmKey(rawKey) {
  return await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Seal a UTF-8 plaintext string under the given AES-GCM key. Returns base64 of
// (nonce || ciphertext). The 12-byte nonce is prepended so decrypt() can split
// it back out without a separate channel.
export async function seal(key, plaintext) {
  const nonce = randomBytes(12);
  const data = encoder.encode(plaintext);

  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    data,
  );

  const cipherBytes = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(nonce.length + cipherBytes.length);

  combined.set(nonce, 0);
  combined.set(cipherBytes, nonce.length);

  return bytesToBase64(combined);
}

// Open a base64 (nonce || ciphertext) blob and return the UTF-8 plaintext.
// Throws if the GCM tag fails to verify — callers should treat any throw as
// "wrong key or tampered ciphertext" and surface a generic error.
export async function open(key, blob) {
  const combined = base64ToBytes(blob);

  const nonce = combined.slice(0, 12);
  const cipherBytes = combined.slice(12);

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    cipherBytes,
  );

  return decoder.decode(plainBuf);
}

// Convenience: import a raw 32-byte key AND seal in one call. Used at vault
// setup and entry create time where the caller has the raw key bytes already.
export async function sealWithRaw(rawKey, plaintext) {
  const key = await importAesGcmKey(rawKey);

  return await seal(key, plaintext);
}

// Convenience: import a raw 32-byte key AND open in one call.
export async function openWithRaw(rawKey, blob) {
  const key = await importAesGcmKey(rawKey);

  return await open(key, blob);
}

// Constant-time equality for two same-length byte arrays. Used by the verifier
// compare so timing side-channels cannot distinguish "almost matched" from
// "wildly wrong". Lengths are allowed to differ — that's public information
// (the blob size is fixed).
export function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;

  let diff = 0;

  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}
