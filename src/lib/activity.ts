import { isSubscriptionCheckout } from "./entitlement";
import { settingAmount, WEEKLY_PRICE } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const activityWindows = [7, 30] as const;
export type ActivityWindowDays = (typeof activityWindows)[number];

export const bandWeight = { high: 0.7, mid: 0.4, low: 0.15 } as const;
export const acquisitionFactor = 0.5;
export const scenarioFactor = { low: 0.5, base: 1, high: 1.5 } as const;
export const scenarioCap = 0.9;

export type ActivityBand = keyof typeof bandWeight;
export type ActivityScenario = keyof typeof scenarioFactor;
export type ActivityKind = "renewal" | "acquisition";
export type PackageMode = "weekly" | "subscription";

export type ActivityViewer = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  joined: string;
  titles: number;
  seriesIds: string[];
  lastViewAt: number;
  expiresAt: number;
  packageMode: PackageMode | "";
  packagePrice: number;
  packagePayments: number;
};

export type ActivityForecastRow = ActivityViewer & {
  band: ActivityBand;
  reason: string;
  weight: number;
  price: number;
  amount: number;
};

export type ActivityTotals = Record<ActivityScenario, number>;

export type ActivityWindowReport = {
  renewal: ActivityForecastRow[];
  acquisition: ActivityForecastRow[];
  totals: ActivityTotals;
};

export type ActivityReport = {
  generatedAt: number;
  monthlyPrice: number;
  weeklyPrice: number;
  groups: {
    recent: ActivityViewer[];
    dormant: ActivityViewer[];
    prospects: ActivityViewer[];
    expiring: ActivityViewer[];
  };
  windows: Record<ActivityWindowDays, ActivityWindowReport>;
};

export type ActivityUserInput = {
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
  joined?: string;
  expiresAt?: number;
};

export type ActivityViewInput = {
  uid: string;
  seriesId: string;
  createdAt?: number;
};

export type ActivityPaymentInput = {
  uid: string;
  mode?: string;
  status?: string;
  amount?: number;
  createdAt?: number;
};

export function scenarioWeight(band: ActivityBand, kind: ActivityKind, scenario: ActivityScenario) {
  const base = bandWeight[band] * (kind === "acquisition" ? acquisitionFactor : 1);
  return Math.min(scenarioCap, base * scenarioFactor[scenario]);
}

export function monthlyListPrice(value: unknown) {
  return settingAmount(value, 14900);
}

export function weeklyListPrice(value: unknown) {
  return settingAmount(value, WEEKLY_PRICE);
}

function money(price: number, weight: number) {
  return Math.round(price * weight);
}

function listPrice(mode: PackageMode, monthlyPrice: number, weeklyPrice: number) {
  return mode === "weekly" ? weeklyPrice : monthlyPrice;
}

function renewalBand(viewer: ActivityViewer, now: number): { band: ActivityBand; reason: string } {
  const stale = viewer.lastViewAt <= 0 || now - viewer.lastViewAt > 14 * DAY_MS;
  if (viewer.titles <= 1) return { band: "low", reason: viewer.titles === 0 ? "Контент үзээгүй" : "1 контент үзсэн" };
  if (stale) return { band: "low", reason: "14 хоногоос илүү үзээгүй" };
  if (viewer.packagePayments >= 2 && now - viewer.lastViewAt <= 7 * DAY_MS && viewer.titles >= 4) {
    return { band: "high", reason: "Сунгасан, сүүлийн 7 хоногт үзсэн, 4 ба түүнээс олон контент" };
  }
  if (viewer.titles <= 3) return { band: "mid", reason: "2–3 контент үзсэн" };
  return { band: "mid", reason: "Идэвхтэй багц" };
}

function acquisitionBand(viewer: ActivityViewer, now: number): { band: ActivityBand; reason: string } {
  const stale = viewer.lastViewAt <= 0 || now - viewer.lastViewAt > 14 * DAY_MS;
  if (stale) return { band: "low", reason: "14 хоногоос илүү үзээгүй" };
  if (now - viewer.lastViewAt <= 7 * DAY_MS && viewer.titles >= 4) {
    return { band: "high", reason: "Сүүлийн 7 хоногт үзсэн, 4 ба түүнээс олон контент" };
  }
  return { band: "mid", reason: "2 ба түүнээс олон контент үзсэн" };
}

function forecastRow(viewer: ActivityViewer, kind: ActivityKind, band: ActivityBand, reason: string, price: number): ActivityForecastRow {
  const weight = scenarioWeight(band, kind, "base");
  return { ...viewer, band, reason, weight, price, amount: money(price, weight) };
}

function totalsOf(rows: { price: number; band: ActivityBand }[], kind: ActivityKind): ActivityTotals {
  const totals: ActivityTotals = { low: 0, base: 0, high: 0 };
  for (const row of rows) {
    for (const scenario of ["low", "base", "high"] as const) {
      totals[scenario] += money(row.price, scenarioWeight(row.band, kind, scenario));
    }
  }
  return totals;
}

function addTotals(left: ActivityTotals, right: ActivityTotals): ActivityTotals {
  return { low: left.low + right.low, base: left.base + right.base, high: left.high + right.high };
}

function byAmount(left: ActivityForecastRow, right: ActivityForecastRow) {
  return right.amount - left.amount || right.titles - left.titles || left.email.localeCompare(right.email);
}

function byRecent(left: ActivityViewer, right: ActivityViewer) {
  return right.lastViewAt - left.lastViewAt || right.titles - left.titles || left.email.localeCompare(right.email);
}

export function buildActivityReport(input: {
  now?: number;
  monthlyPrice: number;
  weeklyPrice?: number;
  users: ActivityUserInput[];
  views: ActivityViewInput[];
  payments: ActivityPaymentInput[];
}): ActivityReport {
  const now = input.now ?? Date.now();
  const monthlyPrice = input.monthlyPrice > 0 ? input.monthlyPrice : 14900;
  const weeklyPrice = input.weeklyPrice && input.weeklyPrice > 0 ? input.weeklyPrice : WEEKLY_PRICE;
  const watched = new Map<string, { seriesIds: Set<string>; lastViewAt: number }>();
  for (const view of input.views) {
    if (!view.uid || !view.seriesId) continue;
    const current = watched.get(view.uid) ?? { seriesIds: new Set<string>(), lastViewAt: 0 };
    current.seriesIds.add(view.seriesId);
    const seen = Number(view.createdAt) || 0;
    if (seen > current.lastViewAt) current.lastViewAt = seen;
    watched.set(view.uid, current);
  }
  const paid = new Map<string, { count: number; mode: PackageMode; price: number; createdAt: number }>();
  for (const payment of input.payments) {
    if (!payment.uid || payment.status !== "Амжилттай" || !isSubscriptionCheckout(payment.mode ?? "")) continue;
    const mode = payment.mode as PackageMode;
    const createdAt = Number(payment.createdAt) || 0;
    const amount = Number(payment.amount) || 0;
    const current = paid.get(payment.uid);
    if (!current) {
      paid.set(payment.uid, { count: 1, mode, price: amount > 0 ? amount : listPrice(mode, monthlyPrice, weeklyPrice), createdAt });
      continue;
    }
    current.count += 1;
    if (createdAt >= current.createdAt) {
      current.mode = mode;
      current.price = amount > 0 ? amount : listPrice(mode, monthlyPrice, weeklyPrice);
      current.createdAt = createdAt;
    }
  }

  const viewers: ActivityViewer[] = input.users.map((user) => {
    const history = watched.get(user.uid);
    const pack = paid.get(user.uid);
    return {
      uid: user.uid,
      name: String(user.name ?? "").trim(),
      email: String(user.email ?? "").trim(),
      phone: String(user.phone ?? "").trim(),
      joined: String(user.joined ?? "").trim(),
      titles: history?.seriesIds.size ?? 0,
      seriesIds: [...(history?.seriesIds ?? [])],
      lastViewAt: history?.lastViewAt ?? 0,
      expiresAt: Math.max(0, Number(user.expiresAt) || 0),
      packageMode: pack?.mode ?? "",
      packagePrice: pack?.price ?? 0,
      packagePayments: pack?.count ?? 0,
    };
  });

  const active = (viewer: ActivityViewer) => viewer.packagePayments > 0 && viewer.expiresAt > now;
  const groups = {
    recent: viewers.filter((viewer) => viewer.lastViewAt > 0 && now - viewer.lastViewAt <= 7 * DAY_MS).sort(byRecent),
    dormant: viewers.filter((viewer) => active(viewer) && (viewer.lastViewAt <= 0 || now - viewer.lastViewAt > 14 * DAY_MS)).sort(byRecent),
    prospects: viewers.filter((viewer) => viewer.packagePayments === 0 && viewer.expiresAt <= now && viewer.titles >= 2).sort(byRecent),
    expiring: viewers.filter((viewer) => active(viewer) && viewer.expiresAt <= now + 7 * DAY_MS).sort((left, right) => left.expiresAt - right.expiresAt),
  };

  const windows = {} as ActivityReport["windows"];
  for (const days of activityWindows) {
    const renewal = viewers
      .filter((viewer) => active(viewer) && viewer.expiresAt <= now + days * DAY_MS)
      .map((viewer) => {
        const picked = renewalBand(viewer, now);
        return forecastRow(viewer, "renewal", picked.band, picked.reason, viewer.packagePrice || listPrice(viewer.packageMode || "subscription", monthlyPrice, weeklyPrice));
      })
      .sort(byAmount);
    const acquisition = viewers
      .filter((viewer) => viewer.packagePayments === 0 && viewer.expiresAt <= now && viewer.titles >= 2 && viewer.lastViewAt > 0 && now - viewer.lastViewAt <= days * DAY_MS)
      .map((viewer) => {
        const picked = acquisitionBand(viewer, now);
        return forecastRow(viewer, "acquisition", picked.band, picked.reason, weeklyPrice);
      })
      .sort(byAmount);
    windows[days] = {
      renewal,
      acquisition,
      totals: addTotals(totalsOf(renewal, "renewal"), totalsOf(acquisition, "acquisition")),
    };
  }

  return { generatedAt: now, monthlyPrice, weeklyPrice, groups, windows };
}
