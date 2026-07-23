// Extracted from terminal/frontend/src/styles/controls.js and sharedStyles.js.
// Only the rules relevant to the browser extension (popup + options).
// Imported by the-options and the-popup Lit components.

import { css } from 'lit';

export const controls = css`
  tp-button {
    line-height: 25px;
    white-space: nowrap;
    --tp-button-padding: 4px 10px;
  }

  tp-button.dark {
    --tp-button-bg: var(--button-dark-bg);
    --tp-button-color: var(--button-dark-color);
    --tp-button-color-hover: var(--button-dark-selected-color);
    --tp-button-bg-hover: var(--button-dark-selected-bg);
    --tp-button-bg-focus: var(--button-dark-selected-bg);
    --tp-button-color-focus: var(--button-dark-hover-color);
  }

  tp-button.danger {
    background-color: var(--error-color);
  }

  tp-button[disabled].danger {
    background-color: var(--tp-button-bg-disabled);
  }

  tp-button.small {
    font-size: 0.8rem;
    height: 24px;
    --tp-button-padding: 0 5px;
  }

  tp-input::part(wrap) {
    background: var(--input-bg);
    border-radius: var(--input-border-radius);
    border: var(--input-border);
    box-shadow: var(--input-box-shadow);
    padding: 0;
  }

  tp-input input {
    padding: 5px;
  }

  tp-input[invalid]::part(wrap) {
    outline: var(--tp-input-text-color-invalid) solid 1px;
  }

  tp-input[focused]::part(wrap) {
    border: var(--input-border-hl);
  }

  tp-input[readonly]::part(wrap) {
    background: var(--input-bg-readonly);
  }

  tp-input::part(error-message) {
    font-weight: bold;
  }

  tp-input input[type="text"]::placeholder {
    color: var(--text-dim);
    opacity: 1;
  }

  tp-input tp-button[slot="suffix"] {
    font-size: 0.8rem;
    --tp-button-padding: 0px 5px;
    margin-right: 2px;
  }

  tp-dialog::part(dialog) {
    box-shadow: var(--shadow-lg);
    max-height: 98vh;
    max-width: 98vw;
  }

  tp-dialog::part(close-icon) {
    --tp-icon-color: var(--icon-color);
  }

  tp-dialog::part(close-icon):hover {
    --tp-icon-color: var(--icon-color-hover);
  }

  tp-dialog::part(scroll-wrapper)::-webkit-scrollbar {
    width: 10px;
  }

  tp-dialog::part(scroll-wrapper)::-webkit-scrollbar-track {
    background: var(--scrollbar-bg);
    border-radius: 4px;
  }

  tp-dialog::part(scroll-wrapper)::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-thumb);
    outline: none;
    border-radius: 4px;
  }

  tp-dialog::-webkit-scrollbar {
    width: 10px;
  }

  tp-dialog::-webkit-scrollbar-track {
    background: var(--scrollbar-bg);
    border-radius: 4px;
  }

  tp-dialog::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-thumb);
    outline: none;
    border-radius: 4px;
  }

  tp-popup-menu {
    background: var(--popup-bg);
    border-radius: var(--popup-border-radius);
    --tp-popup-menu-item-color: var(--text);
  }

  tp-popup-menu-item:not([readonly]):hover {
    --tp-popup-menu-item-bg: var(--menu-item-selected-bg);
  }

  tp-popup-menu-item[disabled] {
    --tp-popup-menu-item-color: var(--text-dim);
  }

  tp-popup-menu-item::part(icon) {
    --tp-icon-width: 18px;
    --tp-icon-height: 18px;
    --tp-icon-color: var(--icon-color);
  }

  tp-popup-menu-item.toggle::part(icon) { opacity: 0.1; }
  tp-popup-menu-item.toggle:is(:hover, [selected])::part(icon) { opacity: 1; }

  tp-popup-menu-divider {
    --tp-popup-menu-divider-spacing: 5px;
    --tp-popup-menu-divider-width: 1px;
    --tp-popup-menu-divider-color: var(--popup-divider-color);
  }

  tp-icon {
    --tp-icon-color: var(--icon-color);
  }

  tp-icon:not(.static):hover {
    --tp-icon-color: var(--icon-color-hover);
  }

  tp-icon.static {
    cursor: default;
  }
`;

export const shared = css`
  h1 {
    font-size: 2.2rem;
    font-weight: inherit;
    color: var(--text);
    padding: 0;
  }

  h2 {
    color: var(--text);
    font-size: 1.8rem;
    font-weight: inherit;
    padding: 0;
  }

  h3 {
    display: block;
    font-size: 1.6rem;
    font-weight: inherit;
  }

  h4 {
    display: block;
    font-size: 1.4rem;
    font-weight: inherit;
  }

  h5 {
    display: block;
    font-size: 1.2rem;
    font-weight: bold;
  }

  h1, h2, h3, h4, h5 {
    font-family: var(--font0);
    margin: 0 0 20px 0;
  }

  label {
    display: block;
    color: var(--label-color);
    padding-bottom: 5px;
  }

  a {
    color: var(--text-dim);
  }

  a:is(:hover, :active) {
    color: var(--text-hl);
  }

  p {
    margin: 0 0 15px 0;
    line-height: 24px;
  }

  [hidden] {
    display: none !important;
  }

  .centered {
    text-align: center;
  }

  .hint {
    font-size: var(--font-size-md);
    margin-bottom: 10px;
  }

  .error-box {
    color: var(--error-color);
    font-weight: bold;
    padding: 20px 0;
  }

  .buttons-justified {
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .buttons-justified tp-button + tp-button {
    margin-left: 20px;
  }

  :is(tp-input, tp-dropdown) + label {
    padding-top: 20px;
  }

  .horizontal {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .flex {
    flex: 1;
  }

  .justified {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .gap-20 {
    gap: 20px;
  }

  .gap-10 {
    gap: 10px;
  }

  .gap-5 {
    gap: 5px;
  }

  .margin-top-20 {
    margin-top: 20px;
  }

  .form-actions {
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .scrollbar::-webkit-scrollbar {
    width: 10px;
  }

  .scrollbar::-webkit-scrollbar-track {
    background: var(--scrollbar-bg);
    border-radius: 4px;
  }

  .scrollbar::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-thumb);
    outline: none;
    border-radius: 4px;
  }
`;
