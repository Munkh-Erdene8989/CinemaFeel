import { SUPER_ADMIN_ID, type AdminRevenue, type Payment, type RevenueReport, type RevenueRow, type Series } from "./types";

function ownerIdOf(series: Series) {
  return series.ownerId || SUPER_ADMIN_ID;
}

function ownerNameOf(series: Series, names: Map<string, string>) {
  const ownerId = ownerIdOf(series);
  return names.get(ownerId) || series.ownerName || (ownerId === SUPER_ADMIN_ID ? "Super admin" : ownerId);
}

export function buildRevenue(series: Series[], payments: Payment[], names: Map<string, string>): RevenueReport {
  const directBySeries = new Map<string, number>();
  let subscriptionPool = 0;
  for (const payment of payments) {
    if (payment.status !== "Амжилттай") continue;
    if (payment.mode === "subscription") subscriptionPool += Number(payment.amount) || 0;
    else if (payment.seriesId) directBySeries.set(payment.seriesId, (directBySeries.get(payment.seriesId) ?? 0) + (Number(payment.amount) || 0));
  }

  const totalUniqueViews = series.reduce((sum, item) => sum + Math.max(0, item.uniqueViews || 0), 0);
  const rows: RevenueRow[] = series.map((item) => {
    const uniqueViews = Math.max(0, item.uniqueViews || 0);
    const ownerId = ownerIdOf(item);
    const direct = directBySeries.get(item.id) ?? 0;
    const subscriptionShare = totalUniqueViews > 0 ? Math.floor((subscriptionPool * uniqueViews) / totalUniqueViews) : 0;
    return {
      seriesId: item.id,
      title: item.title,
      ownerId,
      ownerName: ownerNameOf(item, names),
      uniqueViews,
      direct,
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

  const byAdmin = new Map<string, AdminRevenue>();
  for (const row of rows) {
    const current = byAdmin.get(row.ownerId) ?? {
      adminId: row.ownerId,
      name: row.ownerName,
      contentCount: 0,
      uniqueViews: 0,
      direct: 0,
      subscriptionShare: 0,
      total: 0,
      sharePercent: 0,
    };
    current.contentCount += 1;
    current.uniqueViews += row.uniqueViews;
    current.direct += row.direct;
    current.subscriptionShare += row.subscriptionShare;
    current.total += row.total;
    current.name = names.get(row.ownerId) || row.ownerName;
    byAdmin.set(row.ownerId, current);
  }
  for (const admin of byAdmin.values()) {
    admin.sharePercent = totalUniqueViews > 0 ? (admin.uniqueViews / totalUniqueViews) * 100 : 0;
  }

  return {
    subscriptionPool,
    totalUniqueViews,
    unallocated: totalUniqueViews > 0 ? 0 : subscriptionPool,
    rows: rows.sort((a, b) => b.total - a.total || b.uniqueViews - a.uniqueViews),
    admins: [...byAdmin.values()].sort((a, b) => b.total - a.total || b.uniqueViews - a.uniqueViews),
  };
}
