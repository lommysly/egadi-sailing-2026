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
  const role = String(member?.role || '').trim() || DEFAULT_CREW_ROLE;
  return member?.roleConfirmed === true
    ? `${role} · confermato dallo skipper`
    : `${role} · da confermare dallo skipper`;
}
