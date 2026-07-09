// ============================================================================
// app.js — Clinic Management System
// Vanilla ES6+, Firebase v10 modular SDK. One file, organized by section:
//   1. Imports & shared state
//   2. Small utilities (toast, date helpers, validation)
//   3. Auth (phone OTP) + role routing
//   4. Patient portal
//   5. Compounder portal
//   6. Doctor portal
//   7. Boot
// ============================================================================

import { db, auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut }
  from "./firebase-config.js";
import {
  doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, orderBy, limit,
  onSnapshot, runTransaction, serverTimestamp, Timestamp, getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ----------------------------------------------------------------------------
// 1. Shared state
// ----------------------------------------------------------------------------
const state = {
  user: null,          // Firebase Auth user
  profile: null,       // { role, name, phone } from users/{uid}
  confirmationResult: null, // holds pending phone-auth confirmation
  settings: null,       // clinic_settings/global
  unsubscribers: [],    // active onSnapshot listeners to tear down on logout
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDaysStr = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// ----------------------------------------------------------------------------
// 2. Utilities
// ----------------------------------------------------------------------------
function toast(message, kind = "") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = "toast show" + (kind ? " " + kind : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.className = "toast"), 3200);
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function isValidIndianMobile(number) {
  return /^[6-9]\d{9}$/.test(number);
}

function teardownListeners() {
  state.unsubscribers.forEach((unsub) => unsub());
  state.unsubscribers = [];
}

function daysBetween(dateStrA, dateStrB) {
  const a = new Date(dateStrA);
  const b = new Date(dateStrB);
  return Math.round((a - b) / 86400000);
}

// ----------------------------------------------------------------------------
// 3. Auth (no OTP) + role routing
// ----------------------------------------------------------------------------
// Patients: phone number is the "username", name is the "password".
// Staff: pick a role, enter a shared password — no username field at all.
// Under the hood both are mapped onto Firebase Auth's email/password
// sign-in so we keep a real request.auth.uid for Firestore security rules;
// nothing here is OTP/SMS-verified.

let pendingName = "";
let pendingPhone = "";
let pendingRole = "patient";
let selectedStaffRole = "compounder";

function patientEmailFor(phone) {
  return `p${phone}@patients.clinic.local`;
}
function staffEmailFor(role) {
  return `${role}@staff.clinic.local`;
}
// Firebase requires a 6+ character password. A patient's "password" is their
// own name, so short names are padded invisibly to meet that minimum —
// the padding is applied identically every time, so it never affects login.
function toPatientPassword(name) {
  const trimmed = name.trim();
  return trimmed.length >= 6 ? trimmed : trimmed.padEnd(6, "_");
}

function showFieldError(id, show) {
  document.getElementById(id).classList.toggle("show", show);
}

// --- Top-level Patient / Staff tabs ---
document.getElementById("tab-patient").addEventListener("click", () => {
  document.getElementById("tab-patient").classList.add("active");
  document.getElementById("tab-staff").classList.remove("active");
  document.getElementById("auth-patient-form").classList.remove("hidden");
  document.getElementById("auth-staff-form").classList.add("hidden");
});
document.getElementById("tab-staff").addEventListener("click", () => {
  document.getElementById("tab-staff").classList.add("active");
  document.getElementById("tab-patient").classList.remove("active");
  document.getElementById("auth-staff-form").classList.remove("hidden");
  document.getElementById("auth-patient-form").classList.add("hidden");
});

// --- Staff role sub-toggle (Compounder / Doctor) ---
document.querySelectorAll("[data-staff-role]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-staff-role]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedStaffRole = btn.dataset.staffRole;
  });
});

// --- Patient continue: sign in, or create the account on first use ---
document.getElementById("btn-patient-continue").addEventListener("click", async () => {
  const name = document.getElementById("input-name").value.trim();
  const rawPhone = document.getElementById("input-phone").value.trim();

  const phoneOk = isValidIndianMobile(rawPhone);
  const nameOk = name.length >= 2;
  showFieldError("err-phone", !phoneOk);
  showFieldError("err-name", !nameOk);
  showFieldError("err-patient-mismatch", false);
  if (!phoneOk || !nameOk) return;

  const phoneDigits = rawPhone;
  const phoneDisplay = "+91" + rawPhone;
  const email = patientEmailFor(phoneDigits);
  const password = toPatientPassword(name);

  pendingName = name;
  pendingPhone = phoneDisplay;
  pendingRole = "patient";

  const btn = document.getElementById("btn-patient-continue");
  btn.disabled = true;
  try {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (signInErr) {
      // No account for this number yet -> create one. If the account DOES
      // exist but the name (password) didn't match, creation will fail
      // with "email-already-in-use", which is our real mismatch signal.
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUserProfile(cred.user, name, phoneDisplay, "patient");
      } catch (createErr) {
        if (createErr.code === "auth/email-already-in-use") {
          showFieldError("err-patient-mismatch", true);
        } else {
          toast(createErr.message, "error");
        }
      }
    }
  } finally {
    btn.disabled = false;
  }
});

// --- Staff continue: sign in only (accounts are pre-provisioned by admin) ---
document.getElementById("btn-staff-continue").addEventListener("click", async () => {
  const password = document.getElementById("input-staff-password").value;
  if (!password) {
    showFieldError("err-staff", true);
    return;
  }
  pendingRole = selectedStaffRole;
  const email = staffEmailFor(selectedStaffRole);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showFieldError("err-staff", false);
  } catch (err) {
    console.error(err);
    showFieldError("err-staff", true);
  }
});

// Creates users/{uid} on first login for a given role. Used for patients
// (self-service) — staff accounts are expected to already have a matching
// users/{uid} doc created by the clinic admin (see README.md).
async function ensureUserProfile(user, name, phone, role) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      role,
      name: name || "Patient",
      phone: phone || "",
      createdAt: serverTimestamp(),
    });
  }
}

onAuthStateChanged(auth, async (user) => {
  teardownListeners();
  if (!user) {
    state.user = null;
    state.profile = null;
    showScreen("screen-auth");
    return;
  }
  state.user = user;
  let snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    if (pendingRole === "patient") {
      // Race on first login: auth landed before our explicit profile write.
      await ensureUserProfile(user, pendingName, pendingPhone, "patient");
      snap = await getDoc(doc(db, "users", user.uid));
    } else {
      toast("This staff account has no profile yet — ask the clinic admin to set it up.", "error");
      await signOut(auth);
      return;
    }
  }
  state.profile = snap.data();
  routeToRoleDashboard();
});

function routeToRoleDashboard() {
  const role = state.profile.role;
  if (role === "patient") {
    document.getElementById("patient-name-chip").textContent = state.profile.name;
    document.getElementById("patient-phone-chip").textContent = state.profile.phone;
    showScreen("screen-patient");
    initPatientPortal();
  } else if (role === "compounder") {
    document.getElementById("comp-name-chip").textContent = state.profile.name;
    showScreen("screen-compounder");
    initCompounderPortal();
  } else if (role === "doctor") {
    document.getElementById("doc-name-chip").textContent = state.profile.name;
    showScreen("screen-doctor");
    initDoctorPortal();
  } else {
    toast("Unknown role on account — contact clinic admin.", "error");
  }
}

function wireLogout(buttonId) {
  document.getElementById(buttonId).addEventListener("click", async () => {
    teardownListeners();
    await signOut(auth);
  });
}
wireLogout("patient-logout");
wireLogout("comp-logout");
wireLogout("doc-logout");

// Sidebar nav switching (shared pattern across all three portals)
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panelId = btn.dataset.panel;
    btn.parentElement.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    // Hide all panels within this portal's <main>, then show the target one
    const main = btn.closest(".app-shell").querySelector(".main");
    main.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
    document.getElementById(panelId).classList.remove("hidden");
  });
});

// ----------------------------------------------------------------------------
// 4. PATIENT PORTAL
// ----------------------------------------------------------------------------
function initPatientPortal() {
  const uid = state.user.uid;

  // Live clinic settings (booking window, fee validity, etc.)
  const unsubSettings = onSnapshot(doc(db, "clinic_settings", "global"), (snap) => {
    state.settings = snap.exists() ? snap.data() : defaultSettings();
    renderBookingWindow();
    renderFeeStatusPreview();
  });
  state.unsubscribers.push(unsubSettings);

  // Live clinic open/closed pill, driven by today's clinic_days doc
  const unsubDay = onSnapshot(doc(db, "clinic_days", todayStr()), (snap) => {
    const day = snap.exists() ? snap.data() : { isOpen: false, currentToken: 0 };
    const pill = document.getElementById("patient-clinic-status");
    pill.textContent = day.isOpen ? "Clinic open" : "Clinic closed";
    pill.className = "status-pill " + (day.isOpen ? "open" : "closed");
    document.getElementById("patient-now-serving").textContent = day.currentToken || "—";
    updatePatientTicket(day);
  });
  state.unsubscribers.push(unsubDay);

  // My active appointment (today, not completed/skipped-permanently)
  const activeQuery = query(
    collection(db, "appointments"),
    where("patientId", "==", uid),
    where("date", "==", todayStr())
  );
  const unsubActive = onSnapshot(activeQuery, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.myAppointmentToday = docs.find((a) => a.status !== "completed") || null;
    refreshPatientTicketVisibility();
  });
  state.unsubscribers.push(unsubActive);

  // Waiting queue (for count + EWT), scoped to today
  const waitingQuery = query(
    collection(db, "appointments"),
    where("date", "==", todayStr()),
    where("status", "==", "waiting")
  );
  const unsubWaiting = onSnapshot(waitingQuery, (snap) => {
    state.waitingToday = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    document.getElementById("patient-queue-count").textContent = state.waitingToday.length;
    refreshPatientTicketVisibility();
  });
  state.unsubscribers.push(unsubWaiting);

  // Medical history timeline: completed visits, most recent first
  const historyQuery = query(
    collection(db, "appointments"),
    where("patientId", "==", uid),
    where("status", "==", "completed"),
    orderBy("date", "desc")
  );
  const unsubHistory = onSnapshot(historyQuery, (snap) => {
    renderPatientHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
  state.unsubscribers.push(unsubHistory);

  document.getElementById("btn-book-appointment").addEventListener("click", bookAppointment);
  document.getElementById("input-book-date").addEventListener("change", renderFeeStatusPreview);
}

function defaultSettings() {
  return { maxPatientsPerDay: 40, bookingWindowDays: 7, feeValidityDays: 5, avgTimePerPatient: 10, isOpen: false };
}

function renderBookingWindow() {
  const s = state.settings || defaultSettings();
  const input = document.getElementById("input-book-date");
  input.min = todayStr();
  input.max = addDaysStr(s.bookingWindowDays);
  document.getElementById("book-window-hint").textContent =
    `Bookable up to ${s.bookingWindowDays} day(s) in advance.`;
}

async function renderFeeStatusPreview() {
  if (!state.user) return;
  const s = state.settings || defaultSettings();
  const lastPaid = await getLastPaidVisit(state.user.uid);
  const label = document.getElementById("book-fee-label");
  const detail = document.getElementById("book-fee-detail");
  if (!lastPaid) {
    label.textContent = "Fees due";
    detail.textContent = "No prior paid visit on file — first visit fee applies.";
    return;
  }
  const diff = daysBetween(todayStr(), lastPaid.date);
  if (diff <= s.feeValidityDays) {
    label.textContent = "Fees valid (free return)";
    detail.textContent = `Your last paid visit was ${diff} day(s) ago — within the ${s.feeValidityDays}-day validity window.`;
  } else {
    label.textContent = "Fees due";
    detail.textContent = `Your last paid visit was ${diff} day(s) ago — beyond the ${s.feeValidityDays}-day validity window.`;
  }
}

async function getLastPaidVisit(uid) {
  const q = query(
    collection(db, "appointments"),
    where("patientId", "==", uid),
    where("feesPaid", "==", true),
    where("status", "==", "completed"),
    orderBy("date", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// Books an appointment for the chosen date using a Firestore transaction so
// two patients booking at the same millisecond can never receive the same
// token number (concurrency prevention requirement).
async function bookAppointment() {
  const date = document.getElementById("input-book-date").value;
  if (!date) {
    toast("Choose a date first.", "error");
    return;
  }
  const s = state.settings || defaultSettings();
  const maxAllowedDate = addDaysStr(s.bookingWindowDays);
  if (date < todayStr() || date > maxAllowedDate) {
    toast(`You can only book within ${s.bookingWindowDays} day(s) from today.`, "error");
    return;
  }

  const dayRef = doc(db, "clinic_days", date);
  const lastPaid = await getLastPaidVisit(state.user.uid);
  let feeStatus = "due";
  if (lastPaid) {
    const diff = daysBetween(date, lastPaid.date);
    if (diff <= s.feeValidityDays) feeStatus = "valid";
  }

  try {
    const newApptId = await runTransaction(db, async (tx) => {
      const daySnap = await tx.get(dayRef);
      const dayData = daySnap.exists() ? daySnap.data() : { lastAssignedToken: 0, currentToken: 0, isOpen: false };

      const nextToken = (dayData.lastAssignedToken || 0) + 1;
      if (nextToken > s.maxPatientsPerDay) {
        throw new Error("Fully booked for this date — please choose another day.");
      }

      tx.set(dayRef, { ...dayData, date, lastAssignedToken: nextToken }, { merge: true });

      const apptRef = doc(collection(db, "appointments"));
      tx.set(apptRef, {
        patientId: state.user.uid,
        patientName: state.profile.name,
        patientPhone: state.profile.phone,
        date,
        tokenNumber: nextToken,
        queueOrder: nextToken,
        status: "waiting",
        feesPaid: feeStatus === "valid",
        feeStatus,
        chiefComplaints: "",
        vitals: {},
        diagnosis: "",
        prescription: [],
        createdAt: serverTimestamp(),
      });
      return apptRef.id;
    });
    toast("Appointment booked successfully.", "success");
  } catch (err) {
    console.error(err);
    toast(err.message || "Booking failed. Try again.", "error");
  }
}

function refreshPatientTicketVisibility() {
  const appt = state.myAppointmentToday;
  document.getElementById("patient-no-appointment").classList.toggle("hidden", !!appt);
  document.getElementById("patient-ticket-wrap").classList.toggle("hidden", !appt);
  if (!appt) return;

  document.getElementById("patient-token-number").textContent = "#" + appt.tokenNumber;
  document.getElementById("patient-token-status").textContent = statusLabel(appt.status);

  const waitingAhead = (state.waitingToday || []).filter((w) => w.queueOrder < appt.queueOrder).length;
  const s = state.settings || defaultSettings();
  const ewt = waitingAhead * (s.avgTimePerPatient || 10);
  document.getElementById("patient-ewt").textContent = appt.status === "waiting" ? ewt : 0;

  const ticket = document.getElementById("patient-ticket");
  ticket.classList.toggle("your-turn", appt.status === "in-progress");
}

function updatePatientTicket(day) {
  refreshPatientTicketVisibility();
}

function statusLabel(status) {
  return { waiting: "Waiting", "in-progress": "In consultation", completed: "Completed", skipped: "Skipped" }[status] || status;
}

function renderPatientHistory(records) {
  const wrap = document.getElementById("patient-history-timeline");
  if (!records.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="glyph">📋</div>No past visits yet.</div>`;
    return;
  }
  wrap.innerHTML = records.map((r) => `
    <div class="timeline-item">
      <div class="date">${r.date}</div>
      <strong>${escapeHtml(r.diagnosis || "No diagnosis recorded")}</strong>
      <p style="margin:0.2rem 0 0; font-size:0.85rem; color:var(--ink-soft);">
        ${escapeHtml((r.prescription || []).map((p) => p.medicine).join(", ") || "No prescription")}
      </p>
    </div>
  `).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ----------------------------------------------------------------------------
// 5. COMPOUNDER PORTAL
// ----------------------------------------------------------------------------
function initCompounderPortal() {
  // Settings: load once for the form, keep live for computed fields elsewhere
  const unsubSettings = onSnapshot(doc(db, "clinic_settings", "global"), (snap) => {
    state.settings = snap.exists() ? snap.data() : defaultSettings();
    fillSettingsForm(state.settings);
    document.getElementById("comp-avg-time").textContent = state.settings.avgTimePerPatient;
  });
  state.unsubscribers.push(unsubSettings);

  const dayRef = doc(db, "clinic_days", todayStr());
  const unsubDay = onSnapshot(dayRef, (snap) => {
    const day = snap.exists() ? snap.data() : { isOpen: false, currentToken: 0 };
    document.getElementById("toggle-clinic-open").checked = !!day.isOpen;
    const pill = document.getElementById("comp-clinic-status");
    pill.textContent = day.isOpen ? "Open" : "Closed";
    pill.className = "status-pill " + (day.isOpen ? "open" : "closed");
    document.getElementById("comp-current-token").textContent = day.currentToken || "—";
  });
  state.unsubscribers.push(unsubDay);

  const todayQuery = query(collection(db, "appointments"), where("date", "==", todayStr()));
  const unsubQueue = onSnapshot(todayQuery, (snap) => {
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCompounderQueue(all);
  });
  state.unsubscribers.push(unsubQueue);

  document.getElementById("toggle-clinic-open").addEventListener("change", async (e) => {
    await setDoc(dayRef, { date: todayStr(), isOpen: e.target.checked }, { merge: true });
  });

  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
  document.getElementById("btn-call-next").addEventListener("click", callNextPatient);
  document.getElementById("btn-edit-avg-time").addEventListener("click", overrideAvgTime);
}

function fillSettingsForm(s) {
  document.getElementById("setting-max-patients").value = s.maxPatientsPerDay;
  document.getElementById("setting-booking-window").value = s.bookingWindowDays;
  document.getElementById("setting-fee-validity").value = s.feeValidityDays;
  document.getElementById("setting-avg-time").value = s.avgTimePerPatient;
}

async function saveSettings() {
  const payload = {
    maxPatientsPerDay: Number(document.getElementById("setting-max-patients").value) || 40,
    bookingWindowDays: Number(document.getElementById("setting-booking-window").value) || 7,
    feeValidityDays: Number(document.getElementById("setting-fee-validity").value) || 5,
    avgTimePerPatient: Number(document.getElementById("setting-avg-time").value) || 10,
  };
  await setDoc(doc(db, "clinic_settings", "global"), payload, { merge: true });
  toast("Settings saved.", "success");
}

async function overrideAvgTime() {
  const val = prompt("Set average time per patient (minutes):", state.settings?.avgTimePerPatient || 10);
  if (val === null) return;
  const num = Number(val);
  if (!num || num <= 0) {
    toast("Enter a valid number of minutes.", "error");
    return;
  }
  await setDoc(doc(db, "clinic_settings", "global"), { avgTimePerPatient: num }, { merge: true });
  toast("Average time updated.", "success");
}

let compounderQueueCache = [];

function renderCompounderQueue(all) {
  compounderQueueCache = all;
  const waiting = all.filter((a) => a.status === "waiting").sort((a, b) => a.queueOrder - b.queueOrder);
  const inProgress = all.filter((a) => a.status === "in-progress");
  const completed = all.filter((a) => a.status === "completed");
  const skipped = all.filter((a) => a.status === "skipped");

  document.getElementById("comp-waiting-count").textContent = waiting.length;

  const rows = [...inProgress, ...waiting, ...completed];
  const tbody = document.getElementById("comp-queue-tbody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No appointments for today yet.</td></tr>`;
  } else {
    tbody.innerHTML = rows.map((a) => `
      <tr class="${a.status === "in-progress" ? "current-row" : ""}">
        <td class="token-cell">#${a.tokenNumber}</td>
        <td>${escapeHtml(a.patientName)}<br><span style="font-size:0.75rem;color:var(--ink-soft);">${escapeHtml(a.patientPhone)}</span></td>
        <td><span class="badge ${a.status}">${statusLabel(a.status)}</span></td>
        <td>
          <label style="display:flex; align-items:center; gap:0.35rem; font-weight:400;">
            <input type="checkbox" data-fees-id="${a.id}" ${a.feesPaid ? "checked" : ""} ${a.status === "completed" ? "disabled" : ""} />
            <span class="badge ${a.feeStatus === "valid" ? "valid" : "due"}">${a.feeStatus === "valid" ? "Valid" : "Due"}</span>
          </label>
        </td>
        <td class="row-actions">
          ${a.status === "waiting" ? `
            <button class="btn btn-secondary btn-sm" data-move-up="${a.id}">↑</button>
            <button class="btn btn-secondary btn-sm" data-move-down="${a.id}">↓</button>
            <button class="btn btn-danger btn-sm" data-skip="${a.id}">Skip</button>
          ` : ""}
        </td>
      </tr>
    `).join("");
  }

  const skippedTbody = document.getElementById("comp-skipped-tbody");
  if (!skipped.length) {
    skippedTbody.innerHTML = `<tr><td colspan="3" class="empty-state">No skipped patients.</td></tr>`;
  } else {
    skippedTbody.innerHTML = skipped.map((a) => `
      <tr class="skipped-row">
        <td class="token-cell">#${a.tokenNumber}</td>
        <td>${escapeHtml(a.patientName)}</td>
        <td><button class="btn btn-secondary btn-sm" data-requeue="${a.id}">Re-queue</button></td>
      </tr>
    `).join("");
  }

  wireQueueRowActions();
}

function wireQueueRowActions() {
  document.querySelectorAll("[data-fees-id]").forEach((el) => {
    el.onchange = async () => {
      await updateDoc(doc(db, "appointments", el.dataset.feesId), { feesPaid: el.checked });
    };
  });
  document.querySelectorAll("[data-skip]").forEach((el) => {
    el.onclick = async () => {
      await updateDoc(doc(db, "appointments", el.dataset.skip), { status: "skipped" });
      toast("Patient marked as skipped.", "");
    };
  });
  document.querySelectorAll("[data-requeue]").forEach((el) => {
    el.onclick = async () => {
      const waiting = compounderQueueCache.filter((a) => a.status === "waiting");
      const maxOrder = waiting.length ? Math.max(...waiting.map((a) => a.queueOrder)) : 0;
      await updateDoc(doc(db, "appointments", el.dataset.requeue), { status: "waiting", queueOrder: maxOrder + 1 });
      toast("Patient re-queued to the back of the line.", "success");
    };
  });
  document.querySelectorAll("[data-move-up]").forEach((el) => {
    el.onclick = () => swapQueueOrder(el.dataset.moveUp, -1);
  });
  document.querySelectorAll("[data-move-down]").forEach((el) => {
    el.onclick = () => swapQueueOrder(el.dataset.moveDown, 1);
  });
}

// Emergency override: swaps queueOrder with the adjacent waiting patient in
// the requested direction so the compounder can bump urgent cases forward.
async function swapQueueOrder(apptId, direction) {
  const waiting = compounderQueueCache
    .filter((a) => a.status === "waiting")
    .sort((a, b) => a.queueOrder - b.queueOrder);
  const idx = waiting.findIndex((a) => a.id === apptId);
  const targetIdx = idx + direction;
  if (idx === -1 || targetIdx < 0 || targetIdx >= waiting.length) return;

  const current = waiting[idx];
  const target = waiting[targetIdx];
  await runTransaction(db, async (tx) => {
    tx.update(doc(db, "appointments", current.id), { queueOrder: target.queueOrder });
    tx.update(doc(db, "appointments", target.id), { queueOrder: current.queueOrder });
  });
}

// Calls the next waiting patient (lowest queueOrder). Blocks if someone is
// already in-progress, since the doctor should complete one visit at a time.
async function callNextPatient() {
  const inProgress = compounderQueueCache.find((a) => a.status === "in-progress");
  if (inProgress) {
    toast(`Token #${inProgress.tokenNumber} is still with the doctor.`, "error");
    return;
  }
  const waiting = compounderQueueCache
    .filter((a) => a.status === "waiting")
    .sort((a, b) => a.queueOrder - b.queueOrder);
  if (!waiting.length) {
    toast("No patients waiting.", "");
    return;
  }
  const next = waiting[0];
  await updateDoc(doc(db, "appointments", next.id), { status: "in-progress", calledAt: serverTimestamp() });
  await setDoc(doc(db, "clinic_days", todayStr()), { currentToken: next.tokenNumber }, { merge: true });
  toast(`Called token #${next.tokenNumber}.`, "success");
}

// ----------------------------------------------------------------------------
// 6. DOCTOR PORTAL
// ----------------------------------------------------------------------------
let rxRowCount = 0;
let activeApptId = null;

function initDoctorPortal() {
  const todayQuery = query(
    collection(db, "appointments"),
    where("date", "==", todayStr()),
    where("status", "==", "in-progress")
  );
  const unsub = onSnapshot(todayQuery, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const current = docs[0] || null;
    renderDoctorActivePatient(current);
  });
  state.unsubscribers.push(unsub);

  document.getElementById("btn-add-rx-row").addEventListener("click", () => addRxRow());
  document.getElementById("btn-complete-visit").addEventListener("click", completeVisit);
}

async function renderDoctorActivePatient(appt) {
  const noPatientEl = document.getElementById("doc-no-patient");
  const activeEl = document.getElementById("doc-active-patient");
  if (!appt) {
    noPatientEl.classList.remove("hidden");
    activeEl.classList.add("hidden");
    activeApptId = null;
    return;
  }
  noPatientEl.classList.add("hidden");
  activeEl.classList.remove("hidden");
  activeApptId = appt.id;

  document.getElementById("doc-current-token").textContent = "#" + appt.tokenNumber;
  document.getElementById("doc-current-name").textContent = appt.patientName;
  document.getElementById("doc-current-phone").textContent = appt.patientPhone;

  // Reset consultation form for the new patient
  document.getElementById("doc-chief-complaints").value = "";
  document.getElementById("doc-vital-bp").value = "";
  document.getElementById("doc-vital-pulse").value = "";
  document.getElementById("doc-vital-weight").value = "";
  document.getElementById("doc-diagnosis").value = "";
  document.getElementById("rx-rows").innerHTML = "";
  rxRowCount = 0;
  addRxRow();

  // Load EHR: past completed visits for this patient
  const historyQuery = query(
    collection(db, "appointments"),
    where("patientId", "==", appt.patientId),
    where("status", "==", "completed"),
    orderBy("date", "desc"),
    limit(10)
  );
  const snap = await getDocs(historyQuery);
  const wrap = document.getElementById("doc-history-timeline");
  if (snap.empty) {
    wrap.innerHTML = `<div class="empty-state">No prior visits on record.</div>`;
    return;
  }
  wrap.innerHTML = snap.docs.map((d) => {
    const r = d.data();
    const vitals = r.vitals || {};
    return `
      <div class="timeline-item">
        <div class="date">${r.date}</div>
        <strong>${escapeHtml(r.diagnosis || "—")}</strong>
        <p style="margin:0.2rem 0 0; font-size:0.82rem; color:var(--ink-soft);">
          BP ${escapeHtml(vitals.bp || "—")} · Pulse ${escapeHtml(String(vitals.pulse || "—"))} · Wt ${escapeHtml(String(vitals.weight || "—"))}kg<br>
          Rx: ${escapeHtml((r.prescription || []).map((p) => `${p.medicine} (${p.dosage}, ${p.duration})`).join("; ") || "None")}
        </p>
      </div>
    `;
  }).join("");
}

function addRxRow() {
  rxRowCount += 1;
  const id = `rx-${rxRowCount}`;
  const wrap = document.getElementById("rx-rows");
  const row = document.createElement("div");
  row.className = "rx-row";
  row.id = id;
  row.innerHTML = `
    <input type="text" placeholder="Medicine name" class="rx-medicine" />
    <input type="text" placeholder="Dosage e.g. 1-0-1" class="rx-dosage" />
    <input type="text" placeholder="Duration e.g. 5 days" class="rx-duration" />
    <button class="btn btn-danger btn-sm" type="button">✕</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

// Completes the visit: writes the consultation record, marks the appointment
// "completed", and rolls the actual visit duration into a running average
// that updates every waiting patient's estimated wait time.
async function completeVisit() {
  if (!activeApptId) return;

  const prescription = Array.from(document.querySelectorAll("#rx-rows .rx-row")).map((row) => ({
    medicine: row.querySelector(".rx-medicine").value.trim(),
    dosage: row.querySelector(".rx-dosage").value.trim(),
    duration: row.querySelector(".rx-duration").value.trim(),
  })).filter((r) => r.medicine);

  const apptRef = doc(db, "appointments", activeApptId);
  const apptSnap = await getDoc(apptRef);
  const appt = apptSnap.data();

  const payload = {
    status: "completed",
    chiefComplaints: document.getElementById("doc-chief-complaints").value.trim(),
    vitals: {
      bp: document.getElementById("doc-vital-bp").value.trim(),
      pulse: Number(document.getElementById("doc-vital-pulse").value) || null,
      weight: Number(document.getElementById("doc-vital-weight").value) || null,
    },
    diagnosis: document.getElementById("doc-diagnosis").value.trim(),
    prescription,
    completedAt: serverTimestamp(),
  };

  // Compute actual visit duration if we recorded a calledAt timestamp.
  let visitDurationMin = null;
  if (appt.calledAt) {
    const calledAtMs = appt.calledAt.toMillis ? appt.calledAt.toMillis() : Date.now();
    visitDurationMin = Math.max(1, Math.round((Date.now() - calledAtMs) / 60000));
    payload.visitDurationMin = visitDurationMin;
  }

  await updateDoc(apptRef, payload);

  // Roll the running average time-per-patient (unless the compounder has
  // manually pinned it — we still update it here per spec; the compounder's
  // manual override in overrideAvgTime() simply writes over this value again
  // at any point, taking precedence going forward).
  if (visitDurationMin) {
    await runTransaction(db, async (tx) => {
      const settingsRef = doc(db, "clinic_settings", "global");
      const snap = await tx.get(settingsRef);
      const s = snap.exists() ? snap.data() : defaultSettings();
      const prevAvg = s.avgTimePerPatient || 10;
      const prevCount = s.completedVisitCount || 0;
      const newAvg = Math.round(((prevAvg * prevCount) + visitDurationMin) / (prevCount + 1));
      tx.set(settingsRef, { avgTimePerPatient: newAvg, completedVisitCount: prevCount + 1 }, { merge: true });
    });
  }

  toast("Visit completed and prescription saved.", "success");
}

// ----------------------------------------------------------------------------
// 7. Boot note
// ----------------------------------------------------------------------------
// Nothing else to do on load — onAuthStateChanged (registered above) fires
// immediately with the current session (or null) and drives the initial
// screen.
