export function parseYouTubeUrl(input: string): { videoId: string; startAt: number } | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return { videoId: raw, startAt: 0 };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let videoId = "";
  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") videoId = url.searchParams.get("v") ?? "";
    else if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
      videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
    }
  }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

  const startAt = parseStart(url.searchParams.get("t") || url.searchParams.get("start") || "");
  return { videoId, startAt };
}

function parseStart(value: string) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!match || match[0] === "") return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}
