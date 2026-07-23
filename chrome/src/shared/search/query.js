/**
@license
Copyright (c) 2025 trading_peter
*/

// Structured query parser for the secrets vault search box.
//
// Supported syntax:
//   tag:banking          — entries with the given tag
//   host:github.com      — entries whose URL/host matches
//   type:login           — entries of the given type
//   scope:withdraw       — apiKey entries declaring this scope
//   has:totp             — entries with a TOTP seed
//   strength:weak        — password strength facet
//   changed:>30d         — updated more than N days ago
//   changed:<7d          — updated within N days
//   free-text            — remaining tokens run through the text-tier scorer
//
// Multiple operators AND together. Returns { operators, text } where
// operators is an array of { op, value } and text is the leftover string
// for the text-tier scorer.

const OPS = [
  'tag', 'host', 'type', 'scope', 'has', 'strength', 'changed',
];

const HAS_VALUES = new Set(['totp', 'notes', 'scopes']);
const STRENGTH_VALUES = new Set(['weak', 'fair', 'strong']);
const TYPE_VALUES = new Set(['login', 'mnemonic', 'apiKey', 'privateKey', 'contract', 'backupCodes']);

export function parseQuery(input) {
  const result = { operators: [], text: '' };

  if (!input || !input.trim()) return result;

  const tokens = input.trim().split(/\s+/);
  const textParts = [];

  for (const token of tokens) {
    const colonIdx = token.indexOf(':');

    if (colonIdx <= 0) {
      textParts.push(token);

      continue;
    }

    const op = token.slice(0, colonIdx).toLowerCase();
    const value = token.slice(colonIdx + 1);

    if (!OPS.includes(op) || !value) {
      // Unrecognised operator or empty value — treat as text.
      textParts.push(token);

      continue;
    }

    result.operators.push({ op, value });
  }

  result.text = textParts.join(' ').trim();

  return result;
}

// Apply the parsed operator set to a single index row. Returns true if the row
// passes every operator predicate. The text tier is applied separately by the
// scorer because it contributes a relevance score, not a boolean.
export function matchesOperators(row, operators) {
  for (const { op, value } of operators) {
    if (!matchOperator(row, op, value)) return false;
  }

  return true;
}

function matchOperator(row, op, value) {
  switch (op) {
    case 'tag': {
      const v = value.toLowerCase();

      return row.tags.some(t => t.toLowerCase() === v);
    }

    case 'host': {
      const v = value.toLowerCase();

      return row.hosts.some(h => h.includes(v)) || row.domains.some(d => d.includes(v));
    }

    case 'type':
      return row.type === value;

    case 'scope': {
      const v = value.toLowerCase();

      return (row.facets.scopes || []).some(s => s.toLowerCase() === v);
    }

    case 'has': {
      const v = value.toLowerCase();

      if (v === 'totp') return row.facets.hasTotp === true;
      if (v === 'notes') return row.noteTokens.length > 0;
      if (v === 'scopes') return (row.facets.scopes || []).length > 0;

      return false;
    }

    case 'strength': {
      if (!STRENGTH_VALUES.has(value)) return false;

      return row.facets.strength === value;
    }

    case 'changed': {
      const m = /^([<>])(\d+)d$/.exec(value);

      if (!m) return false;

      const days = parseInt(m[2], 10);
      const cutoff = Date.now() - days * 86400_000;
      const ts = new Date(row.lastAccessed || row.updatedAt || 0).getTime();

      if (m[1] === '>') return ts < cutoff;
      if (m[1] === '<') return ts >= cutoff;

      return false;
    }

    default:
      return false;
  }
}

export const QUERY_OPS = OPS;
export const QUERY_HAS_VALUES = [...HAS_VALUES];
export const QUERY_STRENGTH_VALUES = [...STRENGTH_VALUES];
export const QUERY_TYPE_VALUES = [...TYPE_VALUES];
