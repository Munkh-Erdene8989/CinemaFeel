import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError, requireSuper } from "@/lib/http";
import { defaultSettings, type Settings } from "@/lib/types";

export async function GET(request: NextRequest) {
  if (!(await assertAdmin(request))) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const snap = await adminDb().collection("settings").doc("app").get();
  return NextResponse.json({ settings: { ...defaultSettings, ...(snap.data() as Settings | undefined) } });
}

export async function PUT(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as Partial<Settings>;
  const settings: Settings = {
    name: String(body.name || defaultSettings.name),
    email: String(body.email || defaultSettings.email),
    price: String(body.price || defaultSettings.price).replace(/\D/g, "") || defaultSettings.price,
    maintenance: Boolean(body.maintenance),
    registration: Boolean(body.registration),
    notifications: Boolean(body.notifications),
  };
  await adminDb().collection("settings").doc("app").set(settings);
  return NextResponse.json({ settings });
}
