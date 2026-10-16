import { cache } from "react";
import { adminDb } from "./firebase-admin";
import { creatorCornerTitle, creatorUsernameParam, type PublicCreator } from "./creator-site";

export const loadPublicCreator = cache(async (value: string): Promise<PublicCreator | null> => {
  const username = creatorUsernameParam(value);
  if (!username) return null;
  const snap = await adminDb().collection("admins").where("username", "==", username).limit(1).get();
  const doc = snap.docs[0];
  if (!doc || doc.data().active === false) return null;
  const data = doc.data();
  return {
    id: doc.id,
    name: creatorCornerTitle(username, data.cornerName),
    username,
    contentType: String(data.contentType ?? "").trim(),
  };
});
