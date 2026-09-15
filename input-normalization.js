const LOCALE = 'it-IT';
const SUPPORTED_FORMATS = new Set(['person-name', 'place-name', 'upper-code']);
const installedRoots = new WeakSet();

function compactWhitespace(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function titleCase(value) {
  return String(value || '')
    .toLocaleLowerCase(LOCALE)
    .replace(/(^|[\s'’\-])(\p{L})/gu, (match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase(LOCALE)}`);
}

export function normalizeInputValue(value, format, { commit = false } = {}) {
  if (!SUPPORTED_FORMATS.has(format)) return String(value || '');
  const rawValue = String(value || '');
  const normalizedWhitespace = commit ? compactWhitespace(rawValue) : rawValue;
  if (format === 'upper-code') return normalizedWhitespace.toLocaleUpperCase(LOCALE);
  return titleCase(normalizedWhitespace);
}

function normalizedSelectionOffset(value, offset, format) {
  return normalizeInputValue(String(value || '').slice(0, Math.max(0, offset || 0)), format).length;
}

export function normalizeField(input, { commit = false } = {}) {
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return false;
  const format = input.dataset.format;
  if (!SUPPORTED_FORMATS.has(format)) return false;

  const previousValue = input.value;
  const nextValue = normalizeInputValue(previousValue, format, { commit });
  if (nextValue === previousValue) return false;

  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  input.value = nextValue;

  if (!commit && Number.isInteger(selectionStart) && Number.isInteger(selectionEnd)) {
    const nextStart = Math.min(nextValue.length, normalizedSelectionOffset(previousValue, selectionStart, format));
    const nextEnd = Math.min(nextValue.length, normalizedSelectionOffset(previousValue, selectionEnd, format));
    input.setSelectionRange(nextStart, nextEnd);
  }
  return true;
}

export function normalizeFormFields(form) {
  if (!(form instanceof HTMLFormElement)) return;
  form.querySelectorAll('input[data-format], textarea[data-format]').forEach((input) => {
    normalizeField(input, { commit: true });
  });
}

export function installInputNormalization(root = document) {
  if (!root?.addEventListener || installedRoots.has(root)) return;
  installedRoots.add(root);

  root.addEventListener('input', (event) => {
    normalizeField(event.target);
  });
  root.addEventListener('focusout', (event) => {
    normalizeField(event.target, { commit: true });
  });
  root.addEventListener('submit', (event) => {
    normalizeFormFields(event.target);
  }, true);
}
