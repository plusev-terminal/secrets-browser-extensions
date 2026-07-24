import { html } from 'lit';

export const highlightText = (text, filterText) => {
  if (!filterText) {
    return text;
  }

  const keywords = filterText.toLowerCase()
    .split(' ')
    .filter(keyword => keyword.length > 0);

  let safeText = text.replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  keywords.forEach(keyword => {
    if (keyword.length === 0) return;

    const regex = new RegExp(`(?<!&[^;]*)(${keyword})`, 'gi');
    safeText = safeText.replace(regex, '<mark>$1</mark>');
  });

  return html`<span .innerHTML="${safeText}"></span>`;
};
