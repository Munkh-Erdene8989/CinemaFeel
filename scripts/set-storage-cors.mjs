import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
const raw = encoded ? Buffer.from(encoded, "base64").toString("utf8") : process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT дутуу байна.");

const serviceAccount = JSON.parse(raw);
const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`;
const cors = JSON.parse(readFileSync(new URL("../storage.cors.json", import.meta.url), "utf8"));

initializeApp({
  credential: cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  }),
  storageBucket: bucketName,
});

const bucket = getStorage().bucket();
const [before] = await bucket.getMetadata();
console.log("bucket", bucketName);
console.log("before", JSON.stringify(before.cors ?? []));
await bucket.setCorsConfiguration(cors);
const [after] = await bucket.getMetadata();
console.log("after", JSON.stringify(after.cors ?? []));
