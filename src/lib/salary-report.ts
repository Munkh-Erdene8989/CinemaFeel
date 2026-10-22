import { mapSeries } from "./catalog";
import { adminDb } from "./firebase-admin";
import { paymentsWithoutQr } from "./payment-query";
import { buildSalaryCreators, type SalaryCycle, type SalaryPayout } from "./salary";
import type { Payment } from "./types";

export async function loadSalaryCreators(cycles: SalaryCycle[]) {
  const since = cycles[cycles.length - 1]?.start ?? Date.now();
  const cycleIds = cycles.map((cycle) => cycle.id);
  const payoutChunks: string[][] = [];
  for (let index = 0; index < cycleIds.length; index += 30) payoutChunks.push(cycleIds.slice(index, index + 30));
  const [seriesSnap, paymentSnap, staffSnap, payoutSnaps] = await Promise.all([
    adminDb().collection("series").get(),
    paymentsWithoutQr(adminDb().collection("payments").where("createdAt", ">=", since)).get(),
    adminDb().collection("admins").get(),
    Promise.all(payoutChunks.map((ids) => adminDb().collection("salaryPayouts").where("cycleId", "in", ids).get())),
  ]);
  const series = seriesSnap.docs.map((item) => mapSeries(item.id, item.data()));
  const payments = paymentSnap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Payment, "id">) }));
  const staff = staffSnap.docs.map((admin) => {
    const data = admin.data();
    return {
      id: admin.id,
      name: String(data.name ?? ""),
      username: String(data.username ?? ""),
      invitedById: String(data.invitedById ?? ""),
      bankName: String(data.bankName ?? ""),
      bankAccount: String(data.bankAccount ?? ""),
    };
  });
  const payouts: SalaryPayout[] = payoutSnaps.flatMap((snap) => snap.docs).map((item) => {
    const data = item.data();
    return {
      adminId: String(data.adminId ?? ""),
      cycleId: String(data.cycleId ?? ""),
      paid: data.paid === true,
      paidAt: Number(data.paidAt ?? 0),
    };
  }).filter((item) => item.adminId && item.cycleId);
  return buildSalaryCreators(cycles, series, payments, staff, payouts);
}
