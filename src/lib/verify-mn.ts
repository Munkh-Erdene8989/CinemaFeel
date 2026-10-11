const API = "https://api.verify.mn";

export class VerifyMnError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type VerifySessionCreated = {
  sessionId: string;
  phone: string;
  shortcode: string;
  text: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
};

export type VerifySessionStatus = "PENDING" | "VERIFIED" | "EXPIRED";

export type VerifySessionState = {
  sessionId: string;
  sessionStatus: VerifySessionStatus;
  callbackStatus?: string;
  verifiedAt?: string;
  expiresAt?: string;
};

export function verifyConfigured() {
  return Boolean(process.env.VERIFY_MN_API_KEY?.trim());
}

export function normalizeMnPhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (/^\d{8}$/.test(digits)) return digits;
  if (/^976\d{8}$/.test(digits)) return digits.slice(3);
  return null;
}

export function toE164(phone: string) {
  return `+976${phone}`;
}

export function callbackUrl(origin: string, sessionId: string) {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") return undefined;
  return `${origin.replace(/\/$/, "")}/api/auth/phone/callback/${sessionId}`;
}

function apiKey() {
  const key = process.env.VERIFY_MN_API_KEY?.trim();
  if (!key) throw new VerifyMnError("VERIFY_MN_API_KEY дутуу байна.", 500);
  return key;
}

async function fail(response: Response, fallback: string) {
  const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
  const message = response.status === 401 ? "Verify.mn түлхүүр буруу байна." : data.error || data.message || fallback;
  throw new VerifyMnError(message, response.status);
}

export async function createVerifySession(input: { phone: string; text: string; callback?: string }) {
  const body: { phone: string; text: string; callback?: string } = { phone: input.phone, text: input.text };
  if (input.callback) body.callback = input.callback;
  const response = await fetch(`${API}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) await fail(response, "SMS сесс үүсгэж чадсангүй.");
  return (await response.json()) as VerifySessionCreated;
}

export async function getVerifySession(sessionId: string) {
  const response = await fetch(`${API}/sessions/${encodeURIComponent(sessionId)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) await fail(response, "SMS төлөв шалгаж чадсангүй.");
  return (await response.json()) as VerifySessionState;
}
