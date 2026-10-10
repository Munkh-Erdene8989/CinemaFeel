import { NextRequest, NextResponse } from "next/server";
import { listSeries, newId, seriesPayload, uniqueShareCode } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const series = await listSeries();
  const visible = session.role === "super" ? series : series.filter((item) => item.ownerId === session.adminId);
  return NextResponse.json({ series: visible });
}

export async function POST(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = seriesPayload(body);
  if (!payload.title) return jsonError("Киноны нэр оруулна уу.");
  const id = newId();
  const shareCode = await uniqueShareCode();
  await adminDb().collection("series").doc(id).set({
    ...payload,
    shareCode,
    ownerId: session.adminId,
    ownerName: session.name,
    uniqueViews: 0,
  });
  return NextResponse.json({ id, shareCode });
}
