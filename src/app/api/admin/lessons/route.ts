import { NextRequest, NextResponse } from "next/server";
import { lessonError, lessonFields, listLessons, newLessonId, nextLessonOrder } from "@/lib/lessons";
import { adminDb } from "@/lib/firebase-admin";
import { assertAdmin, jsonError, requireSuper } from "@/lib/http";

export async function GET(request: NextRequest) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  return NextResponse.json({ lessons: await listLessons() });
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireSuper(request);
  if (error) return error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const fields = lessonFields(body);
  const problem = lessonError(fields);
  if (problem) return jsonError(problem);
  const id = newLessonId();
  const order = await nextLessonOrder();
  await adminDb().collection("lessons").doc(id).set({
    ...fields,
    cover: "",
    storagePath: "",
    order,
    ownerId: session.adminId,
    ownerName: session.name,
    createdAt: Date.now(),
  });
  return NextResponse.json({ id });
}
