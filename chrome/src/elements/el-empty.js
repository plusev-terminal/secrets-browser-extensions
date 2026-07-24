/**
@license
Copyright (c) 2026 trading_peter
This program is available under Apache License Version 2.0
*/

import { LitElement, html, css } from 'lit';

class ElEmpty extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          display: flex;
          flex: 1;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }
        
        :host([absolute]) {
          position: absolute;
          inset: 0;
        }
      `
    ];
  }

  render() {
    return html`
      <slot></slot>
    `;
  }
}

window.customElements.define('el-empty', ElEmpty);