import { NextRequest, NextResponse } from "next/server";
import { sendRenewalMails } from "@/lib/renewal-send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай." }, { status: 401 });
  }
  const result = await sendRenewalMails();
  return NextResponse.json(result);
}
