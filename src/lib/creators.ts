import { validCornerName, normalizeCornerName } from "./creator-site";
import { CREATOR_FEE, creatorContentTypes } from "./types";
import { normalizeMnPhone } from "./verify-mn";
import { normalizeInviteCode, normalizeUsername, validUsername } from "./staff";

export { CREATOR_FEE };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreatorDraft = {
  lastName: string;
  firstName: string;
  username: string;
  cornerName: string;
  password: string;
  phone: string;
  email: string;
  portfolio: string;
  contentType: string;
  experience: string;
  inviteCode: string;
  bankName: string;
  bankAccount: string;
};

export function parseCreatorDraft(body: Record<string, unknown>): { value: CreatorDraft } | { error: string } {
  const lastName = String(body.lastName ?? "").trim().replace(/\s+/g, " ");
  const firstName = String(body.firstName ?? "").trim().replace(/\s+/g, " ");
  const username = normalizeUsername(String(body.username ?? ""));
  const cornerName = normalizeCornerName(body.cornerName);
  const password = String(body.password ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = normalizeMnPhone(String(body.phone ?? ""));
  const contentType = String(body.contentType ?? "").trim();
  const portfolio = String(body.portfolio ?? "").trim();
  const experience = String(body.experience ?? "").trim();
  const inviteCode = normalizeInviteCode(String(body.inviteCode ?? ""));
  const bankName = String(body.bankName ?? "").trim().replace(/\s+/g, " ");
  const bankAccount = String(body.bankAccount ?? "").replace(/\D/g, "");

  if (lastName.length < 2 || lastName.length > 40) return { error: "Овгоо оруулна уу." };
  if (firstName.length < 2 || firstName.length > 40) return { error: "Нэрээ оруулна уу." };
  if (!validUsername(username)) return { error: "Нэвтрэх нэр 3–32 тэмдэгт, жижиг үсэг, тоо, . _ - байна." };
  if (!validCornerName(cornerName)) return { error: "Кино булангийн нэр 2–40 тэмдэгт, үсэг эсвэл тоогоор эхэлнэ." };
  if (password.length < 8 || password.length > 72) return { error: "Нууц үг хамгийн багадаа 8 тэмдэгт." };
  if (!phone) return { error: "Утасны дугаар 8 оронтой байна." };
  if (!emailPattern.test(email) || email.length > 120) return { error: "И-мэйл хаяг буруу байна." };
  if (!creatorContentTypes.includes(contentType as (typeof creatorContentTypes)[number])) return { error: "Контентын төрөл сонгоно уу." };
  if (portfolio.length > 240 || /^(javascript|data):/i.test(portfolio)) return { error: "Холбоос буруу байна." };
  if (experience.length > 1000) return { error: "Туршлага, санаа 1000 тэмдэгтээс богино байна." };
  if (inviteCode && (inviteCode.length < 4 || inviteCode.length > 12)) return { error: "Урилгын код буруу байна." };
  if (bankName.length < 2 || bankName.length > 60) return { error: "Банкны нэрээ оруулна уу." };
  if (bankAccount.length < 8 || bankAccount.length > 20) return { error: "Дансны дугаар 8–20 оронтой байна." };
  if (body.terms !== true) return { error: "Үйлчилгээний нөхцөлийг зөвшөөрнө үү." };

  return {
    value: {
      lastName,
      firstName,
      username,
      cornerName,
      password,
      phone: `+976${phone}`,
      email,
      portfolio,
      contentType,
      experience,
      inviteCode,
      bankName,
      bankAccount,
    },
  };
}
