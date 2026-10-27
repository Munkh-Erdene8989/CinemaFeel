import { randomUUID } from "node:crypto";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function readServiceAccount() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const raw = encoded ? Buffer.from(encoded, "base64").toString("utf8") : process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  return JSON.parse(raw) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
}

export function adminApp(): App {
  if (getApps().length) return getApps()[0]!;
  const serviceAccount = readServiceAccount();
  const projectId = serviceAccount?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cinemafeel-mn";
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    `${projectId}.firebasestorage.app`;
  if (!serviceAccount) {
    return initializeApp({ credential: applicationDefault(), projectId, storageBucket });
  }
  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
    storageBucket,
  });
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminDb() {
  return getFirestore(adminApp());
}

export function adminBucket() {
  return getStorage(adminApp()).bucket();
}

export async function readableObjectUrl(path: string, expiresMs = 2 * 60 * 60 * 1000) {
  const file = adminBucket().file(path);
  try {
    const [url] = await file.getSignedUrl({ version: "v4", action: "read", expires: Date.now() + expiresMs });
    return url;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("client_email")) throw error;
    const [meta] = await file.getMetadata();
    let token = String(meta.metadata?.firebaseStorageDownloadTokens || "").split(",").find(Boolean) ?? "";
    if (!token) {
      token = randomUUID();
      await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
    }
    return `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  }
}
