import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";
import { uniqueInviteCode } from "@/lib/staff";

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  if (session.role !== "admin") return NextResponse.json(session);
  const ref = adminDb().collection("admins").doc(session.adminId);
  const snap = await ref.get();
  let inviteCode = String(snap.data()?.inviteCode ?? "");
  if (!inviteCode) {
    inviteCode = await uniqueInviteCode();
    await ref.set({ inviteCode }, { merge: true });
  }
  const data = snap.data();
  const termsSeen = Number(data?.creatorTermsSeenAt ?? 0) > 0;
  const guideSeen = Number(data?.creatorGuideSeenAt ?? 0) > 0;
  return NextResponse.json({ ...session, inviteCode, termsSeen, guideSeen });
}
