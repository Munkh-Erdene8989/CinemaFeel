import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { canonicalGenre, loadGenres, sameGenre, saveGenres } from "@/lib/genres";
import { jsonError, requireSuper } from "@/lib/http";
import { reorderGenres } from "@/lib/genres-order";

function cleanName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export async function POST(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = cleanName(body.name);
  if (!name || name.length > 40) return jsonError("Төрлийн нэр 1–40 тэмдэгт байна.");
  if (name.toLocaleLowerCase("mn") === "бүгд") return jsonError("Энэ нэрийг төрөл болгож болохгүй.");
  const genres = await loadGenres();
  const existing = canonicalGenre(name, genres);
  if (existing) return NextResponse.json({ genres, name: existing, created: false });
  const next = await saveGenres([...genres, name]);
  return NextResponse.json({ genres: next, name, created: true });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { genres?: unknown };
  const current = await loadGenres();
  const next = reorderGenres(current, body.genres);
  if (!next) return jsonError("Ангиллын дараалал буруу байна.");
  const saved = await saveGenres(next);
  return NextResponse.json({ genres: saved });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireSuper(request);
  if (gate.error) return gate.error;
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = cleanName(body.name);
  const genres = await loadGenres();
  const current = canonicalGenre(name, genres);
  if (!current) return jsonError("Төрөл олдсонгүй.", 404);
  if (genres.length <= 1) return jsonError("Дор хаяж нэг төрөл үлдээнэ.");
  const used = await adminDb().collection("series").where("genre", "==", current).limit(1).get();
  if (!used.empty) return jsonError("Энэ төрөлтэй контент байна. Эхлээд тэдгээрийн төрлийг солино уу.");
  const next = await saveGenres(genres.filter((genre) => !sameGenre(genre, current)));
  return NextResponse.json({ genres: next });
}
