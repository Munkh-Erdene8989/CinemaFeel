import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError, requireSuper } from "@/lib/http";
import { marketingFromSettings } from "@/lib/marketing";
import { defaultSettings, mergeSettings, normalizeGenres, type Settings } from "@/lib/types";

export async function GET(request: NextRequest) {
  if (!(await assertAdmin(request))) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const snap = await adminDb().collection("settings").doc("app").get();
  return NextResponse.json({ settings: mergeSettings(snap.data() as Partial<Settings> | undefined) });
}

export async function PUT(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as Partial<Settings>;
  const existing = await adminDb().collection("settings").doc("app").get();
  const current = mergeSettings(existing.data() as Partial<Settings> | undefined);
  const settings: Settings = {
    name: String(body.name || defaultSettings.name),
    email: String(body.email || defaultSettings.email),
    price: String(body.price || defaultSettings.price).replace(/\D/g, "") || defaultSettings.price,
    maintenance: Boolean(body.maintenance),
    registration: Boolean(body.registration),
    notifications: Boolean(body.notifications),
    ...marketingFromSettings({
      emailEnabled: typeof body.emailEnabled === "boolean" ? body.emailEnabled : current.emailEnabled,
      smsEnabled: typeof body.smsEnabled === "boolean" ? body.smsEnabled : current.smsEnabled,
      mailFromName: body.mailFromName ?? current.mailFromName,
      renewalMailEnabled: typeof body.renewalMailEnabled === "boolean" ? body.renewalMailEnabled : current.renewalMailEnabled,
    }),
    genres: normalizeGenres(body.genres ?? current.genres),
  };
  await adminDb().collection("settings").doc("app").set(settings);
  return NextResponse.json({ settings });
}
