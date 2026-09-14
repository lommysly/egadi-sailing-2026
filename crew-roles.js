export const DEFAULT_CREW_ROLE = 'Equipaggio';

export const CREW_ROLE_PRESETS = Object.freeze([
  { value: 'crew', label: DEFAULT_CREW_ROLE },
  { value: 'co_skipper', label: 'Co-skipper' },
  { value: 'hostess', label: 'Hostess' },
  { value: 'collaborator', label: 'Collaboratore' },
  { value: 'other', label: 'Altro ruolo' },
]);

const PRESET_BY_VALUE = new Map(CREW_ROLE_PRESETS.map((role) => [role.value, role.label]));
const VALUE_BY_LABEL = new Map(CREW_ROLE_PRESETS
  .filter((role) => role.value !== 'other')
  .map((role) => [role.label.toLocaleLowerCase('it-IT'), role.value]));
const ENGLISH_PRESET_LABELS = Object.freeze({
  crew: 'Crew',
  co_skipper: 'Co-skipper',
  hostess: 'Hostess',
  collaborator: 'Crew support',
});

function currentLocale() {
  return window.EgadiI18n?.getLocale?.() === 'en' ? 'en' : 'it';
}

export function roleFromFields(fields, prefix, { allowEmpty = false } = {}) {
  const preset = String(fields.get(`${prefix}Preset`) || '');
  if (preset === 'other') {
    const customRole = String(fields.get(`${prefix}Other`) || '').trim();
    if (!customRole && !allowEmpty) throw new Error('Specifica il ruolo selezionato.');
    return customRole.slice(0, 100);
  }
  const label = PRESET_BY_VALUE.get(preset);
  if (label) return label;
  return allowEmpty ? '' : DEFAULT_CREW_ROLE;
}

export function fillRoleFields(form, prefix, role, { allowEmpty = false } = {}) {
  const normalizedRole = String(role || '').trim();
  const preset = VALUE_BY_LABEL.get(normalizedRole.toLocaleLowerCase('it-IT'));
  const presetField = form.elements.namedItem(`${prefix}Preset`);
  const customField = form.elements.namedItem(`${prefix}Other`);
  if (!presetField || !customField) return;

  if (!normalizedRole && allowEmpty) {
    presetField.value = '';
    customField.value = '';
    return;
  }
  presetField.value = preset || 'other';
  customField.value = preset ? '' : normalizedRole;
}

export function roleConfirmationText(member) {
  const storedRole = String(member?.role || '').trim() || DEFAULT_CREW_ROLE;
  const preset = VALUE_BY_LABEL.get(storedRole.toLocaleLowerCase('it-IT'));
  const role = currentLocale() === 'en' && preset
    ? (ENGLISH_PRESET_LABELS[preset] || storedRole)
    : storedRole;
  if (currentLocale() === 'en') {
    return member?.roleConfirmed === true
      ? `${role} · confirmed by the skipper`
      : `${role} · to be confirmed by the skipper`;
  }
  return member?.roleConfirmed === true
    ? `${role} · confermato dallo skipper`
    : `${role} · da confermare dallo skipper`;
}
