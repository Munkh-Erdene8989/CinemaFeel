import { NextRequest, NextResponse } from "next/server";
import { CORNER_NAME_LIMIT, creatorCornerTitle, nextCornerRename } from "@/lib/creator-site";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  if (session.role !== "admin") return jsonError("Зөвхөн контент бүтээгч солино.", 403);
  const body = (await request.json().catch(() => ({}))) as { cornerName?: string };
  const ref = adminDb().collection("admins").doc(session.adminId);
  try {
    const saved = await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      if (!snap.exists || data?.active === false) throw new Error("Бүртгэл олдсонгүй.");
      const username = String(data?.username ?? "");
      const result = nextCornerRename(
        { username, cornerName: String(data?.cornerName ?? ""), edits: Number(data?.cornerNameEdits ?? 0) },
        body.cornerName,
      );
      if ("error" in result) throw new Error(result.error);
      if (result.changed) tx.set(ref, { cornerName: result.cornerName, cornerNameEdits: result.edits }, { merge: true });
      return { ...result, username };
    });
    return NextResponse.json({
      cornerName: saved.cornerName,
      title: creatorCornerTitle(saved.username, saved.cornerName),
      edits: saved.edits,
      remaining: CORNER_NAME_LIMIT - saved.edits,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Нэрийг солиж чадсангүй.";
    return jsonError(message, message === "Бүртгэл олдсонгүй." ? 404 : 400);
  }
}
