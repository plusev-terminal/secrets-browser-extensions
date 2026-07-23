/**
@license
Copyright (c) 2025 trading_peter
*/

// In-memory plaintext search index. Built once on unlock, patched
// incrementally on edit. Lives ONLY in JS memory — never persisted in any
// form. Cleared on lock.
//
// Each entry produces an IndexRow with tokenised/normalised fields and
// precomputed facets. The scorer (score.js) consumes these rows; the query
// parser (query.js) reduces the candidate set via the facets.
//
// Tokenisation is deliberately simple: lowercase, split on non-alphanumeric,
// drop empties. No stemming, no stopwords — vault sizes are small enough that
// brute-force token matching is sub-millisecond and the precision loss from
// stemming is unwanted (matching "trading" and "trader" as distinct tokens
// helps the user narrow deliberately).

function tokenize(text) {
  if (!text) return [];

  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(t => t.length > 0);
}

// Parse a URL or bare host string into a list of matchable tokens.
// "https://github.com/login" → ["github", "com", "login"] plus the eTLD+1
// "github.com" for fuzzy-domain matching.
function parseHosts(urls) {
  const hosts = [];
  const domains = [];

  for (const raw of urls || []) {
    if (!raw) continue;

    let host;

    try {
      // Add a scheme if missing so URL parsing treats it as a URL, not a path.
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

      host = new URL(withScheme).hostname.toLowerCase();
    } catch {
      // Not a URL — treat the whole string as a host token.
      host = String(raw).toLowerCase();
    }

    hosts.push(host);

    const parts = host.split('.');

    if (parts.length >= 2) {
      // eTLD+1 — last two labels. For "api.github.com" → "github.com".
      // Imperfect for multi-label TLDs (.co.uk) but vault-scale OK.
      domains.push(parts.slice(-2).join('.'));
    }
  }

  return { hosts, domains };
}

function deriveFacets(stored) {
  const { type, payload } = stored;
  const facets = {
    type,
    hasTotp: false,
    strength: 'fair',
    tags: payload?.tags || [],
  };

  if (type === 'login') {
    facets.hasTotp = Boolean(payload?.totpSecret);

    if (payload?.password) {
      facets.strength = scorePasswordStrength(payload.password);
    }
  } else if (type === 'apiKey') {
    facets.scopes = Array.isArray(payload?.scopes) ? payload.scopes : [];
  } else if (type === 'backupCodes') {
    const total = payload?.codes?.length || 0;
    const used = (payload?.usedFlags || []).filter(Boolean).length;

    facets.codesRemaining = Math.max(0, total - used);
  }

  return facets;
}

// Zxcvbn-style score approximated without the library. Good enough to drive a
// facet pill — not a real strength meter. The detail panel can show a more
// nuanced indicator built off the same signal.
function scorePasswordStrength(pw) {
  if (!pw) return 'weak';

  let score = 0;

  if (pw.length >= 8) score++;
  if (pw.length >= 16) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 2) return 'weak';
  if (score === 3) return 'fair';
  return 'strong';
}

export function buildIndex(storedEntries) {
  const rows = [];

  for (const stored of storedEntries) {
    rows.push(buildRow(stored));
  }

  return { rows };
}

export function buildRow(stored) {
  const { payload } = stored;
  const urls = payload?.urls || (payload?.url ? [payload.url] : []);
  const { hosts, domains } = parseHosts(urls);

  return {
    id: stored.id,
    type: stored.type,
    titleTokens: tokenize(payload?.title || stored.payload?.title || ''),
    usernameTokens: tokenize(payload?.username || ''),
    hostTokens: tokenize(hosts.join(' ')),
    domains,
    hosts,
    noteTokens: tokenize(payload?.notes || ''),
    customFieldTokens: tokenize((payload?.customFields || []).map(f => f?.key || f?.label || '').join(' ')),
    tags: payload?.tags || [],
    // folderId lives inside the entry payload (zero-knowledge). The index row
    // carries it so folder filtering works without re-walking the entries Map.
    folderId: payload?.folderId ?? null,
    lastAccessed: stored.lastAccessed || stored.updatedAt || stored.createdAt,
    accessCount: stored.accessCount || 0,
    facets: deriveFacets(stored),
    // Back-reference so the scorer can lift the title for display without a
    // second lookup. The title is the only payload field cached on the row —
    // other fields stay in the entries Map and are only fetched on detail open.
    titleText: payload?.title || '(untitled)',
  };
}

export function addToIndex(index, stored) {
  if (!index) return;

  const existingIdx = index.rows.findIndex(r => r.id === stored.id);

  const row = buildRow(stored);

  if (existingIdx >= 0) {
    index.rows[existingIdx] = row;
  } else {
    index.rows.push(row);
  }
}

export function removeFromIndex(index, id) {
  if (!index) return;

  const idx = index.rows.findIndex(r => r.id === id);

  if (idx >= 0) {
    index.rows.splice(idx, 1);
  }
}

export { scorePasswordStrength };
