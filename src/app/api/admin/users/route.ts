import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { todayStamp } from "@/lib/format";
import { jsonError, requireSuper } from "@/lib/http";
import type { AppUser } from "@/lib/types";

export async function GET(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const snap = await adminDb().collection("users").get();
  const users = snap.docs
    .map((item) => ({ uid: item.id, ...(item.data() as Omit<AppUser, "uid">) }))
    .sort((a, b) => String(b.joined).localeCompare(String(a.joined)));
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email.includes("@")) return jsonError("Зөв email оруулна уу.");
  let user;
  try {
    user = await adminAuth().getUserByEmail(email);
  } catch {
    user = await adminAuth().createUser({ email });
  }
  await adminDb().collection("users").doc(user.uid).set(
    {
      email,
      plan: "Үндсэн",
      status: "Идэвхтэй",
      joined: todayStamp(),
      subscriptionExpiresAt: null,
      displayName: "",
      photoURL: "",
      createdAt: Date.now(),
    },
    { merge: true },
  );
  return NextResponse.json({ uid: user.uid });
}
