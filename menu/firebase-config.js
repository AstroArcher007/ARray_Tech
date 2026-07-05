/* ==========================================================================
   Firebase Configuration
   ==========================================================================

   HOW TO SET THIS UP:

   1. Go to https://console.firebase.google.com and create a project
      (or use an existing one).

   2. In the project, click "Add app" -> Web (</> icon) and register an app.
      Firebase will show you a `firebaseConfig` object — copy the values
      into the object below.

   3. Enable Firestore:
      Console -> Build -> Firestore Database -> Create database
      (start in "test mode" while developing, then lock it down with the
      security rules shown at the bottom of this file before going live).

   4. That's it — index.html and admin.html both load this file before
      app.js / admin.js, so `db` is ready to use in both.

   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCgRJRcBc267_WRUv2NbgQwHvHwt9kM7_I",
  authDomain: "arraytech-6f39a.firebaseapp.com",
  projectId: "arraytech-6f39a",
  storageBucket: "arraytech-6f39a.firebasestorage.app",
  messagingSenderId: "389398932278",
  appId: "1:389398932278:web:79562352ad64dd88542197",
  measurementId: "G-62848ZX1S9"
};
// Initialize Firebase (compat SDK — works with plain <script> tags, no bundler needed)
firebase.initializeApp(firebaseConfig);

// Shared Firestore handle used by both app.js and admin.js
const db = firebase.firestore();

/* --------------------------------------------------------------------------
   RECOMMENDED FIRESTORE SECURITY RULES
   Paste into Console -> Firestore Database -> Rules. This allows anyone to
   READ the menu (needed for the public client view) but only signed-in
   staff to WRITE. For a simple internal tool without login, you can instead
   restrict writes by other means (e.g. only deploying admin.html privately),
   but rules are the safer approach for production.
   --------------------------------------------------------------------------

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /menu/{dishId} {
         allow read: if true;
         allow write: if request.auth != null; // requires Firebase Auth sign-in
       }
     }
   }

   -------------------------------------------------------------------------- */
