import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { confirmDemoPhone } from "@/lib/phone-auth";
import { VerifyMnError } from "@/lib/verify-mn";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
  try {
    const result = await confirmDemoPhone(body.sessionId ?? "");
    if (!result.ok) return jsonError(result.error, result.status);
    return NextResponse.json({ status: result.status, token: "token" in result ? result.token : undefined });
  } catch (error) {
    if (error instanceof VerifyMnError) return jsonError(error.message, error.status);
    return jsonError("Баталгаажуулж чадсангүй.", 502);
  }
}
