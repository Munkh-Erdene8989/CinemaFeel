import { NextRequest, NextResponse } from "next/server";
import { rollupAllSeriesViews } from "@/lib/views";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    console.info("rollup cron auth", {
      hasSecret: Boolean(secret),
      hasAuthorization: Boolean(authorization),
      headers: [...request.headers.keys()].sort(),
    });
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай." }, { status: 401 });
  }
  const result = await rollupAllSeriesViews();
  return NextResponse.json(result);
}
