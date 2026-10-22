import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireSuper } from "@/lib/http";
import { paymentsWithoutQr } from "@/lib/payment-query";
import type { Payment } from "@/lib/types";

export async function GET(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const snap = await paymentsWithoutQr(adminDb().collection("payments")).get();
  const payments = snap.docs
    .map((item) => {
      const data = item.data() as Omit<Payment, "id">;
      return { id: item.id, ...data, qrImage: "", qrText: "", urls: [] };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ payments });
}
