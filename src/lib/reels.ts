export const REEL_YOUTUBE_SECONDS = 300;
export const REEL_LIMIT = 16;

export type ReelSource = "youtube" | "file";

export type ReelClip = {
  seriesId: string;
  title: string;
  genre: string;
  image: string;
  year: number;
  source: ReelSource;
  videoId: string;
  url: string;
  startAt: number;
  seconds: number;
  episodeLabel: string;
};

export function shuffle<T>(items: T[], random: () => number = Math.random) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.min(0.999999, Math.max(0, random())) * (index + 1));
    const current = next[index];
    next[index] = next[swap];
    next[swap] = current;
  }
  return next;
}

export function reelSpan(startAt: number, seconds: number, duration = 0) {
  const length = Math.max(1, seconds);
  const cue = Math.max(0, Number.isFinite(startAt) ? startAt : 0);
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (total > 0 && cue >= total) {
    const start = Math.max(0, total - Math.min(length, total));
    return { start, end: total };
  }
  const end = total > 0 ? Math.min(cue + length, total) : cue + length;
  return { start: cue, end };
}

function clipBase(seriesId: string, data: { title?: unknown; genre?: unknown; image?: unknown; cover?: unknown; year?: unknown }) {
  return {
    seriesId,
    title: String(data.title ?? ""),
    genre: String(data.genre ?? ""),
    image: String(data.image || data.cover || ""),
    year: Number(data.year ?? 0) || 0,
  };
}

export function fileClip(seriesId: string, data: { title?: unknown; genre?: unknown; image?: unknown; cover?: unknown; year?: unknown; reelPreview?: unknown }): ReelClip | null {
  const url = String(data.reelPreview ?? "");
  if (!url.startsWith("https://")) return null;
  return {
    ...clipBase(seriesId, data),
    source: "file",
    videoId: "",
    url,
    startAt: 0,
    seconds: REEL_YOUTUBE_SECONDS,
    episodeLabel: "Трейлер",
  };
}

export function youtubeClip(
  seriesId: string,
  data: { title?: unknown; genre?: unknown; image?: unknown; cover?: unknown; year?: unknown },
  preview: { videoId?: unknown; episodeId?: unknown; startAt?: unknown; episodeLabel?: unknown } | null,
): ReelClip | null {
  const videoId = String(preview?.videoId ?? "");
  const episodeId = String(preview?.episodeId ?? "");
  if (!videoId || !episodeId) return null;
  return {
    ...clipBase(seriesId, data),
    source: "youtube",
    videoId,
    url: "",
    startAt: 0,
    seconds: REEL_YOUTUBE_SECONDS,
    episodeLabel: String(preview?.episodeLabel ?? ""),
  };
}
