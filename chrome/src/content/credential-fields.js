// Credential-field detection + autofill engine for the content script.
//
// Single source of truth for finding username/password pairs and filling
// them. Deep-walks open shadow roots, handles form-less SPAs, scores
// candidates by autocomplete hint + name/id heuristics, and drives
// framework-controlled inputs (React/Vue) via realm-safe native setters.
//
// Consumed by autofill.js for badge detection (PAGE_HAS_LOGIN_FORM),
// field enumeration (GET_FILLABLE_FIELDS), and filling (AUTOFILL_CREDENTIALS).
// Do not re-implement any of this logic in autofill.js.

const PASSWORD_SELECTOR = 'input[type="password"]';

const USERNAME_EXCLUDE_TYPES = new Set([
  'password', 'hidden', 'submit', 'button', 'checkbox', 'radio',
  'image', 'reset', 'file', 'range', 'color', 'url',
]);

const NON_USERNAME_HINTS = /captcha|otp|totp|token|search|promo|coupon|referrer|affiliate|newsletter/i;

const USERNAME_NAME_HINTS = /user|email|login|account|identifier|handle/i;

const MIN_PASSWORD_SCORE = -50;

// Walk a root and all reachable open shadowRoots, collecting every element
// matching the selector. Closed shadow roots are unreachable by design.
export function deepQuerySelectorAll(root, selector) {
  const results = [];
  const stack = [root];

  while (stack.length) {
    const node = stack.pop();

    if (!node || typeof node.querySelectorAll !== 'function') continue;

    for (const el of node.querySelectorAll(selector)) results.push(el);

    for (const el of node.querySelectorAll('*')) {
      if (el.shadowRoot) stack.push(el.shadowRoot);
    }
  }

  return results;
}

// First match of deepQuerySelectorAll, or null.
export function deepQuerySelector(root, selector) {
  return deepQuerySelectorAll(root, selector)[0] || null;
}

// Visible per the browser's own visibility engine (Chrome 105+). Reliable
// inside shadow DOM and for position:fixed elements. Engines without
// checkVisibility are treated as visible rather than reintroducing the
// offsetParent heuristic, which false-negatives inside shadow trees.
export function isVisible(el) {
  if (!el || !el.isConnected) return false;

  if (typeof el.checkVisibility !== 'function') return true;

  return el.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true });
}

// Scope for username lookup: nearest form / fieldset / role=form ancestor,
// else the password field's root node (document or shadowRoot). Falls back
// wide only when there is genuinely no enclosing form-like container.
function findScope(passwordField) {
  return passwordField.closest('form, fieldset, [role="form"]')
    || passwordField.getRootNode();
}

// Score a password field. Strongly prefers current-password, penalises
// new-password (registration/reset flows), rewards visibility.
export function scorePasswordField(el) {
  const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
  let score = 0;

  if (ac.includes('current-password')) score += 1000;
  if (ac.includes('new-password')) score -= 1000;

  if (isVisible(el)) score += 100;

  if (el.name && /pass|pwd|secret/i.test(el.name)) score += 10;
  if (el.id && /pass|pwd|secret/i.test(el.id)) score += 10;

  return score;
}

// Score a username candidate relative to a password field. Heavily rewards
// explicit autocomplete hints, type=email, and name/id heuristics; penalises
// fields that smell like captcha/otp/search, and ones that come *after* the
// password field in document order.
export function scoreUsernameField(el, passwordField) {
  const type = (el.type || 'text').toLowerCase();
  if (USERNAME_EXCLUDE_TYPES.has(type)) return -Infinity;

  const name = el.name || '';
  const id = el.id || '';
  const combined = `${name} ${id}`;
  const ac = (el.getAttribute('autocomplete') || '').toLowerCase();

  if (NON_USERNAME_HINTS.test(name) || NON_USERNAME_HINTS.test(id)) return -Infinity;
  if (ac.includes('one-time-code')) return -Infinity;

  let score = 0;

  if (ac.includes('username')) score += 1000;
  if (ac.includes('email')) score += 900;

  if (type === 'email') score += 500;
  if (type === 'tel') score += 150;
  if (type === 'text') score += 200;

  if (USERNAME_NAME_HINTS.test(name)) score += 100;
  if (USERNAME_NAME_HINTS.test(id)) score += 100;

  if (isVisible(el)) score += 100;

  // Prefer candidates that precede the password field in document order.
  if (passwordField) {
    const relation = el.compareDocumentPosition(passwordField);
    if (relation & Node.DOCUMENT_POSITION_FOLLOWING) score += 75;
  }

  // Empty name+id+placeholder+autocomplete is a weak signal.
  if (!name && !id && !el.placeholder && !ac) score -= 50;

  return score;
}

// Pick the best username field within a scope for a given password field.
// Returns the element or null.
function findUsername(passwordField, scope) {
  const candidates = deepQuerySelectorAll(scope, 'input');
  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (candidate === passwordField) continue;

    const score = scoreUsernameField(candidate, passwordField);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

// Detect every username/password pair under root (default: document).
// Deep-walks shadow roots. Each pair carries the live elements plus scores,
// so callers can either fill directly or serialise via describeField.
export function findCredentialPairs(root = document) {
  const passwordFields = deepQuerySelectorAll(root, PASSWORD_SELECTOR);
  const pairs = [];

  for (const passwordField of passwordFields) {
    const scope = findScope(passwordField);
    const usernameField = findUsername(passwordField, scope);

    pairs.push({
      username: usernameField,
      password: passwordField,
      scope,
      passwordScore: scorePasswordField(passwordField),
      usernameScore: usernameField ? scoreUsernameField(usernameField, passwordField) : 0,
    });
  }

  return pairs;
}

// Choose the pair whose password field is the best autofill target.
// Never returns a pair whose password is not visible — returns null so the
// caller can report failure instead of silently filling a honeypot.
export function pickBestPair(pairs) {
  let best = null;

  for (const pair of pairs) {
    if (!isVisible(pair.password)) continue;
    if (pair.passwordScore < MIN_PASSWORD_SCORE) continue;
    if (best === null || pair.passwordScore > best.passwordScore) best = pair;
  }

  return best;
}

// Serialise an input element for the GET_FILLABLE_FIELDS response.
export function describeField(el) {
  if (!el) return null;

  return {
    type: el.type,
    name: el.name || '',
    id: el.id || '',
    placeholder: el.placeholder || '',
  };
}

// Serialise every detected pair for GET_FILLABLE_FIELDS.
export function describePairs(pairs) {
  return pairs.map((pair) => ({
    username: describeField(pair.username),
    password: describeField(pair.password),
  }));
}

// Realm-safe native value setter. Cached after first use. Uses the element's
// own constructor prototype so it works across isolated worlds / frames.
let nativeValueSetter = null;

export function setFieldValue(el, value) {
  if (nativeValueSetter === null) {
    nativeValueSetter = Object.getOwnPropertyDescriptor(
      el.constructor.prototype, 'value',
    )?.set
      || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  }

  nativeValueSetter.call(el, value);
}

// Dispatch composed input + change events so frameworks (React, Vue, Lit)
// detect the fill. composed:true lets the event cross shadow boundaries,
// matching how real user input behaves. InputEvent carries inputType, which
// some frameworks inspect.
function fireFillEvents(el) {
  const opts = { bubbles: true, composed: true };

  el.dispatchEvent(new InputEvent('input', { ...opts, inputType: 'insertFromPaste' }));
  el.dispatchEvent(new Event('change', opts));
}

// Fill username + password into the best detected pair on the page.
// Returns a structured result so the popup / background can distinguish
// success from "no field found".
export function fillCredentials(username, password) {
  const pairs = findCredentialPairs(document);

  if (pairs.length === 0) {
    return { ok: false, reason: 'no-password-field', filled: { username: false, password: false } };
  }

  const pair = pickBestPair(pairs);

  if (!pair) {
    return { ok: false, reason: 'no-fillable-field', filled: { username: false, password: false } };
  }

  let filledUsername = false;

  if (pair.username && username) {
    setFieldValue(pair.username, username);
    fireFillEvents(pair.username);
    filledUsername = true;
  }

  setFieldValue(pair.password, password);
  fireFillEvents(pair.password);

  return { ok: true, filled: { username: filledUsername, password: true } };
}
