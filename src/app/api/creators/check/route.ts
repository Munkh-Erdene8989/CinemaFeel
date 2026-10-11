import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, adminCookieOptions, createAdminToken } from "@/lib/admin-session";
import { adminDb } from "@/lib/firebase-admin";
import { jsonError } from "@/lib/http";
import { settleInvoice } from "@/lib/settle";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { senderInvoiceNo?: string };
  const senderInvoiceNo = String(body.senderInvoiceNo || "");
  if (!senderInvoiceNo) return jsonError("Нэхэмжлэх олдсонгүй.", 404);
  const payment = await adminDb().collection("payments").doc(senderInvoiceNo).get();
  const data = payment.data();
  if (!payment.exists || data?.mode !== "creator" || !data.creatorId) return jsonError("Нэхэмжлэх олдсонгүй.", 404);

  try {
    const result = await settleInvoice(senderInvoiceNo);
    if (result.error) return jsonError(result.error, 400);
    if (!result.paid) return NextResponse.json({ paid: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Төлбөр шалгаж чадсангүй.";
    return NextResponse.json({ paid: false, error: message }, { status: 502 });
  }

  const creatorId = String(data.creatorId);
  const creator = await adminDb().collection("admins").doc(creatorId).get();
  if (!creator.exists || creator.data()?.active === false) return jsonError("Бүртгэл нээгдсэнгүй.", 409);
  const name = String(creator.data()?.name || creator.data()?.username || "Контент бүтээгч");
  const response = NextResponse.json({ paid: true, href: "/admin", username: String(creator.data()?.username || "") });
  response.cookies.set(
    adminCookieName(),
    createAdminToken({ role: "admin", adminId: creatorId, name }),
    adminCookieOptions(),
  );
  return response;
}
