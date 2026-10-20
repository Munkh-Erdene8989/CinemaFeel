import { revenueBetween, type RevenueParty } from "./revenue";
import type { Payment, Series } from "./types";

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

export const SALARY_CYCLE_COUNT = 6;

export type SalaryStatus = "Хүлээгдэж буй" | "Олгосон";

export type SalaryCycle = {
  id: string;
  half: "a" | "b";
  year: number;
  month: number;
  start: number;
  end: number;
  payoutAt: number;
  label: string;
  payoutLabel: string;
};

export type SalaryPayout = {
  adminId: string;
  cycleId: string;
  paid: boolean;
  paidAt: number;
};

export type SalaryLine = {
  id: string;
  label: string;
  payoutLabel: string;
  start: number;
  end: number;
  payoutAt: number;
  current: boolean;
  direct: number;
  subscriptionShare: number;
  referral: number;
  total: number;
  paid: boolean;
  paidAt: number;
  status: SalaryStatus;
};

export type SalaryCreator = {
  adminId: string;
  name: string;
  username: string;
  bankName: string;
  bankAccount: string;
  lines: SalaryLine[];
};

export type SalaryReport = {
  creators: SalaryCreator[];
};

export type SalaryStaff = RevenueParty & {
  bankName?: string;
  bankAccount?: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function ubParts(ms: number) {
  const shifted = new Date(ms + UB_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function ubTimestamp(year: number, month: number, day: number) {
  return Date.UTC(year, month - 1, day) - UB_OFFSET_MS;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function salaryStatus(paid: boolean): SalaryStatus {
  return paid ? "Олгосон" : "Хүлээгдэж буй";
}

export function salaryPayoutDocId(adminId: string, cycleId: string) {
  return `${adminId}_${cycleId}`;
}

export function salaryCycleAt(year: number, month: number, half: "a" | "b"): SalaryCycle {
  const last = daysInMonth(year, month);
  if (half === "a") {
    return {
      id: `${year}-${pad(month)}-a`,
      half,
      year,
      month,
      start: ubTimestamp(year, month, 1),
      end: ubTimestamp(year, month, 16),
      payoutAt: ubTimestamp(year, month, 15),
      label: `${month} сарын 1 – 15`,
      payoutLabel: `${month} сарын 15`,
    };
  }
  const next = shiftMonth(year, month, 1);
  const payoutDay = Math.min(30, last);
  return {
    id: `${year}-${pad(month)}-b`,
    half,
    year,
    month,
    start: ubTimestamp(year, month, 16),
    end: ubTimestamp(next.year, next.month, 1),
    payoutAt: ubTimestamp(year, month, payoutDay),
    label: `${month} сарын 16 – ${last}`,
    payoutLabel: `${month} сарын ${payoutDay}`,
  };
}

export function currentSalaryCycle(now = Date.now()): SalaryCycle {
  const { year, month, day } = ubParts(now);
  return salaryCycleAt(year, month, day <= 15 ? "a" : "b");
}

export function previousSalaryCycle(cycle: SalaryCycle): SalaryCycle {
  if (cycle.half === "b") return salaryCycleAt(cycle.year, cycle.month, "a");
  const prev = shiftMonth(cycle.year, cycle.month, -1);
  return salaryCycleAt(prev.year, prev.month, "b");
}

export function recentSalaryCycles(now = Date.now(), count = SALARY_CYCLE_COUNT): SalaryCycle[] {
  const cycles: SalaryCycle[] = [];
  let current = currentSalaryCycle(now);
  for (let index = 0; index < count; index += 1) {
    cycles.push(current);
    current = previousSalaryCycle(current);
  }
  return cycles;
}

export function listedSalaryCycle(cycleId: string, now = Date.now()) {
  return recentSalaryCycles(now).find((cycle) => cycle.id === cycleId) ?? null;
}

export function buildSalaryCreators(
  cycles: SalaryCycle[],
  series: Series[],
  payments: Payment[],
  staff: SalaryStaff[],
  payouts: SalaryPayout[],
): SalaryCreator[] {
  const paid = new Map(payouts.map((item) => [`${item.adminId}_${item.cycleId}`, item]));
  const byCycle = cycles.map((cycle, index) => ({
    cycle,
    current: index === 0,
    report: revenueBetween(series, payments, staff, cycle.start, cycle.end),
  }));
  return staff
    .map((admin) => ({
      adminId: admin.id,
      name: admin.name || admin.username || admin.id,
      username: admin.username || "",
      bankName: admin.bankName || "",
      bankAccount: admin.bankAccount || "",
      lines: byCycle.map(({ cycle, current, report }) => {
        const mine = report.admins.find((item) => item.adminId === admin.id);
        const mark = paid.get(`${admin.id}_${cycle.id}`);
        const isPaid = mark?.paid === true;
        return {
          id: cycle.id,
          label: cycle.label,
          payoutLabel: cycle.payoutLabel,
          start: cycle.start,
          end: cycle.end,
          payoutAt: cycle.payoutAt,
          current,
          direct: mine?.direct ?? 0,
          subscriptionShare: mine?.subscriptionShare ?? 0,
          referral: mine?.referral ?? 0,
          total: mine?.total ?? 0,
          paid: isPaid,
          paidAt: isPaid ? Number(mark?.paidAt ?? 0) : 0,
          status: salaryStatus(isPaid),
        };
      }),
    }))
    .sort((a, b) => (b.lines[0]?.total ?? 0) - (a.lines[0]?.total ?? 0) || a.name.localeCompare(b.name, "mn"));
}
