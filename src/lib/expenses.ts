import { expenseCategories, expenseFrequencies, expenseIntervals, type Expense, type ExpenseCategory, type ExpenseFrequency, type ExpenseInterval, type ExpenseSource, type ExpenseTemplate } from "./types";

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;
const spentOnPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const monthPattern = /^(\d{4})-(\d{2})$/;
const receiptPattern = /^expense-receipts\/[A-Za-z0-9._-]{1,120}\/[A-Za-z0-9._-]{1,140}$/;

export const EXPENSE_RECEIPT_LIMIT = 8 * 1024 * 1024;

type ExpenseDraft = {
  title: string;
  amount: number;
  category: ExpenseCategory;
  note: string;
  spentOn: string;
  createdAt: number;
  frequency: ExpenseFrequency;
  intervalMonths: number;
  templateId: string;
  source: ExpenseSource;
  receiptPath: string;
};

export type ExpenseEntry =
  | { error: string }
  | { kind: "once"; value: ExpenseDraft }
  | { kind: "recurring"; template: Omit<ExpenseTemplate, "id"> };

export function expenseCategory(value: unknown): ExpenseCategory | "" {
  const text = String(value ?? "").trim();
  return expenseCategories.includes(text as ExpenseCategory) ? (text as ExpenseCategory) : "";
}

export function expenseAmount(value: unknown) {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000_000) return 0;
  return amount;
}

export function expenseDate(value: unknown) {
  const text = String(value ?? "").trim();
  const match = spentOnPattern.exec(text);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  if (year < 2020 || year > 2100) return "";
  return text;
}

export function expenseMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseExpenseMonth(value: unknown) {
  const text = String(value ?? "").trim();
  const match = monthPattern.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

export function currentExpenseMonth(now = Date.now()) {
  const shifted = new Date(now + UB_OFFSET_MS);
  return expenseMonthKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1);
}

export function shiftExpenseMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function spentOnForMonth(monthKey: string, anchorDay: number) {
  const parsed = parseExpenseMonth(monthKey);
  if (!parsed || !Number.isFinite(anchorDay)) return "";
  const day = Math.min(Math.max(1, Math.round(anchorDay)), daysInMonth(parsed.year, parsed.month));
  return `${expenseMonthKey(parsed.year, parsed.month)}-${String(day).padStart(2, "0")}`;
}

export function expenseReceiptPath(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.includes("..") || !receiptPattern.test(text)) return "";
  return text;
}

export function expenseFrequencyLabel(frequency: ExpenseFrequency, intervalMonths = 0) {
  if (frequency === "monthly") return "Сар бүр";
  if (frequency === "custom") return intervalMonths > 0 ? `${intervalMonths} сар тутам` : "Давтамжит";
  return "Нэг удаа";
}

function readFrequency(value: unknown): ExpenseFrequency {
  const text = String(value ?? "").trim();
  return text === "monthly" || text === "custom" || text === "once" ? text : "once";
}

function readSource(value: unknown, templateId: string): ExpenseSource {
  const text = String(value ?? "").trim();
  if (text === "manual" || text === "recurring" || text === "salary") return text;
  return templateId ? "recurring" : "manual";
}

function readInterval(frequency: ExpenseFrequency, value: unknown) {
  if (frequency === "once") return 0;
  if (frequency === "monthly") return 1;
  const interval = Math.round(Number(value));
  return expenseIntervals.includes(interval as ExpenseInterval) ? interval : 0;
}

export function expenseFromRecord(id: string, data: Record<string, unknown>): Expense | null {
  const title = String(data.title ?? "").trim();
  const category = expenseCategory(data.category);
  const amount = expenseAmount(data.amount);
  const spentOn = expenseDate(data.spentOn);
  if (!title || !category || !amount || !spentOn) return null;
  const templateId = String(data.templateId ?? "").trim();
  let frequency = readFrequency(data.frequency);
  let intervalMonths = readInterval(frequency, data.intervalMonths);
  if (frequency === "custom" && !intervalMonths) {
    frequency = "monthly";
    intervalMonths = 1;
  }
  return {
    id,
    title,
    amount,
    category,
    note: String(data.note ?? "").trim(),
    spentOn,
    createdAt: Number(data.createdAt ?? 0),
    frequency,
    intervalMonths,
    templateId,
    source: readSource(data.source, templateId),
    receiptPath: expenseReceiptPath(data.receiptPath),
  };
}

type SharedExpenseFields = {
  title: string;
  amount: number;
  category: ExpenseCategory;
  note: string;
  spentOn: string;
  receiptPath: string;
  createdAt: number;
};

function sharedFields(body: Record<string, unknown>, createdAt: number): { error: string } | SharedExpenseFields {
  const title = String(body.title ?? "").trim().replace(/\s+/g, " ");
  const category = expenseCategory(body.category);
  const amount = expenseAmount(body.amount);
  const spentOn = expenseDate(body.spentOn);
  const note = String(body.note ?? "").trim().replace(/\s+/g, " ");
  const rawReceipt = String(body.receiptPath ?? "").trim();
  const receiptPath = expenseReceiptPath(body.receiptPath);
  if (!title || title.length > 80) return { error: "Зардлын нэр 1–80 тэмдэгт байна." };
  if (!category) return { error: "Зардлын ангилал сонгоно уу." };
  if (!amount) return { error: "Дүн 1₮-өөс их байна." };
  if (!spentOn) return { error: "Огноо буруу байна." };
  if (note.length > 300) return { error: "Тэмдэглэл хэт урт байна." };
  if (rawReceipt && !receiptPath) return { error: "Баримтын зам буруу байна." };
  return { title, amount, category, note, spentOn, receiptPath, createdAt };
}

export function expenseEntryWrite(body: Record<string, unknown>, createdAt = Date.now()): ExpenseEntry {
  const fields = sharedFields(body, createdAt);
  if ("error" in fields) return fields;
  const rawFrequency = body.frequency;
  const frequency = rawFrequency === undefined || rawFrequency === null || rawFrequency === ""
    ? "once"
    : expenseFrequencies.includes(String(rawFrequency) as ExpenseFrequency) ? String(rawFrequency) as ExpenseFrequency : "";
  if (!frequency) return { error: "Давтамж буруу байна." };
  if (frequency === "once") {
    return {
      kind: "once",
      value: {
        title: fields.title,
        amount: fields.amount,
        category: fields.category,
        note: fields.note,
        spentOn: fields.spentOn,
        createdAt: fields.createdAt,
        frequency: "once",
        intervalMonths: 0,
        templateId: "",
        source: "manual",
        receiptPath: fields.receiptPath,
      },
    };
  }
  const intervalMonths = frequency === "monthly" ? 1 : readInterval("custom", body.intervalMonths);
  if (frequency === "custom" && !intervalMonths) return { error: "Давтамж 2, 3, 6 эсвэл 12 сар байна." };
  const anchorDay = Number(fields.spentOn.slice(8, 10));
  return {
    kind: "recurring",
    template: {
      title: fields.title,
      amount: fields.amount,
      category: fields.category,
      note: fields.note,
      frequency,
      intervalMonths,
      startMonth: fields.spentOn.slice(0, 7),
      anchorDay,
      endedMonth: "",
      skippedMonths: [],
      receiptPath: fields.receiptPath,
      createdAt: fields.createdAt,
    },
  };
}

export function expenseWrite(body: Record<string, unknown>, createdAt = Date.now()): { error: string } | { value: ExpenseDraft } {
  const entry = expenseEntryWrite({ ...body, frequency: body.frequency ?? "once" }, createdAt);
  if ("error" in entry) return entry;
  if (entry.kind !== "once") return { error: "Нэг удаагийн зардал биш." };
  return { value: entry.value };
}

export type RecurringSchedule = {
  startMonth: string;
  intervalMonths: number;
  endedMonth: string;
  skippedMonths: string[];
};

export function recurringMonths(template: RecurringSchedule, throughMonth: string) {
  const start = parseExpenseMonth(template.startMonth);
  const through = parseExpenseMonth(throughMonth);
  if (!start || !through || template.intervalMonths < 1) return [];
  const ended = template.endedMonth ? parseExpenseMonth(template.endedMonth) : null;
  const cap = ended ? expenseMonthKey(ended.year, ended.month) : throughMonth;
  const last = cap < throughMonth ? cap : throughMonth;
  if (last < template.startMonth) return [];
  const skipped = new Set(template.skippedMonths);
  const months: string[] = [];
  let cursor = start;
  let index = 0;
  while (index <= 2000) {
    const key = expenseMonthKey(cursor.year, cursor.month);
    if (key > last) break;
    if (index % template.intervalMonths === 0 && !skipped.has(key)) months.push(key);
    cursor = shiftExpenseMonth(cursor.year, cursor.month, 1);
    index += 1;
  }
  return months;
}

export function recurringInstanceId(templateId: string, monthKey: string) {
  return `recur_${templateId}_${monthKey}`;
}

export function recurringInstanceDraft(template: ExpenseTemplate, monthKey: string, createdAt: number): ExpenseDraft | null {
  const spentOn = spentOnForMonth(monthKey, template.anchorDay);
  if (!spentOn) return null;
  return {
    title: template.title,
    amount: template.amount,
    category: template.category,
    note: template.note,
    spentOn,
    createdAt,
    frequency: template.frequency,
    intervalMonths: template.intervalMonths,
    templateId: template.id,
    source: "recurring",
    receiptPath: template.receiptPath,
  };
}

export function expenseTemplateFromRecord(id: string, data: Record<string, unknown>): ExpenseTemplate | null {
  const title = String(data.title ?? "").trim();
  const category = expenseCategory(data.category);
  const amount = expenseAmount(data.amount);
  const frequency = data.frequency === "custom" ? "custom" : data.frequency === "monthly" ? "monthly" : "";
  const intervalMonths = frequency === "monthly" ? 1 : readInterval("custom", data.intervalMonths);
  const start = parseExpenseMonth(data.startMonth);
  const anchorDay = Math.round(Number(data.anchorDay));
  if (!title || !category || !amount || !frequency || !intervalMonths || !start || anchorDay < 1 || anchorDay > 31) return null;
  const ended = data.endedMonth ? parseExpenseMonth(data.endedMonth) : null;
  if (data.endedMonth && !ended) return null;
  const skippedMonths = Array.isArray(data.skippedMonths)
    ? data.skippedMonths.map((item) => String(item)).filter((item) => parseExpenseMonth(item))
    : [];
  return {
    id,
    title,
    amount,
    category,
    note: String(data.note ?? "").trim(),
    frequency,
    intervalMonths,
    startMonth: expenseMonthKey(start.year, start.month),
    anchorDay,
    endedMonth: ended ? expenseMonthKey(ended.year, ended.month) : "",
    skippedMonths,
    receiptPath: expenseReceiptPath(data.receiptPath),
    createdAt: Number(data.createdAt ?? 0),
  };
}

export function expensesForMonth<T extends { spentOn: string }>(expenses: T[], month: string) {
  if (month === "all") return expenses;
  if (!parseExpenseMonth(month)) return [];
  return expenses.filter((item) => item.spentOn.startsWith(`${month}-`));
}

export function expenseCategoryTotals(expenses: Pick<Expense, "category" | "amount">[]) {
  const sums = new Map<ExpenseCategory, number>();
  for (const item of expenses) sums.set(item.category, (sums.get(item.category) ?? 0) + item.amount);
  return expenseCategories
    .filter((category) => (sums.get(category) ?? 0) > 0)
    .map((category) => ({ category, total: sums.get(category) ?? 0 }));
}

export function salaryExpenseId(adminId: string, cycleId: string) {
  return `salary_${adminId}_${cycleId}`;
}

export function salaryExpenseDraft(input: { name: string; payoutLabel: string; spentOn: string; amount: number; createdAt: number }): ExpenseDraft | null {
  const amount = expenseAmount(input.amount);
  const spentOn = expenseDate(input.spentOn);
  const payoutLabel = input.payoutLabel.trim().replace(/\s+/g, " ");
  const name = input.name.trim().replace(/\s+/g, " ") || "Бүтээгч";
  if (!amount || !spentOn || !payoutLabel) return null;
  const prefix = "Цалин · ";
  const suffix = ` · ${payoutLabel}`;
  const room = 80 - prefix.length - suffix.length;
  const clipped = room > 0 ? name.slice(0, room) : "";
  return {
    title: `${prefix}${clipped}${suffix}`.slice(0, 80),
    amount,
    category: "Цалин",
    note: "",
    spentOn,
    createdAt: input.createdAt,
    frequency: "once",
    intervalMonths: 0,
    templateId: "",
    source: "salary",
    receiptPath: "",
  };
}
