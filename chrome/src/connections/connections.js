// PlusEV Secrets Connections — manage Terminal server connections.

import '@tp/tp-button/tp-button.js';
import '@tp/tp-input/tp-input.js';
import '@tp/tp-form/tp-form.js';
import '@tp/tp-dialog/tp-dialog.js';
import '@tp/tp-icon/tp-icon.js';
import '@tp/tp-popup/tp-popup.js';
import '@tp/tp-popup/tp-popup-menu.js';
import '@tp/tp-popup/tp-popup-menu-item.js';
import '@tp/tp-popup/tp-popup-menu-divider.js';
import '@tp/tp-toaster/tp-toaster.js';
import '../elements/el-badge.js';
import '../elements/el-empty.js';
import { LitElement, html, css } from 'lit';
import icons from '../shared/icons.js';
import themeTokens from '../shared/theme-tokens.js';
import { controls, shared } from '../shared/styles.js';
import { DomQuery } from '@tp/helpers/dom-query.js';

function send(msg) { return chrome.runtime.sendMessage(msg); }

export class TheConnections extends DomQuery(LitElement) {
  static get styles() {
    return [
      themeTokens,
      controls,
      shared,
      css`
        :host {
          display: block;
          max-width: 600px;
          margin: var(--space-6) auto;
          padding: var(--space-5);
          font-family: var(--font0);
          font-size: var(--font-size-md);
          background: var(--page-bg);
          color: var(--text);
        }

        h1 {
          font-size: var(--font-size-xl);
          font-weight: 600;
          margin-bottom: var(--space-2);
        }

        .conn-list {
          margin: var(--space-5) 0;
          overflow: hidden;
        }

        .conn-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-5);
          border: solid 1px var(--border-strong);
          background: var(--surface);
          border-radius: var(--default-border-radius);
          cursor: pointer;
        }

        .conn-item + .conn-item {
          margin-top: var(--space-3);
        }

        .conn-item:hover { background: var(--surface-hover); }
        .conn-item.active { background: var(--surface-active); }

        .conn-info {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex: 1;
        }

        .conn-name { font-weight: 500; }
        .conn-url { font-size: var(--font-size-xs); color: var(--text-dim); }
        .conn-actions { display: flex; gap: var(--space-2); align-items: center; }

        .conn-icon {
          --tp-icon-width: 22px;
          --tp-icon-height: 22px;
        }

        .conn-menu-toggle {
          cursor: pointer;
        }
    `];
  }

  static properties = {
    _connections: { type: Array },
    _activeConnectionId: {},
    _editingConn: { type: Object },
    _deletingConn: { type: Object },
  };

  constructor() {
    super();

    this._connections = [];
    this._activeConnectionId = '';
    this._editingConn = null;
    this._deletingConn = null;
  }

  async connectedCallback() {
    super.connectedCallback();
    await this._reload();
  }

  async _reload() {
    const cfg = await send({ type: 'GET_CONFIG' });
    this._connections = cfg.connections || [];
    this._activeConnectionId = cfg.activeConnectionId;
    this.requestUpdate();
  }

  render() {
    return html`
      <h1>Connections</h1>
      <p class="hint">Manage your Terminal server connections. Each connections requires a API key with <i>secrets.read</i> and <i>secrets.write</i> permissions.</p>

      <div class="conn-list">
        ${this._connections.length === 0
          ? html`
            <el-empty absolute>
              <div>No connections yet.</div>
              <div class="button-centered">
                <tp-button @click=${() => this._openAdd()}>Add Connection</tp-button>
              </div>
            </el-empty>
          ` : this._connections.map(c => html`
            <div class="conn-item ${c.id === this._activeConnectionId ? 'active' : ''}"  @click=${e => this._selectConnection(e, c.id)}>
              <div class="conn-info">
                <tp-icon class="conn-icon static" .icon=${icons['server-network-on']}></tp-icon>
                <div>
                  <div class="conn-name">${c.name}</div>
                  <div class="conn-url">${c.serverURL}</div>
                </div>
              </div>
              <div class="conn-actions">
                ${c.id === this._activeConnectionId ? html`<el-badge preset="on">Active</el-badge>` : ''}
                <tp-popup alwaysToggle halign="right">
                  <tp-icon slot="toggle" class="conn-menu-toggle" .icon=${icons['vertical-dots']}></tp-icon>
                  <tp-popup-menu slot="content">
                    <tp-popup-menu-item @click=${() => this._openEdit(c)}>Edit</tp-popup-menu-item>
                    <tp-popup-menu-item @click=${() => this._openDelete(c)}>Delete</tp-popup-menu-item>
                  </tp-popup-menu>
                </tp-popup>
              </div>
            </div>

            `)
        }

        <div class="button-centered">
          <tp-button @click=${() => this._openAdd()}>Add Connection</tp-button>
        </div>
      </div>

      ${this._renderEditDialog()}
      ${this._renderDeleteDialog()}
      <tp-toaster></tp-toaster>
    `;
  }

  _openAdd() {
    this._editingConn = { id: '', name: '', serverURL: '', apiKey: '', apiSecret: '', isNew: true };
    this.$.editDialog.show();
  }

  _openEdit(conn) {
    this._editingConn = { ...conn, isNew: false };
    this.$.editDialog.show();
  }

  _dialog(id) { return this.shadowRoot.querySelector(`#${id}`); }

  _renderEditDialog() {
    const c = this._editingConn || {};

    return html`
      <tp-dialog id="editDialog" showClose modal closeOnEsc closeOnOutsideClick
        @closed=${() => { this._editingConn = null; this.requestUpdate(); }}>
        <h2>${c.isNew ? 'Add Connection' : 'Edit Connection'}</h2>

        <tp-form @submit=${(e) => this._saveFromForm(e)}>
          <form>
            <label>Connection Name</label>
            <tp-input name="name" .value=${c.name} required errorMessage="Name is required">
              <input type="text" @input=${e => { c.name = e.target.value; }}>
            </tp-input>

            <label>Terminal Server URL</label>
            <tp-input name="serverURL" .value=${c.serverURL} required errorMessage="URL is required">
              <input type="url" placeholder="http://localhost:8080"
                @input=${e => { c.serverURL = e.target.value; }}>
            </tp-input>

            <label>API Key</label>
            <tp-input name="apiKey" .value=${c.apiKey} required errorMessage="API key is required">
              <input type="text" placeholder="abc123..."
                @input=${e => { c.apiKey = e.target.value; }}>
            </tp-input>

            <label>API Secret</label>
            <tp-input name="apiSecret" .value=${c.apiSecret} required errorMessage="API secret is required">
              <input type="password" placeholder="xyz..."
                @input=${e => { c.apiSecret = e.target.value; }}>
            </tp-input>

            <div class="buttons-justified">
              <tp-button @click=${() => { this._editingConn = null; this._dialog('editDialog')?.close(); }}>Cancel</tp-button>
              <tp-button @click=${e => this._testFromForm(e)} extended>Test</tp-button>
              <tp-button submit>Save</tp-button>
            </div>
          </form>
        </tp-form>
      </tp-dialog>
    `;
  }

  async _testFromForm(e) {
    const btn = e.target;
    const c = this._editingConn;

    if (!c.name || !c.serverURL || !c.apiKey || !c.apiSecret) {
      window.TpToaster.add({ type: 'warn', content: 'Please fill in all fields.' });
      return;
    }

    btn.showSpinner();
    this.requestUpdate();

    // For new connections: persist first so the ID is stable for the live
    // config write that follows. For existing: just write through SET_CONFIG.
    if (c.isNew && !c.id) {
      const r = await send({
        type: 'ADD_CONNECTION',
        name: c.name,
        serverURL: c.serverURL,
        apiKey: c.apiKey,
        apiSecret: c.apiSecret,
      });

      if (r.error) {
        window.TpToaster.add({ type: 'error', content: r.error });
        btn.showError();
        return;
      }

      c.id = r.connection.id;
      c.isNew = false;
      await send({ type: 'SET_ACTIVE_CONNECTION', id: c.id });
    } else if (!c.isNew) {
      await send({
        type: 'SET_CONFIG',
        config: { serverURL: c.serverURL, apiKey: c.apiKey, apiSecret: c.apiSecret },
      });
    }

    try {
      const r = await send({ type: 'LIST_VAULTS' });

      if (r.error) throw new Error(r.error);

      window.TpToaster.add({
        type: 'success',
        content: `Connected — found ${r.vaults.length} vault(s).`,
        delay: 4000,
      });
      btn.showSuccess();
    } catch (e) {
      window.TpToaster.add({ type: 'error', content: `Connection failed: ${e.message}` });
      btn.showError();
    }
  }

  async _saveFromForm(e) {
    const { name, serverURL, apiKey, apiSecret } = e.detail;
    const c = this._editingConn;

    if (c.id) {
      // Already persisted (by test or was existing) — update.
      await send({
        type: 'SET_CONFIG',
        config: { name, serverURL, apiKey, apiSecret },
      });
    } else {
      const r = await send({ type: 'ADD_CONNECTION', name, serverURL, apiKey, apiSecret });

      if (r.error) {
        window.TpToaster.add({ type: 'error', content: r.error });
        return;
      }

      await send({ type: 'SET_ACTIVE_CONNECTION', id: r.connection.id });
    }

    this._dialog('editDialog')?.close();
    this._editingConn = null;
    await this._reload();
    window.TpToaster.add({ type: 'success', content: 'Connection saved.' });
  }

  _openDelete(conn) {
    this._deletingConn = conn;
    this.requestUpdate();
    this.updateComplete.then(() => this._dialog('deleteDialog')?.show());
  }

  _renderDeleteDialog() {
    if (!this._deletingConn) return html``;

    return html`
      <tp-dialog id="deleteDialog" showClose modal closeOnEsc closeOnOutsideClick
        @closed=${() => { this._deletingConn = null; this.requestUpdate(); }}>
        <h2>Delete Connection</h2>
        <p>Are you sure you want to delete "${this._deletingConn.name}"?</p>
        <p>This removes the connection configuration only. Your vault data on the server is not affected.</p>
        <div class="buttons-justified">
          <tp-button @click=${() => { this._deletingConn = null; this._dialog('deleteDialog')?.close(); }}>Cancel</tp-button>
          <tp-button class="danger" @click=${() => this._confirmDelete()}>Delete</tp-button>
        </div>
      </tp-dialog>
    `;
  }

  async _confirmDelete() {
    if (!this._deletingConn) return;

    await send({ type: 'REMOVE_CONNECTION', id: this._deletingConn.id });
    this._deletingConn = null;
    this._dialog('deleteDialog')?.close();
    await this._reload();
    window.TpToaster.add({ type: 'success', content: 'Connection deleted.' });
  }

  async _selectConnection(e, id) {
    if (id === this._activeConnectionId || e.composedPath().some(n => n.tagName === 'TP-POPUP')) return;

    await send({ type: 'SET_ACTIVE_CONNECTION', id });
    await this._reload();
    window.TpToaster.add({ type: 'success', content: 'Active connection switched.' });
  }
}

customElements.define('the-connections', TheConnections);