/**
@license
Copyright (c) 2025 trading_peter
*/

// Type-aware entry editor for the browser extension.
// Faithful port of terminal/frontend/src/apps/secrets/elements/v-entry-editor.js,
// adapted for the extension context:
//   - Inline full-page view (no tp-dialog) — takes over the popup area
//   - Uses chrome.runtime.sendMessage instead of secretsStore directly
//   - Fires 'entry-saved' CustomEvent so the popup can update its state
//   - No folder dropdown (folders are Phase 3)
//   - Simplified custom fields (no drag-reorder, no tp-sortable dependency)

import '@tp/tp-button/tp-button.js';
import '@tp/tp-dropdown/tp-dropdown.js';
import '@tp/tp-form/tp-form.js';
import '@tp/tp-icon/tp-icon.js';
import '@tp/tp-input/tp-input.js';
import '@tp/tp-textarea/tp-textarea.js';
import './el-array-list.js';
import './el-path-selector.js';
import { LitElement, html, css } from 'lit';
import { DomQuery } from '@tp/helpers/dom-query.js';
import icons from '../shared/icons.js';
import themeTokens from '../shared/theme-tokens.js';
import { controls, shared } from '../shared/styles.js';
import { ENTRY_TYPES, typeMeta, defaultPayload, EXCHANGE_PRESETS, SCOPE_PRESETS } from '../shared/entryTypes.js';

function send(msg) { return chrome.runtime.sendMessage(msg); }

class ElEntryEditor extends DomQuery(LitElement) {
  static get styles() {
    return [
      themeTokens,
      controls,
      shared,
      css`
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        :host(:not([open])) {
          display: none;
        }

        .editor-header {
          display: flex;
          align-items: center;
          padding: var(--space-3) var(--space-4);
          border-bottom: solid 1px var(--border-strong);
          flex-shrink: 0;
          gap: var(--space-2);
        }

        .editor-back {
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

        .editor-back:hover { --tp-icon-color: var(--text-hl); }

        .editor-title {
          flex: 1;
          min-width: 0;
          font-size: var(--font-size-md);
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .editor-body {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }

        .type-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }

        .type-card {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          padding: var(--space-3);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          cursor: pointer;
          background: var(--surface-deep);
        }

        .type-card:hover {
          background: var(--surface-hover);
          border-color: var(--border-strong);
        }

        .type-card.selected {
          background: var(--surface-active);
          border-color: var(--border-strong);
        }

        .type-card tp-icon {
          width: 20px;
          height: 20px;
          color: var(--text-dim);
        }

        .type-card .label {
          font-size: var(--font-size-sm);
          color: var(--text);
          font-weight: 500;
        }

        .type-card .desc {
          font-size: var(--font-size-xs);
          color: var(--text-dim);
          line-height: 1.3;
        }

        .scopes {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .scope-badge {
          font-size: var(--font-size-xs);
          padding: 3px var(--space-2);
          border-radius: var(--radius-sm);
          background: var(--palette-surface-active);
          color: var(--text-dim);
          cursor: pointer;
          text-transform: capitalize;
          user-select: none;
        }

        .scope-badge.active {
          background: var(--palette-accent);
          color: var(--palette-text);
        }

        .scope-badge.danger-active {
          background: var(--error-color);
          color: var(--palette-text);
        }

        .cf-rows {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .cf-row {
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .cf-row tp-input {
          flex: 1;
          min-width: 0;
        }

        .cf-row .cf-type {
          flex: 0 0 90px;
        }

        .cf-row .cf-remove {
          cursor: pointer;
          --tp-icon-width: 18px;
          --tp-icon-height: 18px;
          --tp-icon-color: var(--text-dim);
          flex-shrink: 0;
        }

        .cf-row .cf-remove:hover {
          --tp-icon-color: var(--error-color);
        }

        .cf-add {
          margin-top: var(--space-2);
          cursor: pointer;
          font-size: var(--font-size-sm);
          color: var(--text-dim);
        }

        .cf-add:hover {
          color: var(--text-hl);
        }

        .save-btn {
          margin-top: var(--space-4);
          width: 100%;
        }
      `,
    ];
  }

  static get properties() {
    return {
      _open: { state: true },
      _editing: { state: true },
      _selectedType: { state: true },
      _payload: { state: true },
      _tagsInput: { state: true },
      _folders: { state: true },
    };
  }

  constructor() {
    super();

    this._open = false;
    this._editing = null;
    this._selectedType = 'login';
    this._payload = defaultPayload('login');
    this._tagsInput = '';
    this._folders = [];
  }

  // Open with entry = null for create, entry object for edit.
  open(entry) {
    if (entry) {
      this._editing = entry;
      this._selectedType = entry.type;
      this._payload = JSON.parse(JSON.stringify(entry.payload || {}));
      this._tagsInput = (entry.payload?.tags || []).join(', ');
    } else {
      this._editing = null;
      this._selectedType = 'login';
      this._payload = defaultPayload('login');
      this._tagsInput = '';
    }

    this._open = true;
    this.setAttribute('open', '');
    this._loadFolders();
    this.requestUpdate();
  }

  async _loadFolders() {
    try {
      const resp = await send({ type: 'LIST_FOLDERS' });
      this._folders = resp.folders || [];
    } catch {
      this._folders = [];
    }
  }

  _cancel() {
    this._open = false;
    this.removeAttribute('open');
    this._editing = null;
    this._payload = null;
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('entry-cancel', { bubbles: true, composed: true }));
  }

  _selectType(typeId) {
    if (this._editing) return;

    this._selectedType = typeId;
    this._payload = defaultPayload(typeId);
  }

  _setField(key, value) {
    this._payload = { ...this._payload, [key]: value };
  }

  _toggleScope(scope) {
    const scopes = new Set(this._payload.scopes || []);

    if (scopes.has(scope)) {
      scopes.delete(scope);
    } else {
      scopes.add(scope);
    }

    this._payload = { ...this._payload, scopes: Array.from(scopes) };
  }

  _addCustomField() {
    const fields = [...(this._payload.customFields || []), { name: '', value: '', type: 'text' }];
    this._payload = { ...this._payload, customFields: fields };
  }

  _removeCustomField(index) {
    const fields = [...(this._payload.customFields || [])];
    fields.splice(index, 1);
    this._payload = { ...this._payload, customFields: fields };
  }

  _setCustomField(index, key, value) {
    const fields = [...(this._payload.customFields || [])];
    fields[index] = { ...fields[index], [key]: value };
    this._payload = { ...this._payload, customFields: fields };
  }

  async _save(e) {
    const btn = e.target.submitButton;
    btn?.showSpinner();

    const tags = this._tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const customFields = (this._payload.customFields || [])
      .filter(f => f.name && f.name.trim())
      .map(f => ({
        name: f.name.trim(),
        value: f.value || '',
        type: f.type === 'text' ? 'text' : 'secret',
      }));

    const payload = { ...this._payload, tags, customFields };

    try {
      let result;
      const wasEditing = !!this._editing;

      if (this._editing) {
        const resp = await send({
          type: 'UPDATE_ENTRY',
          id: this._editing.id,
          entryType: this._selectedType,
          payload,
        });

        if (resp.error) throw new Error(resp.error);

        result = resp.entry;
        window.TpToaster.add({ content: 'Entry updated.', type: 'success' });
      } else {
        const resp = await send({
          type: 'CREATE_ENTRY',
          entryType: this._selectedType,
          payload,
        });

        if (resp.error) throw new Error(resp.error);

        result = resp.entry;
        window.TpToaster.add({ content: 'Entry created.', type: 'success' });
      }

      this._open = false;
      this.removeAttribute('open');

      this.dispatchEvent(new CustomEvent('entry-saved', {
        detail: { entry: result, editing: wasEditing },
        bubbles: true,
        composed: true,
      }));

      this._editing = null;
      this._payload = null;
    } catch (err) {
      window.TpToaster.add({ content: err.message || 'Save failed.', type: 'error', delay: 5000 });
      btn?.showError();
    } finally {
      btn?.hideSpinner();
    }
  }

  render() {
    if (!this._open) return null;

    return html`
      <div class="editor-header">
        <tp-icon
          class="editor-back"
          .icon=${icons['arrow-left']}
          tooltip="Cancel"
          @click=${() => this._cancel()}
        ></tp-icon>
        <span class="editor-title">${this._editing ? 'Edit Entry' : 'New Entry'}</span>
      </div>

      <div class="editor-body scrollbar">
        ${!this._editing ? this._renderTypeSelector() : ''}

        <tp-form @submit=${this._save}>
          <form class="form-grid">
            <div class="field span2">
              <label>Title</label>
              <tp-input
                name="title"
                .value=${this._payload.title || ''}
                @input=${e => this._setField('title', e.target.value)}
                required
              >
                <input type="text" />
              </tp-input>
            </div>

            ${this._renderTypeFields()}

            <div class="field span2">
              <label>Custom fields</label>
              ${this._renderCustomFields()}
            </div>

            <div class="field span2">
              <label>Folder</label>
              <el-path-selector
                .folders=${this._folders}
                .value=${this._payload.folderId}
                @folder-picked=${e => this._setField('folderId', e.detail.folderId)}
              ></el-path-selector>
            </div>

            <div class="field span2">
              <label>Tags (comma-separated)</label>
              <tp-input
                .value=${this._tagsInput}
                @input=${e => this._tagsInput = e.target.value}
              >
                <input type="text" placeholder="work, banking, client" />
              </tp-input>
            </div>

            <div class="field span2">
              <label>Notes</label>
              <tp-textarea
                .value=${this._payload.notes || ''}
                @input=${e => this._setField('notes', e.target.value)}
              >
                <textarea rows="3"></textarea>
              </tp-textarea>
            </div>

            <div class="buttons-justified span2">
              <tp-button @click=${() => this._cancel()}>Cancel</tp-button>
              <tp-button submit primary extended>${this._editing ? 'Update' : 'Create'}</tp-button>
            </div>
          </form>
        </tp-form>
      </div>
    `;
  }

  _renderTypeSelector() {
    return html`
      <div class="type-grid">
        ${ENTRY_TYPES.map(t => {
          const iconName = t.icon || 'file';

          return html`
            <div
              class="type-card ${this._selectedType === t.id ? 'selected' : ''}"
              @click=${() => this._selectType(t.id)}
            >
              <tp-icon .icon=${icons[iconName]}></tp-icon>
              <div class="label">${t.label}</div>
              <div class="desc">${t.description}</div>
            </div>
          `;
        })}
      </div>
    `;
  }

  _renderCustomFields() {
    const fields = this._payload.customFields || [];

    return html`
      <div class="cf-rows">
        ${fields.map((f, i) => html`
          <div class="cf-row">
            <tp-input
              .value=${f.name || ''}
              @input=${e => this._setCustomField(i, 'name', e.target.value)}
              placeholder="Name"
            >
              <input type="text" />
            </tp-input>
            <tp-input
              .value=${f.value || ''}
              @input=${e => this._setCustomField(i, 'value', e.target.value)}
              placeholder="Value"
            >
              <input type="text" />
            </tp-input>
            <tp-dropdown
              class="cf-type"
              .items=${[{ value: 'text', label: 'Text' }, { value: 'hidden', label: 'Hidden' }]}
              .value=${f.type || 'text'}
              @selection-changed=${e => this._setCustomField(i, 'type', e.detail)}
            ></tp-dropdown>
            <tp-icon
              class="cf-remove"
              .icon=${icons['close']}
              tooltip="Remove field"
              @click=${() => this._removeCustomField(i)}
            ></tp-icon>
          </div>
        `)}
      </div>
      <div class="cf-add" @click=${() => this._addCustomField()}>+ Add field</div>
    `;
  }

  _renderTypeFields() {
    switch (this._selectedType) {
      case 'login':       return this._renderLoginFields();
      case 'mnemonic':    return this._renderMnemonicFields();
      case 'apiKey':      return this._renderApiKeyFields();
      case 'privateKey':  return this._renderPrivateKeyFields();
      case 'contract':    return this._renderContractFields();
      case 'backupCodes': return this._renderBackupCodesFields();
      default:            return null;
    }
  }

  _renderLoginFields() {
    return html`
      <div class="field">
        <label>Username</label>
        <tp-input
          .value=${this._payload.username || ''}
          @input=${e => this._setField('username', e.target.value)}
        >
          <input type="text" autocomplete="username" />
        </tp-input>
      </div>

      <div class="field">
        <label>Password</label>
        <tp-input
          .value=${this._payload.password || ''}
          @input=${e => this._setField('password', e.target.value)}
        >
          <input type="text" autocomplete="new-password" spellcheck="false" />
        </tp-input>
      </div>

      <div class="field span2">
        <label>URLs</label>
        <el-array-list
          .value=${this._payload.urls || []}
          placeholder="https://example.com/login"
          @entries-changed=${e => this._setField('urls', e.detail)}
        ></el-array-list>
      </div>

      <div class="field span2">
        <label>TOTP secret (optional)</label>
        <tp-input
          .value=${this._payload.totpSecret || ''}
          @input=${e => this._setField('totpSecret', e.target.value)}
        >
          <input type="text" spellcheck="false" />
        </tp-input>
      </div>
    `;
  }

  _renderMnemonicFields() {
    return html`
      <div class="field">
        <label>Word count</label>
        <tp-dropdown
          .items=${[12, 15, 18, 21, 24].map(n => ({ value: String(n), label: `${n} words` }))}
          .value=${String(this._payload.wordCount || 12)}
          @selection-changed=${e => this._setField('wordCount', parseInt(e.detail, 10))}
        ></tp-dropdown>
      </div>

      <div class="field span2">
        <label>Seed phrase</label>
        <tp-textarea
          .value=${this._payload.phrase || ''}
          @input=${e => this._setField('phrase', e.target.value)}
        >
          <textarea rows="3" spellcheck="false" placeholder="word1 word2 word3 ..."></textarea>
        </tp-textarea>
      </div>

      <div class="field span2">
        <label>BIP39 passphrase (optional — the "25th word")</label>
        <tp-input
          .value=${this._payload.passphrase || ''}
          @input=${e => this._setField('passphrase', e.target.value)}
        >
          <input type="text" autocomplete="off" spellcheck="false" />
        </tp-input>
      </div>
    `;
  }

  _renderApiKeyFields() {
    const selectedScopes = new Set(this._payload.scopes || []);

    return html`
      <div class="field">
        <label>Exchange</label>
        <tp-dropdown
          .items=${EXCHANGE_PRESETS}
          .value=${this._payload.exchange || ''}
          .extensible=${true}
          @selection-changed=${e => this._setField('exchange', e.detail)}
        ></tp-dropdown>
      </div>

      <div class="field span2">
        <label>API key</label>
        <tp-input
          .value=${this._payload.key || ''}
          @input=${e => this._setField('key', e.target.value)}
        >
          <input type="text" autocomplete="off" spellcheck="false" />
        </tp-input>
      </div>

      <div class="field span2">
        <label>API secret</label>
        <tp-input
          .value=${this._payload.secret || ''}
          @input=${e => this._setField('secret', e.target.value)}
        >
          <input type="text" autocomplete="off" spellcheck="false" />
        </tp-input>
      </div>

      <div class="field span2">
        <label>Scopes (user-declared — no exchange calls)</label>
        <div class="scopes">
          ${SCOPE_PRESETS.map(scope => html`
            <span
              class="scope-badge ${selectedScopes.has(scope) ? (scope === 'withdraw' ? 'danger-active' : 'active') : ''}"
              @click=${() => this._toggleScope(scope)}
            >${scope}</span>
          `)}
        </div>
      </div>
    `;
  }

  _renderPrivateKeyFields() {
    return html`
      <div class="field">
        <label>Type</label>
        <tp-dropdown
          .items=${[
            { value: 'privateKey', label: 'Raw private key' },
            { value: 'keystore', label: 'Keystore JSON' },
          ]}
          .value=${this._payload.subtype || 'privateKey'}
          @selection-changed=${e => this._setField('subtype', e.detail)}
        ></tp-dropdown>
      </div>

      <div class="field">
        <label>Chain</label>
        <tp-dropdown
          .items=${['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'bsc']}
          .value=${this._payload.chain || 'ethereum'}
          .extensible=${true}
          @selection-changed=${e => this._setField('chain', e.detail)}
        ></tp-dropdown>
      </div>

      <div class="field span2">
        <label>Address (cached, public)</label>
        <tp-input
          .value=${this._payload.address || ''}
          @input=${e => this._setField('address', e.target.value)}
        >
          <input type="text" spellcheck="false" />
        </tp-input>
      </div>

      <div class="field span2">
        <label>Derivation path (if HD)</label>
        <tp-input
          .value=${this._payload.derivationPath || ''}
          @input=${e => this._setField('derivationPath', e.target.value)}
        >
          <input type="text" spellcheck="false" placeholder="m/44'/60'/0'/0/0" />
        </tp-input>
      </div>

      ${this._payload.subtype === 'keystore' ? html`
        <div class="field span2">
          <label>Keystore JSON</label>
          <tp-textarea
            .value=${this._payload.keystore || ''}
            @input=${e => this._setField('keystore', e.target.value)}
          >
            <textarea rows="6" spellcheck="false"></textarea>
          </tp-textarea>
        </div>
      ` : html`
        <div class="field span2">
          <label>Private key (hex)</label>
          <tp-input
            .value=${this._payload.privateKey || ''}
            @input=${e => this._setField('privateKey', e.target.value)}
          >
            <input type="text" spellcheck="false" />
          </tp-input>
        </div>
      `}
    `;
  }

  _renderContractFields() {
    return html`
      <div class="field">
        <label>Chain</label>
        <tp-dropdown
          .items=${['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'bsc', 'solana']}
          .value=${this._payload.chain || 'ethereum'}
          .extensible=${true}
          @selection-changed=${e => this._setField('chain', e.detail)}
        ></tp-dropdown>
      </div>

      <div class="field span2">
        <label>Address</label>
        <tp-input
          .value=${this._payload.address || ''}
          @input=${e => this._setField('address', e.target.value)}
          required
        >
          <input type="text" spellcheck="false" />
        </tp-input>
      </div>

      <div class="field span2">
        <label>ABI (optional, encrypted)</label>
        <tp-textarea
          .value=${this._payload.abi || ''}
          @input=${e => this._setField('abi', e.target.value)}
        >
          <textarea rows="6" spellcheck="false"></textarea>
        </tp-textarea>
      </div>
    `;
  }

  _renderBackupCodesFields() {
    return html`
      <div class="field span2">
        <label>Service</label>
        <tp-input
          .value=${this._payload.service || ''}
          @input=${e => this._setField('service', e.target.value)}
        >
          <input type="text" />
        </tp-input>
      </div>

      <div class="field span2">
        <label>Codes (one per line)</label>
        <tp-textarea
          .value=${(this._payload.codes || []).join('\n')}
          @input=${e => this._setField('codes', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
        >
          <textarea rows="6" spellcheck="false"></textarea>
        </tp-textarea>
      </div>
    `;
  }
}

window.customElements.define('el-entry-editor', ElEntryEditor);
