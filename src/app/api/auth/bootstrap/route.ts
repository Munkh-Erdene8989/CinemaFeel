import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { todayStamp } from "@/lib/format";
import { jsonError, readUser } from "@/lib/http";

export async function POST(request: NextRequest) {
  const decoded = await readUser(request);
  if (!decoded?.uid) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const email = decoded.email?.toLowerCase();
  if (!email) return jsonError("Email олдсонгүй.", 400);

  const settings = await adminDb().collection("settings").doc("app").get();
  const registrationOpen = settings.exists ? settings.data()?.registration !== false : true;
  const ref = adminDb().collection("users").doc(decoded.uid);
  const snap = await ref.get();
  if (!snap.exists && !registrationOpen) return jsonError("Шинэ бүртгэл хаалттай байна.", 403);
  if (snap.exists && snap.data()?.status === "Түр зогссон") return jsonError("Таны бүртгэл түр зогссон байна.", 403);

  if (!snap.exists) {
    await ref.set({
      email,
      plan: "Үндсэн",
      status: "Идэвхтэй",
      joined: todayStamp(),
      subscriptionExpiresAt: null,
      displayName: decoded.name || "",
      photoURL: decoded.picture || "",
      createdAt: Date.now(),
    });
  } else if (snap.data()?.email !== email) {
    await ref.set({ email, displayName: decoded.name || snap.data()?.displayName || "", photoURL: decoded.picture || snap.data()?.photoURL || "" }, { merge: true });
  }
  return NextResponse.json({ ok: true });
}
