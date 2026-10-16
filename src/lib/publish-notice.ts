import { announceIfReady, type AnnouncementResult } from "./announce";
import { announcePendingEpisodes, type EpisodeTelegramResult } from "./episode-announce";

export async function publishNotice(seriesId: string, origin: string, status?: string): Promise<AnnouncementResult & EpisodeTelegramResult> {
  const announcement = await announceIfReady(seriesId, origin);
  const telegram = status === "Нийтлэгдсэн" ? await announcePendingEpisodes(seriesId, origin) : {};
  return { ...announcement, ...telegram };
}
