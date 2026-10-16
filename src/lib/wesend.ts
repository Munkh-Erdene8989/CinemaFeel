import { releaseMessage, type ReleaseMail } from "./mail";
import { normalizeMnPhone } from "./verify-mn";

const API = "https://api.wesend.mn/v1";
const BULK_LIMIT = 1000;
const SMS_CHAR_LIMIT = 300;
const LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ё: "yo", ж: "j", з: "z", и: "i", й: "i",
  к: "k", л: "l", м: "m", н: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i",
  ь: "", э: "e", ю: "yu", я: "ya",
};
const VOWELS = new Set(["а", "е", "ё", "и", "о", "ө", "у", "ү", "ы", "э", "ю", "я"]);

export function cyrillicToLatin(input: string) {
  let out = "";
  let atWordStart = true;
  let prevVowel = false;
  for (const char of input) {
    const lower = char.toLowerCase();
    const mapped = lower === "е" ? (atWordStart || prevVowel ? "ye" : "e") : LATIN[lower];
    if (mapped === undefined) {
      out += char;
      atWordStart = !/\p{L}/u.test(char);
      prevVowel = false;
      continue;
    }
    const cased = char === lower ? mapped : `${mapped.charAt(0).toUpperCase()}${mapped.slice(1)}`;
    out += cased;
    atWordStart = false;
    prevVowel = VOWELS.has(lower);
  }
  return out;
}

export function wesendConfigured() {
  return Boolean(process.env.WESEND_API_KEY?.trim());
}

export function supportedMnMobile(input: string) {
  const phone = normalizeMnPhone(input);
  if (!phone) return null;
  const prefix = Number(phone.slice(0, 4));
  if (prefix >= 5000 && prefix <= 5599) {
    const unitel = prefix <= 5049;
    const mobicom = prefix >= 5050 && prefix <= 5099;
    const toki = prefix >= 5500 && prefix <= 5549;
    const mobicomHigh = prefix >= 5550 && prefix <= 5599;
    return unitel || mobicom || toki || mobicomHigh ? phone : null;
  }
  if (phone.startsWith("8181")) return phone;
  const two = phone.slice(0, 2);
  const operators = new Set(["85", "94", "95", "99", "69", "90", "91", "92", "96", "80", "86", "88", "89", "78", "83", "87", "93", "97", "98", "60", "66", "72"]);
  return operators.has(two) ? phone : null;
}

export function releaseSmsText(title: string, link: string) {
  const head = "Shine kontent nemegdlee: ";
  const cleanTitle = cyrillicToLatin(title).replace(/\s+/g, " ").trim() || "Shine kino";
  const tail = ` ${link}`;
  const room = SMS_CHAR_LIMIT - head.length - tail.length;
  if (room < 1) return `${head.trimEnd()}${tail}`.slice(0, SMS_CHAR_LIMIT);
  if (cleanTitle.length <= room) return `${head}${cleanTitle}${tail}`;
  const ellipsis = "...";
  if (room <= ellipsis.length) return `${head}${cleanTitle.slice(0, room)}${tail}`;
  return `${head}${cleanTitle.slice(0, room - ellipsis.length).trimEnd()}${ellipsis}${tail}`;
}

type SendResult = { ok: true } | { ok: false; error: string };

function explain(code: string, fallback: string) {
  if (code === "trial_recipient") return "WeSend туршилтын горимд зөвхөн баталгаажсан утас, имэйл рүү илгээнэ.";
  if (code === "insufficient_credits") return "WeSend кредит хүрэлцэхгүй байна.";
  if (code === "subscription_required") return "WeSend илгээх эрх идэвхгүй байна.";
  if (code === "invalid_api_key") return "WeSend API түлхүүр буруу байна.";
  if (code === "message_too_long") return "Мэдэгдэл хэт урт байна.";
  if (code === "unsupported_number") return "Утасны дугаар руу SMS илгээх боломжгүй.";
  return fallback;
}

async function postBulk(path: string, body: unknown, idempotencyKey: string): Promise<SendResult> {
  const key = process.env.WESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "WeSend тохиргоо дутуу байна." };
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("wesend request failed", error);
    return { ok: false, error: "WeSend рүү холбогдож чадсангүй." };
  }
  const data = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } | string };
  if (response.ok) return { ok: true };
  const error = data.error;
  const code = typeof error === "object" && error ? String(error.code ?? "") : "";
  const message = typeof error === "string" ? error : error?.message || "";
  console.error("wesend send failed", response.status, code, message);
  return { ok: false, error: explain(code, "Мэдэгдэл илгээгдсэнгүй.") };
}

async function sendChunks(path: string, recipients: string[], seriesId: string, channel: "email" | "sms", payload: (chunk: string[]) => unknown) {
  const tag = seriesId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "series";
  for (let index = 0; index < recipients.length; index += BULK_LIMIT) {
    const chunk = recipients.slice(index, index + BULK_LIMIT);
    const sent = await postBulk(path, payload(chunk), `new-release/${tag}/${channel}/${index}`);
    if (!sent.ok) return sent;
  }
  return { ok: true as const };
}

export async function sendReleaseEmails(recipients: string[], mail: ReleaseMail, seriesId: string) {
  const message = releaseMessage(mail);
  return sendChunks("/email/bulk", recipients, seriesId, "email", (to) => ({
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    from_name: "CinemaFeel",
  }));
}

export async function sendReleaseSms(recipients: string[], title: string, link: string, seriesId: string) {
  return sendChunks("/sms/bulk", recipients, seriesId, "sms", (to) => ({
    to,
    text: releaseSmsText(title, link),
  }));
}
