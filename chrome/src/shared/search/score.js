/**
@license
Copyright (c) 2025 trading_peter
*/

// Weighted text-tier scorer. Consumed after the operator tier has reduced the
// candidate set via query.js::matchesOperators.
//
// Each token of the free-text query is matched against the row's pre-tokenised
// fields. Tokens matching title or host score high; username medium; notes low.
// Multiple matching tokens accumulate — a row matching every query token
// ranks above a row matching only one.
//
// Final ranking combines the raw text score with a recency × frequency
// boost so commonly-accessed entries surface to the top even on partial
// matches. This is the formula Bitwarden lacks.

const FIELD_WEIGHTS = Object.freeze({
  title: 10,
  host: 8,
  domain: 6,
  username: 4,
  customField: 3,
  notes: 1,
});

// Score a single row against the free-text portion of the query.
// Returns a numeric score (higher = better match). 0 means no match.
export function scoreRow(row, textQuery) {
  if (!textQuery) {
    // Empty text query — every row that passed operators is a candidate.
    // Rank by recency × frequency alone.
    return recencyFrequencyBoost(row, 1);
  }

  const queryTokens = tokenize(textQuery);

  if (queryTokens.length === 0) return recencyFrequencyBoost(row, 1);

  let score = 0;
  let matchedAny = false;

  for (const qt of queryTokens) {
    let tokenScore = 0;

    if (row.titleTokens.some(t => t.includes(qt))) {
      tokenScore += FIELD_WEIGHTS.title;
      matchedAny = true;
    }

    if (row.hostTokens.some(t => t.includes(qt))) {
      tokenScore += FIELD_WEIGHTS.host;
      matchedAny = true;
    }

    const domainMatch = row.domains.some(d => {
      const label = d.split('.')[0];
      return label.includes(qt) || d.includes(qt);
    });

    if (domainMatch) {
      tokenScore += FIELD_WEIGHTS.domain;
      matchedAny = true;
    }

    if (row.usernameTokens.some(t => t.includes(qt))) {
      tokenScore += FIELD_WEIGHTS.username;
      matchedAny = true;
    }

    if (row.customFieldTokens.some(t => t.includes(qt))) {
      tokenScore += FIELD_WEIGHTS.customField;
      matchedAny = true;
    }

    if (row.noteTokens.some(t => t.includes(qt))) {
      tokenScore += FIELD_WEIGHTS.notes;
      matchedAny = true;
    }

    score += tokenScore;
  }

  if (!matchedAny) return 0;

  // Scale the recency × frequency boost by the match strength so a perfect
  // title+host match on an old entry still outranks a weak notes match on a
  // frequently-accessed one.
  return score * recencyFrequencyBoost(row, score);
}

// Combined recency × frequency multiplier in [1.0, ~3.0].
//   - recency: most recent access within 7d → up to +1.0 boost, decaying
//   - frequency: accessCount capped at 20 normalises the curve
function recencyFrequencyBoost(row, baseScore) {
  const now = Date.now();
  const lastTs = new Date(row.lastAccessed || 0).getTime();

  const daysSince = Math.max(0, (now - lastTs) / 86400_000);

  const recency = Math.max(0, 1 - daysSince / 30);

  const frequency = Math.min(1, (row.accessCount || 0) / 20);

  return 1 + recency * 0.6 + frequency * 0.4;
}

function tokenize(text) {
  if (!text) return [];

  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(t => t.length > 0);
}

// Sort a list of { row, score } descending by score. Used by callers after
// running every candidate row through scoreRow.
export function rankByScore(scoredRows) {
  return scoredRows.slice().sort((a, b) => b.score - a.score);
}
