import { SUPER_ADMIN_ID, type AdminRevenue, type Payment, type ReferralEarning, type RevenueReport, type RevenueRow, type Series } from "./types";

const CREATOR_DIRECT_PERCENT = 80;
const SUBSCRIPTION_CREATOR_PERCENT = 50;
const REFERRAL_PERCENT = 10;

function ownerIdOf(series: Series) {
  return series.ownerId || SUPER_ADMIN_ID;
}

function ownerNameOf(series: Series, names: Map<string, string>) {
  const ownerId = ownerIdOf(series);
  return names.get(ownerId) || series.ownerName || (ownerId === SUPER_ADMIN_ID ? "Super admin" : ownerId);
}

function percentOf(amount: number, percent: number) {
  return Math.floor((amount * percent) / 100);
}

function emptyAdmin(adminId: string, name: string): AdminRevenue {
  return {
    adminId,
    name,
    contentCount: 0,
    uniqueViews: 0,
    gross: 0,
    direct: 0,
    platformFee: 0,
    subscriptionShare: 0,
    referral: 0,
    referrals: [],
    total: 0,
    sharePercent: 0,
  };
}

export function buildRevenue(series: Series[], payments: Payment[], names: Map<string, string>, invitedBy = new Map<string, string>()): RevenueReport {
  const grossBySeries = new Map<string, number>();
  let subscriptionGross = 0;
  for (const payment of payments) {
    if (payment.status !== "Амжилттай") continue;
    if (payment.mode === "subscription") subscriptionGross += Number(payment.amount) || 0;
    else if (payment.seriesId) grossBySeries.set(payment.seriesId, (grossBySeries.get(payment.seriesId) ?? 0) + (Number(payment.amount) || 0));
  }

  const subscriptionPool = percentOf(subscriptionGross, SUBSCRIPTION_CREATOR_PERCENT);
  const platformSubscription = subscriptionGross - subscriptionPool;
  const totalUniqueViews = series.reduce((sum, item) => sum + Math.max(0, item.uniqueViews || 0), 0);
  const rows: RevenueRow[] = series.map((item) => {
    const uniqueViews = Math.max(0, item.uniqueViews || 0);
    const gross = grossBySeries.get(item.id) ?? 0;
    const direct = percentOf(gross, CREATOR_DIRECT_PERCENT);
    const subscriptionShare = totalUniqueViews > 0 ? Math.floor((subscriptionPool * uniqueViews) / totalUniqueViews) : 0;
    return {
      seriesId: item.id,
      title: item.title,
      ownerId: ownerIdOf(item),
      ownerName: ownerNameOf(item, names),
      uniqueViews,
      gross,
      direct,
      platformFee: gross - direct,
      subscriptionShare,
      total: direct + subscriptionShare,
      sharePercent: totalUniqueViews > 0 ? (uniqueViews / totalUniqueViews) * 100 : 0,
    };
  });

  const allocated = rows.reduce((sum, row) => sum + row.subscriptionShare, 0);
  const leftover = totalUniqueViews > 0 ? subscriptionPool - allocated : 0;
  if (leftover > 0) {
    const top = rows.reduce((best, row) => (row.uniqueViews > best.uniqueViews ? row : best), rows[0]);
    if (top && top.uniqueViews > 0) {
      top.subscriptionShare += leftover;
      top.total += leftover;
    }
  }

  const referralsByInviter = new Map<string, Map<string, ReferralEarning>>();
  let referralPaid = 0;
  let platformDirect = 0;
  for (const row of rows) {
    const inviterId = invitedBy.get(row.ownerId) || "";
    const reward = inviterId && inviterId !== row.ownerId ? Math.min(percentOf(row.gross, REFERRAL_PERCENT), row.platformFee) : 0;
    platformDirect += row.platformFee - reward;
    referralPaid += reward;
    if (!reward || !inviterId) continue;
    const lines = referralsByInviter.get(inviterId) ?? new Map<string, ReferralEarning>();
    const line = lines.get(row.ownerId) ?? { creatorId: row.ownerId, name: row.ownerName, gross: 0, reward: 0 };
    line.gross += row.gross;
    line.reward += reward;
    line.name = names.get(row.ownerId) || row.ownerName;
    lines.set(row.ownerId, line);
    referralsByInviter.set(inviterId, lines);
  }

  const byAdmin = new Map<string, AdminRevenue>();
  for (const row of rows) {
    const current = byAdmin.get(row.ownerId) ?? emptyAdmin(row.ownerId, row.ownerName);
    current.contentCount += 1;
    current.uniqueViews += row.uniqueViews;
    current.gross += row.gross;
    current.direct += row.direct;
    current.platformFee += row.platformFee;
    current.subscriptionShare += row.subscriptionShare;
    current.total += row.total;
    current.name = names.get(row.ownerId) || row.ownerName;
    byAdmin.set(row.ownerId, current);
  }

  for (const [inviterId, lines] of referralsByInviter) {
    const current = byAdmin.get(inviterId) ?? emptyAdmin(inviterId, names.get(inviterId) || inviterId);
    current.referrals = [...lines.values()].sort((a, b) => b.reward - a.reward || b.gross - a.gross);
    current.referral = current.referrals.reduce((sum, item) => sum + item.reward, 0);
    current.total += current.referral;
    current.name = names.get(inviterId) || current.name;
    byAdmin.set(inviterId, current);
  }

  for (const admin of byAdmin.values()) {
    admin.sharePercent = totalUniqueViews > 0 ? (admin.uniqueViews / totalUniqueViews) * 100 : 0;
  }

  return {
    subscriptionGross,
    subscriptionPool,
    platformSubscription,
    platformDirect,
    referralPaid,
    totalUniqueViews,
    unallocated: totalUniqueViews > 0 ? 0 : subscriptionPool,
    rows: rows.sort((a, b) => b.total - a.total || b.uniqueViews - a.uniqueViews),
    admins: [...byAdmin.values()].sort((a, b) => b.total - a.total || b.uniqueViews - a.uniqueViews),
  };
}
