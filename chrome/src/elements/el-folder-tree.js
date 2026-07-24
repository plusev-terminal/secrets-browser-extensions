/**
@license
Copyright (c) 2025 trading_peter
*/

// Folder navigation tree for the browser extension. Port of the terminal's
// v-folder-tree, adapted for the extension context:
//   - Folders passed as a property (no secretsStore dependency)
//   - No DnD (entries can't be dragged from the extension popup)
//   - No folder CRUD dialogs (context menu dispatches events only)
//   - No entry counts (extension doesn't track them)
//
// Wraps tp-tree-nav. Emits `folder-selected` with { folderId, key }.

import { LitElement, html, css } from 'lit';
import '@tp/tp-button/tp-button.js';
import '@tp/tp-dialog/tp-dialog.js';
import '@tp/tp-icon/tp-icon.js';
import '@tp/tp-input/tp-input.js';
import '@tp/tp-tree-nav/tp-tree-nav.js';
import { TpTreeNav } from '@tp/tp-tree-nav/tp-tree-nav.js';
import icons from '../shared/icons.js';
import themeTokens from '../shared/theme-tokens.js';
import { controls, shared } from '../shared/styles.js';

const ROOT_KEY = '__all__';

class ElFolderTree extends LitElement {
  static get styles() {
    return [
      themeTokens,
      controls,
      shared,
      css`
        :host {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .all-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-1) var(--space-2);
          margin: 0 var(--space-4);
          border-radius: var(--radius-sm);
          cursor: pointer;
          color: var(--text);
          font-size: var(--font-size-sm);
          user-select: none;
        }

        .all-row:hover {
          background: var(--surface-hover);
        }

        .all-row.active {
          background: var(--surface-active);
        }

        .all-row tp-icon {
          --tp-icon-width: 16px;
          --tp-icon-height: 16px;
          --tp-icon-color: var(--icon-color);
        }

        tp-tree-nav {
          --tp-tree-nav-row-height: 28px;
          --tp-tree-empty-color: var(--text-dim);
          --tp-tree-empty-opacity: 1;
          --tp-tree-empty-font-size: var(--font-size-xs);
          --tp-tree-empty-padding: var(--space-2) var(--space-4);

          --tp-icon-color: var(--icon-color);
          --tp-popup-menu-item-color: var(--text);

          flex: 1;
          min-height: 0;
          color: var(--text);
        }

        tp-tree-nav::part(empty) {
          align-items: flex-start;
          text-align: left;
        }

        tp-tree-nav::part(context-menu) {
          background: var(--popup-bg);
          box-shadow: var(--popup-box-shadow);
          border-radius: var(--popup-border-radius);
        }

        tp-tree-nav::part(context-menu-item):hover {
          --tp-popup-menu-item-bg: var(--menu-item-selected-bg);
        }

        tp-tree-nav::part(tree)::-webkit-scrollbar {
          width: 10px;
        }

        tp-tree-nav::part(tree)::-webkit-scrollbar-track {
          background: var(--scrollbar-bg);
          border-radius: 4px;
        }

        tp-tree-nav::part(tree)::-webkit-scrollbar-thumb {
          background-color: var(--scrollbar-thumb);
          outline: none;
          border-radius: 4px;
        }

        .folder-filter {
          padding: 0 var(--space-4) var(--space-2);
        }

        .folder-filter-wrap {
          position: relative;
        }

        .folder-filter-wrap tp-icon {
          position: absolute;
          left: var(--space-3);
          top: 50%;
          transform: translateY(-50%);
          --tp-icon-color: var(--text-dim);
          --tp-icon-width: 16px;
          --tp-icon-height: 16px;
          pointer-events: none;
        }

        .folder-filter tp-input {
          --tp-input-padding-left: 36px;
        }
      `,
    ];
  }

  static get properties() {
    return {
      folders: { type: Array },
      selectedFolderKey: { type: String },
      _expandedPaths: { state: true },
      _folderFilter: { state: true },
    };
  }

  constructor() {
    super();

    this.folders = [];
    this.selectedFolderKey = ROOT_KEY;
    this._expandedPaths = [ROOT_KEY];
    this._folderFilter = '';
  }

  updated(changed) {
    super.updated?.(changed);

    const tree = this.renderRoot.querySelector('tp-tree-nav');

    if (!tree) return;

    if (!tree.__vaultWired) {
      tree.__vaultWired = true;

      tree.expandOnDoubleClick = true;
      tree.defaultActions = [
        { action: 'new-subfolder', label: 'New Subfolder', icon: icons['folder-plus'] },
        { action: 'rename', label: 'Rename', icon: icons['pencil'] },
        { action: 'delete', label: 'Delete', icon: icons['delete'] },
      ];
      tree.beforeContextMenu = (item, baseActions) => {
        if (item.node._isRoot) {
          return baseActions.filter(a => a.action === 'new-subfolder');
        }

        return baseActions;
      };

      tree.addEventListener('toggle-expand', (e) => this._onToggleExpand(e));
      tree.addEventListener('node-click', (e) => this._onRowClick(e.detail, e));
      tree.addEventListener('node-action', (e) => this._handleNodeAction(e));
    }
  }

  _buildTreeItems() {
    const folders = this.folders;
    const filter = this._folderFilter.trim().toLowerCase();

    const byParent = new Map();

    for (const folder of folders) {
      const pid = folder.payload?.parentId;
      const key = (pid != null && folders.some(f => f.id === pid)) ? String(pid) : null;
      const arr = byParent.get(key) || [];

      arr.push(folder);
      byParent.set(key, arr);
    }

    let visibleIds = null;

    if (filter) {
      visibleIds = new Set();

      const idMap = new Map(folders.map(f => [f.id, f]));

      for (const folder of folders) {
        const name = (folder.payload?.name || '').toLowerCase();

        if (name.includes(filter)) {
          let cur = folder;

          while (cur) {
            visibleIds.add(cur.id);
            const pid = cur.payload?.parentId;

            cur = (pid != null && idMap.has(pid)) ? idMap.get(pid) : null;
          }
        }
      }
    }

    const buildChildren = (parentKey) => {
      let children = byParent.get(parentKey) || [];

      if (visibleIds) {
        children = children.filter(f => visibleIds.has(f.id));
      }

      return children
        .slice()
        .sort((a, b) => (a.payload?.name || '').localeCompare(b.payload?.name || ''))
        .map(folder => ({
          slug: String(folder.id),
          label: folder.payload?.name || '(unnamed)',
          icon: icons['folder'],
          _folderId: folder.id,
          children: buildChildren(String(folder.id)),
          states: [],
          actions: [],
        }));
    };

    return [
      {
        slug: ROOT_KEY,
        label: 'All Entries',
        icon: icons['app'],
        _folderId: null,
        _isRoot: true,
        children: buildChildren(null),
        states: [],
        actions: [],
      },
    ];
  }

  _getRoots() {
    const items = this._buildTreeItems();

    const expandedPaths = this._folderFilter.trim()
      ? this._collectAllPaths(items)
      : this._expandedPaths;

    return TpTreeNav.buildTree(items, {
      expandedPaths,
      selectedPaths: [],
    }).nodes;
  }

  _collectAllPaths(items) {
    const paths = [];

    const walk = (nodes, parentPath) => {
      for (const node of nodes) {
        const path = parentPath ? `${parentPath}/${node.slug}` : node.slug;

        paths.push(path);
        walk(node.children || [], path);
      }
    };

    walk(items, '');

    return paths;
  }

  _onToggleExpand(e) {
    const { path, expanded } = e.detail;

    const set = new Set(this._expandedPaths);

    if (expanded) {
      set.add(path);
    } else {
      set.delete(path);
    }

    this._expandedPaths = [...set];
  }

  _onRowClick(item, e) {
    e.stopPropagation();

    const node = item.node;

    if (node._isRoot) {
      this.selectedFolderKey = ROOT_KEY;

      this.dispatchEvent(new CustomEvent('folder-selected', {
        detail: { folderId: null, key: ROOT_KEY },
        bubbles: true,
        composed: true,
      }));
      return;
    }

    const folderId = node._folderId;

    if (folderId == null) return;

    this.selectedFolderKey = String(folderId);

    this.dispatchEvent(new CustomEvent('folder-selected', {
      detail: { folderId, key: String(folderId) },
      bubbles: true,
      composed: true,
    }));
  }

  _handleNodeAction(e) {
    const { action, item } = e.detail;

    // Dispatch as events — the host decides what to do.
    if (action === 'new-subfolder') {
      const parentId = item.node._isRoot ? null : item.node._folderId;

      this.dispatchEvent(new CustomEvent('folder-create-requested', {
        detail: { parentId },
        bubbles: true,
        composed: true,
      }));
      return;
    }

    const folderId = item?.node?._folderId;

    if (folderId == null) return;

    if (action === 'rename') {
      this.dispatchEvent(new CustomEvent('folder-rename-requested', {
        detail: { folderId },
        bubbles: true,
        composed: true,
      }));
    } else if (action === 'delete') {
      this.dispatchEvent(new CustomEvent('folder-delete-requested', {
        detail: { folderId },
        bubbles: true,
        composed: true,
      }));
    }
  }

  render() {
    return html`
      <div class="folder-filter">
        <div class="folder-filter-wrap">
          <tp-icon .icon=${icons['search'] || icons['settings']}></tp-icon>
          <tp-input .value=${this._folderFilter}>
            <input
              type="text"
              placeholder="Filter folders..."
              @input=${e => this._folderFilter = e.target.value}
            />
          </tp-input>
        </div>
      </div>

      <tp-tree-nav
        .roots=${this._getRoots()}
      ></tp-tree-nav>
    `;
  }
}

window.customElements.define('el-folder-tree', ElFolderTree);
