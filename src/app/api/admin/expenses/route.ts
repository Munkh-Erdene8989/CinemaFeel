import { NextRequest, NextResponse } from "next/server";
import { createExpense, listExpenses, removeExpense } from "@/lib/expense-store";
import { currentExpenseMonth, parseExpenseMonth } from "@/lib/expenses";
import { jsonError, requireSuper } from "@/lib/http";

export async function GET(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const month = request.nextUrl.searchParams.get("month") || currentExpenseMonth();
  if (month !== "all" && !parseExpenseMonth(month)) return jsonError("Сар буруу байна.");
  const data = await listExpenses(month);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const written = await createExpense(body);
  if ("error" in written) return jsonError(written.error, written.status ?? 400);
  return NextResponse.json(written);
}

export async function DELETE(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { id?: string; stop?: boolean };
  const removed = await removeExpense(String(body.id ?? ""), body.stop === true);
  if ("error" in removed) return jsonError(removed.error, removed.status ?? 400);
  return NextResponse.json(removed);
}
