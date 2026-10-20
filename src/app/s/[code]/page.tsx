import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { writeShareCode } from "@/lib/catalog";
import { adminDb } from "@/lib/firebase-admin";
import { publishedShareId } from "@/lib/preview";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = code.trim().toLowerCase();
  if (!/^[a-z0-9]{4,6}$/.test(normalized)) notFound();

  const db = adminDb();
  const direct = await db.collection("shareCodes").doc(normalized).get();
  if (direct.exists) {
    const seriesId = publishedShareId(direct.data());
    if (!seriesId) notFound();
    redirect(`/watch/${seriesId}/1`);
  }

  const snap = await db.collection("series").where("shareCode", "==", normalized).limit(1).get();
  const series = snap.docs[0];
  if (!series) notFound();
  const status = String(series.data().status ?? "");
  after(() => writeShareCode(normalized, series.id, status).catch((error) => console.warn("Хуваалцах кодыг хадгалж чадсангүй.", error)));
  if (status !== "Нийтлэгдсэн") notFound();
  redirect(`/watch/${series.id}/1`);
}
