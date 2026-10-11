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

function shell(preheader: string, body: string) {
  return `<!DOCTYPE html>
<html lang="mn">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#070709;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070709;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#121216;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:28px 28px 0;font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:0.22em;color:#ff536a;">CINEMAFEEL</td></tr>
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

export async function sendOtpEmail(email: string, code: string) {
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
    from: fromAddress(),
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

export async function sendNewReleaseEmail(recipients: string[], mail: ReleaseMail, seriesId: string, idempotencyKey?: string) {
  const resend = client();
  if (!resend) return { ok: false as const, error: "Имэйл илгээх тохиргоо дутуу байна." };
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
  const text = lines.join("\n");
  const subject = `Шинээр нэмэгдлээ: ${copy.title}`;
  const tagId = seriesId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "series";
  const from = fromAddress();

  for (let index = 0; index < recipients.length; index += 100) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 150));
    const chunk = recipients.slice(index, index + 100);
    const { error } = await resend.batch.send(
      chunk.map((to) => ({
        from,
        to: [to],
        subject,
        html,
        text,
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
