import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function config() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function firebaseConfigured() {
  return Boolean(config().apiKey && config().projectId);
}

export function getFirebaseApp(): FirebaseApp {
  const current = config();
  if (!current.apiKey || !current.projectId) {
    throw new Error("Firebase тохиргоо дутуу байна.");
  }
  return getApps().length ? getApp() : initializeApp(current);
}

export function clientAuth() {
  return getAuth(getFirebaseApp());
}

export function clientDb() {
  return getFirestore(getFirebaseApp());
}
