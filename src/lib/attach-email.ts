import type { UserRecord } from "firebase-admin/auth";
import { subscriptionActive } from "./format";
import { adminAuth, adminDb } from "./firebase-admin";
import type { AppUser } from "./types";

function authCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) return String(error.code);
  return "";
}

function emailStub(user: UserRecord) {
  if (user.phoneNumber) return false;
  return user.providerData.every((item) => item.providerId === "password");
}

async function unusedAccount(uid: string) {
  const snap = await adminDb().collection("users").doc(uid).get();
  const data = snap.exists ? (snap.data() as AppUser) : null;
  if (data?.plan === "Plus" || subscriptionActive(data)) return false;
  const purchases = await adminDb().collection("purchases").where("uid", "==", uid).limit(1).get();
  return purchases.empty;
}

export async function attachEmail(uid: string, email: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const normalized = email.trim().toLowerCase();
  let current: UserRecord;
  try {
    current = await adminAuth().getUser(uid);
  } catch {
    return { ok: false, error: "Бүртгэл олдсонгүй.", status: 404 };
  }

  const currentEmail = current.email?.toLowerCase() || "";
  if (currentEmail && currentEmail !== normalized) {
    return { ok: false, error: "Энэ бүртгэлд өөр имэйл холбогдсон байна.", status: 400 };
  }

  if (currentEmail !== normalized) {
    try {
      const taken = await adminAuth().getUserByEmail(normalized);
      if (taken.uid !== uid) {
        if (!emailStub(taken) || !(await unusedAccount(taken.uid))) {
          return { ok: false, error: "Энэ имэйл өөр бүртгэлд бүртгэлтэй байна.", status: 400 };
        }
        await adminAuth().deleteUser(taken.uid);
        await adminDb().collection("users").doc(taken.uid).delete().catch(() => undefined);
      }
    } catch (error) {
      if (authCode(error) !== "auth/user-not-found") return { ok: false, error: "Имэйл шалгаж чадсангүй.", status: 500 };
    }

    try {
      await adminAuth().updateUser(uid, { email: normalized, emailVerified: true });
    } catch (error) {
      if (authCode(error) === "auth/email-already-exists") return { ok: false, error: "Энэ имэйл өөр бүртгэлд бүртгэлтэй байна.", status: 400 };
      return { ok: false, error: "Имэйл холбож чадсангүй.", status: 500 };
    }
  }

  await adminDb().collection("users").doc(uid).set({ email: normalized }, { merge: true });
  return { ok: true };
}
