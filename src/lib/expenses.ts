import { expenseCategories, type Expense, type ExpenseCategory } from "./types";

type ExpenseDraft = {
  title: string;
  amount: number;
  category: ExpenseCategory;
  note: string;
  spentOn: string;
  createdAt: number;
};

const spentOnPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function expenseFromRecord(id: string, data: Record<string, unknown>): Expense | null {
  const title = String(data.title ?? "").trim();
  const category = expenseCategory(data.category);
  const amount = expenseAmount(data.amount);
  const spentOn = expenseDate(data.spentOn);
  if (!title || !category || !amount || !spentOn) return null;
  return {
    id,
    title,
    amount,
    category,
    note: String(data.note ?? "").trim(),
    spentOn,
    createdAt: Number(data.createdAt ?? 0),
  };
}

export function expenseWrite(body: Record<string, unknown>, createdAt = Date.now()): { error: string } | { value: ExpenseDraft } {
  const title = String(body.title ?? "").trim().replace(/\s+/g, " ");
  const category = expenseCategory(body.category);
  const amount = expenseAmount(body.amount);
  const spentOn = expenseDate(body.spentOn);
  const note = String(body.note ?? "").trim().replace(/\s+/g, " ");
  if (!title || title.length > 80) return { error: "Зардлын нэр 1–80 тэмдэгт байна." };
  if (!category) return { error: "Зардлын ангилал сонгоно уу." };
  if (!amount) return { error: "Дүн 1₮-өөс их байна." };
  if (!spentOn) return { error: "Огноо буруу байна." };
  if (note.length > 300) return { error: "Тэмдэглэл хэт урт байна." };
  return {
    value: { title, amount, category, note, spentOn, createdAt },
  };
}
