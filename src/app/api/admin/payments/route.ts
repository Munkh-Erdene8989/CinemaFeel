import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";
import type { Payment } from "@/lib/types";

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const snap = await adminDb().collection("payments").get();
  const payments = snap.docs
    .map((item) => ({ id: item.id, ...(item.data() as Omit<Payment, "id">) }))
    .sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ payments });
}
