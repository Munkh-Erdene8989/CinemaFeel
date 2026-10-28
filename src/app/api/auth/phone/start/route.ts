import { NextRequest, NextResponse } from "next/server";
import { jsonError, siteOrigin } from "@/lib/http";
import { startPhoneLogin } from "@/lib/phone-auth";
import { VerifyMnError } from "@/lib/verify-mn";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string };
  try {
    const result = await startPhoneLogin(body.phone ?? "", siteOrigin(request));
    if (!result.ok) return jsonError(result.error, result.status);
    if (result.delivery === "otp") {
      return NextResponse.json({
        sessionId: result.sessionId,
        delivery: "otp",
        expiresAt: result.expiresAt,
        demo: false,
      });
    }
    return NextResponse.json({
      sessionId: result.sessionId,
      delivery: "mo",
      fallback: result.fallback,
      displayInstruction: result.displayInstruction,
      code: result.code,
      smsUri: result.smsUri,
      shortcode: result.shortcode,
      expiresAt: result.expiresAt,
      demo: result.demo,
    });
  } catch (error) {
    if (error instanceof VerifyMnError) return jsonError(error.message, error.status === 401 ? 401 : 502);
    return jsonError("Утасны баталгаажуулалт эхлүүлж чадсангүй.", 502);
  }
}
