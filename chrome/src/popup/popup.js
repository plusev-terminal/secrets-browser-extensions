// PlusEV Secrets popup — quick search + copy + autofill.
// Lit web component matching the Terminal the-* app pattern.
// Multi-connection: connection switcher in header, vault switcher on vault name.

import '@tp/tp-button/tp-button.js';
import '@tp/tp-input/tp-input.js';
import '@tp/tp-icon/tp-icon.js';
import '@tp/tp-popup/tp-popup.js';
import '@tp/tp-popup/tp-popup-menu.js';
import '@tp/tp-popup/tp-popup-menu-item.js';
import '@tp/tp-toaster/tp-toaster.js';
import { LitElement, html, css } from 'lit';
import { virtualize } from '@lit-labs/virtualizer/virtualize.js';
import icons from '../shared/icons.js';
import themeTokens from '../shared/theme-tokens.js';
import { controls, shared } from '../shared/styles.js';

function send(msg) { return chrome.runtime.sendMessage(msg); }

export class ThePopup extends LitElement {
  static get styles() {
    return [themeTokens, controls, shared, css`
      :host {
        display: flex;
        flex-direction: column;
        width: 380px;
        height: 500px;
        font-family: var(--font0);
        font-size: var(--font-size-md);
        background: var(--page-bg);
        color: var(--text);
        overflow: hidden;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-bottom: solid 1px var(--border-strong);
        flex-shrink: 0;
      }

      .header h1 {
        font-size: 14px;
        margin: 0;
        font-weight: 600;
        flex: 1;
      }

      .vault-name-toggle {
        cursor: pointer;
        user-select: none;
      }

      .vault-name-toggle::after {
        content: ' ▾';
        font-size: 10px;
        opacity: 0.5;
      }

      .header-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .conn-toggle {
        --tp-icon-width: 18px;
        --tp-icon-height: 18px;
        cursor: pointer;
        --tp-icon-color: var(--icon-color);
      }

      .conn-toggle:hover { --tp-icon-color: var(--icon-color-hover); }

      .search-row {
        padding: 10px 14px;
        flex-shrink: 0;
      }

      .results {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 0 8px 8px;
      }

      .results::-webkit-scrollbar { width: 10px; }
      .results::-webkit-scrollbar-track { background: var(--scrollbar-bg); border-radius: 4px; }
      .results::-webkit-scrollbar-thumb { background-color: var(--scrollbar-thumb); outline: none; border-radius: 4px; }

      .scrollbar::-webkit-scrollbar { width: 10px; }
      .scrollbar::-webkit-scrollbar-track { background: var(--scrollbar-bg); border-radius: 4px; }
      .scrollbar::-webkit-scrollbar-thumb { background-color: var(--scrollbar-thumb); outline: none; border-radius: 4px; }

      .entry {
        display: flex;
        align-items: center;
        padding: 8px 10px;
        border-radius: var(--default-border-radius);
        cursor: pointer;
      }

      .entry:hover { background: var(--surface-hover); }

      .entry-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 10px;
        --tp-icon-width: 20px;
        --tp-icon-height: 20px;
      }

      .entry-info {
        flex: 1;
        min-width: 0;
      }

      .entry-title {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .entry-meta {
        font-size: var(--font-size-xs);
        color: var(--text-dim);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .entry-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.15s;
      }

      .entry:hover .entry-actions { opacity: 1; }

      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-dim);
      }

      .match-banner {
        padding: 6px 14px;
        font-size: var(--font-size-xs);
        color: var(--text-hl);
        border-bottom: solid 1px var(--border-strong);
        flex-shrink: 0;
      }

      .unlock-form { padding: 14px; }

      .logo-row {
        display: flex;
        justify-content: center;
        padding-top: 20px;
      }

      .popup-unlocked {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      tp-toast {
        border-radius: var(--popup-border-radius);
        background: var(--palette-text);
        color: var(--palette-bg);
        font-weight: bold;
      }

      tp-toast::part(dismiss-icon):hover {
        --tp-icon-color: var(--icon-color-hover);
      }

      tp-toast[type="warning"] {
        background: var(--warning-color);
        color: var(--palette-bg);
      }

      tp-toast[type="error"] {
        background: var(--error-color);
        color: var(--palette-text);
      }

      tp-toast[type="error"]::part(type-icon) {
        --tp-icon-color: var(--palette-text);
      }

      tp-toast[type="error"]::part(dismiss-icon) {
        --tp-icon-color: var(--palette-text);
      }

      tp-toast[type="error"]::part(dismiss-icon):hover {
        --tp-icon-color: var(--palette-bg);
      }

      tp-toast[type="error"]::part(timeout-strip) {
        --tp-timeout-strip-color: var(--palette-text);
      }

      tp-toast::part(timeout-strip) {
        left: 0px;
        right: 0px;
        bottom: 0px;
        border-radius: 0 0 var(--popup-border-radius) var(--popup-border-radius);
        overflow: hidden;
        --tp-timeout-strip-width: 5px;
        --tp-timeout-strip-color: var(--palette-accent);
      }

      tp-toast::part(inner-strip) {
        margin-top: 3px;
        height: 2px;
      }
    `];
  }

  static properties = {
    _mode: {}, _vaultInfo: { type: Object }, _entries: { type: Array },
    _autofillMatches: { type: Array }, _hostname: {},
    _lockedVaultId: {}, _lockedVaultName: {}, _unlockError: {},
    _vaults: { type: Array }, _connections: { type: Array },
  };

  constructor() {
    super();
    this._mode = null; this._vaultInfo = {}; this._entries = [];
    this._autofillMatches = []; this._hostname = '';
    this._lockedVaultId = 0; this._lockedVaultName = ''; this._unlockError = '';
    this._vaults = []; this._connections = [];
  }

  async connectedCallback() {
    super.connectedCallback();
    const cfg = await send({ type: 'GET_CONFIG' });
    this._connections = cfg.connections || [];
    this._activeConnectionId = cfg.activeConnectionId;
    const conn = (this._connections || []).find(c => c.id === cfg.activeConnectionId);
    if (!conn || !conn.serverURL || !conn.apiKey) { this._mode = 'notConfigured'; this.requestUpdate(); return; }
    this._lockedVaultId = conn.vaultId || 0;
    this._lockedVaultName = conn.vaultName || '';
    await this._loadVaults();
    const state = await send({ type: 'GET_VAULT_STATE' });
    if (!state.isUnlocked) { this._mode = 'locked'; this.requestUpdate(); return; }
    await this._enterUnlocked(state);
  }

  async _loadVaults() { const r = await send({ type: 'LIST_VAULTS' }); this._vaults = r.vaults || []; }

  render() {
    let content;
    if (this._mode === 'notConfigured') content = html`<div class="empty-state"><p>Not configured yet.</p><tp-button @click=${() => chrome.runtime.openOptionsPage()}>Open Options</tp-button></div>`;
    else if (this._mode === 'locked') content = this._renderLocked();
    else if (this._mode === 'unlocked') content = this._renderUnlocked();
    else content = html``;
    return html`${content}<tp-toaster></tp-toaster>`;
  }

  _renderLocked() {
    return html`
      <div class="header">
        ${this._renderVaultMenu()}
        <div class="header-actions">
          ${this._renderConnMenu()}
          ${this._renderMoreMenu()}
        </div>
      </div>
      <div class="logo-row"><tp-icon .icon=${icons['logo']} style="--tp-icon-width:36px;--tp-icon-height:36px;"></tp-icon></div>
      <div class="unlock-form">
        <tp-input id="masterPassword" style="margin-bottom:12px;"><input type="password" placeholder="Master password" autofocus @keydown=${e => { if (e.key === 'Enter') this._doUnlock(); }}></tp-input>
        <tp-button id="unlockBtn" @click=${this._doUnlock} style="width:100%;">Unlock</tp-button>
        ${this._unlockError ? html`<div style="color:var(--error-color);font-size:12px;margin-top:8px;">${this._unlockError}</div>` : ''}
      </div>
    `;
  }

  _renderUnlocked() {
    return html`
      <div class="popup-unlocked">
        <div class="header">
          ${this._renderVaultMenu()}
          <div class="header-actions">
            ${this._renderConnMenu()}
            ${this._renderMoreMenu()}
          </div>
        </div>
        ${this._autofillMatches.length > 0 ? html`<div class="match-banner">${this._autofillMatches.length} match${this._autofillMatches.length > 1 ? 'es' : ''} for ${this._hostname}</div>` : ''}
        <div class="search-row">
          <tp-input id="searchInput"><input type="text" placeholder="Search vault..." autocomplete="off" @input=${() => { clearTimeout(this._st); this._st = setTimeout(() => this._doSearch(), 150); }}></tp-input>
        </div>
        <div class="results">
          ${this._entries.length === 0 ? html`<div class="empty-state">No entries found.</div>`
            : virtualize({ items: this._entries, keyFunction: e => e.id, scroller: true, renderItem: e => this._renderEntryItem(e) })}
        </div>
      </div>
    `;
  }

  _renderEntryItem(entry) {
    return html`
      <div class="entry">
        <div class="entry-icon"><tp-icon .icon=${icons[typeIcon(entry.type)]}></tp-icon></div>
        <div class="entry-info">
          <div class="entry-title">${entry.payload?.title || '(untitled)'}</div>
          ${entry.payload?.username ? html`<div class="entry-meta">${entry.payload.username}</div>` : ''}
        </div>
        <div class="entry-actions">
          <tp-button small @click=${e => { e.stopPropagation(); this._copyField(entry, 'username'); }}>U</tp-button>
          <tp-button small @click=${e => { e.stopPropagation(); this._copyField(entry, 'password'); }}>P</tp-button>
          ${entry.type === 'login' ? html`<tp-button small @click=${e => { e.stopPropagation(); this._autofillEntry(entry); }}>⚡</tp-button>` : ''}
        </div>
      </div>
    `;
  }

  _renderVaultMenu() {
    const name = this._vaultInfo?.vaultName || this._lockedVaultName || 'Unlock Vault';
    return html`
      <tp-popup alwaysToggle halign="left">
        <h1 slot="toggle" class="vault-name-toggle">
          ${this._mode === 'unlocked' ? html`<tp-icon .icon=${icons['logo']} style="--tp-icon-width:20px;--tp-icon-height:20px;margin-right:6px;vertical-align:middle;"></tp-icon>` : ''}${name}
        </h1>
        <tp-popup-menu slot="content">
          ${this._vaults.map(v => html`
            <tp-popup-menu-item class="toggle" .icon=${v.id === this._lockedVaultId ? icons['check'] : undefined} ?selected=${v.id === this._lockedVaultId} @click=${() => this._switchVault(v)}>${v.name}</tp-popup-menu-item>
          `)}
        </tp-popup-menu>
      </tp-popup>
    `;
  }

  _renderMoreMenu() {
    return html`
      <tp-popup alwaysToggle halign="right">
        <tp-icon class="vault-menu-trigger" slot="toggle" .icon=${icons['vertical-dots']}></tp-icon>
        <tp-popup-menu slot="content">
          ${this._mode === 'unlocked' ? html`<tp-popup-menu-item class="toggle" .icon=${icons['lock']} @click=${this._doLock}>Lock</tp-popup-menu-item>` : ''}
          <tp-popup-menu-item class="toggle" .icon=${icons['settings']} @click=${() => chrome.runtime.openOptionsPage()}>Connections</tp-popup-menu-item>
        </tp-popup-menu>
      </tp-popup>
    `;
  }

  async _doUnlock() {
    const input = this.renderRoot.querySelector('#masterPassword input');
    const btn = this.renderRoot.querySelector('#unlockBtn');
    if (!input || !btn) return;
    btn.loading = true; this._unlockError = '';
    try {
      const resp = await send({ type: 'UNLOCK', vaultId: this._lockedVaultId, password: input.value });
      if (resp.error) throw new Error(resp.error);
      input.value = '';
      await this._enterUnlocked(await send({ type: 'GET_VAULT_STATE' }));
    } catch (e) { this._unlockError = e.message; btn.loading = false; input.value = ''; }
  }

  async _doLock() { await send({ type: 'LOCK' }); this._mode = 'locked'; const cfg = await send({ type: 'GET_CONFIG' }); this._lockedVaultId = cfg.activeVaultId || 0; this._lockedVaultName = cfg.activeVaultName || ''; this.requestUpdate(); }

  _doSearch() {
    const input = this.renderRoot.querySelector('#searchInput input');
    if (!input) return;
    const q = input.value;
    if (!q && this._autofillMatches.length > 0) { this._entries = this._autofillMatches; this.requestUpdate(); }
    else send({ type: 'SEARCH', query: q }).then(resp => { this._entries = resp.results || []; this.requestUpdate(); });
  }

  async _enterUnlocked(state) {
    this._mode = 'unlocked'; this._vaultInfo = state;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try { this._hostname = tab?.url ? new URL(tab.url).hostname : ''; } catch {}
    if (this._hostname) { const r = await send({ type: 'MATCH_HOSTNAME', hostname: this._hostname }); this._autofillMatches = r.results || []; }
    this._entries = this._autofillMatches.length > 0 ? this._autofillMatches : [];
    this.requestUpdate();
    setTimeout(() => { const si = this.renderRoot.querySelector('#searchInput input'); if (si) si.focus(); }, 100);
  }

  async _switchVault(vault) { if (vault.id === this._lockedVaultId) return; this._lockedVaultId = vault.id; this._lockedVaultName = vault.name; await send({ type: 'SET_CONFIG', config: { vaultId: vault.id, vaultName: vault.name } }); await this._doLock(); }
  async _switchConnection(conn) { if (conn.id === this._activeConnectionId) return; await send({ type: 'SET_ACTIVE_CONNECTION', id: conn.id }); this._mode = 'locked'; const cfg = await send({ type: 'GET_CONFIG' }); this._connections = cfg.connections || []; this._activeConnectionId = cfg.activeConnectionId; this._lockedVaultId = cfg.activeVaultId || 0; this._lockedVaultName = cfg.activeVaultName || ''; this._vaults = []; this.requestUpdate(); }
  async _autofillEntry(entry) { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab) return; await chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL_CREDENTIALS', username: entry.payload.username || '', password: entry.payload.password || '' }); window.close(); }
  async _copyField(entry, field) { const v = entry.payload?.[field]; if (!v) return; await navigator.clipboard.writeText(v); }
}

function typeIcon(type) { return { login:'user', mnemonic:'wallet', apiKey:'key', privateKey:'key', contract:'file', backupCodes:'lock' }[type] || 'file'; }

ThePopup.prototype._renderConnMenu = function() {
  return html`
    <tp-popup alwaysToggle halign="right">
      <tp-icon class="conn-toggle" slot="toggle" .icon=${icons['server-network-on']}></tp-icon>
      <tp-popup-menu slot="content">
        ${(this._connections || []).map(c => html`
          <tp-popup-menu-item class="toggle" .icon=${c.id === this._activeConnectionId ? icons['check'] : undefined} @click=${() => this._switchConnection(c)}>${c.name}</tp-popup-menu-item>
        `)}
        <tp-popup-menu-item class="toggle" .icon=${icons['settings']} @click=${() => chrome.runtime.openOptionsPage()}>Manage Connections</tp-popup-menu-item>
      </tp-popup-menu>
    </tp-popup>
  `;
};

customElements.define('the-popup', ThePopup);
