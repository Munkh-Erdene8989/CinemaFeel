import { NextRequest, NextResponse } from "next/server";
import { newId, readManageableSeries } from "@/lib/catalog";
import { announceNewEpisode } from "@/lib/episode-announce";
import { adminBucket } from "@/lib/firebase-admin";
import { assertAdmin, jsonError, siteOrigin } from "@/lib/http";
import { parseYouTubeUrl } from "@/lib/youtube";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await assertAdmin(request);
  if (!session) return jsonError("Нэвтрэх шаардлагатай.", 401);
  const { id } = await context.params;
  const loaded = await readManageableSeries(session, id);
  if (!loaded.ok) return jsonError(loaded.error, loaded.status);
  const series = loaded.ref;
  const body = (await request.json().catch(() => ({}))) as {
    number?: number;
    title?: string;
    storagePath?: string;
    duration?: number;
    youtubeUrl?: string;
    subtitleText?: string;
    subtitleOffsetMs?: number;
  };

  let youtubeId = "";
  let startAt = 0;
  if (typeof body.youtubeUrl === "string" && body.youtubeUrl.trim()) {
    const parsed = parseYouTubeUrl(body.youtubeUrl);
    if (!parsed) return jsonError("YouTube линк буруу байна.");
    youtubeId = parsed.videoId;
    startAt = parsed.startAt;
  }
  const storagePath = String(body.storagePath || "");
  if (!storagePath && !youtubeId) return jsonError("Видео файл эсвэл YouTube линк оруулна уу.");

  const subtitleText = typeof body.subtitleText === "string" ? body.subtitleText : "";
  if (subtitleText.length > 1_500_000) return jsonError("SRT хэт урт байна.");
  const subtitleOffsetMs = Math.max(-120_000, Math.min(120_000, Number(body.subtitleOffsetMs ?? 0) || 0));

  const episodeId = newId();
  const episode: {
    number: number;
    title: string;
    storagePath: string;
    duration: number;
    source?: "youtube";
    startAt?: number;
    subtitleOffsetMs?: number;
    telegramAnnounce: "pending";
  } = {
    number: Number(body.number ?? 1),
    title: String(body.title || `${body.number}-р анги`),
    storagePath,
    duration: Number(body.duration ?? 0),
    telegramAnnounce: "pending",
  };

  if (youtubeId) {
    episode.source = "youtube";
    episode.startAt = startAt;
    episode.subtitleOffsetMs = subtitleOffsetMs;
    const playback: { youtubeId: string; subtitlePath?: string } = { youtubeId };
    if (subtitleText.trim()) {
      const subtitlePath = `subtitles/${id}/${episodeId}.srt`;
      try {
        await adminBucket().file(subtitlePath).save(subtitleText, {
          resumable: false,
          contentType: "text/plain; charset=utf-8",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Storage холбогдсонгүй.";
        return jsonError(`Хадмал хадгалагдсангүй. ${message}`, 503);
      }
      playback.subtitlePath = subtitlePath;
    }
    await series.collection("playback").doc(episodeId).set(playback);
  }

  await series.collection("episodes").doc(episodeId).set(episode);
  const count = (await series.collection("episodes").get()).size;
  await series.set({ episodes: count }, { merge: true });
  let telegram: { telegramSent?: boolean; telegramError?: string; telegramPending?: string } = {};
  try {
    telegram = await announceNewEpisode(id, episodeId, siteOrigin(request));
  } catch (error) {
    console.error("telegram episode announce failed", error);
    telegram = { telegramError: "Telegram мэдэгдэл илгээгдсэнгүй." };
  }
  return NextResponse.json({ episode: { id: episodeId, ...episode }, ...telegram });
}
