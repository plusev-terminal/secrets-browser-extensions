// PlusEV Secrets popup — quick search + copy + autofill.
// Lit web component matching the Terminal the-* app pattern.
// Multi-connection: connection switcher in header, vault switcher on vault name.

import '@tp/tp-button/tp-button.js';
import '@tp/tp-input/tp-input.js';
import '@tp/tp-icon/tp-icon.js';
import '@tp/tp-popup/tp-popup.js';
import '@tp/tp-popup/tp-popup-menu.js';
import '@tp/tp-popup/tp-popup-menu-item.js';
import '@tp/tp-popup/tp-popup-menu-divider.js';
import '@tp/tp-toaster/tp-toaster.js';
import '@tp/tp-form/tp-form.js';
import '../elements/el-empty.js';
import { LitElement, html, css } from 'lit';
import { virtualize } from '@lit-labs/virtualizer/virtualize.js';
import icons from '../shared/icons.js';
import themeTokens from '../shared/theme-tokens.js';
import { controls, shared } from '../shared/styles.js';
import { typeMeta } from '../shared/entryTypes.js';
import { copyToClipboard } from '@tp/helpers/clipboard';

function send(msg) { return chrome.runtime.sendMessage(msg); }

export class ThePopup extends LitElement {
  static get styles() {
    return [
      themeTokens,
      controls,
      shared,
      css`
        :host {
          display: flex;
          flex-direction: column;
          width: 480px;
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
          padding: var(--space-3) var(--space-4);
          border-bottom: solid 1px var(--border-strong);
          flex-shrink: 0;
        }

        .header h1 {
          font-size: var(--font-size-lg);
          margin: 0;
          font-weight: 600;
          flex: 1;
        }

        .vault-name-toggle {
          cursor: pointer;
          user-select: none;
          padding: var(--space-1) var(--space-2);
          border: solid 1px var(--border-strong);
          border-radius: var(--default-border-radius);
        }

        .vault-name-toggle:hover,
        tp-popup[isopen] .vault-name-toggle {
          border: solid 1px var(--palette-accent);
        }

        .header-actions {
          display: flex;
          gap: var(--space-2);
          align-items: center;
        }

        .conn-toggle {
          --tp-icon-width: 18px;
          --tp-icon-height: 18px;
          cursor: pointer;
          --tp-icon-color: var(--icon-color);
        }

        .conn-toggle:hover {
          --tp-icon-color: var(--icon-color-hover);
        }

        .search-row {
          padding: var(--space-3) var(--space-4);
          flex-shrink: 0;
        }

        .results {
          position: relative;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 0 0 var(--space-2);
        }

        .entry {
          display: flex;
          align-items: center;
          width: 100%;
          box-sizing: border-box;
          padding: var(--space-2) var(--space-3);
          cursor: pointer;
          gap: var(--space-3);
        }

        .entry:hover {
          background: var(--surface-hover);
        }
        .entry-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
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
          flex-shrink: 0;
          gap: var(--space-1);
          opacity: 0;
          transition: opacity 0.15s;
        }

        .entry:hover .entry-actions {
          opacity: 1;
        }

        .entry-action {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-1);
          border: solid 1px var(--border-strong);
          border-radius: var(--default-border-radius);
          cursor: pointer;
          --tp-icon-width: 16px;
          --tp-icon-height: 16px;
          --tp-icon-color: var(--text-dim);
        }

        .entry-action:hover {
          --tp-icon-color: var(--text-hl);
          border-color: var(--text-hl);
        }

        .section-label {
          padding: var(--space-3) var(--space-3) var(--space-1);
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }

        .all-entries-label {
          border-top: solid 1px var(--border-strong);
          margin-top: var(--space-2);
          padding-top: var(--space-3);
        }

        .unlock-form {
          padding: var(--space-4);
        }

        .no-vaults {
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          text-align: center;
          color: var(--text);
        }

        .no-vaults .hint-dim {
          color: var(--text-dim);
          font-size: var(--font-size-sm);
          margin: 0;
        }

        .logo {
          --tp-icon-width: 20px;
          --tp-icon-height: 20px;
          margin-right: var(--space-2);
          vertical-align: middle;
        }

        .logo-row {
          display: flex;
          justify-content: center;
          padding-top: var(--space-5);
        }

        .logo-row tp-icon {
          --tp-icon-width: 20vw;
          --tp-icon-height: 20vw;
        }

        .unlock-btn {
          margin-top: var(--space-5);
          width: 100%;
        }

        .popup-unlocked {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .detail-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .detail-header {
          display: flex;
          align-items: center;
          padding: var(--space-3) var(--space-4);
          border-bottom: solid 1px var(--border-strong);
          flex-shrink: 0;
          gap: var(--space-2);
        }

        .detail-back {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-1);
          border-radius: var(--default-border-radius);
          cursor: pointer;
          --tp-icon-width: 18px;
          --tp-icon-height: 18px;
          --tp-icon-color: var(--text);
        }

        .detail-back:hover { --tp-icon-color: var(--text-hl); }

        .detail-header-icon {
          --tp-icon-width: 22px;
          --tp-icon-height: 22px;
          --tp-icon-color: var(--text-dim);
          flex-shrink: 0;
        }

        .detail-title {
          flex: 1;
          min-width: 0;
          font-size: var(--font-size-md);
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .detail-type-badge {
          font-size: var(--font-size-xs);
          color: var(--text-dim);
          flex-shrink: 0;
        }

        .detail-body {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }

        .field-row {
          margin-bottom: var(--space-4);
        }

        .field-label {
          font-size: var(--font-size-xs);
          color: var(--text-dim);
          margin-bottom: var(--space-1);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .field-value {
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .field-value-text {
          flex: 1;
          min-width: 0;
          font-size: var(--font-size-sm);
          font-family: var(--font-mono);
          word-break: break-all;
        }

        .field-value-text.masked {
          color: var(--text-dim);
          letter-spacing: 0.15em;
          user-select: none;
          font-family: var(--font0);
        }

        .field-value-text.plain {
          font-family: var(--font0);
        }

        .field-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
        }

        .field-tag {
          font-size: var(--font-size-xs);
          padding: 2px var(--space-2);
          border-radius: var(--radius-lg);
          background: var(--palette-surface-active);
          color: var(--text-dim);
        }

        .field-notes {
          font-size: var(--font-size-sm);
          color: var(--text);
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.5;
        }

        .scope-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
        }

        .scope-badge {
          font-size: var(--font-size-xs);
          padding: 2px var(--space-2);
          border-radius: var(--radius-sm);
          background: var(--palette-surface-active);
          color: var(--text);
          text-transform: capitalize;
        }

        .code-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .code-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: var(--font-size-sm);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--default-border-radius);
          background: var(--palette-surface);
        }

        .code-item.used {
          text-decoration: line-through;
          opacity: 0.5;
        }
    `];
  }

  render() {
    let content;

    if (this._mode === 'notConfigured') {
      content = html`
        <el-empty absolute>
          <div>
            Not configured yet.
          </div>
          <div class="button-centered">
            <tp-button @click=${() => chrome.runtime.openOptionsPage()}>Open Options</tp-button>
          </div>
        </el-empty>
      `;
    } else if (this._mode === 'locked') {
      content = this._renderLocked();
    } else if (this._mode === 'detail') {
      content = this._renderDetail();
    } else if (this._mode === 'unlocked') {
      content = this._renderUnlocked();
    } else {
      content = html``;
    }

    return html`
      ${content}
      <tp-toaster></tp-toaster>
    `;
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
      <div class="logo-row">
        <tp-icon class="static" .icon=${icons['logo']}></tp-icon>
      </div>
      ${this._vaults.length === 0
        ? this._renderNoVaultsHint()
        : this._renderUnlockForm()}
    `;
  }

  _renderUnlockForm() {
    const showPassword = this._showPassword || false;

    return html`
      <tp-form class="unlock-form" @submit=${this._doUnlock}>
        <form>
          <label>Master password</label>
          <tp-input name="masterPassword">
            <input type=${showPassword ? 'text' : 'password'} autofocus>
            <tp-icon slot="suffix" class="eye-icon" .icon=${showPassword ? icons['eye-off'] : icons['eye']} @click=${() => this._toggleShowPassword()}></tp-icon>
          </tp-input>
          <tp-button id="unlockBtn" class="unlock-btn" submit>Unlock</tp-button>
        </form>
      </tp-form>
    `;
  }

  // Shown when the active connection is configured but the server returned
  // no vaults. The user almost always needs to open Connections to verify
  // the server URL / API key — give them a direct path.
  _renderNoVaultsHint() {
    return html`
      <div class="no-vaults">
        <p>No vaults found on this server.</p>
        <p class="hint-dim">Check the server URL and API key under Connections.</p>
        <tp-button @click=${() => chrome.runtime.openOptionsPage()}>Open Connections</tp-button>
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
        <div class="search-row">
          <tp-input id="searchInput">
            <input
              type="text"
              placeholder="Search vault..."
              autocomplete="off"
              @input=${() => {
                clearTimeout(this._searchTimer);
                this._searchTimer = setTimeout(() => this._doSearch(), 80);
              }}
            >
            <tp-icon slot="suffix" .icon=${icons.backspace} @click=${() => this._clearSearch()}></tp-icon>
          </tp-input>
        </div>
        <div class="results scrollbar">
          ${this._listItems.length === 0
            ? html`<el-empty absolute>No entries found.</el-empty>`
            : virtualize({
                items: this._listItems,
                keyFunction: item => item._kind === 'label' ? `label-${item.text}` : item.id,
                scroller: true,
                renderItem: item => this._renderListItem(item),
              })}
        </div>
      </div>
    `;
  }

  get _listItems() {
    const showSuggestions = this._autofillMatches.length > 0 && !this._searchQuery;
    const items = [];

    if (showSuggestions) {
      items.push({ _kind: 'label', text: `Autofill for ${this._hostname}` });
      for (const m of this._autofillMatches) items.push(m);
      items.push({ _kind: 'label', text: 'All entries', _allEntries: true });
    }

    for (const e of this._entries) items.push(e);

    return items;
  }

  _renderListItem(item) {
    if (item._kind === 'label') {
      return html`<div class="section-label ${item._allEntries ? 'all-entries-label' : ''}">${item.text}</div>`;
    }

    return this._renderEntryItem(item);
  }

  _renderEntryItem(entry) {
    const iconName = typeMeta(entry.type)?.icon || 'file';
    const p = entry.payload || {};

    return html`
      <div class="entry" @click=${() => this._openEntry(entry)}>
        <div class="entry-icon static">
          <tp-icon .icon=${icons[iconName]}></tp-icon>
        </div>
        <div class="entry-info">
          <div class="entry-title">${p.title || '(untitled)'}</div>
          ${p.username ? html`<div class="entry-meta">${p.username}</div>` : ''}
        </div>
        <div class="entry-actions">
          ${p.username ? html`
            <tp-icon
              class="entry-action"
              .icon=${icons['user']}
              tooltip="Copy username"
              @click=${e => { e.stopPropagation(); this._copyField(entry, 'username'); }}
            ></tp-icon>
          ` : ''}
          ${p.password ? html`
            <tp-icon
              class="entry-action"
              .icon=${icons['lock']}
              tooltip="Copy password"
              @click=${e => { e.stopPropagation(); this._copyField(entry, 'password'); }}
            ></tp-icon>
          ` : ''}
          ${p.totpSecret ? html`
            <tp-icon
              class="entry-action"
              .icon=${icons['clock']}
              tooltip="Copy TOTP secret"
              @click=${e => { e.stopPropagation(); this._copyField(entry, 'totpSecret'); }}
            ></tp-icon>
          ` : ''}
          ${entry.type === 'login' ? html`
            <tp-icon
              class="entry-action"
              .icon=${icons['key']}
              tooltip="Autofill credentials"
              @click=${e => { e.stopPropagation(); this._autofillEntry(entry); }}
            ></tp-icon>
          ` : ''}
        </div>
      </div>
    `;
  }

  // ── Detail view ──

  _openEntry(entry) {
    this._selectedEntry = entry;
    this._revealedKeys = new Set();
    this._mode = 'detail';
  }

  _closeDetail() {
    this._selectedEntry = null;
    this._revealedKeys = new Set();
    this._mode = 'unlocked';
  }

  _isRevealed(key) {
    return this._revealedKeys.has(key);
  }

  _toggleRevealed(key) {
    if (this._isRevealed(key)) {
      this._revealedKeys.delete(key);
    } else {
      this._revealedKeys.add(key);
    }

    this._revealedKeys = new Set(this._revealedKeys);
  }

  async _copyValue(value, label) {
    if (!value) return;

    await navigator.clipboard.writeText(value);
    window.TpToaster.add({ type: 'success', content: `${label} copied — clears in 30s.` });

    if (this._clipboardTimer) clearTimeout(this._clipboardTimer);

    this._clipboardTimer = setTimeout(() => {
      navigator.clipboard.writeText(' ').catch(() => {});
      this._clipboardTimer = null;
    }, 30000);
  }

  _renderDetail() {
    const entry = this._selectedEntry;

    if (!entry) {
      this._mode = 'unlocked';
      return html``;
    }

    const meta = typeMeta(entry.type);
    const iconName = meta?.icon || 'file';
    const p = entry.payload || {};

    return html`
      <div class="detail-view">
        <div class="detail-header">
          <tp-icon
            class="detail-back"
            .icon=${icons['arrow-left']}
            tooltip="Back to list"
            @click=${() => this._closeDetail()}
          ></tp-icon>
          <tp-icon class="detail-header-icon" .icon=${icons[iconName]}></tp-icon>
          <span class="detail-title">${p.title || '(untitled)'}</span>
          <span class="detail-type-badge">${meta?.label || entry.type}</span>
        </div>
        <div class="detail-body scrollbar">
          ${this._renderDetailFields(entry)}
        </div>
      </div>
    `;
  }

  _renderDetailFields(entry) {
    const p = entry.payload || {};

    switch (entry.type) {
      case 'login':       return this._renderLogin(p);
      case 'mnemonic':    return this._renderMnemonic(p);
      case 'apiKey':      return this._renderApiKey(p);
      case 'privateKey':  return this._renderPrivateKey(p);
      case 'contract':    return this._renderContract(p);
      case 'backupCodes': return this._renderBackupCodes(p);
      default:            return this._renderCommon(p);
    }
  }

  _renderFieldRow(label, value, opts = {}) {
    const { masked, mono, copyable } = opts;

    if (!value && value !== 0) return null;

    const isRevealed = masked ? this._isRevealed(label) : true;
    const displayValue = masked && !isRevealed ? '••••••••' : value;

    return html`
      <div class="field-row">
        <div class="field-label">${label}</div>
        <div class="field-value">
          <span class="field-value-text ${masked && !isRevealed ? 'masked' : (mono ? '' : 'plain')}">${displayValue}</span>
          ${masked ? html`
            <tp-icon
              class="entry-action"
              .icon=${isRevealed ? icons['eye-off'] : icons['eye']}
              tooltip=${isRevealed ? 'Hide' : 'Reveal'}
              @click=${() => this._toggleRevealed(label)}
            ></tp-icon>
          ` : ''}
          ${copyable ? html`
            <tp-icon
              class="entry-action"
              .icon=${icons['copy']}
              tooltip="Copy"
              @click=${() => this._copyValue(value, label)}
            ></tp-icon>
          ` : ''}
        </div>
      </div>
    `;
  }

  _renderCommon(p) {
    let out = [];

    if (p.tags && p.tags.length > 0) {
      out.push(html`
        <div class="field-row">
          <div class="field-label">Tags</div>
          <div class="field-tags">
            ${p.tags.map(t => html`<span class="field-tag">${t}</span>`)}
          </div>
        </div>
      `);
    }

    if (p.notes) {
      out.push(html`
        <div class="field-row">
          <div class="field-label">Notes</div>
          <div class="field-notes">${p.notes}</div>
        </div>
      `);
    }

    if (p.customFields && p.customFields.length > 0) {
      out.push(html`
        <div class="field-row">
          <div class="field-label">Custom Fields</div>
          ${p.customFields.map((f, i) => this._renderFieldRow(f.name || `Field ${i + 1}`, f.value, {
            masked: f.type === 'secret',
            copyable: true,
          }))}
        </div>
      `);
    }

    return out;
  }

  _renderLogin(p) {
    return html`
      ${this._renderFieldRow('Username', p.username, { copyable: true })}
      ${this._renderFieldRow('Password', p.password, { masked: true, copyable: true })}
      ${p.urls && p.urls.length > 0
        ? p.urls.map((u, i) => this._renderFieldRow(i === 0 ? 'URLs' : '', u, { copyable: true }))
        : ''}
      ${this._renderFieldRow('TOTP Secret', p.totpSecret, { masked: true, copyable: true })}
      ${this._renderCommon(p)}
    `;
  }

  _renderMnemonic(p) {
    return html`
      ${this._renderFieldRow('Word Count', p.wordCount)}
      ${this._renderFieldRow('Seed Phrase', p.phrase, { masked: true, copyable: true, mono: true })}
      ${this._renderFieldRow('Passphrase', p.passphrase, { masked: true, copyable: true })}
      ${p.derivationPaths && p.derivationPaths.length > 0
        ? p.derivationPaths.map((d, i) => this._renderFieldRow(i === 0 ? 'Derivation Paths' : '', d, { mono: true }))
        : ''}
      ${this._renderCommon(p)}
    `;
  }

  _renderApiKey(p) {
    return html`
      ${this._renderFieldRow('Exchange', p.exchange)}
      ${this._renderFieldRow('API Key', p.key, { masked: true, copyable: true, mono: true })}
      ${this._renderFieldRow('API Secret', p.secret, { masked: true, copyable: true, mono: true })}
      ${p.scopes && p.scopes.length > 0 ? html`
        <div class="field-row">
          <div class="field-label">Scopes</div>
          <div class="scope-list">
            ${p.scopes.map(s => html`<span class="scope-badge">${s}</span>`)}
          </div>
        </div>
      ` : ''}
      ${this._renderCommon(p)}
    `;
  }

  _renderPrivateKey(p) {
    return html`
      ${this._renderFieldRow('Type', p.subtype === 'keystore' ? 'Keystore JSON' : 'Raw Private Key')}
      ${p.subtype === 'keystore'
        ? this._renderFieldRow('Keystore', p.keystore, { masked: true, copyable: true, mono: true })
        : this._renderFieldRow('Private Key', p.privateKey, { masked: true, copyable: true, mono: true })}
      ${this._renderFieldRow('Address', p.address, { copyable: true, mono: true })}
      ${this._renderFieldRow('Chain', p.chain)}
      ${this._renderFieldRow('Derivation Path', p.derivationPath, { mono: true })}
      ${this._renderCommon(p)}
    `;
  }

  _renderContract(p) {
    return html`
      ${this._renderFieldRow('Address', p.address, { copyable: true, mono: true })}
      ${this._renderFieldRow('Chain', p.chain)}
      ${this._renderFieldRow('ABI', p.abi, { masked: true, mono: true })}
      ${this._renderCommon(p)}
    `;
  }

  _renderBackupCodes(p) {
    const codes = p.codes || [];
    const usedFlags = p.usedFlags || [];

    return html`
      ${this._renderFieldRow('Service', p.service)}
      ${codes.length > 0 ? html`
        <div class="field-row">
          <div class="field-label">Backup Codes</div>
          <div class="code-list">
            ${codes.map((code, i) => html`
              <div class="code-item ${usedFlags[i] ? 'used' : ''}">
                <span>${code}</span>
                <tp-icon
                  class="entry-action"
                  .icon=${icons['copy']}
                  tooltip="Copy code"
                  @click=${() => this._copyValue(code, 'Code')}
                ></tp-icon>
              </div>
            `)}
          </div>
        </div>
      ` : ''}
      ${this._renderFieldRow('Generated', p.generatedDate)}
      ${this._renderFieldRow('Expires', p.expiresAt)}
      ${this._renderCommon(p)}
    `;
  }

  _renderVaultMenu() {
    const name = this._vaultInfo?.vaultName || this._lockedVaultName || 'Unlock Vault';

    return html`
      ${this._mode === 'unlocked' ? html`<tp-icon class="logo static" .icon=${icons['logo']}></tp-icon>` : null}
      
      <tp-popup alwaysToggle halign="left">
        <h1 slot="toggle" class="vault-name-toggle">
          ${name}
        </h1>
        <tp-popup-menu slot="content">
          ${this._vaults.map(v => html`
            <tp-popup-menu-item
              class="toggle"
              .icon=${icons['check']}
              ?selected=${v.id === this._lockedVaultId}
              @click=${() => this._switchVault(v)}
            >${v.name}</tp-popup-menu-item>
          `)}
        </tp-popup-menu>
      </tp-popup>
    `;
  }

  _renderConnMenu() {
    return html`
      <tp-popup alwaysToggle halign="right">
        <tp-icon class="conn-toggle" slot="toggle" .icon=${icons['server-network-on']}></tp-icon>
        <tp-popup-menu slot="content">
          ${(this._connections || []).map(c => html`
            <tp-popup-menu-item
              class="toggle"
              ?selected=${c.id === this._activeConnectionId}
              .icon=${icons['check']}
              @click=${() => this._switchConnection(c)}
            >${c.name}</tp-popup-menu-item>
          `)}
          <tp-popup-menu-divider></tp-popup-menu-divider>
          <tp-popup-menu-item
            .icon=${icons['settings']}
            @click=${() => chrome.runtime.openOptionsPage()}
          >Manage Connections</tp-popup-menu-item>
        </tp-popup-menu>
      </tp-popup>
    `;
  }

  _renderMoreMenu() {
    return html`
      <tp-popup alwaysToggle halign="right">
        <tp-icon class="vault-menu-trigger" slot="toggle" .icon=${icons['vertical-dots']}></tp-icon>
        <tp-popup-menu slot="content">
          ${this._mode === 'unlocked' ? html`
            <tp-popup-menu-item
              class="toggle"
              .icon=${icons['lock']}
              @click=${this._doLock}
            >Lock</tp-popup-menu-item>
          ` : ''}
          <tp-popup-menu-item
            class="toggle"
            .icon=${icons['settings']}
            @click=${() => chrome.runtime.openOptionsPage()}
          >Connections</tp-popup-menu-item>
        </tp-popup-menu>
      </tp-popup>
    `;
  }

  static properties = {
    _mode: {},
    _vaultInfo: { type: Object },
    _entries: { type: Array },
    _autofillMatches: { type: Array },
    _hostname: {},
    _lockedVaultId: {},
    _lockedVaultName: {},
    _vaults: { type: Array },
    _connections: { type: Array },
    _activeConnectionId: {},
    _showPassword: { type: Boolean },
    _selectedEntry: { type: Object },
    _revealedKeys: { state: true },
    _searchQuery: { state: true },
  };

  constructor() {
    super();

    this._mode = null;
    this._vaultInfo = {};
    this._entries = [];
    this._autofillMatches = [];
    this._hostname = '';
    this._lockedVaultId = 0;
    this._lockedVaultName = '';
    this._vaults = [];
    this._connections = [];
    this._activeConnectionId = '';
    this._showPassword = false;
    this._selectedEntry = null;
    this._revealedKeys = new Set();
    this._searchQuery = '';
  }

  async connectedCallback() {
    super.connectedCallback();

    const cfg = await send({ type: 'GET_CONFIG' });
    this._connections = cfg.connections || [];
    this._activeConnectionId = cfg.activeConnectionId;

    const conn = (this._connections || []).find(c => c.id === this._activeConnectionId);

    if (!conn || !conn.serverURL || !conn.apiKey) {
      this._mode = 'notConfigured';
      this.requestUpdate();
      return;
    }

    this._lockedVaultId = conn.vaultId || 0;
    this._lockedVaultName = conn.vaultName || '';

    await this._loadVaults();
    await this._preselectVault();

    const state = await send({ type: 'GET_VAULT_STATE' });

    if (!state.isUnlocked) {
      this._mode = 'locked';
      this.requestUpdate();
      return;
    }

    await this._enterUnlocked(state);
  }

  async _loadVaults() {
    const r = await send({ type: 'LIST_VAULTS' });
    this._vaults = r.vaults || [];
  }

  // Make sure `_lockedVaultId` points at a real vault on the server. If the
  // configured vault is missing (server has been wiped, vault was deleted,
  // or nothing was ever picked), fall back to the first available vault and
  // persist the choice via SET_CONFIG so subsequent loads skip this path.
  async _preselectVault() {
    if (this._vaults.length === 0) return;

    const match = this._vaults.find(v => v.id === this._lockedVaultId);

    if (match) return;

    const fallback = this._vaults[0];

    this._lockedVaultId = fallback.id;
    this._lockedVaultName = fallback.name;

    await send({
      type: 'SET_CONFIG',
      config: { vaultId: fallback.id, vaultName: fallback.name },
    });
  }

  _toggleShowPassword() {
    this._showPassword = !this._showPassword;
  }

  async _doUnlock(e) {
    const frm = e.target
    const data = e.detail;
    const btn = frm.submitButton;

    btn.showSpinner();

    try {
      const resp = await send({
        type: 'UNLOCK',
        vaultId: this._lockedVaultId,
        password: data.masterPassword,
      });

      if (resp.error) throw new Error(resp.error);

      frm.reset();
      await this._enterUnlocked(await send({ type: 'GET_VAULT_STATE' }));
    } catch (e) {
      window.TpToaster.add({ type: 'error', content: e.message });
      btn.showError();
      frm.reset();
    }
  }

  async _doLock() {
    await send({ type: 'LOCK' });
    this._mode = 'locked';

    const cfg = await send({ type: 'GET_CONFIG' });
    this._lockedVaultId = cfg.activeVaultId || 0;
    this._lockedVaultName = cfg.activeVaultName || '';
    this.requestUpdate();
  }

  _doSearch() {
    const input = this.renderRoot.querySelector('#searchInput input');

    if (!input) return;

    const q = input.value;
    this._searchQuery = q;

    send({ type: 'SEARCH', query: q }).then(resp => {
      this._entries = resp.results || [];
      this.requestUpdate();
    });
  }

  _clearSearch() {
    const input = this.renderRoot.querySelector('#searchInput input');

    if (!input) return;

    input.value = '';
    this._searchQuery = '';
    this._doSearch();
    input.focus();
  }

  async _enterUnlocked(state) {
    this._mode = 'unlocked';
    this._vaultInfo = state;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
      this._hostname = tab?.url ? new URL(tab.url).hostname : '';
    } catch {
      this._hostname = '';
    }

    if (this._hostname) {
      const r = await send({ type: 'MATCH_HOSTNAME', hostname: this._hostname });
      this._autofillMatches = r.results || [];
    }

    const r = await send({ type: 'SEARCH', query: '' });
    this._entries = r.results || [];

    this.requestUpdate();

    setTimeout(() => {
      const si = this.renderRoot.querySelector('#searchInput input');
      if (si) si.focus();
    }, 100);
  }

  async _switchVault(vault) {
    if (vault.id === this._lockedVaultId) return;

    this._lockedVaultId = vault.id;
    this._lockedVaultName = vault.name;

    await send({
      type: 'SET_CONFIG',
      config: { vaultId: vault.id, vaultName: vault.name },
    });

    await this._doLock();
  }

  async _switchConnection(conn) {
    if (conn.id === this._activeConnectionId) return;

    await send({ type: 'SET_ACTIVE_CONNECTION', id: conn.id });
    this._mode = 'locked';

    const cfg = await send({ type: 'GET_CONFIG' });
    this._connections = cfg.connections || [];
    this._activeConnectionId = cfg.activeConnectionId;
    this._lockedVaultId = cfg.activeVaultId || 0;
    this._lockedVaultName = cfg.activeVaultName || '';
    this._vaults = [];

    this.requestUpdate();
  }

  async _autofillEntry(entry) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) return;

    await chrome.tabs.sendMessage(tab.id, {
      type: 'AUTOFILL_CREDENTIALS',
      username: entry.payload.username || '',
      password: entry.payload.password || '',
    }, { frameId: 0 });

    window.close();
  }

  async _copyField(entry, field) {
    const v = entry.payload?.[field];

    if (!v) return;

    const ok = await copyToClipboard(v);

    window.TpToaster.add({
      content: ok
        ? 'Copied to clipboard'
        : 'Clipboard unavailable',
      type: ok ? 'success' : 'error',
      delay: 3000,
    });
  }
}

customElements.define('the-popup', ThePopup);