import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {
  activateCrewInvite,
  auth,
  boatId,
  crewAccessErrorMessage,
  db,
  inviteId,
  personalAreaUrl,
  startCrewAreaSession,
  startInviteActivation,
  watchForStaleScript,
  withSaveRetry,
} from './crew-session.js?v=20260923-stale-check-v2';
import { canUsePrivateArea, privateAreaBlockMessage } from './private-area-access.js?v=20260919-live-privacy-v1';
import { fillRoleFields, roleFromFields } from './crew-roles.js?v=20260914-en2';
import { installInputNormalization, normalizeFormFields } from './input-normalization.js?v=20260915-input-format-v2';

watchForStaleScript(import.meta.url);

const i18n = window.EgadiI18n;
const translate = (key, fallback, params) => {
  const translated = i18n?.t?.(key, params);
  return translated && translated !== key ? translated : fallback;
};
const activeLocale = () => i18n?.getLocale?.() === 'en' ? 'en' : 'it';
let activeInvite = null;
let activeMember = null;
let activeCrewDraft = null;
let activatedPhone = '';
let activeBriefing = null;
let activeRuleAcceptance = null;
let pendingParticipantProfile = null;
let stopBriefingSubscription = null;
let stopRuleAcceptanceSubscription = null;
let preRegistrationGateResolved = false;
const isEditMode = new URLSearchParams(window.location.search).get('edit') === '1';

installInputNormalization();

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(activeLocale() === 'en' ? 'en-GB' : 'it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function hasItalianBriefing() {
  return typeof activeBriefing?.rulesText === 'string' && activeBriefing.rulesText.trim().length > 0;
}

function hasOfficialEnglishBriefing() {
  return typeof activeBriefing?.rulesTitleEn === 'string' && activeBriefing.rulesTitleEn.trim().length > 0
    && typeof activeBriefing?.rulesSummaryEn === 'string' && activeBriefing.rulesSummaryEn.trim().length > 0
    && typeof activeBriefing?.rulesTextEn === 'string' && activeBriefing.rulesTextEn.trim().length > 0
    && typeof activeBriefing?.scheduleNoteEn === 'string';
}

function hasPublishedBriefing() {
  return hasItalianBriefing() && (activeLocale() !== 'en' || hasOfficialEnglishBriefing());
}

function briefingTitle() {
  return translate('crew.briefing.fullRules', 'Regolamento di bordo');
}

function briefingRequiresFullRulesRead() {
  return activeBriefing?.fullRulesRequired === true;
}

function briefingSummary() {
  const summary = activeLocale() === 'en' && hasOfficialEnglishBriefing()
    ? activeBriefing.rulesSummaryEn
    : activeBriefing?.rulesSummary;
  return typeof summary === 'string' && summary.trim()
    ? summary.trim()
    : translate('crew.briefing.summaryFallback', 'La sintesi ti orienta: leggi tutto il regolamento di bordo prima di confermare.');
}

function briefingRulesText() {
  if (activeLocale() === 'en' && hasOfficialEnglishBriefing()) return activeBriefing.rulesTextEn;
  return activeBriefing?.rulesText || '';
}

function compactRulesLine(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isRulesSectionHeading(line, index, lines) {
  const compact = compactRulesLine(line);
  if (!compact || compact.length > 140 || /^[•\-–—*]\s+/.test(compact)) return false;
  if (/^(?:#{1,6}\s+|\d{1,2}[.)]\s+|[ivxlcdm]{1,7}[.)]\s+)/i.test(compact)) return true;
  if (/[A-ZÀ-ÖØ-Þ]/.test(compact) && compact.length <= 110 && compact === compact.toUpperCase()) return true;
  if (/^(?:premessa|introduzione|introduction|overview|notice|avvertenza|avvertenze)$/i.test(compact)) return true;
  const previousBlank = index === 0 || !compactRulesLine(lines[index - 1]);
  const nextLine = lines.slice(index + 1).map(compactRulesLine).find(Boolean);
  return previousBlank
    && Boolean(nextLine)
    && compact.length <= 96
    && !/[.!?;:]$/.test(compact)
    && nextLine.length >= compact.length;
}

function splitRulesIntoSections(value) {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  let current = null;
  let paragraphLines = [];
  const flushParagraph = () => {
    const paragraph = paragraphLines.map((line) => line.trim()).filter(Boolean).join('\n');
    paragraphLines = [];
    if (!paragraph) return;
    if (!current) current = { heading: '', paragraphs: [] };
    current.paragraphs.push(paragraph);
  };
  const flushSection = () => {
    flushParagraph();
    if (current?.heading || current?.paragraphs.length) sections.push(current);
    current = null;
  };

  lines.forEach((line, index) => {
    if (!compactRulesLine(line)) {
      flushParagraph();
      return;
    }
    if (isRulesSectionHeading(line, index, lines)) {
      flushSection();
      current = { heading: compactRulesLine(line), paragraphs: [] };
      return;
    }
    paragraphLines.push(line);
  });
  flushSection();
  return sections;
}

function rulesSectionCategory(section) {
  const heading = String(section.heading || '').toLowerCase();
  const fullText = `${heading} ${section.paragraphs.join(' ')}`.toLowerCase();
  const environment = /ambient|rifiut|fumo|mozzicon|mare|marin[oa]|environment|waste|smok/;
  const route = /skipper|naviga|rotta|rada|porto|tender|uscit|orari|route|navigation|anchorage|harbou?r|timings|schedule/;
  const life = /vita comune|rispetto|cabine|cambusa|cucina|salute|comportamento|preparazione|personale|spesa|costi|life on board|respect|cabins|galley|health|behavio[u]?r|preparation|cost/;
  const safety = /sicurezz|emergen|giubbot|life ?line|zattera|estintor|cadut|boma|dotazion|gas|safety|emergen|lifejacket|liferaft|extinguisher|overboard|equipment/;
  if (environment.test(heading)) return 'environment';
  if (route.test(heading)) return 'route';
  if (life.test(heading)) return 'life';
  if (safety.test(heading)) return 'safety';
  if (environment.test(fullText)) return 'environment';
  if (route.test(fullText)) return 'route';
  if (safety.test(fullText)) return 'safety';
  return 'life';
}

function rulesSectionLabel(category) {
  const labels = activeLocale() === 'en'
    ? { route: 'Route & navigation', safety: 'Safety', life: 'Life on board', environment: 'Sea & environment' }
    : { route: 'Rotta e navigazione', safety: 'Sicurezza', life: 'Vita a bordo', environment: 'Mare e ambiente' };
  return labels[category] || labels.life;
}

function renderRulesSections(selector, value) {
  const target = document.querySelector(selector);
  if (!target) return;
  const sections = splitRulesIntoSections(value);
  const fragment = document.createDocumentFragment();
  sections.forEach((section, index) => {
    const isDocumentTitle = index === 0
      && section.paragraphs.length === 0
      && /regolamento|board rules/i.test(section.heading);
    const category = isDocumentTitle ? 'route' : rulesSectionCategory(section);
    const card = document.createElement('section');
    card.className = `rules-section-card rules-section-card--${category}${isDocumentTitle ? ' rules-section-card--document' : ''}`;
    const icon = document.createElement('span');
    icon.className = 'rules-section-icon';
    icon.setAttribute('aria-hidden', 'true');
    const content = document.createElement('div');
    content.className = 'rules-section-content';
    const label = document.createElement('p');
    label.className = 'rules-section-kicker';
    label.textContent = rulesSectionLabel(category);
    if (!isDocumentTitle) content.append(label);
    if (section.heading) {
      const heading = document.createElement('h4');
      heading.className = 'rules-section-heading';
      heading.id = `${target.id}-section-${index}`;
      heading.textContent = section.heading;
      card.setAttribute('aria-labelledby', heading.id);
      content.append(heading);
    } else {
      card.setAttribute('aria-label', rulesSectionLabel(category));
    }
    const copy = document.createElement('div');
    copy.className = 'rules-section-copy';
    section.paragraphs.forEach((paragraph) => {
      const item = document.createElement('p');
      item.textContent = paragraph;
      copy.append(item);
    });
    content.append(copy);
    card.append(icon, content);
    fragment.append(card);
  });
  target.replaceChildren(fragment);
}

function currentBriefingVersion() {
  return Number.isInteger(activeBriefing?.rulesVersion) ? activeBriefing.rulesVersion : 1;
}

function hasAcceptedCurrentBriefing() {
  return activeRuleAcceptance?.rulesVersion === currentBriefingVersion()
    && activeRuleAcceptance?.acceptedBy === auth.currentUser?.uid
    && (!briefingRequiresFullRulesRead() || activeRuleAcceptance?.fullRulesRead === true);
}

function hasReachedEnd(element) {
  return element.clientHeight > 0 && element.scrollHeight - element.scrollTop - element.clientHeight <= 8;
}

function isEntireRulesTextVisible(element) {
  return element.clientHeight > 0 && element.scrollHeight <= element.clientHeight + 8;
}

function clearPreRegistrationRulesGate() {
  const gate = document.querySelector('#preRegistrationBriefing');
  const scrollRegion = document.querySelector('#preRegistrationRulesScroll');
  gate.dataset.rulesContext = '';
  gate.dataset.rulesVersion = '';
  gate.dataset.fullRulesRead = '';
  scrollRegion.scrollTop = 0;
  scrollRegion.classList.remove('is-complete');
  document.querySelector('#preRegistrationAcknowledgement').checked = false;
  document.querySelector('#preRegistrationAcknowledgement').disabled = true;
  document.querySelector('#preRegistrationAcceptButton').disabled = true;
  document.querySelector('#preRegistrationFullRulesHint').textContent = translate('crew.flow.scrollToEnd', 'Leggi il regolamento completo. Quando hai finito, seleziona qui sotto la dichiarazione di lettura.');
}

function updatePreRegistrationAcceptState() {
  const acknowledgement = document.querySelector('#preRegistrationAcknowledgement');
  const acceptButton = document.querySelector('#preRegistrationAcceptButton');
  const canConfirm = hasPublishedBriefing() && !hasAcceptedCurrentBriefing();
  acknowledgement.disabled = !canConfirm;
  if (!canConfirm) acknowledgement.checked = false;
  acceptButton.disabled = !(canConfirm && acknowledgement.checked);
}

function markPreRegistrationRulesRead() {
  const gate = document.querySelector('#preRegistrationBriefing');
  const scrollRegion = document.querySelector('#preRegistrationRulesScroll');
  const acknowledgement = document.querySelector('#preRegistrationAcknowledgement');
  if (gate.dataset.fullRulesRead === 'true') return;
  gate.dataset.fullRulesRead = 'true';
  scrollRegion.classList.add('is-complete');
  document.querySelector('#preRegistrationFullRulesHint').textContent = translate('crew.flow.fullRulesSeen', 'Regolamento di bordo visualizzato. Se lo hai letto, puoi confermare la dichiarazione.');
  updatePreRegistrationAcceptState();
  if (document.activeElement === scrollRegion) acknowledgement.focus();
}

function resetPreRegistrationRulesRead() {
  const gate = document.querySelector('#preRegistrationBriefing');
  const scrollRegion = document.querySelector('#preRegistrationRulesScroll');
  gate.dataset.fullRulesRead = '';
  scrollRegion.scrollTop = 0;
  scrollRegion.classList.remove('is-complete');
  document.querySelector('#preRegistrationFullRulesHint').textContent = translate('crew.flow.scrollToEnd', 'Leggi il regolamento completo. Quando hai finito, seleziona qui sotto la dichiarazione di lettura.');
  updatePreRegistrationAcceptState();
  requestAnimationFrame(() => {
    if (isEntireRulesTextVisible(scrollRegion)) markPreRegistrationRulesRead();
  });
}

function briefingSchedule() {
  const englishScheduleNote = activeLocale() === 'en' && hasOfficialEnglishBriefing()
    ? activeBriefing?.scheduleNoteEn
    : activeBriefing?.scheduleNote;
  return [
    [translate('crew.schedule.meeting', 'Ritrovo'), activeBriefing?.meetingPoint],
    [translate('crew.schedule.boarding', 'Imbarco'), formatDateTime(activeBriefing?.boardingAt)],
    [translate('crew.schedule.departure', 'Partenza'), formatDateTime(activeBriefing?.departureAt)],
    [translate('crew.schedule.return', 'Rientro'), formatDateTime(activeBriefing?.returnAt)],
    [translate('crew.schedule.note', 'Nota operativa'), englishScheduleNote],
  ].filter(([, value]) => value);
}

function renderSchedule() {
  const target = document.querySelector('#preRegistrationSchedule');
  target.replaceChildren(...briefingSchedule().map(([label, value]) => {
    const item = document.createElement('div');
    const heading = document.createElement('span');
    const detail = document.createElement('strong');
    heading.textContent = label;
    detail.textContent = value;
    item.append(heading, detail);
    return item;
  }));
}

function stopPreRegistrationSubscriptions() {
  stopBriefingSubscription?.();
  stopRuleAcceptanceSubscription?.();
  stopBriefingSubscription = null;
  stopRuleAcceptanceSubscription = null;
}

function showOpening(message = '', isError = false) {
  stopPreRegistrationSubscriptions();
  activeInvite = null;
  activeMember = null;
  activeCrewDraft = null;
  activatedPhone = '';
  activeBriefing = null;
  activeRuleAcceptance = null;
  pendingParticipantProfile = null;
  preRegistrationGateResolved = false;
  clearPreRegistrationRulesGate();
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#signInSection').hidden = false;
  setMessage(document.querySelector('#participantAuthMessage'), message, isError);
}

function showActivation() {
  stopPreRegistrationSubscriptions();
  activeCrewDraft = null;
  pendingParticipantProfile = null;
  activeBriefing = null;
  activeRuleAcceptance = null;
  preRegistrationGateResolved = false;
  clearPreRegistrationRulesGate();
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#activationSection').hidden = false;
  document.querySelector('#activationForm [name="phone"]').focus();
}

function showInvalid() {
  stopPreRegistrationSubscriptions();
  activeInvite = null;
  activeMember = null;
  activeCrewDraft = null;
  activatedPhone = '';
  activeBriefing = null;
  activeRuleAcceptance = null;
  pendingParticipantProfile = null;
  preRegistrationGateResolved = false;
  clearPreRegistrationRulesGate();
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#invalidLink').hidden = false;
}

function projectionBerthLabel(projection) {
  const labels = {
    double_cabin: activeLocale() === 'en' ? 'double cabin' : 'cabina doppia',
    single_cabin: activeLocale() === 'en' ? 'single cabin' : 'cabina singola',
    dinette: 'dinette',
    other: activeLocale() === 'en' ? 'other accommodation' : 'altra sistemazione',
  };
  return labels[projection?.berthType] || '';
}

function renderProjectionHint(projection) {
  const hint = document.querySelector('#participantProjectionHint');
  if (!hint) return;
  const role = String(projection?.plannedRole || '').trim();
  const berth = projectionBerthLabel(projection);
  if (!role && !berth) {
    hint.hidden = true;
    hint.textContent = '';
    return;
  }
  const details = [
    role ? (activeLocale() === 'en' ? `role proposed: ${role}` : `ruolo proposto: ${role}`) : '',
    berth ? (activeLocale() === 'en' ? `accommodation proposed: ${berth}` : `sistemazione prevista: ${berth}`) : '',
  ].filter(Boolean).join(' · ');
  hint.textContent = activeLocale() === 'en'
    ? `Your skipper has prepared this plan for you — ${details}. It is a proposal: verify your personal details before submitting the Crew List.`
    : `Lo skipper ha preparato questa previsione per te — ${details}. È una proposta: verifica i tuoi dati personali prima di inviare la Crew List.`;
  hint.hidden = false;
}

function fillProjectionProfileDefaults(projection) {
  if (!projection) return;
  const form = document.querySelector('#participantForm');
  const fillIfEmpty = (fieldName, value) => {
    const input = form.elements.namedItem(fieldName);
    if (input && !input.value && typeof value === 'string' && value.trim()) input.value = value.trim();
  };
  fillIfEmpty('firstName', projection.firstName);
  fillIfEmpty('lastName', projection.lastName);
  fillIfEmpty('phone', projection.whatsappNumber);
  if (typeof projection.plannedRole === 'string' && projection.plannedRole.trim()) {
    fillRoleFields(form, 'role', projection.plannedRole);
  }
}

async function readProjectionForInvite(invite) {
  if (!invite?.boatId || !invite?.id) return null;
  try {
    const snapshot = await getDoc(doc(db, 'boats', invite.boatId, 'crewProjections', invite.id));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch {
    // Gli inviti precedenti e le Rules non ancora aggiornate restano pienamente utilizzabili.
    return null;
  }
}

async function readCrewDraftForInvite(invite) {
  if (!invite?.boatId || !invite?.id) return null;
  try {
    const snapshot = await getDoc(doc(db, 'boats', invite.boatId, 'crewDrafts', invite.id));
    return snapshot.exists() ? snapshot.data() : null;
  } catch {
    // Fino al deploy delle nuove Rules, un invito esistente resta comunque utilizzabile.
    return null;
  }
}

function renderDraftHint(draft) {
  const hint = document.querySelector('#participantDraftHint');
  if (!hint) return;
  hint.hidden = !draft;
  hint.textContent = draft
    ? translate('page.participant.draftLoadedHint', 'Hai una bozza privata in corso. Completa i dati quando hai tutto: finché non confermi, non compare nella Crew List e non entra nel PDF del charter.')
    : '';
}

function showProfile({ invite, member, draft = null, projection = null, phone = '' }) {
  activeInvite = invite;
  activeMember = member;
  activeCrewDraft = draft;
  activatedPhone = phone;
  stopPreRegistrationSubscriptions();
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = true;
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#profileSection').hidden = false;
  document.querySelector('#participantTitle').textContent = invite.displayName || translate('crew.flow.titleFallback', 'Dati per la Crew List');
  const form = document.querySelector('#participantForm');
  form.reset();
  if (draft) fillProfile(draft, { allowEmptyRole: true });
  else if (member) fillProfile(member);
  fillProjectionProfileDefaults(projection);
  if (pendingParticipantProfile) {
    fillProfile(pendingParticipantProfile, { allowEmptyRole: true });
    pendingParticipantProfile = null;
  }
  renderProjectionHint(projection);
  renderDraftHint(draft);
  setMessage(document.querySelector('#participantFormMessage'), '');
  if (phone && !form.elements.namedItem('phone').value) {
    form.elements.namedItem('phone').value = phone;
  }
}

function fillProfile(member, { allowEmptyRole = false } = {}) {
  const form = document.querySelector('#participantForm');
  for (const [field, value] of Object.entries(member || {})) {
    const input = form.elements.namedItem(field);
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value || '';
  }
  fillRoleFields(form, 'role', member?.role, { allowEmpty: allowEmptyRole });
}

async function openProfile({ invite, phone = '', redirectWhenCompleted = true }) {
  const [member, draft, projection] = await Promise.all([
    getDoc(doc(db, 'boats', invite.boatId, 'members', invite.id)),
    readCrewDraftForInvite(invite),
    readProjectionForInvite(invite),
  ]);
  if (member.exists() && !draft && redirectWhenCompleted) {
    window.location.replace(personalAreaUrl());
    return;
  }
  showProfile({ invite, member: member.exists() ? member.data() : null, draft, projection, phone });
}

function renderPreRegistrationGate() {
  if (!activeInvite || !auth.currentUser || preRegistrationGateResolved) return;
  const gate = document.querySelector('#preRegistrationBriefing');
  const content = document.querySelector('#preRegistrationBriefingContent');
  const waiting = document.querySelector('#preRegistrationBriefingWaiting');
  const status = document.querySelector('#preRegistrationBriefingStatus');
  const acknowledgement = document.querySelector('#preRegistrationAcknowledgement');
  const acceptButton = document.querySelector('#preRegistrationAcceptButton');

  gate.hidden = false;
  if (!hasPublishedBriefing()) {
    content.hidden = true;
    waiting.hidden = false;
    acknowledgement.checked = false;
    acknowledgement.disabled = true;
    acceptButton.disabled = true;
    gate.dataset.rulesContext = '';
    gate.dataset.rulesVersion = '';
    gate.dataset.fullRulesRead = '';
    if (hasItalianBriefing() && activeLocale() === 'en') {
      waiting.textContent = translate('crew.flow.officialEnglishWaiting', 'The skipper has not yet published the official English version of the safety briefing. Please ask for it before accepting the rules in English.');
      status.textContent = translate('crew.flow.officialEnglishRequired', 'An official English safety briefing is required before you can continue in English.');
    } else {
      waiting.textContent = translate('crew.flow.briefingWaiting', 'Lo skipper deve ancora pubblicare il briefing di sicurezza e le regole di bordo. Quando saranno pubblicati, potrai leggerli e accettarli qui prima di inserire i tuoi dati nella Crew List.');
      status.textContent = translate('crew.briefing.required', 'Il briefing di sicurezza è obbligatorio prima di inserire i dati nella Crew List.');
    }
    return;
  }

  waiting.hidden = true;
  content.hidden = false;
  renderSchedule();
  const version = String(currentBriefingVersion());
  const rulesContext = `${activeInvite.boatId}:${activeInvite.id}:${version}:${activeLocale()}`;
  if (gate.dataset.rulesContext !== rulesContext) {
    document.querySelector('#preRegistrationRulesTitle').textContent = briefingTitle();
    document.querySelector('#preRegistrationRulesSummary').textContent = briefingSummary();
    renderRulesSections('#preRegistrationRulesText', briefingRulesText());
    gate.dataset.rulesContext = rulesContext;
    gate.dataset.rulesVersion = version;
    resetPreRegistrationRulesRead();
  }

  if (hasAcceptedCurrentBriefing()) {
    preRegistrationGateResolved = true;
    acknowledgement.checked = false;
    acceptButton.disabled = true;
    setMessage(document.querySelector('#preRegistrationMessage'), translate('crew.briefing.confirmed', 'Briefing confermato. Ora puoi completare la Crew List.'));
    window.setTimeout(() => {
      openProfile({ invite: activeInvite, phone: activatedPhone, redirectWhenCompleted: false }).catch(() => {
        preRegistrationGateResolved = false;
        setMessage(document.querySelector('#preRegistrationMessage'), translate('crew.flow.cannotOpenCrewList', 'Non riesco ad aprire la Crew List. Riprova tra poco.'), true);
      });
    }, 250);
    return;
  }

  status.textContent = translate('crew.flow.readThenComplete', 'Leggi la sintesi e il regolamento di bordo completo. Poi potrai inserire i dati nella Crew List.');
  updatePreRegistrationAcceptState();
}

function openPreRegistrationBriefing({ invite, phone }) {
  activeInvite = invite;
  activeMember = null;
  activatedPhone = phone;
  activeBriefing = null;
  activeRuleAcceptance = null;
  preRegistrationGateResolved = false;
  stopPreRegistrationSubscriptions();
  clearPreRegistrationRulesGate();
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = false;
  setMessage(document.querySelector('#preRegistrationMessage'), '');
  document.querySelector('#preRegistrationBriefingStatus').textContent = translate('crew.flow.loadingBriefing', 'Carico il briefing della tua barca…');
  document.querySelector('#preRegistrationBriefingWaiting').hidden = true;
  document.querySelector('#preRegistrationBriefingContent').hidden = true;

  stopBriefingSubscription = onSnapshot(
    doc(db, 'boats', invite.boatId, 'briefing', 'board'),
    (snapshot) => {
      activeBriefing = snapshot.exists() ? snapshot.data() : null;
      renderPreRegistrationGate();
    },
    () => {
      document.querySelector('#preRegistrationBriefingContent').hidden = true;
      document.querySelector('#preRegistrationBriefingWaiting').hidden = false;
      document.querySelector('#preRegistrationBriefingStatus').textContent = translate('crew.flow.briefingUnavailable', 'Briefing non disponibile. Controlla la connessione e ricarica la pagina.');
      setMessage(document.querySelector('#preRegistrationMessage'), translate('crew.flow.cannotReadBriefing', 'Non riesco a leggere il briefing di sicurezza. Riprova tra poco.'), true);
    },
  );
  stopRuleAcceptanceSubscription = onSnapshot(
    doc(db, 'boats', invite.boatId, 'ruleAcceptances', invite.id),
    (snapshot) => {
      activeRuleAcceptance = snapshot.exists() ? snapshot.data() : null;
      renderPreRegistrationGate();
    },
    () => {
      document.querySelector('#preRegistrationBriefingContent').hidden = true;
      document.querySelector('#preRegistrationBriefingWaiting').hidden = false;
      document.querySelector('#preRegistrationBriefingStatus').textContent = translate('crew.flow.acceptanceUnavailable', 'Conferma non disponibile. Controlla la connessione e ricarica la pagina.');
      setMessage(document.querySelector('#preRegistrationMessage'), translate('crew.flow.cannotReadAcceptance', 'Non riesco a leggere la conferma del briefing. Riprova tra poco.'), true);
    },
  );
}

async function hasCurrentBriefingAcceptance(invite) {
  const [briefingSnapshot, acceptanceSnapshot] = await Promise.all([
    getDoc(doc(db, 'boats', invite.boatId, 'briefing', 'board')),
    getDoc(doc(db, 'boats', invite.boatId, 'ruleAcceptances', invite.id)),
  ]);
  if (!briefingSnapshot.exists() || !acceptanceSnapshot.exists()) return false;
  const briefing = briefingSnapshot.data();
  const acceptance = acceptanceSnapshot.data();
  return typeof briefing.rulesText === 'string'
    && briefing.rulesText.trim().length > 0
    && Number.isInteger(briefing.rulesVersion)
    && acceptance.inviteId === invite.id
    && acceptance.acceptedBy === auth.currentUser?.uid
    && acceptance.rulesVersion === briefing.rulesVersion
    && (briefing.fullRulesRequired !== true || acceptance.fullRulesRead === true);
}

document.querySelector('#activationForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = new FormData(form);
  const phone = fields.get('phone').trim();
  const pin = fields.get('pin').trim();
  const pinConfirmation = fields.get('pinConfirmation').trim();
  const submitButton = form.querySelector('button[type="submit"]');
  if (pin !== pinConfirmation) {
    setMessage(document.querySelector('#activationMessage'), translate('crew.flow.pinMismatch', 'I due codici non coincidono.'), true);
    return;
  }
  submitButton.disabled = true;
  setMessage(document.querySelector('#activationMessage'), translate('crew.flow.activatingAccess', 'Attivo il tuo accesso personale…'));
  try {
    const session = await activateCrewInvite({ phone, pin });
    openPreRegistrationBriefing({ invite: session.invite, phone });
  } catch (error) {
    setMessage(document.querySelector('#activationMessage'), crewAccessErrorMessage(error, { activation: true }), true);
  } finally {
    submitButton.disabled = false;
  }
});

function profilePayloadFromFields(fields, { allowEmptyRole = false } = {}) {
  const firstName = String(fields.get('firstName') || '').trim();
  const lastName = String(fields.get('lastName') || '').trim();
  return {
    firstName,
    lastName,
    birthDate: String(fields.get('birthDate') || ''),
    birthPlace: String(fields.get('birthPlace') || '').trim(),
    nationality: String(fields.get('nationality') || '').trim(),
    gender: String(fields.get('gender') || ''),
    documentType: String(fields.get('documentType') || ''),
    documentNumber: String(fields.get('documentNumber') || '').trim(),
    documentExpiry: String(fields.get('documentExpiry') || ''),
    role: roleFromFields(fields, 'role', { allowEmpty: allowEmptyRole }),
    email: String(fields.get('email') || '').trim().toLowerCase(),
    phone: String(fields.get('phone') || '').trim() || activatedPhone,
    charterConsent: fields.get('charterConsent') === 'on',
    displayName: [firstName, lastName].filter(Boolean).join(' '),
  };
}

document.querySelector('#participantForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!canUsePrivateArea()) {
    showOpening(privateAreaBlockMessage(), true);
    return;
  }
  if (!activeInvite || !auth.currentUser) return;
  const form = event.currentTarget;
  normalizeFormFields(form);
  const fields = new FormData(form);
  const isDraft = event.submitter?.dataset.participantSave === 'draft';
  const saveButtons = [...form.querySelectorAll('[data-participant-save]')];
  let keepButtonsDisabled = false;
  saveButtons.forEach((button) => { button.disabled = true; });
  setMessage(
    document.querySelector('#participantFormMessage'),
    isDraft
      ? translate('crew.flow.savingDraft', 'Salvo la tua bozza privata…')
      : translate('crew.flow.savingDetails', 'Salvo i tuoi dati…'),
  );
  try {
    const profile = profilePayloadFromFields(fields, { allowEmptyRole: isDraft });
    if (!await hasCurrentBriefingAcceptance(activeInvite)) {
      pendingParticipantProfile = profile;
      setMessage(document.querySelector('#participantFormMessage'), translate('crew.flow.briefingUpdated', 'Il briefing è stato aggiornato: rileggilo e accettalo prima di salvare i dati.'), true);
      openPreRegistrationBriefing({ invite: activeInvite, phone: activatedPhone });
      return;
    }
    const draftRef = doc(db, 'boats', activeInvite.boatId, 'crewDrafts', activeInvite.id);
    const verifyingMessage = () => setMessage(document.querySelector('#participantFormMessage'), translate('crew.flow.verifying', 'Connessione lenta — verifico se è stato comunque salvato…'));
    if (isDraft) {
      await withSaveRetry(() => setDoc(draftRef, {
        ...profile,
        // La bozza resta legata alla persona e alla versione dell'invito che
        // l'ha creata: una riemissione sullo stesso ID non può esporla a un
        // nuovo destinatario.
        participantUid: auth.currentUser.uid,
        accessVersion: Number.isInteger(activeInvite.accessVersion) ? activeInvite.accessVersion : 0,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      }), verifyingMessage);
      activeCrewDraft = profile;
      pendingParticipantProfile = null;
      renderDraftHint(activeCrewDraft);
      setMessage(document.querySelector('#participantFormMessage'), translate('crew.flow.draftSaved', 'Bozza salvata nella tua area privata. Non è ancora nella Crew List e non entra nel PDF del charter.'));
      return;
    }

    const roleChanged = profile.role !== String(activeMember?.role || '').trim();
    // Un batch già "committed" non è più riutilizzabile: se un tentativo
    // fallisce se ne crea uno nuovo identico ad ogni riprova, invece di
    // richiamare commit() sullo stesso oggetto.
    await withSaveRetry(() => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'boats', activeInvite.boatId, 'members', activeInvite.id), {
        ...profile,
        roleConfirmed: roleChanged ? false : activeMember?.roleConfirmed === true,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      }, { merge: true });
      if (activeCrewDraft) batch.delete(draftRef);
      return batch.commit();
    }, verifyingMessage);
    activeCrewDraft = null;
    pendingParticipantProfile = null;
    renderDraftHint(null);
    setMessage(document.querySelector('#participantFormMessage'), translate('crew.flow.detailsSaved', 'Dati inviati con successo. Apro la tua area personale…'));
    keepButtonsDisabled = true;
    window.setTimeout(() => window.location.replace(personalAreaUrl()), 900);
  } catch (error) {
    setMessage(
      document.querySelector('#participantFormMessage'),
      isDraft
        ? translate('crew.flow.draftNotSaved', 'La bozza non è stata salvata. Controlla la connessione e riprova.')
        : translate('crew.flow.detailsNotSaved', 'I dati non sono stati inviati. Controlla la connessione e riprova.'),
      true,
    );
  } finally {
    if (!keepButtonsDisabled) saveButtons.forEach((button) => { button.disabled = false; });
  }
});

document.querySelector('#preRegistrationAcknowledgement').addEventListener('change', (event) => {
  if (!event.currentTarget.disabled) updatePreRegistrationAcceptState();
});

document.querySelector('#preRegistrationRulesScroll').addEventListener('scroll', (event) => {
  if (hasPublishedBriefing() && hasReachedEnd(event.currentTarget)) markPreRegistrationRulesRead();
});

if ('ResizeObserver' in window) {
  new ResizeObserver(() => {
    const scrollRegion = document.querySelector('#preRegistrationRulesScroll');
    if (hasPublishedBriefing() && scrollRegion && isEntireRulesTextVisible(scrollRegion)) markPreRegistrationRulesRead();
  }).observe(document.querySelector('#preRegistrationRulesScroll'));
}

document.querySelector('#preRegistrationBriefingStatus').setAttribute('role', 'status');
document.querySelector('#preRegistrationBriefingStatus').setAttribute('aria-live', 'polite');

document.querySelector('#preRegistrationAcceptButton').addEventListener('click', async () => {
  if (!hasPublishedBriefing() || !activeInvite || !auth.currentUser) return;
  if (!document.querySelector('#preRegistrationAcknowledgement').checked) {
    setMessage(document.querySelector('#preRegistrationMessage'), translate('crew.flow.confirmReadFirst', 'Conferma di aver letto il regolamento di bordo prima di proseguire.'), true);
    return;
  }
  const button = document.querySelector('#preRegistrationAcceptButton');
  button.disabled = true;
  setMessage(document.querySelector('#preRegistrationMessage'), translate('crew.flow.recordingAcceptance', 'Registro la conferma del briefing…'));
  try {
    const rulesVersion = currentBriefingVersion();
    const acceptance = {
      inviteId: activeInvite.id,
      acceptedBy: auth.currentUser.uid,
      rulesVersion,
      ...(briefingRequiresFullRulesRead() ? { fullRulesRead: true } : {}),
      acceptedLocale: activeLocale(),
      acceptedAt: serverTimestamp(),
    };
    const acceptanceRef = doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id);
    const historyRef = doc(acceptanceRef, 'history', `${rulesVersion}-${auth.currentUser.uid}`);
    await runTransaction(db, async (transaction) => {
      const historySnapshot = await transaction.get(historyRef);
      // La conferma corrente deve essere sempre nel formato canonico: un record
      // precedente non può conservare campi legacy che le regole non accettano.
      transaction.set(acceptanceRef, acceptance);
      // Lo storico è immutabile. Se il browser sta riprendendo un tentativo già
      // registrato, riusiamo quella traccia senza far fallire la transazione.
      if (!historySnapshot.exists()) transaction.set(historyRef, acceptance);
    });
  } catch (error) {
    console.error('Impossibile salvare la conferma del briefing.', error);
    setMessage(document.querySelector('#preRegistrationMessage'), translate('crew.flow.cannotConfirmRules', 'Non riesco a confermare le regole. Riprova tra poco.'), true);
    button.disabled = false;
  }
});

if (isEditMode) {
  startCrewAreaSession({
    onOpening: showOpening,
    onInvalid: showInvalid,
    onReady: async ({ invite }) => {
      let briefingAccepted = false;
      try {
        briefingAccepted = await hasCurrentBriefingAcceptance(invite);
      } catch {
        openPreRegistrationBriefing({ invite, phone: '' });
        return;
      }
      if (!briefingAccepted) {
        openPreRegistrationBriefing({ invite, phone: '' });
        return;
      }
      openProfile({ invite, phone: '', redirectWhenCompleted: false }).catch(() => {
        openPreRegistrationBriefing({ invite, phone: '' });
      });
    },
  });
} else {
  startInviteActivation({
    onOpening: showOpening,
    onInvalid: showInvalid,
    onReady: showActivation,
  });
}
