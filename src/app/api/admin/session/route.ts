import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) return jsonError("Нэвтрэх шаардлагатай.", 401);
  return NextResponse.json({ ok: true });
}
