import { Resend } from "resend";

export type ReleaseMail = {
  title: string;
  description: string;
  genre: string;
  year: number;
  episodes: number;
  cover: string;
  link: string;
  free: boolean;
};

function fromAddress() {
  return (process.env.RESEND_FROM_EMAIL || "").trim().replace(/^["']|["']$/g, "");
}

export function displayFrom(raw: string, fromName?: string) {
  const from = raw.trim().replace(/^["']|["']$/g, "");
  if (!fromName?.trim()) return from;
  const name = fromName.replace(/[<>"\r\n]/g, "").replace(/\s+/g, " ").trim().slice(0, 40) || "CinemaFeel";
  const email = from.match(/<([^>]+)>/)?.[1]?.trim() || from;
  if (!email.includes("@")) return from;
  return `${name} <${email}>`;
}

export function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && fromAddress());
}

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key || !fromAddress()) return null;
  return new Resend(key);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function publicSiteUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (!configured) return "https://cinemafeel.dev";
  try {
    const url = new URL(configured);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return "https://cinemafeel.dev";
    return configured;
  } catch {
    return "https://cinemafeel.dev";
  }
}

function shell(preheader: string, body: string) {
  const site = publicSiteUrl();
  const logo = `${site}/feel-cinema-logo.png`;
  return `<!DOCTYPE html>
<html lang="mn">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#070709;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070709;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#121216;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:28px 28px 0;">
          <a href="${escapeHtml(site)}" style="text-decoration:none;">
            <img src="${escapeHtml(logo)}" alt="feel cinema" width="139" height="84" style="display:block;border:0;outline:none;width:139px;height:auto;" />
          </a>
        </td></tr>
        <tr><td style="padding:18px 28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f4f4f5;">
          ${body}
        </td></tr>
      </table>
      <p style="max-width:560px;margin:16px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#71717a;font-size:12px;line-height:1.6;">Богино түүх, том мэдрэмж.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail(email: string, code: string, fromName?: string) {
  const resend = client();
  if (!resend) return { ok: false as const, error: "Имэйл илгээх тохиргоо дутуу байна." };
  const digits = escapeHtml(code);
  const html = shell(
    `Таны баталгаажуулах код ${code}. 10 минут хүчинтэй.`,
    `<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.16em;color:#ff536a;">НЭВТРЭХ</p>
     <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:800;">6 оронтой код</h1>
     <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">CinemaFeel-д нэвтрэхийн тулд доорх кодыг оруулна уу. Код 10 минут хүчинтэй.</p>
     <p style="margin:22px 0 0;padding:16px 12px;border-radius:14px;background:#1c1c22;text-align:center;font-size:32px;font-weight:800;letter-spacing:0.42em;color:#ffffff;">${digits}</p>
     <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#71717a;">Энэ кодыг хэн ч танаас асуух ёсгүй. Хэрэв та нэвтрэхийг хүсээгүй бол энэ захиаг устгана уу.</p>`,
  );
  const { error } = await resend.emails.send({
    from: displayFrom(fromAddress(), fromName),
    to: [email],
    subject: `${code} — CinemaFeel баталгаажуулах код`,
    html,
    text: `Таны CinemaFeel баталгаажуулах код: ${code}\n\nКод 10 минут хүчинтэй. Энэ кодыг хэнд ч бүү дамжуулаарай.`,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

function releaseCopy(mail: ReleaseMail) {
  const title = mail.title.replace(/\s+/g, " ").trim() || "Шинэ кино";
  const description = mail.description.replace(/\s+/g, " ").trim();
  const meta = [mail.genre, mail.year ? String(mail.year) : "", mail.episodes ? `${mail.episodes} анги` : "", mail.free ? "Үнэгүй" : ""]
    .filter(Boolean)
    .join(" · ");
  const lead = `${title} сая CinemaFeel дээр нэмэгдлээ. Шинэ түүхээ алгасах хэрэггүй — зурган дээр эсвэл доорх товч дээр дараад шууд нээгээрэй.`;
  const close = description
    ? "Богино анги. Том мэдрэмж. Өнөө орой нэг бүлэг нээхэд л хангалттай."
    : "Богино анги, гүн мэдрэмж. Өнөө орой нэг бүлэгт цаг гаргаарай — эхний анги таныг хүлээж байна.";
  return { title, description, meta, lead, close };
}

export function broadcastMessage(subject: string, body: string) {
  const title = subject.replace(/\s+/g, " ").trim();
  const copy = body.replace(/\r\n/g, "\n").trim();
  const blocks = copy.split(/\n{2,}/).map((block) => (
    `<p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#e4e4e7;">${escapeHtml(block).replace(/\n/g, "<br />")}</p>`
  )).join("");
  const html = shell(
    title,
    `<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.16em;color:#ff536a;">МЭДЭГДЭЛ</p>
     <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:800;">${escapeHtml(title)}</h1>
     ${blocks}`,
  );
  return { subject: title, html, text: `${title}\n\n${copy}` };
}

export function releaseMessage(mail: ReleaseMail) {
  const copy = releaseCopy(mail);
  const safeTitle = escapeHtml(copy.title);
  const safeLink = escapeHtml(mail.link);
  const safeCover = escapeHtml(mail.cover);
  const safeMeta = escapeHtml(copy.meta);
  const safeDescription = escapeHtml(copy.description);
  const html = shell(
    copy.lead,
    `<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.16em;color:#ff536a;">ШИНЭ КОНТЕНТ</p>
     <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;font-weight:800;">Шинээр нэмэгдлээ</h1>
     <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#d4d4d8;">${escapeHtml(copy.lead)}</p>
     <a href="${safeLink}" style="text-decoration:none;">
       <img src="${safeCover}" alt="${safeTitle}" width="504" style="width:100%;max-width:504px;height:auto;margin-top:22px;border:0;border-radius:16px;display:block;" />
     </a>
     <h2 style="margin:18px 0 0;font-size:22px;line-height:1.3;font-weight:800;">${safeTitle}</h2>
     ${safeMeta ? `<p style="margin:8px 0 0;font-size:13px;color:#a1a1aa;">${safeMeta}</p>` : ""}
     ${safeDescription ? `<p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#e4e4e7;">${safeDescription}</p>` : ""}
     <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#a1a1aa;">${escapeHtml(copy.close)}</p>
     <p style="margin:22px 0 0;">
       <a href="${safeLink}" style="display:inline-block;background:#ff3d56;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:12px;">Кино үзэх</a>
     </p>
     <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#71717a;">Та CinemaFeel-д бүртгэлтэй учраас шинэ контентыг хамгийн түрүүнд авлаа.</p>`,
  );
  const lines = ["Шинээр нэмэгдлээ", "", copy.lead, "", copy.title];
  if (copy.meta) lines.push(copy.meta);
  if (copy.description) lines.push("", copy.description);
  lines.push("", copy.close, "", `Кино үзэх: ${mail.link}`);
  return {
    subject: `Шинээр нэмэгдлээ: ${copy.title}`,
    html,
    text: lines.join("\n"),
  };
}

export type CreatorWelcome = {
  name: string;
  username: string;
  password: string;
  loginLink: string;
  ready: boolean;
};

export function creatorWelcomeMessage(mail: CreatorWelcome) {
  const name = mail.name.replace(/\s+/g, " ").trim() || "Бүтээгч";
  const username = mail.username.trim();
  const password = mail.password;
  const lead = mail.ready
    ? `${name}, таны CinemaFeel дашбоард нээгдлээ. Эхний богино түүхээ өнөөдөр оруулаарай — үзэгчид таныг хүлээж байна.`
    : `${name}, бүртгэл чинь хадгалагдлаа. Төлбөр баталгаажмагц доорх нэр, нууц үгээр дашбоард руу орно. Эхний түүхээ бэлдээрэй.`;
  const close = "Богино анги, том мэдрэмж. Таны булан CinemaFeel дээр таныг хүлээж байна.";
  const accessNote = mail.ready
    ? "Дашбоард одоо нээлттэй. Доорх мэдээллээр нэвтэрнэ үү."
    : "Бүртгэлийн төлбөр баталгаажмагц энэ нэр, нууц үгээр нэвтэрнэ.";
  const html = shell(
    lead,
    `<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.16em;color:#ff536a;">ДАШБОАРД</p>
     <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;font-weight:800;">Нэвтрэх мэдээлэл</h1>
     <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#d4d4d8;">${escapeHtml(lead)}</p>
     <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#a1a1aa;">${escapeHtml(accessNote)}</p>
     <p style="margin:18px 0 0;padding:16px 18px;border-radius:14px;background:#1c1c22;font-size:14px;line-height:1.8;color:#f4f4f5;">
       Нэвтрэх нэр<br /><b style="font-size:16px;">${escapeHtml(username)}</b><br /><br />
       Нууц үг<br /><b style="font-size:16px;">${escapeHtml(password)}</b>
     </p>
     <p style="margin:22px 0 0;">
       <a href="${escapeHtml(mail.loginLink)}" style="display:inline-block;background:#ff3d56;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:12px;">Дашбоард руу нэвтрэх</a>
     </p>
     <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#a1a1aa;">${escapeHtml(close)}</p>
     <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#71717a;">Нууц үгээ хэнд ч бүү дамжуулаарай. Нэвтэрсний дараа шинэ нууц үг тохируулж болно.</p>`,
  );
  const text = [
    "Нэвтрэх мэдээлэл",
    "",
    lead,
    "",
    accessNote,
    "",
    `Нэвтрэх нэр: ${username}`,
    `Нууц үг: ${password}`,
    "",
    close,
    "",
    `Дашбоард руу нэвтрэх: ${mail.loginLink}`,
    "",
    "Нууц үгээ хэнд ч бүү дамжуулаарай.",
  ].join("\n");
  return {
    subject: "CinemaFeel дашбоард нээгдлээ",
    html,
    text,
  };
}

export type CreatorNotice = {
  name: string;
  corner: string;
  contentType: string;
  link: string;
};

export function creatorNoticeMessage(mail: CreatorNotice) {
  const name = mail.name.replace(/\s+/g, " ").trim() || "Шинэ бүтээгч";
  const corner = mail.corner.replace(/\s+/g, " ").trim() || name;
  const contentType = mail.contentType.replace(/\s+/g, " ").trim();
  const lead = `${name} CinemaFeel-д нэгдлээ. ${corner} булан нээгдсэн — шинэ түүхийг хамгийн түрүүнд хүлээн аваарай.`;
  const close = "Богино анги, том мэдрэмж. Шинэ булангийн эхний бүтээлийг алгасах хэрэггүй.";
  const html = shell(
    lead,
    `<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.16em;color:#ff536a;">ШИНЭ БҮТЭЭГЧ</p>
     <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;font-weight:800;">Шинэ булан нээгдлээ</h1>
     <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#d4d4d8;">${escapeHtml(lead)}</p>
     <h2 style="margin:18px 0 0;font-size:22px;line-height:1.3;font-weight:800;">${escapeHtml(corner)}</h2>
     ${contentType ? `<p style="margin:8px 0 0;font-size:13px;color:#a1a1aa;">${escapeHtml(contentType)}</p>` : ""}
     <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#a1a1aa;">${escapeHtml(close)}</p>
     <p style="margin:22px 0 0;">
       <a href="${escapeHtml(mail.link)}" style="display:inline-block;background:#ff3d56;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:12px;">Булан үзэх</a>
     </p>
     <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#71717a;">Та CinemaFeel-д бүртгэлтэй учраас шинэ бүтээгчийг хамгийн түрүүнд авлаа.</p>`,
  );
  const lines = ["Шинэ булан нээгдлээ", "", lead, "", corner];
  if (contentType) lines.push(contentType);
  lines.push("", close, "", `Булан үзэх: ${mail.link}`);
  return {
    subject: `Шинэ бүтээгч: ${corner}`,
    html,
    text: lines.join("\n"),
  };
}

type OutboundMail = {
  subject: string;
  html: string;
  text: string;
};

const renewalCopy = {
  d3: {
    kicker: "БАГЦ",
    subject: "3 хоногийн дараа багц чинь дуусна",
    title: "3 хоног үлдлээ",
    paragraphs: [
      "Сайн уу,",
      "Багцын чинь хугацаа 3 хоногийн дараа дуусах гэж байна. Яарах зүйл байхгүй, санаанд чинь оруулж байгаа юм.",
      "Үзэж байсан түүх чинь тэндээ байгаа. Үргэлжлүүлээд үзмээр санагдвал багцаа сунгаад л болно.",
    ],
    button: "Үзсээр байя",
  },
  d1: {
    kicker: "БАГЦ",
    subject: "Маргааш багц дуусах нь",
    title: "Маргааш дуусна",
    paragraphs: [
      "Сайн уу,",
      "Маргааш багцын чинь хугацаа дуусна. Дараагийн анги хүлээж байгаа байх.",
      "Өнөөдөр сунгавал завсарлагагүй үргэлжилнэ. Зав гарвал хараарай.",
    ],
    button: "Багцаа сунгая",
  },
  offer: {
    kicker: "Чамд зориулсан",
    subject: "Чамд зориулж 20% үлдээсэн",
    title: "20% хөнгөлөлт",
    paragraphs: [
      "Сайн уу,",
      "Багц дуусаад 3 хонож байна. Эргэж ирэхгүй байхад чинь нэг юм бодогдсон.",
      "Зөвхөн чамд багцаа 20% хөнгөлөлттэй сунгах боломж үлдээсэн. 24 цаг хүчинтэй. Таалагдвал ашиглаарай, үгүй бол энэ мэйлийг орхиход болно.",
    ],
    button: "20%-тай эргэж ирье",
  },
} as const;

export function renewalMessage(input: { kind: keyof typeof renewalCopy; link: string; deadline?: string }) {
  const copy = renewalCopy[input.kind];
  const paragraphs: string[] = [...copy.paragraphs];
  if (input.kind === "offer" && input.deadline) paragraphs.push(`Энэ санал ${input.deadline} хүртэл нээлттэй.`);
  const blocks = paragraphs
    .map((paragraph) => `<p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#d4d4d8;">${escapeHtml(paragraph)}</p>`)
    .join("");
  const html = shell(
    paragraphs[1] || copy.subject,
    `<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.16em;color:#ff536a;">${escapeHtml(copy.kicker)}</p>
     <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;font-weight:800;">${escapeHtml(copy.title)}</h1>
     ${blocks}
     <p style="margin:22px 0 0;">
       <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#ff3d56;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:12px;">${escapeHtml(copy.button)}</a>
     </p>`,
  );
  return {
    subject: copy.subject,
    html,
    text: [...paragraphs, "", `${copy.button}: ${input.link}`].join("\n"),
  };
}

export async function sendResendEmails(recipients: string[], message: OutboundMail, category: string, idempotencyPrefix: string, fromName?: string) {
  const resend = client();
  if (!resend) return { ok: false as const, error: "Имэйл илгээх тохиргоо дутуу байна." };
  const tag = idempotencyPrefix.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "mail";
  const from = displayFrom(fromAddress(), fromName);
  for (let index = 0; index < recipients.length; index += 100) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 150));
    const chunk = recipients.slice(index, index + 100);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from,
        to: [to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: [{ name: "category", value: category }],
      })),
      { idempotencyKey: `${tag}/${index}` },
    );
    if (error) return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

export async function sendOneEmail(to: string, message: OutboundMail, idempotencyKey: string, fromName?: string) {
  const resend = client();
  if (!resend) return { ok: false as const, error: "Имэйл илгээх тохиргоо дутуу байна." };
  const key = idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "mail";
  const { error } = await resend.emails.send(
    {
      from: displayFrom(fromAddress(), fromName),
      to: [to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      tags: [{ name: "category", value: "renewal" }],
    },
    { idempotencyKey: key },
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function sendNewReleaseEmail(recipients: string[], mail: ReleaseMail, seriesId: string, idempotencyKey?: string, fromName?: string) {
  const resend = client();
  if (!resend) return { ok: false as const, error: "Имэйл илгээх тохиргоо дутуу байна." };
  const message = releaseMessage(mail);
  const tagId = seriesId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "series";
  const from = displayFrom(fromAddress(), fromName);

  for (let index = 0; index < recipients.length; index += 100) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 150));
    const chunk = recipients.slice(index, index + 100);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from,
        to: [to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: [
          { name: "category", value: "new_release" },
          { name: "series_id", value: tagId },
        ],
      })),
      { idempotencyKey: idempotencyKey || `new-release/${tagId}/${index}` },
    );
    if (error) return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}
