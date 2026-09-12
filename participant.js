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
} from './crew-session.js?v=20260911-live';
import { canUsePrivateArea, privateAreaBlockMessage } from './private-area-access.js?v=20260911-live';
import { fillRoleFields, roleFromFields } from './crew-roles.js?v=20260911-role1';

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
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function hasPublishedBriefing() {
  return typeof activeBriefing?.rulesText === 'string' && activeBriefing.rulesText.trim().length > 0;
}

function currentBriefingVersion() {
  return Number.isInteger(activeBriefing?.rulesVersion) ? activeBriefing.rulesVersion : 1;
}

function hasAcceptedCurrentBriefing() {
  return activeRuleAcceptance?.rulesVersion === currentBriefingVersion()
    && activeRuleAcceptance?.acceptedBy === auth.currentUser?.uid;
}

function briefingSchedule() {
  return [
    ['Ritrovo', activeBriefing?.meetingPoint],
    ['Imbarco', formatDateTime(activeBriefing?.boardingAt)],
    ['Partenza', formatDateTime(activeBriefing?.departureAt)],
    ['Rientro', formatDateTime(activeBriefing?.returnAt)],
    ['Nota operativa', activeBriefing?.scheduleNote],
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
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#signInSection').hidden = false;
  setMessage(document.querySelector('#participantAuthMessage'), message, isError);
}

function showActivation() {
  stopPreRegistrationSubscriptions();
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#activationSection').hidden = false;
  document.querySelector('#activationForm [name="phone"]').focus();
}

function showInvalid() {
  stopPreRegistrationSubscriptions();
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#invalidLink').hidden = false;
}

function showProfile({ invite, member, phone = '' }) {
  activeInvite = invite;
  activeMember = member;
  activatedPhone = phone;
  stopPreRegistrationSubscriptions();
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = true;
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#profileSection').hidden = false;
  document.querySelector('#participantTitle').textContent = invite.displayName || 'Dati per la Crew List';
  if (member) fillProfile(member);
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
  const member = await getDoc(doc(db, 'boats', invite.boatId, 'members', invite.id));
  if (member.exists() && redirectWhenCompleted) {
    window.location.replace(personalAreaUrl());
    return;
  }
  showProfile({ invite, member: member.exists() ? member.data() : null, phone });
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
    acceptButton.disabled = true;
    gate.dataset.rulesVersion = '';
    status.textContent = 'Il briefing di sicurezza è obbligatorio prima di inserire i dati nella Crew List.';
    return;
  }

  waiting.hidden = true;
  content.hidden = false;
  renderSchedule();
  document.querySelector('#preRegistrationRulesTitle').textContent = activeBriefing.rulesTitle || 'Briefing di sicurezza';
  document.querySelector('#preRegistrationRulesText').textContent = activeBriefing.rulesText;
  const version = String(currentBriefingVersion());
  if (gate.dataset.rulesVersion !== version) {
    acknowledgement.checked = false;
    gate.dataset.rulesVersion = version;
  }

  if (hasAcceptedCurrentBriefing()) {
    preRegistrationGateResolved = true;
    acknowledgement.checked = false;
    acceptButton.disabled = true;
    setMessage(document.querySelector('#preRegistrationMessage'), 'Briefing confermato. Ora puoi completare la Crew List.');
    window.setTimeout(() => {
      openProfile({ invite: activeInvite, phone: activatedPhone, redirectWhenCompleted: false }).catch(() => {
        preRegistrationGateResolved = false;
        setMessage(document.querySelector('#preRegistrationMessage'), 'Non riesco ad aprire la Crew List. Riprova tra poco.', true);
      });
    }, 250);
    return;
  }

  status.textContent = `Leggi il briefing di sicurezza e accetta la versione ${version}: solo dopo potrai inserire i dati nella Crew List.`;
  acceptButton.disabled = !acknowledgement.checked;
}

function openPreRegistrationBriefing({ invite, phone }) {
  activeInvite = invite;
  activeMember = null;
  activatedPhone = phone;
  activeBriefing = null;
  activeRuleAcceptance = null;
  preRegistrationGateResolved = false;
  stopPreRegistrationSubscriptions();
  document.querySelector('#invalidLink').hidden = true;
  document.querySelector('#signInSection').hidden = true;
  document.querySelector('#activationSection').hidden = true;
  document.querySelector('#profileSection').hidden = true;
  document.querySelector('#preRegistrationBriefing').hidden = false;
  setMessage(document.querySelector('#preRegistrationMessage'), '');
  document.querySelector('#preRegistrationBriefingStatus').textContent = 'Carico il briefing della tua barca…';
  document.querySelector('#preRegistrationBriefingWaiting').hidden = true;
  document.querySelector('#preRegistrationBriefingContent').hidden = true;

  stopBriefingSubscription = onSnapshot(
    doc(db, 'boats', invite.boatId, 'briefing', 'board'),
    (snapshot) => {
      activeBriefing = snapshot.exists() ? snapshot.data() : null;
      renderPreRegistrationGate();
    },
    () => setMessage(document.querySelector('#preRegistrationMessage'), 'Non riesco a leggere il briefing di sicurezza. Riprova tra poco.', true),
  );
  stopRuleAcceptanceSubscription = onSnapshot(
    doc(db, 'boats', invite.boatId, 'ruleAcceptances', invite.id),
    (snapshot) => {
      activeRuleAcceptance = snapshot.exists() ? snapshot.data() : null;
      renderPreRegistrationGate();
    },
    () => setMessage(document.querySelector('#preRegistrationMessage'), 'Non riesco a leggere la conferma del briefing. Riprova tra poco.', true),
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
    && acceptance.rulesVersion === briefing.rulesVersion;
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
    setMessage(document.querySelector('#activationMessage'), 'I due codici non coincidono.', true);
    return;
  }
  submitButton.disabled = true;
  setMessage(document.querySelector('#activationMessage'), 'Attivo il tuo accesso personale…');
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
  setMessage(document.querySelector('#participantFormMessage'), 'Salvo i tuoi dati…');
  try {
    if (!activeMember && !await hasCurrentBriefingAcceptance(activeInvite)) {
      setMessage(document.querySelector('#participantFormMessage'), 'Il briefing è stato aggiornato: rileggilo e accettalo prima di comparire nella Crew List.', true);
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
    setMessage(document.querySelector('#participantFormMessage'), 'Dati inviati con successo. Apro la tua area personale…');
    window.setTimeout(() => window.location.replace(personalAreaUrl()), 900);
  } catch (error) {
    setMessage(document.querySelector('#participantFormMessage'), 'I dati non sono stati inviati. Controlla la connessione e riprova.', true);
    submitButton.disabled = false;
  }
});

document.querySelector('#preRegistrationAcknowledgement').addEventListener('change', (event) => {
  const canAccept = hasPublishedBriefing() && !hasAcceptedCurrentBriefing() && event.currentTarget.checked;
  document.querySelector('#preRegistrationAcceptButton').disabled = !canAccept;
});

document.querySelector('#preRegistrationAcceptButton').addEventListener('click', async () => {
  if (!hasPublishedBriefing() || !activeInvite || !auth.currentUser) return;
  if (!document.querySelector('#preRegistrationAcknowledgement').checked) {
    setMessage(document.querySelector('#preRegistrationMessage'), 'Conferma di aver letto briefing e regole prima di proseguire.', true);
    return;
  }
  const button = document.querySelector('#preRegistrationAcceptButton');
  button.disabled = true;
  setMessage(document.querySelector('#preRegistrationMessage'), 'Registro la conferma del briefing…');
  try {
    const rulesVersion = currentBriefingVersion();
    const acceptance = {
      inviteId: activeInvite.id,
      acceptedBy: auth.currentUser.uid,
      rulesVersion,
      acceptedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id), acceptance, { merge: true });
    batch.create(doc(db, 'boats', activeInvite.boatId, 'ruleAcceptances', activeInvite.id, 'history', `${rulesVersion}-${auth.currentUser.uid}`), acceptance);
    await batch.commit();
  } catch (error) {
    setMessage(document.querySelector('#preRegistrationMessage'), 'Non riesco a confermare le regole. Riprova tra poco.', true);
    button.disabled = false;
  }
});

if (isEditMode) {
  startCrewAreaSession({
    onOpening: showOpening,
    onInvalid: showInvalid,
    onReady: async ({ invite }) => {
      const member = await getDoc(doc(db, 'boats', invite.boatId, 'members', invite.id));
      if (!member.exists()) {
        openPreRegistrationBriefing({ invite, phone: '' });
        return;
      }
      showProfile({ invite, member: member.data() });
    },
  });
} else {
  startInviteActivation({
    onOpening: showOpening,
    onInvalid: showInvalid,
    onReady: showActivation,
  });
}
