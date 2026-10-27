export function normalizeMailFromName(value: unknown) {
  const name = String(value ?? "").replace(/[<>"\r\n]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  return name || "CinemaFeel";
}

export function marketingFromSettings(data?: { emailEnabled?: unknown; smsEnabled?: unknown; mailFromName?: unknown; renewalMailEnabled?: unknown } | null) {
  return {
    emailEnabled: data?.emailEnabled !== false,
    smsEnabled: data?.smsEnabled !== false,
    mailFromName: normalizeMailFromName(data?.mailFromName),
    renewalMailEnabled: data?.renewalMailEnabled === true,
  };
}

const SUBJECT_LIMIT = 120;
const BODY_LIMIT = 4000;
const SMS_LIMIT = 300;

export function broadcastInput(input: { email?: unknown; sms?: unknown; subject?: unknown; body?: unknown; smsBody?: unknown }) {
  const email = input.email === true;
  const sms = input.sms === true;
  const subject = String(input.subject ?? "").replace(/\s+/g, " ").trim();
  const body = String(input.body ?? "").replace(/\r\n/g, "\n").trim();
  const smsBody = String(input.smsBody ?? "").replace(/\r\n/g, "\n").trim();
  if (!email && !sms) return { ok: false as const, error: "Имэйл эсвэл SMS сонгоно уу." };
  if (email && !subject) return { ok: false as const, error: "Имэйлийн гарчиг оруулна уу." };
  if (email && subject.length > SUBJECT_LIMIT) return { ok: false as const, error: "Гарчиг 120 тэмдэгтээс урт байна." };
  if (email && !body) return { ok: false as const, error: "Имэйлийн агуулга оруулна уу." };
  if (email && body.length > BODY_LIMIT) return { ok: false as const, error: "Имэйлийн агуулга 4000 тэмдэгтээс урт байна." };
  if (sms && !smsBody) return { ok: false as const, error: "SMS агуулга оруулна уу." };
  if (sms && smsBody.length > SMS_LIMIT) return { ok: false as const, error: "SMS 300 тэмдэгтээс урт байна." };
  return { ok: true as const, email, sms, subject, body, smsBody };
}

export function announcementAudience(input: {
  emails: string[];
  phones: string[];
  emailEnabled: boolean;
  smsEnabled: boolean;
  mature: boolean;
}) {
  const emails = input.emailEnabled ? input.emails : [];
  const phones = input.mature || !input.smsEnabled ? [] : input.phones;
  const suppressed =
    !emails.length &&
    !phones.length &&
    ((input.emails.length > 0 && !input.emailEnabled) || (input.phones.length > 0 && !input.smsEnabled && !input.mature));
  return { emails, phones, suppressed };
}
