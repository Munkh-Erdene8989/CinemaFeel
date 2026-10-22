import { NextRequest, NextResponse } from "next/server";
import { buildActivityReport, monthlyListPrice } from "@/lib/activity";
import { adminDb } from "@/lib/firebase-admin";
import { requireSuper } from "@/lib/http";
import { defaultSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const db = adminDb();
  const [settingsSnap, userSnap, viewSnap, paymentSnap] = await Promise.all([
    db.collection("settings").doc("app").get(),
    db.collection("users").get(),
    db.collection("views").select("uid", "seriesId", "createdAt").get(),
    db.collection("payments").select("uid", "mode", "status", "amount", "createdAt").get(),
  ]);
  const price = text(settingsSnap.data()?.price) || defaultSettings.price;
  const report = buildActivityReport({
    monthlyPrice: monthlyListPrice(price),
    users: userSnap.docs.map((item) => {
      const data = item.data();
      return {
        uid: item.id,
        name: text(data.displayName),
        email: text(data.email),
        phone: text(data.phone),
        joined: text(data.joined),
        expiresAt: Number(data.subscriptionExpiresAt) || 0,
      };
    }),
    views: viewSnap.docs.map((item) => {
      const data = item.data();
      return { uid: text(data.uid), seriesId: text(data.seriesId), createdAt: Number(data.createdAt) || 0 };
    }),
    payments: paymentSnap.docs.map((item) => {
      const data = item.data();
      return {
        uid: text(data.uid),
        mode: text(data.mode),
        status: text(data.status),
        amount: Number(data.amount) || 0,
        createdAt: Number(data.createdAt) || 0,
      };
    }),
  });
  return NextResponse.json(report);
}
