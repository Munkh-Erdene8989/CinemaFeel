export type Access = "free" | "paid";
export type SeriesStatus = "Нийтлэгдсэн" | "Ноорог";
export type Plan = "Үндсэн" | "Plus";
export type UserStatus = "Идэвхтэй" | "Түр зогссон";
export type PaymentStatus = "Хүлээгдэж буй" | "Амжилттай" | "Буцаагдсан" | "Амжилтгүй";
export type CheckoutMode = "single" | "subscription";

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
};

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
};

export type Settings = {
  name: string;
  email: string;
  price: string;
  maintenance: boolean;
  registration: boolean;
  notifications: boolean;
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
    genres: normalizeGenres(data?.genres),
  };
}

export type RevenueRow = {
  seriesId: string;
  title: string;
  ownerId: string;
  ownerName: string;
  uniqueViews: number;
  direct: number;
  subscriptionShare: number;
  total: number;
  sharePercent: number;
};

export type AdminRevenue = {
  adminId: string;
  name: string;
  contentCount: number;
  uniqueViews: number;
  direct: number;
  subscriptionShare: number;
  total: number;
  sharePercent: number;
};

export type RevenueReport = {
  subscriptionPool: number;
  totalUniqueViews: number;
  unallocated: number;
  rows: RevenueRow[];
  admins: AdminRevenue[];
};

export const SUPER_ADMIN_ID = "super";
