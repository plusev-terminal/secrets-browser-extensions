/**
@license
Copyright (c) 2025 trading_peter
*/

// Recovery key generation + verification. The recovery key is a 32-byte random
// value, base32-encoded for human transcription. It is shown to the user ONCE
// at setup; the server stores only a verifier blob (sealed with the key).
//
// Recovery flow:
//   1. User enters recovery key (base32).
//   2. Client decodes to raw 32 bytes.
//   3. Client calls verifyMasterKey(recoveryKey, vault.recoveryVerifier).
//   4. On success, client decrypts WrappedMasterByRecovery → MasterKey.
//   5. From there, normal unlock proceeds.
//
// WrappedMasterByRecovery is the ONLY place the MasterKey appears in
// recoverable form on the server. Without the recovery key, the wrapping is
// an opaque random-looking blob.
//
// Encoding choice: base32 (RFC 4648, no padding) with dashes every 4 chars
// for readability. 32 bytes → 52 base32 chars. We group as 13 groups of 4.
// Example: "XXXX-XXXX-XXXX-...-XXXX"

import { sealWithRaw, openWithRaw, randomBytes, bytesToBase64, base64ToBytes, constantTimeEqual } from './crypto.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_KEY_BYTES = 32;

function base32Encode(bytes) {
  let output = '';
  let bits = 0;
  let value = 0;

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(str) {
  const cleaned = str.replace(/[-\s]/g, '').toUpperCase();
  const output = [];
  let bits = 0;
  let value = 0;

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);

    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

// Format a base32 string into human-readable 4-char groups separated by dashes.
// "ABCD1234" → "ABCD-1234". Safe on empty input — returns an empty string.
export function formatRecoveryKey(b32) {
  if (!b32) return '';
  return b32.match(/.{1,4}/g).join('-');
}

// Strip dashes/whitespace from a user-entered recovery key string before
// decoding.
export function normalizeRecoveryKey(input) {
  return input.replace(/[-\s]/g, '').toUpperCase();
}

// Generate a fresh recovery key. Returns:
//   {
//     rawBytes: Uint8Array(32) — the secret itself, used by the caller to
//                 build verifiers/wrappers, then dropped from memory.
//     display:  string — formatted for one-time display to the user.
//   }
export function generateRecoveryKey() {
  const rawBytes = randomBytes(RECOVERY_KEY_BYTES);
  const b32 = base32Encode(rawBytes);

  return {
    rawBytes,
    display: formatRecoveryKey(b32),
  };
}

// Decode a user-entered recovery key (possibly with dashes/whitespace/casing)
// back to the raw 32 bytes. Throws on malformed input.
export function decodeRecoveryKey(input) {
  const bytes = base32Decode(input);

  if (bytes.length !== RECOVERY_KEY_BYTES) {
    throw new Error(`Recovery key must decode to ${RECOVERY_KEY_BYTES} bytes, got ${bytes.length}.`);
  }

  return bytes;
}

// Build the two server-stored blobs that make recovery possible:
//   recoveryVerifier        — sealed with the recovery key, proves the user
//                              entered the right recovery key
//   wrappedMasterByRecovery — MasterKey sealed with the recovery key, used to
//                              recover the MasterKey once recoveryVerifier
//                              verifies
//
// Returns base64 strings suitable for posting to /api/secrets/vaults/create.
export async function buildRecoveryBlobs(recoveryKeyBytes, masterKey) {
  const [recoveryVerifier, wrappedMasterByRecovery] = await Promise.all([
    sealWithRaw(recoveryKeyBytes, RECOVERY_VERIFIER_MAGIC),
    sealWithRaw(recoveryKeyBytes, bytesToBase64(masterKey)),
  ]);

  return { recoveryVerifier, wrappedMasterByRecovery };
}

// Verify a user-entered recovery key against the stored recoveryVerifier blob.
// Uses a constant-time comparison so timing side-channels cannot distinguish
// "almost matched" from "wildly wrong" — same rationale as verifyMasterKey.
const RECOVERY_VERIFIER_MAGIC = 'VAULT_RECOVERY_VERIFIER_v1';

export async function verifyRecoveryKey(recoveryKeyBytes, recoveryVerifierBlob) {
  let opened;

  try {
    opened = await openWithRaw(recoveryKeyBytes, recoveryVerifierBlob);
  } catch {
    return false;
  }

  const a = new TextEncoder().encode(opened);
  const b = new TextEncoder().encode(RECOVERY_VERIFIER_MAGIC);

  return constantTimeEqual(a, b);
}

// Recover the MasterKey from the recovery path. Caller must have already
// verified the recovery key against recoveryVerifier.
export async function recoverMasterKey(recoveryKeyBytes, wrappedMasterByRecovery) {
  const b64 = await openWithRaw(recoveryKeyBytes, wrappedMasterByRecovery);

  return base64ToBytes(b64);
}
