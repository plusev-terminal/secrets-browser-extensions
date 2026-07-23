/**
@license
Copyright (c) 2025 trading_peter
*/

// Pure functions for folder hierarchy operations. Extracted from store.js so
// they can be unit-tested without booting the crypto layer.
//
// These functions take plain Map/array inputs — they do NOT touch the
// secretsStore singleton, do NOT import crypto, and have zero side effects.
//
// Folder shape: { id, payload: { name, parentId, sortOrder, ... } }
// Entry shape:  { id, payload: { folderId, ... } }

// Return the Set of folder IDs that are descendants of `folderId` (not
// including folderId itself). Walks the parentId graph. Used for:
//   - "include subfolders" entry filtering
//   - cycle prevention when moving a folder via DnD
export function descendantFolderIds(folders, folderId) {
  const result = new Set();

  if (folderId == null) return result;

  const queue = [folderId];

  while (queue.length) {
    const current = queue.shift();

    for (const folder of folders) {
      const pid = folder.payload?.parentId;

      if (pid === current && !result.has(folder.id)) {
        result.add(folder.id);
        queue.push(folder.id);
      }
    }
  }

  return result;
}

// All entry IDs that belong to a folder (and optionally its descendants).
// folderId === null/undefined returns "unfiled" entries — those whose
// folderId is null OR points to a folder that no longer exists.
export function entriesInFolder(entries, folders, folderId, { includeDescendants = true } = {}) {
  if (folderId === null || folderId === undefined) {
    const liveFolderIds = new Set(folders.map(f => f.id));

    return entries.filter(e =>
      e.payload?.folderId == null || !liveFolderIds.has(e.payload.folderId)
    );
  }

  const allowedIds = new Set([folderId]);

  if (includeDescendants) {
    for (const descId of descendantFolderIds(folders, folderId)) {
      allowedIds.add(descId);
    }
  }

  return entries.filter(e => allowedIds.has(e.payload?.folderId));
}

export function countEntriesInFolder(entries, folders, folderId, opts) {
  return entriesInFolder(entries, folders, folderId, opts).length;
}

// Build a nested tree of folders from a flat list. Returns an array of
// { folder, children: [...] }. Unlimited depth via recursive parentId walk.
export function buildFolderTree(folders) {
  const byParent = new Map();

  for (const folder of folders) {
    const pid = folder.payload?.parentId;
    const key = (pid != null && folders.some(f => f.id === pid)) ? pid : null;
    const arr = byParent.get(key) || [];

    arr.push(folder);
    byParent.set(key, arr);
  }

  const buildChildren = (parentKey) => {
    const items = byParent.get(parentKey) || [];

    return items
      .slice()
      .sort((a, b) => (a.payload?.sortOrder || 0) - (b.payload?.sortOrder || 0))
      .map(folder => ({
        folder,
        children: buildChildren(folder.id),
      }));
  };

  return buildChildren(null);
}

// Detect whether assigning newParentId to folderId would create a cycle.
// Returns true if newParentId is folderId itself OR a descendant of folderId.
// Used by the tree's DnD validator.
export function wouldCreateCycle(folders, folderId, newParentId) {
  if (folderId == null) return false;
  if (folderId === newParentId) return true;

  if (newParentId == null) return false;

  return descendantFolderIds(folders, folderId).has(newParentId);
}
