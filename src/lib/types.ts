import { marketingFromSettings } from "./marketing";

export type Access = "free" | "paid";
export type SeriesStatus = "Нийтлэгдсэн" | "Ноорог";
export type Plan = "Үндсэн" | "Plus";
export type UserStatus = "Идэвхтэй" | "Түр зогссон";
export type PaymentStatus = "Хүлээгдэж буй" | "Амжилттай" | "Буцаагдсан" | "Амжилтгүй";
export type CheckoutMode = "single" | "weekly" | "subscription" | "creator";

export const WEEKLY_PRICE = 5900;
export const WEEKLY_DAYS = 7;

export type AdminRole = "super" | "admin";

export type AdminSession = {
  role: AdminRole;
  adminId: string;
  name: string;
};

export type StaffAdmin = {
  id: string;
  username: string;
  name: string;
  active: boolean;
  createdAt: number;
  phone: string;
  email: string;
  paid: boolean;
  source: "self" | "manual";
  contentType: string;
  bankName: string;
  bankAccount: string;
  inviteCode: string;
  invitedById: string;
  invitedByCode: string;
  invitedByName: string;
  firstName: string;
  lastName: string;
  portfolio: string;
  experience: string;
  termsAcceptedAt: number;
  cornerName: string;
  cornerNameEdits: number;
};

export const CREATOR_FEE = 10000;

export const creatorContentTypes = ["Short drama", "Романтик", "Драма", "Комеди", "Триллер", "Бусад"] as const;

export type Series = {
  id: string;
  title: string;
  genre: string;
  description: string;
  episodes: number;
  price: number;
  access: Access;
  image: string;
  cover: string;
  shareCode: string;
  views: number;
  uniqueViews: number;
  ownerId: string;
  ownerName: string;
  status: SeriesStatus;
  featured: boolean;
  year: number;
  age: string;
  createdAt: number;
};

export type Episode = {
  id: string;
  number: number;
  title: string;
  storagePath: string;
  duration: number;
  source?: "file" | "youtube";
  startAt?: number;
  subtitleOffsetMs?: number;
};

export type Lesson = {
  id: string;
  title: string;
  description: string;
  cover: string;
  hasVideo: boolean;
  order: number;
  ownerId: string;
  ownerName: string;
  createdAt: number;
};

export type SeriesWithEpisodes = Series & { episodeList: Episode[] };

export type AppUser = {
  uid: string;
  email: string;
  phone?: string;
  plan: Plan;
  status: UserStatus;
  joined: string;
  subscriptionExpiresAt: number | null;
  displayName: string;
  photoURL: string;
};

export type Purchase = {
  id: string;
  uid: string;
  seriesId: string;
  amount: number;
  createdAt: number;
  paymentId: string;
};

export type QPayUrl = {
  name: string;
  description: string;
  logo: string;
  link: string;
};

export type Payment = {
  id: string;
  uid: string;
  email: string;
  amount: number;
  product: string;
  mode: CheckoutMode;
  seriesId: string | null;
  createdAt: number;
  date: string;
  method: "QPay";
  status: PaymentStatus;
  invoiceId: string;
  senderInvoiceNo: string;
  paymentId: string;
  qrImage: string;
  qrText: string;
  urls: QPayUrl[];
  creatorId?: string;
  originalAmount?: number;
  discountCode?: string;
  discountPercent?: number;
};

export type Discount = {
  code: string;
  percent: number;
  active: boolean;
  usedCount: number;
  createdAt: number;
};

export type Settings = {
  name: string;
  email: string;
  price: string;
  maintenance: boolean;
  registration: boolean;
  notifications: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  mailFromName: string;
  genres: string[];
};

export const defaultGenres = ["Романтик", "Драма", "Өшөө авалт", "Уран зөгнөлт"];

export const defaultSettings: Settings = {
  name: "CinemaFeel",
  email: "support@cinemafeel.mn",
  price: "14900",
  maintenance: false,
  registration: true,
  notifications: true,
  emailEnabled: true,
  smsEnabled: true,
  mailFromName: "CinemaFeel",
  genres: defaultGenres,
};

export function normalizeGenres(value: unknown) {
  const source = Array.isArray(value) ? value : defaultGenres;
  const genres: string[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    const name = String(item ?? "").trim().replace(/\s+/g, " ");
    const key = name.toLocaleLowerCase("mn");
    if (!name || name.length > 40 || key === "бүгд" || seen.has(key)) continue;
    seen.add(key);
    genres.push(name);
  }
  return genres.length ? genres : [...defaultGenres];
}

export function mergeSettings(data?: Partial<Settings> | null): Settings {
  return {
    ...defaultSettings,
    ...data,
    ...marketingFromSettings(data),
    genres: normalizeGenres(data?.genres),
  };
}

export type RevenueRow = {
  seriesId: string;
  title: string;
  ownerId: string;
  ownerName: string;
  uniqueViews: number;
  gross: number;
  direct: number;
  platformFee: number;
  subscriptionShare: number;
  total: number;
  sharePercent: number;
};

export type ReferralEarning = {
  creatorId: string;
  name: string;
  gross: number;
  reward: number;
};

export type AdminRevenue = {
  adminId: string;
  name: string;
  contentCount: number;
  uniqueViews: number;
  gross: number;
  direct: number;
  platformFee: number;
  subscriptionShare: number;
  referral: number;
  referrals: ReferralEarning[];
  total: number;
  sharePercent: number;
};

export type RevenueReport = {
  subscriptionGross: number;
  subscriptionPool: number;
  platformSubscription: number;
  platformDirect: number;
  referralPaid: number;
  totalUniqueViews: number;
  unallocated: number;
  rows: RevenueRow[];
  admins: AdminRevenue[];
};

export const SUPER_ADMIN_ID = "super";
