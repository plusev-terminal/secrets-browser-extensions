// el-badge — themed status pill. Copied from terminal/frontend/src/elements/el-badge.js.

import '@tp/tp-tooltip/tp-tooltip-mixin.js';
import { Tooltip } from '@tp/tp-tooltip/tp-tooltip-mixin.js';
import { LitElement, html, css } from 'lit';

class ElBadge extends Tooltip(LitElement) {
  static get styles() {
    return css`
      :host {
        display: inline-block;
        padding: var(--badge-padding, 2px 8px);
        border-radius: 4px;
        font-size: var(--font-size-xs);
        font-weight: bold;
        text-transform: uppercase;
      }

      :host([preset="on"]) {
        background: color-mix(in srgb, var(--success-color) 15%, transparent);
        color: var(--success-color);
      }

      :host([preset="off"]) {
        background: color-mix(in srgb, var(--error-color) 15%, transparent);
        color: var(--error-color);
      }

      :host([preset="neutral"]) {
        background: var(--surface-hover);
        color: var(--text);
      }

      :host([preset="dim"]) {
        background: var(--text-dim);
        color: var(--text-inverse);
      }

      :host([preset="warn"]) {
        background: color-mix(in srgb, var(--warning-color) 15%, transparent);
        color: var(--warning-color);
      }

      :host([preset="info"]) {
        background: color-mix(in srgb, var(--info-color) 12%, transparent);
        color: var(--info-color);
      }

      ::slotted(el-badge) { margin-left: 5px; }
      ::slotted(tp-icon) { --tp-icon-color: currentColor; }
    `;
  }

  static get properties() {
    return { preset: { type: String, reflect: true } };
  }

  render() { return html`<slot></slot>`; }
}

customElements.define('el-badge', ElBadge);
