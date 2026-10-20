export type SeriesPreview = {
  episodeId: string;
  episodeNumber: number;
  videoId: string;
  startAt: number;
  subtitlePath: string;
  subtitleOffsetMs: number;
  episodeLabel: string;
};

export function shouldReplacePreview(current: { videoId?: unknown; episodeNumber?: unknown } | null | undefined, episodeNumber: number) {
  const videoId = String(current?.videoId ?? "");
  if (!videoId) return true;
  const currentNumber = Number(current?.episodeNumber);
  if (!Number.isFinite(currentNumber)) return true;
  return episodeNumber < currentNumber;
}

export function readPreview(value: unknown): SeriesPreview | null {
  if (!value || typeof value !== "object") return null;
  const preview = value as Partial<SeriesPreview>;
  const videoId = String(preview.videoId ?? "");
  const episodeId = String(preview.episodeId ?? "");
  if (!videoId || !episodeId) return null;
  return {
    episodeId,
    episodeNumber: Number(preview.episodeNumber ?? 0),
    videoId,
    startAt: Number(preview.startAt ?? 0),
    subtitlePath: String(preview.subtitlePath ?? ""),
    subtitleOffsetMs: Number(preview.subtitleOffsetMs ?? 0),
    episodeLabel: String(preview.episodeLabel ?? ""),
  };
}

export function subtitleUrl(seriesId: string, episodeId: string) {
  return `/api/media/subtitle?seriesId=${encodeURIComponent(seriesId)}&episodeId=${encodeURIComponent(episodeId)}`;
}

export function publishedShareId(data: { seriesId?: unknown; status?: unknown } | null | undefined) {
  const seriesId = String(data?.seriesId ?? "");
  if (!seriesId || String(data?.status ?? "") !== "Нийтлэгдсэн") return null;
  return seriesId;
}
