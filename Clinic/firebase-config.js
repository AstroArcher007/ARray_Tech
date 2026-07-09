// ============================================================================
// firebase-config.js
// ----------------------------------------------------------------------------
// Central Firebase bootstrap for the Clinic Management System.
// Uses the Firebase v10+ modular Web SDK, loaded straight from the CDN
// so the project stays framework-free (no bundler / npm build step needed).
//
// SETUP:
// 1. Go to https://console.firebase.google.com -> create a project.
// 2. Add a Web App, copy the config object it gives you into FIREBASE_CONFIG
//    below.
// 3. Enable Authentication -> Sign-in method -> Email/Password.
//    (No OTP/SMS is used — see app.js for how phone+name and the staff
//    password are mapped onto Firebase's email/password sign-in.)
// 4. Enable Firestore Database (in production mode) and deploy the rules
//    in firestore.rules (see README.md for the CLI command).
// 5. (Optional) Enable Firebase Hosting and run `firebase deploy`.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ----------------------------------------------------------------------------
// 1. YOUR FIREBASE PROJECT CONFIG
// ----------------------------------------------------------------------------
// Replace every value below with the config object from your Firebase
// console (Project settings -> General -> Your apps -> SDK setup and config).
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBuEAasLL63sIf6aCJLyy5faMGzHmsMnqw",
  authDomain: "arrattech-clinicsystem.firebaseapp.com",
  projectId: "arrattech-clinicsystem",
  storageBucket: "arrattech-clinicsystem.firebasestorage.app",
  messagingSenderId: "43597491832",
  appId: "1:43597491832:web:7e2c1ccdca4edac960c78d",
  measurementId: "G-KLM6LL5HYR"
};

// ----------------------------------------------------------------------------
// 2. INITIALIZE APP / AUTH / FIRESTORE
// ----------------------------------------------------------------------------
export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ----------------------------------------------------------------------------
// 3. OFFLINE RESILIENCE
// ----------------------------------------------------------------------------
// Keeps the Compounder's queue list working through brief connectivity drops.
// Firestore will queue writes locally and sync automatically once the
// connection returns. Only one tab per browser can hold the persistence
// lock, so we fail silently (with a console note) in multi-tab situations.
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn(
      "[firebase-config] Offline persistence could not be enabled: multiple tabs open."
    );
  } else if (err.code === "unimplemented") {
    console.warn(
      "[firebase-config] Offline persistence is not supported in this browser."
    );
  }
});

// ----------------------------------------------------------------------------
// 4. AUTH HELPERS
// ----------------------------------------------------------------------------
// No OTP / SMS verification is used. Patients sign in with their phone
// number as the "username" and their name as the "password" (see app.js —
// login.js maps both to a synthetic email/password pair under the hood so
// we can keep using Firebase Auth's session management and Firestore
// security rules, which key off request.auth.uid). Staff sign in with a
// role + a shared password only, no username field.
export { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut };
