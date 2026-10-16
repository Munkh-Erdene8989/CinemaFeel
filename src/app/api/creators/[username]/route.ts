import { NextRequest, NextResponse } from "next/server";
import { loadPublicCreator } from "@/lib/creator-public";
import { jsonError } from "@/lib/http";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const creator = await loadPublicCreator(username);
  if (!creator) return jsonError("Контент бүтээгч олдсонгүй.", 404);
  return NextResponse.json(creator);
}
