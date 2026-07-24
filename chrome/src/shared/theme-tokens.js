// Dark theme CSS custom property tokens for the browser extension.
// Shared by the-options and the-popup Lit components.
// Extracted from terminal/frontend/src/styles/themes/dark/theme.js.

import { css } from 'lit';

export default css`
  :host {
  /* ── Palette ── */
  --palette-bg: #0F111D;
  --palette-bg-deep: #131627;
  --palette-surface: #181B2E;
  --palette-surface-active: #211D44;
  --palette-surface-hover: #24204B;
  --palette-control: #353265;
  --palette-disabled: #373741;
  --palette-muted: #72759d;
  --palette-text: #D4D7DC;
  --palette-accent: #D00E91;
  --palette-accent-2: #ff1347;
  --palette-info: #2897DC;
  --palette-highlight: #00ffa1;

  --hl-gradient: linear-gradient(0deg, var(--palette-accent), var(--palette-accent-2));

  /* ── Status colors ── */
  --success-color: #00d1b2;
  --warning-color: #ffb400;
  --error-color: #d00e58;
  --info-color: var(--palette-info);

  /* ── Semantic ── */
  --text: var(--palette-text);
  --text-inverse: var(--palette-bg);
  --text-hl: var(--palette-accent);
  --text-hl-2: var(--palette-accent-2);
  --text-dim: var(--palette-muted);
  --label-color: var(--palette-muted);
  --page-bg: var(--palette-bg);
  --surface: var(--palette-surface);
  --surface-hover: var(--palette-surface-hover);
  --surface-active: var(--palette-surface-active);
  --surface-deep: var(--palette-bg-deep);
  --border-subtle: var(--palette-muted);
  --border-strong: var(--palette-control);

  /* ── Scrollbar ── */
  --scrollbar-bg: var(--palette-surface);
  --scrollbar-thumb: var(--palette-muted);

  /* ── Fonts ── */
  --font0: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.8rem;
  --font-size-md: 0.9rem;
  --font-size-lg: 1rem;
  --font-size-xl: 1.2rem;
  --font-size-2xl: 1.5rem;

  /* ── Spacing scale (per terminal-frontend-style) ── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* ── Radii ── */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --default-border-radius: var(--radius-md);

  /* ── Shadows ── */
  --shadow-sm: 0px 2px 4px 0px rgb(0 0 0 / 12%);
  --shadow-md: 0px 5px 7px 0px rgb(0 0 0 / 16%);
  --shadow-lg: 0px 10px 24px 0px rgb(0 0 0 / 32%);

  /* ── Cards ── */
  --card-bg: var(--palette-surface);
  --card-border-radius: 6px;
  --card-padding: 20px;
  --card-box-shadow: var(--shadow-md);

  /* ── Buttons ── */
  --tp-button-color: var(--palette-surface);
  --tp-button-bg: var(--palette-text);
  --tp-button-color-hover: var(--palette-text);
  --tp-button-bg-hover: var(--hl-gradient);
  --tp-button-bg-focus: var(--palette-accent);
  --tp-button-color-focus: var(--palette-text);
  --tp-button-bg-disabled: var(--palette-disabled);
  --tp-button-color-disabled: var(--palette-surface);

  --button-dark-bg: var(--palette-bg);
  --button-dark-color: var(--palette-text);
  --button-dark-selected-bg: var(--hl-gradient);
  --button-dark-selected-color: var(--palette-text);
  --button-dark-hover-bg: var(--palette-control);
  --button-dark-hover-color: var(--palette-text);

  --tp-button-spinner-color1: var(--palette-control);
  --tp-button-spinner-color2: var(--palette-accent);

  /* ── Inputs ── */
  --tp-input-text-color-invalid: var(--error-color);
  --input-bg: var(--palette-control);
  --input-bg-v2: var(--palette-surface-active);
  --input-bg-readonly: var(--palette-bg-deep);
  --input-border: solid 1px var(--palette-control);
  --input-border-radius: var(--default-border-radius);
  --input-box-shadow: var(--shadow-md);
  --input-border-hl: solid 1px var(--palette-accent);

  /* ── Popups ── */
  --popup-bg: var(--palette-control);
  --popup-border-radius: var(--default-border-radius);
  --popup-box-shadow: var(--shadow-md);
  --popup-divider-color: var(--palette-surface);

  /* ── Dialogs ── */
  --tp-dialog-border-radius: 6px;
  --tp-dialog-bg: var(--palette-surface);
  --tp-dialog-border: solid 1px var(--palette-surface-hover);
  --tp-dialog-padding: 20px;

  /* ── Menu ── */
  --menu-item-selected-bg: var(--palette-surface-hover);
  --menu-item-hover-bg: var(--palette-surface);

  /* ── Icons ── */
  --icon-color: var(--text);
  --icon-color-hover: var(--palette-accent);
  --icon-color-inverse: var(--palette-bg);
  --icon-color-disabled: var(--text-dim);
  }
`;
