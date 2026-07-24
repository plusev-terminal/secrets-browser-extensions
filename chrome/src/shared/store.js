// Vault store — the extension's in-memory vault state. Adapted from the
// Terminal frontend's store.js, stripped of Lit component coupling and UI
// event dispatching. Designed for use inside the MV3 background service worker.
//
// Sensitive state (masterKey, decrypted entries) lives only in memory between
// unlock and lock. When the service worker is terminated by MV3 (idle timeout),
// all state is naturally scrubbed — tighter than the web frontend's _scrub().

import { deriveMasterKey, DEFAULT_KDF_PARAMS } from './crypto/kdf.js';
import { base64ToBytes } from './crypto/crypto.js';
import { verifyMasterKey, decryptEntry, encryptEntry } from './crypto/keys.js';
import { buildIndex, addToIndex, removeFromIndex } from './search/index.js';
import { parseQuery, matchesOperators } from './search/query.js';
import { scoreRow, rankByScore } from './search/score.js';

export class VaultStore {
  constructor() {
    this.state = 'locked'; // 'locked' | 'unlocked' | 'noVault'
    this.vault = null;
    this.masterKey = null;
    this.entries = new Map();
    this.folders = new Map();
    this.index = null;
    this.client = null;
  }

  setClient(client) {
    this.client = client;
  }

  isUnlocked() {
    return this.state === 'unlocked' && this.masterKey !== null;
  }

  // List vaults from the server (no unlock — just metadata).
  async listVaults() {
    const resp = await this.client.post('/vaults/list');
    return resp.data || [];
  }

  // Unlock: derive master key, verify, sync.
  async unlock(vault, password) {
    const salt = base64ToBytes(vault.kdfSalt);
    const params = vault.kdfParams || DEFAULT_KDF_PARAMS;

    const masterKey = await deriveMasterKey(password, salt, params);

    if (!(await verifyMasterKey(masterKey, vault.verifier))) {
      throw new Error('Incorrect master password');
    }

    this.masterKey = masterKey;
    this.vault = vault;
    this.state = 'unlocked';

    // Full sync.
    await this.sync();
  }

  // Sync all entries + folders from the server.
  async sync() {
    if (!this.isUnlocked()) return;

    const resp = await this.client.post('/sync', { vaultId: this.vault.id });
    const { entries, folders } = resp.data;

    // Decrypt entries.
    this.entries.clear();

    for (const wireEntry of entries) {
      if (wireEntry.deletedAt) continue;

      try {
        const payload = await decryptEntry(this.masterKey, wireEntry.wrappedDek, wireEntry.ciphertext);
        this.entries.set(wireEntry.id, { ...wireEntry, payload });
      } catch {
        // Skip entries that fail to decrypt (corrupted or wrong key).
      }
    }

    // Decrypt folders.
    this.folders.clear();

    for (const wireFolder of folders) {
      if (wireFolder.deletedAt) continue;

      try {
        const payload = await decryptEntry(this.masterKey, wireFolder.wrappedDek, wireFolder.ciphertext);
        this.folders.set(wireFolder.id, { ...wireFolder, payload });
      } catch {
        // Skip.
      }
    }

    // Rebuild search index.
    this.index = buildIndex([...this.entries.values()]);
  }

  // Check if the vault revision has changed (cheap poll).
  async checkRevision() {
    const resp = await this.client.get(`/revision-date?vaultId=${this.vault.id}`);
    const serverTs = Date.parse(resp.data.revisionDate);
    const localTs = Date.parse(this.vault.revisionDate || 0);

    return serverTs > localTs;
  }

  // Get an entry's decrypted payload.
  getEntry(id) {
    return this.entries.get(id) || null;
  }

  // List all decrypted folders (for the path selector).
  listFolders() {
    return [...this.folders.values()];
  }

  // Search entries by query. Supports the operator syntax from
  // search/query.js (tag:, host:, type:, scope:, has:, strength:, changed:)
  // plus free-text scoring via search/score.js. When the query is empty, all
  // entries are returned, ranked by recency × frequency.
  search(query) {
    if (!this.index) return [];

    const { operators, text } = parseQuery(query);
    const rows = this.index.rows;

    const scored = [];

    for (const row of rows) {
      if (!matchesOperators(row, operators)) continue;

      scored.push({ row, score: scoreRow(row, text) });
    }

    return rankByScore(scored).map(({ row }) => this.entries.get(row.id));
  }

  // Match entries against a hostname for autofill.
  matchHostname(hostname) {
    const results = [];

    for (const entry of this.entries.values()) {
      if (entry.type !== 'login') continue;

      const urls = entry.payload.urls || [];

      for (const url of urls) {
        try {
          const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
          const entryHost = new URL(withScheme).hostname;

          if (
            entryHost === hostname ||
            entryHost.endsWith(`.${hostname}`) ||
            hostname.endsWith(`.${entryHost}`)
          ) {
            results.push(entry);
            break;
          }
        } catch {
          // Skip malformed URLs.
        }
      }
    }

    return results;
  }

  // Create a new entry: encrypt the payload, POST to the server, cache locally.
  async createEntry(type, payload) {
    const { wrappedDek, ciphertext } = await encryptEntry(this.masterKey, payload);

    const resp = await this.client.post('/entries/create', {
      vaultId: this.vault.id,
      type,
      wrappedDek,
      ciphertext,
    });

    const wireEntry = resp.data;
    const cached = { ...wireEntry, payload };

    this.entries.set(wireEntry.id, cached);
    addToIndex(this.index, cached);

    return cached;
  }

  // Update an existing entry: re-encrypt under a fresh DEK, PUT to the server.
  async updateEntry(id, type, payload) {
    const { wrappedDek, ciphertext } = await encryptEntry(this.masterKey, payload);

    const cached = this.entries.get(id);
    const lastKnownRevisionDate = cached?.revisionDate || null;

    const resp = await this.client.post('/entries/update', {
      id,
      type,
      wrappedDek,
      ciphertext,
      lastKnownRevisionDate,
    });

    const wireEntry = resp.data;
    const updated = { ...wireEntry, payload };

    this.entries.set(id, updated);
    removeFromIndex(this.index, id);
    addToIndex(this.index, updated);

    return updated;
  }

  // Lock: scrub all sensitive state.
  lock() {
    this._scrub();
  }

  _scrub() {
    if (this.masterKey) {
      // Best-effort zero before dropping the reference — JS GC is
      // non-deterministic, but the fill is cheap and ensures the buffer is
      // scrubbed if a copy escaped.
      try { this.masterKey.fill(0); } catch { /* typed array views may not support fill */ }
    }

    this.masterKey = null;
    this.entries.clear();
    this.folders.clear();
    this.index = null;
    this.state = 'locked';
  }
}