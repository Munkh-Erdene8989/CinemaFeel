import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { verifyPhoneOtp } from "@/lib/phone-auth";
import { VerifyMnError } from "@/lib/verify-mn";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { sessionId?: string; code?: string };
  try {
    const result = await verifyPhoneOtp(body.sessionId ?? "", body.code ?? "");
    if (!result.ok) return jsonError(result.error, result.status);
    return NextResponse.json({ status: result.status, token: result.token });
  } catch (error) {
    if (error instanceof VerifyMnError) return jsonError(error.message, error.status === 401 ? 401 : 502);
    return jsonError("Код шалгаж чадсангүй.", 502);
  }
}
