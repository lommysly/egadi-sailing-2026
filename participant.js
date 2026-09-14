import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
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
} from './crew-session.js?v=20260914-en2';
import { canUsePrivateArea, privateAreaBlockMessage } from './private-area-access.js?v=20260914-en2';
import { fillRoleFields, roleFromFields } from './crew-roles.js?v=20260914-en2';

const i18n = window.EgadiI18n;
const translate = (key, fallback, params) => {
  const translated = i18n?.t?.(key, params);
  return translated && translated !== key ? translated : fallback;
};
const activeLocale = () => i18n?.getLocale?.() === 'en' ? 'en' : 'it';
let activeInvite = null;
let activeMember = null;
let activatedPhone = '';
let activeBriefing = null;
let activeRuleAcceptance = null;
let stopBriefingSubscription = null;
let stopRuleAcceptanceSubscription = null;
let preRegistrationGateResolved = false;
const isEditMode = new URLSearchParams(window.location.search).get('edit') === '1';

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
  if (activeLocale() === 'en' && hasOfficialEnglishBriefing()) return activeBriefing.rulesTitleEn.trim();
  return activeBriefing?.rulesTitle || translate('crew.briefing.fullRules', 'Regolamento completo');
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
    : translate('crew.briefing.summaryFallback', 'Leggi integralmente il regolamento completo: questa sintesi non sostituisce il testo.');
}

function briefingRulesText() {
  if (activeLocale() === 'en' && hasOfficialEnglishBriefing()) return activeBriefing.rulesTextEn;
  return activeBriefing?.rulesText || '';
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
  document.querySelector('#preRegistrationFullRulesHint').textContent = translate('crew.flow.scrollToEnd', 'Scorri fino alla fine del regolamento per sbloccare la conferma.');
}

function updatePreRegistrationAcceptState() {
  const gate = document.querySelector('#preRegistrationBriefing');
  const acknowledgement = document.querySelector('#preRegistrationAcknowledgement');
  const acceptButton = document.querySelector('#preRegistrationAcceptButton');
  const fullRulesRead = gate.dataset.fullRulesRead === 'true';
  acknowledgement.disabled = !fullRulesRead;
  if (!fullRulesRead) acknowledgement.checked = false;
  acceptButton.disabled = !(hasPublishedBriefing() && !hasAcceptedCurrentBriefing() && fullRulesRead && acknowledgement.checked);
}

function markPreRegistrationRulesRead() {
  const gate = document.querySelector('#preRegistrationBriefing');
  const scrollRegion = document.querySelector('#preRegistrationRulesScroll');
  const acknowledgement = document.querySelector('#preRegistrationAcknowledgement');
  if (gate.dataset.fullRulesRead === 'true') return;
  gate.dataset.fullRulesRead = 'true';
  scrollRegion.classList.add('is-complete');
  document.querySelector('#preRegistrationFullRulesHint').textContent = translate('crew.flow.fullRulesSeen', 'Regolamento completo visualizzato. Ora puoi confermare la lettura.');
  updatePreRegistrationAcceptState();
  if (document.activeElement === scrollRegion) acknowledgement.focus();
}

function resetPreRegistrationRulesRead() {
  const gate = document.querySelector('#preRegistrationBriefing');
  const scrollRegion = document.querySelector('#preRegistrationRulesScroll');
  gate.dataset.fullRulesRead = '';
  scrollRegion.scrollTop = 0;
  scrollRegion.classList.remove('is-complete');
  document.querySelector('#preRegistrationFullRulesHint').textContent = translate('crew.flow.scrollToEnd', 'Scorri fino alla fine del regolamento per sbloccare la conferma.');
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
  activatedPhone = '';
  activeBriefing = null;
  activeRuleAcceptance = null;
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
  activatedPhone = '';
  activeBriefing = null;
  activeRuleAcceptance = null;
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

function showProfile({ invite, member, projection = null, phone = '' }) {
  activeInvite = invite;
  activeMember = member;
  activatedPhone = phone;
  stopPreRegistrationSubscriptions();
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = true;
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#profileSection').hidden = false;
  document.querySelector('#participantTitle').textContent = invite.displayName || translate('crew.flow.titleFallback', 'Dati per la Crew List');
  if (member) fillProfile(member);
  else fillProjectionProfileDefaults(projection);
  renderProjectionHint(projection);
  if (phone && !document.querySelector('#participantForm [name="phone"]').value) {
    document.querySelector('#participantForm [name="phone"]').value = phone;
  }
}

function fillProfile(member) {
  const form = document.querySelector('#participantForm');
  for (const [field, value] of Object.entries(member || {})) {
    const input = form.elements.namedItem(field);
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value || '';
  }
  fillRoleFields(form, 'role', member?.role);
}

async function openProfile({ invite, phone = '', redirectWhenCompleted = true }) {
  const [member, projection] = await Promise.all([
    getDoc(doc(db, 'boats', invite.boatId, 'members', invite.id)),
    readProjectionForInvite(invite),
  ]);
  if (member.exists() && redirectWhenCompleted) {
    window.location.replace(personalAreaUrl());
    return;
  }
  showProfile({ invite, member: member.exists() ? member.data() : null, projection, phone });
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
    document.querySelector('#preRegistrationRulesText').textContent = briefingRulesText();
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

  status.textContent = translate('crew.flow.readThenComplete', `Leggi la sintesi e l’intero regolamento, poi accetta la versione ${version}: solo dopo potrai inserire i dati nella Crew List.`, { version });
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

document.querySelector('#participantForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!canUsePrivateArea()) {
    showOpening(privateAreaBlockMessage(), true);
    return;
  }
  if (!activeInvite || !auth.currentUser) return;
  const form = event.currentTarget;
  const fields = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(document.querySelector('#participantFormMessage'), translate('crew.flow.savingDetails', 'Salvo i tuoi dati…'));
  try {
    if (!await hasCurrentBriefingAcceptance(activeInvite)) {
      setMessage(document.querySelector('#participantFormMessage'), translate('crew.flow.briefingUpdated', 'Il briefing è stato aggiornato: rileggilo e accettalo prima di comparire nella Crew List.'), true);
      openPreRegistrationBriefing({ invite: activeInvite, phone: activatedPhone });
      return;
    }
    const firstName = fields.get('firstName').trim();
    const lastName = fields.get('lastName').trim();
    const role = roleFromFields(fields, 'role');
    const roleChanged = role !== String(activeMember?.role || '').trim();
    await setDoc(doc(db, 'boats', activeInvite.boatId, 'members', activeInvite.id), {
      firstName, lastName, birthDate: fields.get('birthDate'), birthPlace: fields.get('birthPlace').trim(),
      nationality: fields.get('nationality').trim(), gender: fields.get('gender'), documentType: fields.get('documentType'),
      documentNumber: fields.get('documentNumber').trim(), documentExpiry: fields.get('documentExpiry'), role,
      roleConfirmed: roleChanged ? false : activeMember?.roleConfirmed === true,
      email: fields.get('email').trim().toLowerCase(), phone: fields.get('phone').trim() || activatedPhone, charterConsent: fields.get('charterConsent') === 'on',
      displayName: `${firstName} ${lastName}`, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid,
    }, { merge: true });
    setMessage(document.querySelector('#participantFormMessage'), translate('crew.flow.detailsSaved', 'Dati inviati con successo. Apro la tua area personale…'));
    window.setTimeout(() => window.location.replace(personalAreaUrl()), 900);
  } catch (error) {
    setMessage(document.querySelector('#participantFormMessage'), translate('crew.flow.detailsNotSaved', 'I dati non sono stati inviati. Controlla la connessione e riprova.'), true);
    submitButton.disabled = false;
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
    setMessage(document.querySelector('#preRegistrationMessage'), translate('crew.flow.confirmReadFirst', 'Scorri il regolamento completo e conferma di averlo letto prima di proseguire.'), true);
    return;
  }
  if (document.querySelector('#preRegistrationBriefing').dataset.fullRulesRead !== 'true') return;
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
    const batch = writeBatch(db);
    batch.set(doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id), acceptance, { merge: true });
    batch.create(doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id, 'history', `${rulesVersion}-${auth.currentUser.uid}`), acceptance);
    await batch.commit();
  } catch (error) {
    setMessage(document.querySelector('#preRegistrationMessage'), translate('crew.flow.cannotConfirmRules', 'Non riesco a confermare le regole. Riprova tra poco.'), true);
    button.disabled = false;
  }
});

if (isEditMode) {
  startCrewAreaSession({
    onOpening: showOpening,
    onInvalid: showInvalid,
    onReady: async ({ invite }) => {
      let member;
      let briefingAccepted = false;
      let projection = null;
      try {
        [member, briefingAccepted, projection] = await Promise.all([
          getDoc(doc(db, 'boats', invite.boatId, 'members', invite.id)),
          hasCurrentBriefingAcceptance(invite),
          readProjectionForInvite(invite),
        ]);
      } catch {
        openPreRegistrationBriefing({ invite, phone: '' });
        return;
      }
      if (!member.exists() || !briefingAccepted) {
        openPreRegistrationBriefing({ invite, phone: '' });
        return;
      }
      showProfile({ invite, member: member.data(), projection });
    },
  });
} else {
  startInviteActivation({
    onOpening: showOpening,
    onInvalid: showInvalid,
    onReady: showActivation,
  });
}
