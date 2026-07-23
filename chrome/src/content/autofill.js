// Content script: form detection + credential injection.
//
// Runs at document_idle on all URLs. Listens for AUTOFILL_CREDENTIALS
// messages from the background service worker (triggered by popup selection
// or right-click context menu).
//
// Also detects login forms on page load and notifies the background worker
// so the badge can show the match count.

// Notify the background worker about login forms on this page.
if (document.querySelector('input[type="password"]')) {
  chrome.runtime.sendMessage({
    type: 'PAGE_HAS_LOGIN_FORM',
    hostname: location.hostname,
  }).catch(() => {});
}

// Listen for autofill commands.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTOFILL_CREDENTIALS') {
    autofillCredentials(message.username, message.password);
    sendResponse({ ok: true });
  }

  if (message.type === 'GET_FILLABLE_FIELDS') {
    sendResponse({ fields: detectLoginFields() });
  }

  return true;
});

// Detect username + password field pairs on the page.
function detectLoginFields() {
  const passwordFields = [...document.querySelectorAll('input[type="password"]')];

  if (passwordFields.length === 0) return [];

  const pairs = [];

  for (const passwordField of passwordFields) {
    // Look for a username/email field near the password field.
    const form = passwordField.closest('form') || passwordField.parentElement?.parentElement;

    let usernameField = null;

    if (form) {
      usernameField = form.querySelector(
        'input[type="text"], input[type="email"], input[type="text"]:not([type="password"]), input[name*="user" i], input[name*="email" i], input[name*="login" i], input[name*="account" i], input[id*="user" i], input[id*="email" i], input[id*="login" i]'
      );
    }

    // Fallback: search siblings above the password field.
    if (!usernameField) {
      let prev = passwordField.previousElementSibling;
      while (prev) {
        if (prev.tagName === 'INPUT' && prev.type !== 'password' && prev.type !== 'hidden') {
          usernameField = prev;
          break;
        }
        prev = prev.previousElementSibling;
      }
    }

    pairs.push({
      username: usernameField ? describeField(usernameField) : null,
      password: describeField(passwordField),
    });
  }

  return pairs;
}

function describeField(el) {
  return {
    type: el.type,
    name: el.name || '',
    id: el.id || '',
    placeholder: el.placeholder || '',
  };
}

// Inject credentials into the detected form fields.
function autofillCredentials(username, password) {
  const passwordFields = [...document.querySelectorAll('input[type="password"]')];

  if (passwordFields.length === 0) {
    console.warn('[plusev-secrets] No password field found on this page.');
    return;
  }

  // Use the first visible password field.
  const passwordField = passwordFields.find(isVisible) || passwordFields[0];

  // Find the associated username field.
  const form = passwordField.closest('form');
  let usernameField = null;

  if (form) {
    usernameField = form.querySelector(
      'input[type="text"], input[type="email"], input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'
    );
  }

  // Fill password.
  setFieldValue(passwordField, password);

  // Fill username if we found a field and have a value.
  if (usernameField && username) {
    setFieldValue(usernameField, username);
  }

  // Dispatch input events so frameworks (React, Vue) detect the change.
  [usernameField, passwordField].forEach(field => {
    if (!field) return;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function setFieldValue(el, value) {
  // Use the native setter to work with React/Vue controlled inputs.
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;

  nativeInputValueSetter.call(el, value);
}

function isVisible(el) {
  const style = window.getComputedStyle(el);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && el.offsetParent !== null;
}
