# Clinic Management System

A lightweight Single Page Application for running a walk-in clinic's daily
queue — patient booking, live token tracking, compounder queue control, and
a doctor's consultation workspace — built with plain HTML/CSS/JS and
Firebase (Auth, Firestore).

## Files

| File | Purpose |
|---|---|
| `index.html` | Markup for the auth screen and all three dashboards |
| `styles.css` | Design system (colors, type, the "ticket" token widget, tables) |
| `app.js` | All application logic: auth, real-time listeners, booking, queue ops |
| `firebase-config.js` | Firebase SDK bootstrap — **edit this first** |
| `firestore.rules` | Security rules enforcing per-role data access |

## 1. Firebase project setup

1. Create a project at the [Firebase console](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → enable **Email/Password**.
   (No OTP/SMS is used — see "How login works" below.)
3. **Firestore Database** → create in production mode, pick a region.
4. **Project settings** → Your apps → add a **Web app** → copy the config
   object into `firebase-config.js` (`FIREBASE_CONFIG`).
5. Install the Firebase CLI once (`npm install -g firebase-tools`), then from
   this folder:
   ```bash
   firebase login
   firebase init firestore hosting   # point hosting's public dir at this folder
   firebase deploy --only firestore:rules
   firebase deploy --only hosting    # optional, to publish it
   ```

## How login works (no OTP)

- **Patients**: their phone number acts as the username and their name acts
  as the password. The first time someone enters a number + name that
  hasn't been seen before, an account is created automatically. From then
  on, they must enter the same name (exact match, case-sensitive) with that
  number to get back in — if the name doesn't match, the app shows "That
  name doesn't match our records for this number."
- **Staff**: the login screen has no username field at all — just a
  **Compounder / Doctor** toggle and a single password box. Staff accounts
  are **not** self-service; an admin must provision them ahead of time (see
  section 3 below), and staff sign-in only checks the password against
  whichever account already exists.

Under the hood, both flows use Firebase's email/password sign-in with a
synthetic email (e.g. `p9876543210@patients.clinic.local` for a patient, or
`doctor@staff.clinic.local` for staff) — this keeps a real, stable
`request.auth.uid` for Firestore's security rules, without any SMS step.

**Security note:** a phone number and a person's own name are not secrets,
and the staff password is shared clinic-wide. This login model trades real
authentication for convenience — it's appropriate for a low-stakes internal
tool, not for protecting sensitive data from a determined attacker. If that
matters for your deployment, consider re-adding phone OTP or a proper
per-staff password later; the Firestore rules and data model don't need to
change either way.

## 2. Composite indexes

Several queries combine `where` + `orderBy` (medical history, last-paid-fee
lookup, doctor's EHR view). The first time each runs, Firestore's console
error message includes a direct "Create index" link — click it, or run
`firebase deploy --only firestore:indexes` after adding an `firestore.indexes.json`
with entries for:
- `appointments`: `patientId ASC, status ASC, date DESC`
- `appointments`: `patientId ASC, feesPaid ASC, status ASC, date DESC`

## 3. Creating staff accounts (compounder / doctor)

Staff accounts must be created once by an admin — there's no self-registration
for them, unlike patients. For each of the two roles:

1. Firebase console → **Authentication** → **Add user**:
   - Email: `compounder@staff.clinic.local` (or `doctor@staff.clinic.local`)
   - Password: whatever you want that role's shared password to be.
2. Copy the new user's **UID** from the Authentication table.
3. Firestore → create a document at `users/{that UID}` with:
   ```json
   { "role": "compounder", "name": "Front Desk" }
   ```
   (use `"role": "doctor"` and a suitable `name` for the doctor account).
4. Share the password with whoever needs that role. They open the app,
   choose **Staff** → the matching role toggle, enter the password, and
   they're in.

To change a shared staff password later, use **Authentication → (user) →
Reset password** in the console, or delete and recreate the account.

## 4. Data model

```
users/{uid}            { role, name, phone, createdAt }
clinic_settings/global { isOpen, maxPatientsPerDay, bookingWindowDays,
                          feeValidityDays, avgTimePerPatient, completedVisitCount }
clinic_days/{date}     { date, isOpen, lastAssignedToken, currentToken }
appointments/{id}       { patientId, patientName, patientPhone, date,
                          tokenNumber, queueOrder, status,
                          feesPaid, feeStatus, chiefComplaints, vitals,
                          diagnosis, prescription[], createdAt, calledAt,
                          completedAt, visitDurationMin }
```

`status` moves through `waiting → in-progress → completed`, with a
`skipped` side-state for no-shows that can be re-queued.

## 5. How the trickier requirements are implemented

- **No duplicate tokens under concurrent booking**: `bookAppointment()` in
  `app.js` uses `runTransaction()` to read-and-increment
  `clinic_days/{date}.lastAssignedToken` atomically.
- **Offline resilience**: `enableIndexedDbPersistence(db)` in
  `firebase-config.js` queues writes locally through short outages.
- **Data privacy**: enforced server-side in `firestore.rules`, not just
  hidden in the UI — a patient's Firestore reads for another patient's
  appointment will be rejected outright.
- **Emergency reordering**: the compounder's ↑/↓ buttons swap the
  `queueOrder` field between adjacent waiting appointments; "Skip" sets
  `status: "skipped"` and "Re-queue" sends the patient to the back of the
  line with a fresh `queueOrder`.
- **Running average visit time**: each time a doctor completes a visit,
  `completeVisit()` folds the actual elapsed minutes into
  `avgTimePerPatient` via a weighted running average; the compounder's
  "Override" button can pin it to a manual value at any time afterward.

## 6. Known limitations / next steps

- Staff role promotion is manual (console-only) by design — there's no
  in-app admin panel in this build.
- The booking flow assumes one appointment per patient per day; a patient
  who already has a non-completed appointment today can still submit
  another booking form (add a simple pre-check if you want to block that).
- Drag-and-drop reordering was implemented as ↑ / ↓ buttons for simplicity
  and better mobile/accessibility support; swap in a drag library if you
  want pointer-based reordering.
