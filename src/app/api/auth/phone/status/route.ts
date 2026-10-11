import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { phoneLoginStatus } from "@/lib/phone-auth";
import { VerifyMnError } from "@/lib/verify-mn";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  try {
    const result = await phoneLoginStatus(sessionId);
    if (!result.ok) return jsonError(result.error, result.status);
    return NextResponse.json({ status: result.status, token: "token" in result ? result.token : undefined });
  } catch (error) {
    if (error instanceof VerifyMnError) return jsonError(error.message, error.status);
    return jsonError("Төлөв шалгаж чадсангүй.", 502);
  }
}
