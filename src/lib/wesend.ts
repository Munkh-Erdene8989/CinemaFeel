import { releaseMessage, type ReleaseMail } from "./mail";
import { normalizeMnPhone } from "./verify-mn";

const API = "https://api.wesend.mn/v1";
const BULK_LIMIT = 1000;
const SMS_CHAR_LIMIT = 300;

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
  const head = "Шинэ контент нэмэгдлээ: ";
  const cleanTitle = title.replace(/\s+/g, " ").trim() || "Шинэ кино";
  const tail = ` ${link}`;
  const room = SMS_CHAR_LIMIT - head.length - tail.length;
  if (room < 1) return `${head.trimEnd()}${tail}`.slice(0, SMS_CHAR_LIMIT);
  const short = cleanTitle.length > room ? `${cleanTitle.slice(0, room - 1).trimEnd()}…` : cleanTitle;
  return `${head}${short}${tail}`;
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
