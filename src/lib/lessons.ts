import type { DocumentData } from "firebase-admin/firestore";
import { newId } from "./catalog";
import { adminDb } from "./firebase-admin";
import type { AdminSession, Lesson } from "./types";

export function mapLesson(id: string, data: DocumentData): Lesson {
  return {
    id,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    cover: String(data.cover ?? ""),
    hasVideo: Boolean(data.storagePath),
    order: Number(data.order ?? 0),
    ownerId: String(data.ownerId ?? ""),
    ownerName: String(data.ownerName ?? ""),
    createdAt: Number(data.createdAt ?? 0),
  };
}

export function lessonFields(body: Record<string, unknown>) {
  return {
    title: String(body.title ?? "").trim().replace(/\s+/g, " "),
    description: String(body.description ?? "").trim(),
  };
}

export function lessonError(fields: { title: string; description: string }) {
  if (fields.title.length < 2 || fields.title.length > 120) return "Хичээлийн нэр 2–120 тэмдэгт байна.";
  if (fields.description.length > 2000) return "Тайлбар 2000 тэмдэгтээс богино байна.";
  return "";
}

export function safeLessonPath(id: string, path: string, folder: "lessons" | "lesson-covers") {
  return path.startsWith(`${folder}/${id}/`) && !path.includes("..");
}

export async function listLessons(): Promise<Lesson[]> {
  const snap = await adminDb().collection("lessons").get();
  return snap.docs
    .map((item) => mapLesson(item.id, item.data()))
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export async function readLesson(id: string) {
  const ref = adminDb().collection("lessons").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "Хичээл олдсонгүй.", status: 404 as const };
  return { ok: true as const, ref, snap };
}

export async function readManageableLesson(session: AdminSession, id: string) {
  if (session.role !== "super") return { ok: false as const, error: "Зөвхөн super admin хичээл засна.", status: 403 as const };
  return readLesson(id);
}

export async function nextLessonOrder() {
  const snap = await adminDb().collection("lessons").get();
  const highest = snap.docs.reduce((max, item) => Math.max(max, Number(item.data().order ?? 0)), 0);
  return highest + 10;
}

export function newLessonId() {
  return newId();
}

export async function moveLesson(id: string, direction: "up" | "down") {
  const lessons = await listLessons();
  const group = lessons;
  const index = group.findIndex((item) => item.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= group.length) return;
  const orders = group.some((item, itemIndex) => itemIndex > 0 && item.order === group[itemIndex - 1].order)
    ? group.map((_, itemIndex) => (itemIndex + 1) * 10)
    : group.map((item) => item.order);
  const next = orders[index];
  orders[index] = orders[target];
  orders[target] = next;
  const batch = adminDb().batch();
  let writes = 0;
  group.forEach((item, itemIndex) => {
    if (item.order === orders[itemIndex]) return;
    writes += 1;
    batch.set(adminDb().collection("lessons").doc(item.id), { order: orders[itemIndex] }, { merge: true });
  });
  if (writes) await batch.commit();
}
