import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireSuper } from "@/lib/http";
import { broadcastMessage, resendConfigured, sendResendEmails } from "@/lib/mail";
import { broadcastInput, marketingFromSettings } from "@/lib/marketing";
import { marketingSmsText, sendCustomSms, sendWesendEmails, supportedMnMobile, wesendConfigured } from "@/lib/wesend";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function audience() {
  const snap = await adminDb().collection("users").get();
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const item of snap.docs) {
    const data = item.data();
    if (data.status === "Түр зогссон") continue;
    const email = String(data.email ?? "").trim().toLowerCase();
    if (emailPattern.test(email)) emails.add(email);
    const phone = supportedMnMobile(String(data.phone ?? ""));
    if (phone) phones.add(phone);
  }
  return { emails: [...emails], phones: [...phones] };
}

export async function POST(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    sms?: unknown;
    subject?: unknown;
    body?: unknown;
    smsBody?: unknown;
    confirm?: unknown;
    idempotencyKey?: unknown;
  } | null;
  const draft = broadcastInput(body ?? {});
  if (!draft.ok) return jsonError(draft.error);

  const people = await audience();
  const emails = draft.email ? people.emails : [];
  const phones = draft.sms ? people.phones : [];
  if (draft.email && !emails.length) return jsonError("Имэйлтэй идэвхтэй хэрэглэгч алга.");
  if (draft.sms && !phones.length) return jsonError("SMS илгээх дугаар алга.");
  if (draft.email && !resendConfigured() && !wesendConfigured()) return jsonError("Имэйл илгээх тохиргоо дутуу байна.");
  if (draft.sms && !wesendConfigured()) return jsonError("SMS илгээх тохиргоо дутуу байна.");

  let smsText = "";
  if (draft.sms) {
    const checked = marketingSmsText(draft.smsBody);
    if (!checked.ok) return jsonError(checked.error);
    smsText = checked.text;
  }

  if (body?.confirm !== true) {
    return NextResponse.json({ preview: true, emails: emails.length, phones: phones.length, smsText });
  }

  const settings = await adminDb().collection("settings").doc("app").get();
  const fromName = marketingFromSettings(settings.data()).mailFromName;
  const key = String(body?.idempotencyKey ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || `m${Date.now()}`;
  let emailed = 0;
  if (draft.email) {
    const message = broadcastMessage(draft.subject, draft.body);
    const sent = resendConfigured()
      ? await sendResendEmails(emails, message, "marketing", `marketing-${key}`, fromName)
      : await sendWesendEmails(emails, message, `marketing-${key}`, fromName);
    if (!sent.ok) return jsonError(sent.error || "Имэйл илгээгдсэнгүй.");
    emailed = emails.length;
  }
  if (draft.sms) {
    const sent = await sendCustomSms(phones, smsText, `marketing-${key}`);
    if (!sent.ok) return jsonError(emailed ? `Имэйл илгээгдсэн. SMS илгээгдсэнгүй: ${sent.error}` : sent.error);
  }
  return NextResponse.json({ emailed, smsed: phones.length, smsText });
}
