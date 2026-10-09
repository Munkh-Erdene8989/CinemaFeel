import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { settleInvoice } from "@/lib/settle";

async function senderFrom(request: NextRequest) {
  const url = new URL(request.url);
  const querySender = url.searchParams.get("sender") || url.searchParams.get("sender_invoice_no");
  if (querySender) return querySender;
  const body = (await request.json().catch(() => ({}))) as { sender_invoice_no?: string; invoice_id?: string };
  if (body.sender_invoice_no) return body.sender_invoice_no;
  if (body.invoice_id) {
    const snap = await adminDb().collection("payments").where("invoiceId", "==", body.invoice_id).limit(1).get();
    return snap.docs[0]?.id || "";
  }
  return "";
}

async function handle(request: NextRequest) {
  const sender = await senderFrom(request);
  if (!sender) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await settleInvoice(sender);
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
