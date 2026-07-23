// el-card — slim card wrapper with slot for content.
// Copied from terminal/frontend/src/elements/el-card.js.

import { LitElement, html, css } from 'lit';

class ElCard extends LitElement {
  static get styles() {
    return css`
      :host {
        display: block;
        background: var(--card-bg);
        border-radius: var(--card-border-radius);
        padding: var(--card-padding, 40px);
        box-shadow: var(--card-box-shadow);
      }

      :host([interactive]) {
        cursor: pointer;
        border: var(--input-border);
        background: var(--surface-hover);
      }

      :host([interactive]:hover) {
        border: var(--input-border-hl);
      }

      :host([warning]) {
        background: color-mix(in srgb, var(--warning-color) 15%, transparent);
        color: var(--warning-color);
      }
    `;
  }

  render() {
    return html`<slot></slot>`;
  }
}

customElements.define('el-card', ElCard);
