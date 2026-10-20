const SITE_MARK = "CinemaFeel.mn";

export function playbackMark(input: { phone?: string | null; email?: string | null }) {
  const phone = String(input.phone ?? "").trim();
  const email = String(input.email ?? "").trim();
  const lines = [phone, email.includes("@") ? email : "", SITE_MARK].filter(Boolean);
  return phone || email.includes("@") ? lines.join("\n") : "";
}
