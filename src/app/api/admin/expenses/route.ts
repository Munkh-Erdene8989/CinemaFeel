import { NextRequest, NextResponse } from "next/server";
import { expenseFromRecord, expenseWrite } from "@/lib/expenses";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireSuper } from "@/lib/http";

export async function GET(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const snap = await adminDb().collection("expenses").get();
  const expenses = snap.docs
    .map((item) => expenseFromRecord(item.id, item.data() as Record<string, unknown>))
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt - a.createdAt);
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  return NextResponse.json({ expenses, total });
}

export async function POST(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const written = expenseWrite(body);
  if ("error" in written) return jsonError(written.error);
  const ref = adminDb().collection("expenses").doc();
  await ref.set(written.value);
  return NextResponse.json({ expense: { id: ref.id, ...written.value } });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = String(body.id ?? "").trim();
  if (!id || id.includes("/")) return jsonError("Зардал олдсонгүй.");
  const ref = adminDb().collection("expenses").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return jsonError("Зардал олдсонгүй.", 404);
  await ref.delete();
  return NextResponse.json({ ok: true });
}
