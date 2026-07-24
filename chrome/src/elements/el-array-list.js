/**
@license
Copyright (c) 2025 trading_peter
*/

// Simplified array-of-strings input for the browser extension.
// Each row is a text input + remove button, with a trailing "Add" button.
// No drag-reorder. Fires `entries-changed` on blur / add / remove.

import '@tp/tp-input/tp-input.js';
import '@tp/tp-icon/tp-icon.js';
import { LitElement, html, css } from 'lit';
import icons from '../shared/icons.js';
import themeTokens from '../shared/theme-tokens.js';
import { controls } from '../shared/styles.js';

class ElArrayList extends LitElement {
  static get styles() {
    return [
      themeTokens,
      controls,
      css`
        :host {
          display: block;
        }

        .item-line {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          margin-bottom: var(--space-1);
        }

        .item-line tp-input {
          flex: 1;
        }

        tp-icon.remove-btn {
          --tp-icon-width: 18px;
          --tp-icon-height: 18px;
          --tp-icon-color: var(--text-dim);
          cursor: pointer;
          flex-shrink: 0;
        }

        tp-icon.remove-btn:hover {
          --tp-icon-color: var(--error-color);
        }

        .add-btn {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          margin-top: var(--space-2);
          cursor: pointer;
          font-size: var(--font-size-sm);
          color: var(--text-dim);
          user-select: none;
        }

        .add-btn:hover {
          color: var(--text-hl);
        }

        .add-btn tp-icon {
          --tp-icon-width: 18px;
          --tp-icon-height: 18px;
        }
      `,
    ];
  }

  static get properties() {
    return {
      value: { type: Array },
      _items: { state: true },
      placeholder: { type: String },
    };
  }

  constructor() {
    super();
    this._items = [];
    this.placeholder = '';
  }

  set value(val) {
    if (Array.isArray(val)) {
      this._items = [...val];
    } else if (typeof val === 'string' && val) {
      this._items = [val];
    } else {
      this._items = [];
    }
  }

  get value() {
    return this._readFromDOM();
  }

  _readFromDOM() {
    if (!this.shadowRoot) return this._items;

    const inputs = this.shadowRoot.querySelectorAll('tp-input');
    const out = [];

    inputs.forEach(el => {
      if (el.value) out.push(el.value);
    });

    return out;
  }

  _syncFromDOM() {
    this._items = this._readFromDOM();
  }

  async _addItem() {
    this._syncFromDOM();

    const inputs = this.shadowRoot.querySelectorAll('tp-input');
    const emptyInput = Array.from(inputs).find(el => !el.value);

    if (emptyInput) {
      emptyInput.focus();
      return;
    }

    this._items = [...this._items, ''];
    await this.updateComplete;

    const last = this.shadowRoot.querySelectorAll('tp-input');
    if (last.length > 0) last[last.length - 1].focus();
  }

  async _removeItem(index) {
    this._syncFromDOM();
    this._items = this._items.filter((_, i) => i !== index);
    await this.updateComplete;
    this._fireChanged();
  }

  _onBlur() {
    this._syncFromDOM();
    this._fireChanged();
  }

  _fireChanged() {
    this.dispatchEvent(new CustomEvent('entries-changed', {
      detail: this._items,
      bubbles: true,
      composed: true,
    }));
  }

  _renderItem(v, i, canRemove) {
    return html`
      <div class="item-line">
        <tp-input .value=${v}>
          <input
            type="text"
            placeholder=${this.placeholder}
            @blur=${() => this._onBlur()}
          />
        </tp-input>
        ${canRemove
          ? html`<tp-icon class="remove-btn" .icon=${icons['close']} tooltip="Remove" @click=${() => this._removeItem(i)}></tp-icon>`
          : null}
      </div>
    `;
  }

  render() {
    const items = this._items.length > 0 ? this._items : [''];
    const canRemove = items.length > 1;

    return html`
      ${items.map((v, i) => this._renderItem(v, i, canRemove))}
      <div class="add-btn" @click=${() => this._addItem()}>
        <tp-icon .icon=${icons['plus']}></tp-icon>
        <span>Add</span>
      </div>
    `;
  }
}

window.customElements.define('el-array-list', ElArrayList);
