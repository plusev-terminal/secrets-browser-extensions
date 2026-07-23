/**
@license
Copyright (c) 2025 trading_peter
*/

// Web Worker that runs Argon2id off the main thread. Receives
// { password, salt, params }, returns { key } or { error }, then is
// terminated by the caller.
//
// Security properties:
//   - The password string and derived MasterKey live only in this worker's
//     JS heap, never in the long-lived main-thread heap.
//   - The key buffer is transferred (not copied) back to the main thread —
//     zero-copy, and the worker's reference is detached after postMessage.
//   - The caller terminates this worker immediately after receiving the
//     result, so the worker's heap is freed by the OS, not by JS GC.
//     This is actually a tighter scrub than the main-thread path could offer.
//
// Why sync argon2id (not argon2idAsync) here: we're in a worker, so blocking
// is fine. The async variant yields between passes to keep the main thread
// responsive — we don't need that here, and sync is faster.

import { argon2id } from '@noble/hashes/argon2.js';

self.onmessage = (e) => {
  const { password, salt, params } = e.data;

  try {
    const passwordBytes = new TextEncoder().encode(password);

    const key = argon2id(passwordBytes, salt, {
      t: params.iterations,
      m: params.memoryCost,
      p: params.parallelism,
      dkLen: 32,
    });

    // Best-effort scrub of the encoded password before we post the result.
    // Worker is about to terminate anyway, but belt-and-suspenders.
    passwordBytes.fill(0);

    // Transfer the underlying ArrayBuffer — zero-copy, detaches the worker's
    // reference so the key material exists in only one place after this call.
    self.postMessage({ key }, [key.buffer]);
  } catch (err) {
    self.postMessage({ error: err.message || 'Argon2id derivation failed.' });
  }
};
