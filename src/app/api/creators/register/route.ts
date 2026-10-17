import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { newId } from "@/lib/catalog";
import { parseCreatorDraft } from "@/lib/creators";
import { todayStamp } from "@/lib/format";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError, siteOrigin } from "@/lib/http";
import { createInvoice } from "@/lib/qpay";
import { sendCreatorWelcome } from "@/lib/creator-notice";
import { findInviter, hashPassword, normalizeUsername, uniqueInviteCode } from "@/lib/staff";
import { CREATOR_FEE } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseCreatorDraft(body);
  if ("error" in parsed) return jsonError(parsed.error);

  const draft = parsed.value;
  const superName = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  if (superName && draft.username === superName) return jsonError("Энэ нэвтрэх нэр бүртгэлтэй байна.");

  const existing = await adminDb().collection("admins").where("username", "==", draft.username).limit(1).get();
  const current = existing.docs[0];
  if (current && (current.data().active !== false || current.data().paid === true)) {
    return jsonError("Энэ нэвтрэх нэр бүртгэлтэй байна.");
  }

  const emailTaken = await adminDb().collection("admins").where("email", "==", draft.email).limit(1).get();
  if (!emailTaken.empty && emailTaken.docs[0].id !== current?.id) return jsonError("Энэ и-мэйл бүртгэлтэй байна.");

  const inviter = draft.inviteCode ? await findInviter(draft.inviteCode) : null;
  if (draft.inviteCode && (!inviter || inviter.id === current?.id)) return jsonError("Урилгын код олдсонгүй.");

  const id = current?.id || newId();
  const created = !current;
  const profile = {
    username: normalizeUsername(draft.username),
    cornerName: draft.cornerName,
    cornerNameEdits: 0,
    name: `${draft.lastName} ${draft.firstName}`,
    lastName: draft.lastName,
    firstName: draft.firstName,
    passwordHash: hashPassword(draft.password),
    phone: draft.phone,
    email: draft.email,
    portfolio: draft.portfolio,
    contentType: draft.contentType,
    experience: draft.experience,
    bankName: draft.bankName,
    bankAccount: draft.bankAccount,
    termsAcceptedAt: Date.now(),
    active: false,
    paid: false,
    source: "self",
    kind: "creator",
    inviteCode: String(current?.data().inviteCode || (await uniqueInviteCode())),
    invitedById: inviter?.id || "",
    invitedByCode: inviter?.inviteCode || "",
    invitedByName: inviter?.name || "",
    createdAt: current?.data().createdAt || Date.now(),
  };

  await adminDb().collection("admins").doc(id).set(profile);

  const senderInvoiceNo = `CF${Date.now()}${randomBytes(4).toString("hex")}`;
  const callbackUrl = `${siteOrigin(request)}/api/qpay/callback?sender=${senderInvoiceNo}`;
  let invoice;
  try {
    invoice = await createInvoice({
      senderInvoiceNo,
      description: "Контент бүтээгчийн бүртгэл",
      amount: CREATOR_FEE,
      callbackUrl,
    });
  } catch (error) {
    if (created) await adminDb().collection("admins").doc(id).delete().catch(() => undefined);
    const message = error instanceof Error ? error.message : "QPay нэхэмжлэх үүсгэж чадсангүй.";
    return jsonError(message, 502);
  }

  await adminDb().collection("payments").doc(senderInvoiceNo).set({
    uid: `creator:${id}`,
    email: draft.email,
    amount: CREATOR_FEE,
    product: "Контент бүтээгчийн бүртгэл",
    mode: "creator",
    seriesId: null,
    creatorId: id,
    createdAt: Date.now(),
    date: todayStamp(),
    method: "QPay",
    status: "Хүлээгдэж буй",
    invoiceId: invoice.invoice_id,
    senderInvoiceNo,
    paymentId: "",
    qrImage: invoice.qr_image || "",
    qrText: invoice.qr_text || "",
    urls: invoice.urls || [],
  });

  let welcomeSent = false;
  try {
    const welcomed = await sendCreatorWelcome({
      creatorId: id,
      email: draft.email,
      name: profile.name,
      username: profile.username,
      password: draft.password,
      ready: false,
    });
    welcomeSent = welcomed.ok;
    if (!welcomed.ok) console.error("creator welcome email failed", welcomed.error);
  } catch (error) {
    console.error("creator welcome email failed", error);
  }

  return NextResponse.json({
    senderInvoiceNo,
    qrImage: invoice.qr_image || "",
    qrText: invoice.qr_text || "",
    urls: invoice.urls || [],
    amount: CREATOR_FEE,
    username: draft.username,
    welcomeSent,
  });
}
