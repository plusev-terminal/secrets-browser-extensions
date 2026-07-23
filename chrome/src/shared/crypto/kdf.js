/**
@license
Copyright (c) 2025 trading_peter
*/

// Argon2id key derivation, offloaded to a Web Worker so the main thread
// stays responsive during the (intentionally expensive) memory-hard KDF.
//
// Architecture:
//   - This module is the main-thread wrapper. It spawns kdf-worker.js per
//     derivation call, posts { password, salt, params }, awaits the result,
//     and terminates the worker. The worker's heap is freed by the OS on
//     termination — a tighter scrub than main-thread GC could offer.
//   - The worker uses @noble/hashes' pure-JS argon2id (sync — blocking is
//     fine inside a worker). See issue #232 §2a for the library rationale.
//   - If Worker is unavailable (rare — embedded contexts, tests), falls
//     back to main-thread argon2idAsync via dynamic import. UI freezes in
//     that case, but the function still works.
//
// Worker is spawned via `new URL('./kdf-worker.js', import.meta.url)`, which
// esbuild recognises and bundles as a separate chunk. No manual worker URL
// management needed.

// Default parameters chosen for desktop-class hardware. Tunable per-vault —
// the chosen params are stored alongside the vault (kdfParams column) so a
// future stronger setting can be rolled out without breaking old vaults.
//
// memoryCost (m): 64 MiB — meaningful brute-force cost (a 24 GB GPU runs
//   ~384 concurrent attempts instead of thousands), fits comfortably in any
//   desktop RAM. Now that derivation is off-main-thread, we can afford the
//   2x cost vs Bitwarden's 32 MiB default — "stricter than industry default"
//   is a defensible position for a vault holding seed phrases worth millions.
// iterations (t): 3 — OWASP floor; Argon2id's memory hardness does the heavy
//   lifting.
// parallelism (p): 1 — the @noble/hashes implementation fills lanes
//   sequentially in one JS thread. Higher p just multiplies work without
//   speedup. To get true p=4 parallelism we'd need a multi-threaded WASM
//   build (what hash-wasm does internally) — not worth the supply-chain
//   cost for this product.
//
// Benchmarked at ~2.3s in a worker on a developer workstation (Jul 2026).
// Main thread stays responsive throughout.
export const DEFAULT_KDF_PARAMS = Object.freeze({
  memoryCost: 65536, // 64 MiB in KiB
  iterations: 3,
  parallelism: 1,
});

export function defaultKdfParams() {
  return { ...DEFAULT_KDF_PARAMS };
}

// Derive a 32-byte MasterKey from the user's master password and the
// vault-scoped salt. The salt is 16 random bytes generated client-side at
// vault setup; the params are stored alongside it so unlock can replay the
// exact derivation.
//
// Output type: Uint8Array(32). The key is raw bytes — keys.js is responsible
// for importing it into a WebCrypto key object when needed.
export async function deriveMasterKey(password, salt, params = DEFAULT_KDF_PARAMS) {
  if (typeof Worker === 'undefined') {
    return await deriveInMainFallback(password, salt, params);
  }

  return await deriveInWorker(password, salt, params);
}

// The worker is registered as a separate gowebbuild entry point and output
// to shared/crypto/kdf-worker.js. The path here is relative to the importing
// module's location (background/sw.js). We use a simple string path because
// gowebbuild v7.5.0's esbuild (v0.14.50) doesn't auto-emit assets via the
// new URL(pattern, import.meta.url) pattern.
const WORKER_URL = '../shared/crypto/kdf-worker.js';

async function deriveInWorker(password, salt, params) {
  const worker = new Worker(WORKER_URL, { type: 'module' });

  try {
    return await new Promise((resolve, reject) => {
      const onMessage = (e) => {
        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(new Uint8Array(e.data.key));
        }
      };

      const onError = (e) => {
        reject(new Error(e.message || 'Worker error during Argon2id derivation.'));
      };

      worker.addEventListener('message', onMessage, { once: true });
      worker.addEventListener('error', onError, { once: true });

      worker.postMessage({ password, salt, params });
    });
  } finally {
    // Always terminate, whether the derivation succeeded, failed, or the
    // caller cancelled. The worker holds the password string in its JS heap
    // until termination — freeing the heap is the scrub.
    worker.terminate();
  }
}

// Fallback path for environments without Worker support. Dynamic import
// keeps noble out of the main bundle unless this path is actually taken.
// UI will freeze during derivation — acceptable for an edge case.
async function deriveInMainFallback(password, salt, params) {
  const { argon2idAsync } = await import('@noble/hashes/argon2.js');

  const passwordBytes = new TextEncoder().encode(password);

  const key = await argon2idAsync(passwordBytes, salt, {
    t: params.iterations,
    m: params.memoryCost,
    p: params.parallelism,
    dkLen: 32,
  });

  passwordBytes.fill(0);

  return key;
}
