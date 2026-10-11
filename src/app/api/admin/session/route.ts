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
  return NextResponse.json({ ...session, inviteCode });
}
