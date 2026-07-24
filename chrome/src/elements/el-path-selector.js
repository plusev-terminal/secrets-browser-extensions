/**
@license
Copyright (c) 2025 trading_peter
*/

// Folder path selector for the browser extension.
// Uses a tp-dialog containing el-folder-tree — mirrors the terminal's
// v-path-selector. Fires `folder-picked` with the selected folderId.

import '@tp/tp-button/tp-button.js';
import '@tp/tp-dialog/tp-dialog.js';
import '@tp/tp-icon/tp-icon.js';
import { LitElement, html, css } from 'lit';
import { DomQuery } from '@tp/helpers/dom-query.js';
import icons from '../shared/icons.js';
import themeTokens from '../shared/theme-tokens.js';
import { controls, shared } from '../shared/styles.js';
import './el-folder-tree.js';

class ElPathSelector extends DomQuery(LitElement) {
  static get styles() {
    return [
      themeTokens,
      controls,
      shared,
      css`
        .trigger {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: 5px;
          background: var(--input-bg);
          border-radius: var(--input-border-radius);
          border: var(--input-border);
          box-shadow: var(--input-box-shadow);
          cursor: pointer;
          font-size: var(--font-size-md);
          color: var(--text);
          min-height: 30px;
        }

        .trigger tp-icon {
          --tp-icon-width: 18px;
          --tp-icon-height: 18px;
          --tp-icon-color: var(--text-dim);
        }

        .trigger-label {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .trigger-label.dim {
          color: var(--text-dim);
        }

        #pathDialog::part(dialog) {
          width: 500px;
          max-width: calc(100vw - 32px);
        }

        #pathDialog::part(scroll-wrapper) {
          max-height: 75vh;
        }

        .picker-body {
          max-height: 500px;
          overflow-y: auto;
        }

        el-folder-tree {
          margin-top: 0;
        }
      `,
    ];
  }

  static get properties() {
    return {
      folders: { type: Array },
      value: { type: Object },
      _selectedFolderId: { state: true },
      _label: { state: true },
    };
  }

  constructor() {
    super();
    this.folders = [];
    this._selectedFolderId = null;
    this._label = 'All Entries';
  }

  set value(val) {
    this._selectedFolderId = val ?? null;
    this._updateLabel();
  }

  get value() {
    return this._selectedFolderId;
  }

  updated(changedProps) {
    if (changedProps.has('folders')) {
      this._updateLabel();
    }
  }

  _updateLabel() {
    if (this._selectedFolderId == null) {
      this._label = 'All Entries';
      return;
    }

    const folder = this.folders.find(f => f.id === this._selectedFolderId);
    this._label = folder?.payload?.name || 'Unknown folder';
  }

  _openDialog() {
    this.$.pathDialog.show();
  }

  _onFolderSelected(e) {
    this._selectedFolderId = e.detail.folderId;
  }

  _confirm() {
    this._updateLabel();
    this.$.pathDialog.close();
    this.dispatchEvent(new CustomEvent('folder-picked', {
      detail: { folderId: this._selectedFolderId },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <div class="trigger" @click=${() => this._openDialog()}>
        <tp-icon .icon=${icons['folder']}></tp-icon>
        <span class="trigger-label ${this._selectedFolderId == null ? 'dim' : ''}">${this._label}</span>
      </div>
      <tp-dialog id="pathDialog" showClose modal closeOnEsc>
        <h3>Select folder</h3>
        <div class="picker-body scrollbar">
          <el-folder-tree
            .folders=${this.folders}
            selectedFolderKey=${this._selectedFolderId != null ? String(this._selectedFolderId) : '__all__'}
            @folder-selected=${(e) => this._onFolderSelected(e)}
          ></el-folder-tree>
        </div>
        <div class="buttons-justified">
          <tp-button dialog-dismiss>Cancel</tp-button>
          <tp-button @click=${() => this._confirm()}>Select</tp-button>
        </div>
      </tp-dialog>
    `;
  }
}

window.customElements.define('el-path-selector', ElPathSelector);
