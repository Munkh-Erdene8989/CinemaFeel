import { adminDb } from "./firebase-admin";
import { publicWatchLink, sendEpisodeNotice } from "./telegram";

export type EpisodeTelegramResult = {
  telegramSent?: boolean;
  telegramError?: string;
  telegramPending?: string;
};

function httpsUrl(value: unknown) {
  const url = String(value ?? "").trim();
  return /^https:\/\//i.test(url) ? url : "";
}

export async function announceNewEpisode(seriesId: string, episodeId: string, origin: string): Promise<EpisodeTelegramResult> {
  const seriesRef = adminDb().collection("series").doc(seriesId);
  const seriesSnap = await seriesRef.get();
  if (!seriesSnap.exists) return {};
  const series = seriesSnap.data() ?? {};
  const episodeRef = seriesRef.collection("episodes").doc(episodeId);
  const episodeSnap = await episodeRef.get();
  if (!episodeSnap.exists) return {};
  const episode = episodeSnap.data() ?? {};
  if (episode.telegramAnnounce === "sent") return {};

  if (series.status !== "Нийтлэгдсэн") {
    await episodeRef.set({ telegramAnnounce: "pending" }, { merge: true });
    return { telegramPending: "Цуврал нийтлэгдсэн үед сувагт мэдэгдэл очно." };
  }

  const photoUrl = httpsUrl(series.image) || httpsUrl(series.cover);
  const episodeNumber = Number(episode.number ?? 1) || 1;
  const sent = await sendEpisodeNotice({
    seriesTitle: String(series.title ?? ""),
    episodeTitle: String(episode.title ?? ""),
    episodeNumber,
    photoUrl,
    link: publicWatchLink(origin, seriesId, episodeNumber),
  });

  if (sent.ok) {
    await episodeRef.set({ telegramAnnounce: "sent", telegramAnnouncedAt: Date.now() }, { merge: true });
    return { telegramSent: true };
  }

  await episodeRef.set({ telegramAnnounce: "pending" }, { merge: true });
  if (sent.pending) return { telegramPending: sent.pending };
  return { telegramError: sent.error || "Telegram мэдэгдэл илгээгдсэнгүй." };
}

export async function announcePendingEpisodes(seriesId: string, origin: string): Promise<EpisodeTelegramResult> {
  try {
    return await sendPendingEpisodes(seriesId, origin);
  } catch (error) {
    console.error("telegram episode announce failed", error);
    return { telegramError: "Telegram мэдэгдэл илгээгдсэнгүй." };
  }
}

async function sendPendingEpisodes(seriesId: string, origin: string): Promise<EpisodeTelegramResult> {
  const seriesRef = adminDb().collection("series").doc(seriesId);
  const seriesSnap = await seriesRef.get();
  if (!seriesSnap.exists || seriesSnap.data()?.status !== "Нийтлэгдсэн") return {};

  const pending = await seriesRef.collection("episodes").where("telegramAnnounce", "==", "pending").get();
  const ordered = [...pending.docs].sort((a, b) => Number(a.data().number ?? 0) - Number(b.data().number ?? 0));
  let sent = 0;
  let telegramError = "";
  let telegramPending = "";
  for (const episode of ordered) {
    const result = await announceNewEpisode(seriesId, episode.id, origin);
    if (result.telegramSent) sent += 1;
    if (result.telegramError) telegramError = result.telegramError;
    if (result.telegramPending) telegramPending = result.telegramPending;
  }

  return {
    telegramSent: sent > 0 ? true : undefined,
    telegramError: telegramError || undefined,
    telegramPending: sent === 0 && telegramPending ? telegramPending : undefined,
  };
}
