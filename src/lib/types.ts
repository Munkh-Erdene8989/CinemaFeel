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
};

export const defaultSettings: Settings = {
  name: "CinemaFeel",
  email: "support@cinemafeel.mn",
  price: "14900",
  maintenance: false,
  registration: true,
  notifications: true,
};

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

export const genres = ["Романтик", "Драма", "Өшөө авалт", "Уран зөгнөлт"] as const;
export const SUPER_ADMIN_ID = "super";
