import { NextRequest, NextResponse } from "next/server";
import { receiptReadUrl, receiptUploadTarget, saveReceipt } from "@/lib/expense-store";
import { jsonError, requireSuper } from "@/lib/http";

export async function GET(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const opened = await receiptReadUrl(request.nextUrl.searchParams.get("id") ?? "");
  if ("error" in opened) return jsonError(opened.error, opened.status ?? 400);
  return NextResponse.json(opened);
}

export async function POST(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { expenseId?: string; templateId?: string; fileName?: string; contentType?: string };
  const created = await receiptUploadTarget(body);
  if ("error" in created) return jsonError(created.error, created.status ?? 400);
  return NextResponse.json(created);
}

export async function PATCH(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { expenseId?: string; templateId?: string; receiptPath?: string; applyToEmpty?: boolean };
  const saved = await saveReceipt(body);
  if ("error" in saved) return jsonError(saved.error, saved.status ?? 400);
  return NextResponse.json(saved);
}
