import { NextRequest, NextResponse } from "next/server";
import { findLiveCreatorId } from "@/lib/access";
import { adminDb } from "@/lib/firebase-admin";
import { todayStamp } from "@/lib/format";
import { jsonError, readUser } from "@/lib/http";

export async function POST(request: NextRequest) {
  const decoded = await readUser(request);
  if (!decoded?.uid) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const email = decoded.email?.toLowerCase() || "";
  const phone = decoded.phone_number || "";
  if (!email && !phone) return jsonError("Бүртгэлийн мэдээлэл олдсонгүй.", 400);

  const settings = await adminDb().collection("settings").doc("app").get();
  const registrationOpen = settings.exists ? settings.data()?.registration !== false : true;
  const ref = adminDb().collection("users").doc(decoded.uid);
  const snap = await ref.get();
  if (!snap.exists && !registrationOpen) return jsonError("Шинэ бүртгэл хаалттай байна.", 403);
  if (snap.exists && snap.data()?.status === "Түр зогссон") return jsonError("Таны бүртгэл түр зогссон байна.", 403);

  const creatorId = await findLiveCreatorId(adminDb(), { email, phone });
  if (!snap.exists) {
    await ref.set({
      email,
      phone,
      plan: "Үндсэн",
      status: "Идэвхтэй",
      joined: todayStamp(),
      subscriptionExpiresAt: null,
      displayName: decoded.name || "",
      photoURL: decoded.picture || "",
      createdAt: Date.now(),
      creatorId,
    });
  } else {
    const patch: Record<string, string> = {};
    if (email && snap.data()?.email !== email) patch.email = email;
    if (phone && snap.data()?.phone !== phone) patch.phone = phone;
    if (decoded.name && snap.data()?.displayName !== decoded.name) patch.displayName = decoded.name;
    if (decoded.picture && snap.data()?.photoURL !== decoded.picture) patch.photoURL = decoded.picture;
    if (String(snap.data()?.creatorId ?? "") !== creatorId) patch.creatorId = creatorId;
    if (Object.keys(patch).length) await ref.set(patch, { merge: true });
  }
  return NextResponse.json({ ok: true });
}
