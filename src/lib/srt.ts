function shiftStamp(clock: string, milli: string, offsetMs: number) {
  const [hours, minutes, seconds] = clock.split(":").map(Number);
  const total = Math.max(0, hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + Number(milli) + offsetMs);
  const nextHours = Math.floor(total / 3_600_000);
  const nextMinutes = Math.floor((total % 3_600_000) / 60_000);
  const nextSeconds = Math.floor((total % 60_000) / 1_000);
  const nextMilli = total % 1_000;
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return `${pad(nextHours)}:${pad(nextMinutes)}:${pad(nextSeconds)}.${pad(nextMilli, 3)}`;
}

export function srtToVtt(raw: string, offsetMs = 0) {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const timed = offsetMs
    ? text.replace(/(\d{2}:\d{2}:\d{2})[,.](\d{3})/g, (_, clock: string, milli: string) => shiftStamp(clock, milli, offsetMs))
    : text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${timed.trim()}\n`;
}
