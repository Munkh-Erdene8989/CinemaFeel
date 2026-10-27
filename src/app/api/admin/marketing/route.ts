import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireSuper } from "@/lib/http";
import { marketingFromSettings, normalizeMailFromName } from "@/lib/marketing";
import { resendConfigured } from "@/lib/mail";
import { mergeSettings, type Settings } from "@/lib/types";
import { wesendConfigured } from "@/lib/wesend";

function fromEmail() {
  return (process.env.RESEND_FROM_EMAIL || "").trim().replace(/^["']|["']$/g, "");
}

export async function GET(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const snap = await adminDb().collection("settings").doc("app").get();
  const settings = mergeSettings(snap.data() as Partial<Settings> | undefined);
  return NextResponse.json({
    settings,
    channels: {
      resend: resendConfigured(),
      wesend: wesendConfigured(),
      fromEmail: fromEmail(),
    },
  });
}

export async function PUT(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => null)) as { emailEnabled?: unknown; smsEnabled?: unknown; mailFromName?: unknown; renewalMailEnabled?: unknown } | null;
  if (!body) return jsonError("Имэйл болон SMS унтраалтыг сонгоно уу.");
  const existing = await adminDb().collection("settings").doc("app").get();
  const current = mergeSettings(existing.data() as Partial<Settings> | undefined);
  if (typeof body.renewalMailEnabled === "boolean" && typeof body.emailEnabled !== "boolean" && typeof body.smsEnabled !== "boolean") {
    const settings: Settings = { ...current, renewalMailEnabled: body.renewalMailEnabled };
    await adminDb().collection("settings").doc("app").set(settings);
    return NextResponse.json({ settings });
  }
  if (typeof body.emailEnabled !== "boolean" || typeof body.smsEnabled !== "boolean") {
    return jsonError("Имэйл болон SMS унтраалтыг сонгоно уу.");
  }
  const channels = marketingFromSettings({
    emailEnabled: body.emailEnabled,
    smsEnabled: body.smsEnabled,
    mailFromName: normalizeMailFromName(body.mailFromName),
    renewalMailEnabled: typeof body.renewalMailEnabled === "boolean" ? body.renewalMailEnabled : current.renewalMailEnabled,
  });
  const settings: Settings = { ...current, ...channels };
  await adminDb().collection("settings").doc("app").set(settings);
  return NextResponse.json({ settings });
}
