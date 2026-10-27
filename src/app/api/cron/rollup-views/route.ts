import { NextRequest, NextResponse } from "next/server";
import { rollupAuthorized } from "@/lib/cron-auth";
import { rollupAllSeriesViews } from "@/lib/views";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!rollupAuthorized(request)) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай." }, { status: 401 });
  }
  const result = await rollupAllSeriesViews();
  return NextResponse.json(result);
}
