// PlusEV Secrets content script — autofill + login-form detection.
//
// Runs at document_idle on all URLs (top frame + all_frames, see manifest).
// Listens for AUTOFILL_CREDENTIALS / GET_FILLABLE_FIELDS messages from the
// background service worker (popup selection or right-click context menu),
// and notifies the worker when a login form is present so the badge can
// show the match count.
//
// All detection + fill logic lives in ./credential-fields.js. This file is
// only the message router + the SPA-aware login observer.

import {
  findCredentialPairs,
  describePairs,
  fillCredentials,
} from './credential-fields.js';

let loginPresent = null;
let debounceTimer = null;

function notifyBackground(present) {
  if (present === loginPresent) return;

  loginPresent = present;

  chrome.runtime.sendMessage({
    type: 'PAGE_HAS_LOGIN_FORM',
    hostname: location.hostname,
    present,
  }).catch(() => {});
}

// Recompute login presence from the live DOM (deep-walks shadow roots).
function recheckLogin() {
  notifyBackground(findCredentialPairs(document).length > 0);
}

// Throttled observer: SPAs mount login forms long after document_idle, so
// watch the tree and re-check on a short debounce. Cheap because the deep
// walk only runs at most once per 250ms of churn.
function scheduleRecheck() {
  if (debounceTimer !== null) return;

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    recheckLogin();
  }, 250);
}

// Cheap gate: only recheck when a mutation adds or removes something that
// could be/contain a form control or a shadow host. Pages with constant
// DOM churn (tickers, chat) would otherwise trigger a full deep walk every
// 250ms for the life of the page.
function mutationsMatter(mutations) {
  for (const mutation of mutations) {
    for (const list of [mutation.addedNodes, mutation.removedNodes]) {
      for (const node of list) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches('input, form, fieldset, [role="form"]')) return true;
        if (node.querySelector('input, form')) return true;
        if (node.localName.includes('-')) return true;
      }
    }
  }

  return false;
}

new MutationObserver((mutations) => {
  if (mutationsMatter(mutations)) scheduleRecheck();
}).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

recheckLogin();

// Message router.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTOFILL_CREDENTIALS') {
    sendResponse(fillCredentials(message.username, message.password));
    return true;
  }

  if (message.type === 'GET_FILLABLE_FIELDS') {
    sendResponse({ fields: describePairs(findCredentialPairs(document)) });
    return true;
  }
});
