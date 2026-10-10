import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { SUPER_ADMIN_ID } from "./types";

export async function recordUniqueView(seriesId: string, uid: string, ownerId: string) {
  const db = adminDb();
  const viewRef = db.collection("views").doc(`${seriesId}_${uid}`);
  const seriesRef = db.collection("series").doc(seriesId);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(viewRef);
    if (existing.exists) return;
    tx.set(viewRef, {
      seriesId,
      uid,
      ownerId: ownerId || SUPER_ADMIN_ID,
      createdAt: Date.now(),
    });
    tx.set(seriesRef, { uniqueViews: FieldValue.increment(1) }, { merge: true });
  });
}
