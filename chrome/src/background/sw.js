// Background service worker for the PlusEV Secrets extension.
//
// Owns: vault state (encrypted cache), crypto, sync, autofill matching,
// and the message router between popup / content scripts / options.
//
// Multi-connection: stores an array of connections, one active at a time.
// Existing flat-field configs auto-migrate to the connections array on load.
//
// MV3 lifecycle: the service worker is terminated by the browser when idle
// (~30s with no activity). This is a FEATURE for security — the master key
// is naturally scrubbed. The user re-unlocks on next use.

import { HmacClient } from '../shared/hmac-client.js';
import { VaultStore } from '../shared/store.js';

const store = new VaultStore();

// Per-tab login-form presence reported by the content script:
// tabId -> Set of frameIds that currently have a login form.
// Absent key = no report yet; the badge falls back to hostname matching.
const tabLoginFrames = new Map();

// ── Config management ──

const CONFIG_KEYS = ['connections', 'activeConnectionId'];

let connIdCounter = 0;

async function getConfig() {
  const raw = await chrome.storage.local.get(CONFIG_KEYS);

  // Migration: old flat-field config to connections array.
  if (!raw.connections) {
    const flat = await chrome.storage.local.get(['serverURL', 'apiKey', 'apiSecret', 'vaultId', 'vaultName']);

    if (flat.serverURL) {
      raw.connections = [{
        id: _nextConnId(),
        name: 'Default',
        serverURL: flat.serverURL,
        apiKey: flat.apiKey,
        apiSecret: flat.apiSecret,
        vaultId: flat.vaultId || 0,
        vaultName: flat.vaultName || '',
      }];
      raw.activeConnectionId = raw.connections[0].id;
      await chrome.storage.local.set({
        connections: raw.connections,
        activeConnectionId: raw.activeConnectionId,
      });
    } else {
      raw.connections = [];
    }
  }

  // Seed the in-memory counter from the existing IDs so we don't collide
  // after a service-worker restart. Format: "conn_<n>".
  _seedConnIdCounter(raw.connections || []);

  // Ensure vaultId/vaultName are numbers/strings.
  for (const c of raw.connections || []) {
    c.vaultId = c.vaultId || 0;
    c.vaultName = c.vaultName || '';
  }

  return raw;
}

function _nextConnId() {
  connIdCounter++;
  return 'conn_' + connIdCounter;
}

function _seedConnIdCounter(connections) {
  for (const c of connections) {
    const m = /^conn_(\d+)$/.exec(c.id || '');

    if (m) {
      const n = parseInt(m[1], 10);

      if (n > connIdCounter) connIdCounter = n;
    }
  }
}

function _findConn(connections, id) {
  return (connections || []).find(c => c.id === id);
}

async function createClient() {
  const config = await getConfig();
  const conn = _findConn(config.connections, config.activeConnectionId);

  if (!conn || !conn.serverURL || !conn.apiKey) return null;

  return new HmacClient({ serverURL: conn.serverURL, apiKey: conn.apiKey, apiSecret: conn.apiSecret });
}

// ── Badge management ──

const BADGE_MATCH_COLOR = '#4CAF50';

async function updateBadge() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }

  if (!store.isUnlocked()) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }

  try {
    const hostname = new URL(tab.url).hostname;
    const matches = store.matchHostname(hostname);

    // Once the content script has reported, only surface matches when a
    // login form is actually present in the tab. No report yet → show them.
    const frames = tabLoginFrames.get(tab.id);
    const formPresent = frames === undefined || frames.size > 0;

    if (matches.length > 0 && formPresent) {
      await chrome.action.setBadgeText({ text: String(matches.length) });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_MATCH_COLOR });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    await chrome.action.setBadgeText({ text: '' });
  }
}

// ── Message router ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => sendResponse({ error: err.message }));
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {

    case 'GET_CONFIG': {
      const cfg = await getConfig();
      const conn = _findConn(cfg.connections, cfg.activeConnectionId);
      return {
        connections: cfg.connections,
        activeConnectionId: cfg.activeConnectionId,
        activeVaultId: conn?.vaultId || 0,
        activeVaultName: conn?.vaultName || '',
      };
    }

    case 'SET_CONFIG': {
      const cfg = await getConfig();
      const conn = _findConn(cfg.connections, cfg.activeConnectionId);

      if (!conn) return { error: 'No active connection' };

      if (message.config.serverURL !== undefined) conn.serverURL = message.config.serverURL;
      if (message.config.apiKey !== undefined) conn.apiKey = message.config.apiKey;
      if (message.config.apiSecret !== undefined) conn.apiSecret = message.config.apiSecret;
      if (message.config.vaultId !== undefined) conn.vaultId = message.config.vaultId;
      if (message.config.vaultName !== undefined) conn.vaultName = message.config.vaultName;
      if (message.config.name !== undefined) conn.name = message.config.name;

      await chrome.storage.local.set({ connections: cfg.connections });
      return { ok: true };
    }

    case 'ADD_CONNECTION': {
      const cfg = await getConfig();
      const conn = {
        id: _nextConnId(),
        name: message.name || 'New Connection',
        serverURL: message.serverURL || '',
        apiKey: message.apiKey || '',
        apiSecret: message.apiSecret || '',
        vaultId: 0,
        vaultName: '',
      };

      cfg.connections.push(conn);
      await chrome.storage.local.set({ connections: cfg.connections });
      return { ok: true, connection: conn };
    }

    case 'REMOVE_CONNECTION': {
      const cfg = await getConfig();
      const idx = cfg.connections.findIndex(c => c.id === message.id);

      if (idx === -1) return { error: 'Connection not found' };

      cfg.connections.splice(idx, 1);

      if (cfg.activeConnectionId === message.id) {
        cfg.activeConnectionId = cfg.connections[0]?.id || '';
        store.lock();
      }

      await chrome.storage.local.set({
        connections: cfg.connections,
        activeConnectionId: cfg.activeConnectionId,
      });
      return { ok: true };
    }

    case 'SET_ACTIVE_CONNECTION': {
      if (store.isUnlocked()) store.lock();

      await chrome.storage.local.set({ activeConnectionId: message.id });
      await updateBadge();
      return { ok: true };
    }

    case 'GET_VAULT_STATE': {
      const cfg = await getConfig();
      const conn = _findConn(cfg.connections, cfg.activeConnectionId);
      return {
        state: store.state,
        vaultName: store.vault?.name || conn?.vaultName || '',
        entryCount: store.entries.size,
        isUnlocked: store.isUnlocked(),
      };
    }

    case 'LIST_VAULTS': {
      const client = await createClient();

      if (!client) return { error: 'Not configured' };

      store.setClient(client);
      const vaults = await store.listVaults();
      return { vaults };
    }

    case 'UNLOCK': {
      const cfg = await getConfig();
      const client = await createClient();

      if (!client) return { error: 'Not configured' };

      store.setClient(client);
      const vaults = await store.listVaults();
      const vault = vaults.find(v => v.id === message.vaultId);

      if (!vault) return { error: 'Vault not found' };

      await store.unlock(vault, message.password);
      const conn = _findConn(cfg.connections, cfg.activeConnectionId);

      if (conn) {
        conn.vaultId = vault.id;
        conn.vaultName = vault.name;
        await chrome.storage.local.set({ connections: cfg.connections });
      }

      await updateBadge();
      return { ok: true, entryCount: store.entries.size };
    }

    case 'LOCK':
      store.lock();
      await updateBadge();
      return { ok: true };

    case 'SEARCH':
      if (!store.isUnlocked()) return { error: 'Vault is locked' };
      return { results: store.search(message.query || '') };

    case 'GET_ENTRY':
      if (!store.isUnlocked()) return { error: 'Vault is locked' };
      return { entry: store.getEntry(message.id) };

    case 'MATCH_HOSTNAME':
      if (!store.isUnlocked()) return { error: 'Vault is locked' };
      return { results: store.matchHostname(message.hostname) };

    case 'PAGE_HAS_LOGIN_FORM': {
      const tabId = sender.tab?.id;

      if (tabId === undefined || sender.frameId === undefined) return { ok: false };

      let frames = tabLoginFrames.get(tabId);

      if (!frames) {
        frames = new Set();
        tabLoginFrames.set(tabId, frames);
      }

      if (message.present) {
        frames.add(sender.frameId);
      } else {
        frames.delete(sender.frameId);
      }

      await updateBadge();
      return { ok: true };
    }

    case 'SYNC':
      if (!store.isUnlocked()) return { error: 'Vault is locked' };

      await store.sync();
      await updateBadge();
      return { ok: true, entryCount: store.entries.size };

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

// ── Tab listeners ──

chrome.tabs.onActivated.addListener(updateBadge);

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    // Frame presence from the previous page is stale; the content script
    // re-reports after load. Until then, fall back to hostname matching.
    tabLoginFrames.delete(tabId);
    updateBadge();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabLoginFrames.delete(tabId);
});

// ── Context menu ──

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'autofill',
    title: 'Fill credentials from PlusEV Secrets',
    contexts: ['editable'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'autofill') return;
  if (!store.isUnlocked()) return;

  try {
    // Match against the frame the user right-clicked in (may be cross-origin).
    const hostname = new URL(info.frameUrl || info.pageUrl).hostname;
    const matches = store.matchHostname(hostname);

    if (matches.length !== 1) return;

    await chrome.tabs.sendMessage(tab.id, {
      type: 'AUTOFILL_CREDENTIALS',
      username: matches[0].payload.username || '',
      password: matches[0].payload.password || '',
    }, { frameId: info.frameId });
  } catch {
    // Content script may not be injected on this page — silently ignore.
  }
});