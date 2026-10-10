import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = code.trim().toLowerCase();
  if (!/^[a-z0-9]{4,6}$/.test(normalized)) notFound();
  const snap = await adminDb().collection("series").where("shareCode", "==", normalized).limit(1).get();
  const series = snap.docs[0];
  if (!series || series.data().status !== "Нийтлэгдсэн") notFound();
  redirect(`/watch/${series.id}/1`);
}
