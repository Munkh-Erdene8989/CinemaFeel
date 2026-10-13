export type EpisodeNotice = {
  seriesTitle: string;
  episodeTitle: string;
  episodeNumber: number;
  photoUrl: string;
  link: string;
};

export type TelegramSendResult = {
  ok: boolean;
  error?: string;
  pending?: string;
};

function botToken() {
  return (process.env.TELEGRAM_BOT_TOKEN || "").trim();
}

function channelId() {
  return (process.env.TELEGRAM_CHANNEL_ID || "").trim();
}

export function telegramConfigured() {
  return Boolean(botToken() && channelId());
}

export function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function episodeCaption(notice: Pick<EpisodeNotice, "seriesTitle" | "episodeTitle" | "episodeNumber">) {
  const series = escapeTelegramHtml(notice.seriesTitle.replace(/\s+/g, " ").trim() || "Шинэ контент");
  const title = notice.episodeTitle.replace(/\s+/g, " ").trim();
  const numbered = `${notice.episodeNumber}-р анги`;
  const line = !title || title === numbered ? numbered : `${numbered} · ${escapeTelegramHtml(title)}`;
  return `Шинэ анги гарлаа\n<b>${series}</b>\n${line}`.slice(0, 1024);
}

export function publicWatchLink(origin: string, seriesId: string, episodeNumber: number) {
  let base = "https://cinemafeel.dev";
  try {
    const url = new URL(origin);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") base = origin.replace(/\/$/, "");
  } catch {
    base = "https://cinemafeel.dev";
  }
  const number = Math.max(1, episodeNumber || 1);
  return `${base}/watch/${encodeURIComponent(seriesId)}/${number}`;
}

export async function sendEpisodeNotice(notice: EpisodeNotice): Promise<TelegramSendResult> {
  if (!telegramConfigured()) return { ok: false, error: "Telegram бот тохируулаагүй байна." };
  if (!/^https:\/\//i.test(notice.photoUrl)) {
    return { ok: false, pending: "Постер эсвэл ковер оруулсны дараа сувагт мэдэгдэл очно." };
  }
  if (!/^https:\/\//i.test(notice.link)) return { ok: false, error: "Үзэх холбоос буруу байна." };

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken()}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        chat_id: channelId(),
        photo: notice.photoUrl,
        caption: episodeCaption(notice),
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "Үзэх", url: notice.link }]] },
      }),
    });
  } catch (error) {
    console.error("telegram send failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "Telegram мэдэгдэл илгээгдсэнгүй." };
  }

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !payload?.ok) {
    const description = payload?.description || "Telegram мэдэгдэл илгээгдсэнгүй.";
    console.error("telegram send failed", description);
    return { ok: false, error: description };
  }
  return { ok: true };
}
