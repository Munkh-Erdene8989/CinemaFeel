import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  return NextResponse.json(session);
}
