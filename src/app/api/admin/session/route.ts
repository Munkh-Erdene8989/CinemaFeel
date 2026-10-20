import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  if (session.role !== "admin") return NextResponse.json(session);
  const snap = await adminDb().collection("admins").doc(session.adminId).get();
  const data = snap.data();
  const inviteCode = String(data?.inviteCode ?? "");
  const username = String(data?.username ?? "");
  const cornerName = String(data?.cornerName ?? "");
  const cornerNameEdits = Number(data?.cornerNameEdits ?? 0);
  const termsSeen = Number(data?.creatorTermsSeenAt ?? 0) > 0;
  const guideSeen = Number(data?.creatorGuideSeenAt ?? 0) > 0;
  const salaryGuideSeen = Number(data?.salaryGuideSeenAt ?? 0) > 0;
  return NextResponse.json({ ...session, inviteCode, username, cornerName, cornerNameEdits, termsSeen, guideSeen, salaryGuideSeen });
}
