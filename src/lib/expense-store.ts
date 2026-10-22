import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { adminBucket, adminDb } from "./firebase-admin";
import {
  currentExpenseMonth,
  expenseCategoryTotals,
  expenseEntryWrite,
  expenseFromRecord,
  expenseReceiptPath,
  expenseTemplateFromRecord,
  expensesForMonth,
  recurringInstanceDraft,
  recurringInstanceId,
  recurringMonths,
  salaryExpenseDraft,
  salaryExpenseId,
} from "./expenses";
import { salaryPayoutDate, type SalaryCycle } from "./salary";
import type { Expense, ExpenseTemplate } from "./types";

type StoreError = { error: string; status?: number };

function chunks<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

function cleanId(value: string) {
  const id = value.trim();
  if (!id || id.includes("/") || id.includes("..")) return "";
  return id;
}

function safePdfName(fileName: string) {
  const safe = (fileName || "receipt").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe || "receipt"}.pdf`;
}

function ownsReceipt(id: string, path: string) {
  return expenseReceiptPath(path) === path && path.startsWith(`expense-receipts/${id}/`);
}

async function deleteReceiptIfUnused(path: string) {
  const receiptPath = expenseReceiptPath(path);
  if (!receiptPath) return;
  const [expenses, templates] = await Promise.all([
    adminDb().collection("expenses").where("receiptPath", "==", receiptPath).limit(1).get(),
    adminDb().collection("expenseTemplates").where("receiptPath", "==", receiptPath).limit(1).get(),
  ]);
  if (!expenses.empty || !templates.empty) return;
  try {
    await adminBucket().file(receiptPath).delete({ ignoreNotFound: true });
  } catch {
    // The ledger row is already updated. A missing bucket should not block it.
  }
}

export async function ensureRecurringExpenses(now = Date.now()) {
  const through = currentExpenseMonth(now);
  const snap = await adminDb().collection("expenseTemplates").get();
  const templates = snap.docs
    .map((item) => expenseTemplateFromRecord(item.id, item.data() as Record<string, unknown>))
    .filter((item): item is ExpenseTemplate => item !== null);
  const planned = templates.flatMap((template) => recurringMonths(template, through).flatMap((month) => {
    const draft = recurringInstanceDraft(template, month, now);
    return draft ? [{ id: recurringInstanceId(template.id, month), draft }] : [];
  }));
  if (!planned.length) return;
  const existing = new Set<string>();
  for (const group of chunks(planned, 100)) {
    const refs = group.map((item) => adminDb().collection("expenses").doc(item.id));
    const found = await adminDb().getAll(...refs);
    for (const item of found) if (item.exists) existing.add(item.id);
  }
  const missing = planned.filter((item) => !existing.has(item.id));
  for (const group of chunks(missing, 400)) {
    const batch = adminDb().batch();
    for (const item of group) batch.set(adminDb().collection("expenses").doc(item.id), item.draft);
    await batch.commit();
  }
}

export async function listExpenses(month: string) {
  await ensureRecurringExpenses();
  const snap = await adminDb().collection("expenses").get();
  const expenses = expensesForMonth(
    snap.docs
      .map((item) => expenseFromRecord(item.id, item.data() as Record<string, unknown>))
      .filter((item): item is Expense => item !== null),
    month,
  ).sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt - a.createdAt);
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  return { expenses, total, byCategory: expenseCategoryTotals(expenses), month };
}

async function latestRecurringExpense(template: ExpenseTemplate) {
  const months = recurringMonths(template, currentExpenseMonth());
  const month = months[months.length - 1];
  if (!month) return null;
  const snap = await adminDb().collection("expenses").doc(recurringInstanceId(template.id, month)).get();
  if (!snap.exists) return null;
  return expenseFromRecord(snap.id, snap.data() as Record<string, unknown>);
}

export async function createExpense(body: Record<string, unknown>): Promise<StoreError | { expense: Expense | null; templateId: string }> {
  const written = expenseEntryWrite(body);
  if ("error" in written) return written;
  if (written.kind === "once") {
    const ref = adminDb().collection("expenses").doc();
    await ref.set(written.value);
    return { expense: { id: ref.id, ...written.value }, templateId: "" };
  }
  const ref = adminDb().collection("expenseTemplates").doc();
  const template: ExpenseTemplate = { id: ref.id, ...written.template };
  await ref.set(written.template);
  await ensureRecurringExpenses();
  return { expense: await latestRecurringExpense(template), templateId: ref.id };
}

async function dropLaterInstances(templateId: string, month: string) {
  const snap = await adminDb().collection("expenses").where("templateId", "==", templateId).get();
  const later = snap.docs.filter((item) => String(item.data().spentOn ?? "").slice(0, 7) > month);
  const paths = later.map((item) => expenseReceiptPath(item.data().receiptPath));
  for (const group of chunks(later, 400)) {
    const batch = adminDb().batch();
    for (const item of group) batch.delete(item.ref);
    await batch.commit();
  }
  for (const path of paths) await deleteReceiptIfUnused(path);
}

export async function removeExpense(id: string, stop: boolean): Promise<StoreError | { ok: true }> {
  const clean = cleanId(id);
  if (!clean) return { error: "Зардал олдсонгүй.", status: 404 };
  const ref = adminDb().collection("expenses").doc(clean);
  const snap = await ref.get();
  if (!snap.exists) return { error: "Зардал олдсонгүй.", status: 404 };
  const expense = expenseFromRecord(snap.id, snap.data() as Record<string, unknown>);
  if (!expense) return { error: "Зардал олдсонгүй.", status: 404 };
  const month = expense.spentOn.slice(0, 7);
  if (stop) {
    if (!expense.templateId) return { error: "Энэ зардал давтамжтай биш." };
    const templateRef = adminDb().collection("expenseTemplates").doc(expense.templateId);
    const template = await templateRef.get();
    if (!template.exists) return { error: "Тогтмол зардлын загвар олдсонгүй.", status: 404 };
    await templateRef.set({ endedMonth: month }, { merge: true });
    await dropLaterInstances(expense.templateId, month);
    return { ok: true };
  }
  if (expense.templateId) {
    const templateRef = adminDb().collection("expenseTemplates").doc(expense.templateId);
    const template = await templateRef.get();
    if (template.exists) await templateRef.set({ skippedMonths: FieldValue.arrayUnion(month) }, { merge: true });
  }
  await ref.delete();
  await deleteReceiptIfUnused(expense.receiptPath);
  return { ok: true };
}

async function receiptTarget(expenseId: string, templateId: string): Promise<StoreError | { id: string; kind: "expense" | "template"; ref: DocumentReference }> {
  const expense = cleanId(expenseId);
  const template = cleanId(templateId);
  if ((expense && template) || (!expense && !template)) return { error: "Баримтын мэдээлэл дутуу." };
  if (expense) {
    const ref = adminDb().collection("expenses").doc(expense);
    const snap = await ref.get();
    if (!snap.exists) return { error: "Зардал олдсонгүй.", status: 404 };
    return { id: expense, kind: "expense", ref };
  }
  const ref = adminDb().collection("expenseTemplates").doc(template);
  const snap = await ref.get();
  if (!snap.exists) return { error: "Тогтмол зардлын загвар олдсонгүй.", status: 404 };
  return { id: template, kind: "template", ref };
}

export async function receiptUploadTarget(input: { expenseId?: string; templateId?: string; fileName?: string; contentType?: string }): Promise<StoreError | { uploadUrl: string; storagePath: string }> {
  if ((input.contentType || "application/octet-stream") !== "application/pdf") return { error: "Зөвхөн PDF хавсаргана." };
  const target = await receiptTarget(String(input.expenseId ?? ""), String(input.templateId ?? ""));
  if ("error" in target) return target;
  const storagePath = `expense-receipts/${target.id}/${Date.now()}-${safePdfName(String(input.fileName ?? ""))}`;
  if (!ownsReceipt(target.id, storagePath)) return { error: "Баримтын зам буруу байна." };
  try {
    const [uploadUrl] = await adminBucket().file(storagePath).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType: "application/pdf",
    });
    return { uploadUrl, storagePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage холбогдсонгүй.";
    return { error: `Firebase Storage бэлэн биш байна. ${message}`, status: 503 };
  }
}

export async function saveReceipt(input: { expenseId?: string; templateId?: string; receiptPath?: string; applyToEmpty?: boolean }): Promise<StoreError | { ok: true }> {
  const target = await receiptTarget(String(input.expenseId ?? ""), String(input.templateId ?? ""));
  if ("error" in target) return target;
  const receiptPath = expenseReceiptPath(input.receiptPath);
  if (!ownsReceipt(target.id, receiptPath)) return { error: "Баримтын зам буруу байна." };
  const previous = expenseReceiptPath(target.ref ? (await target.ref.get()).data()?.receiptPath : "");
  await target.ref.set({ receiptPath }, { merge: true });
  if (target.kind === "template" && input.applyToEmpty) {
    const instances = await adminDb().collection("expenses").where("templateId", "==", target.id).get();
    const empty = instances.docs.filter((item) => !expenseReceiptPath(item.data().receiptPath));
    for (const group of chunks(empty, 400)) {
      const batch = adminDb().batch();
      for (const item of group) batch.set(item.ref, { receiptPath }, { merge: true });
      await batch.commit();
    }
  }
  if (previous && previous !== receiptPath) await deleteReceiptIfUnused(previous);
  return { ok: true };
}

export async function receiptReadUrl(expenseId: string): Promise<StoreError | { url: string }> {
  const id = cleanId(expenseId);
  if (!id) return { error: "Зардал олдсонгүй.", status: 404 };
  const snap = await adminDb().collection("expenses").doc(id).get();
  if (!snap.exists) return { error: "Зардал олдсонгүй.", status: 404 };
  const receiptPath = expenseReceiptPath(snap.data()?.receiptPath);
  if (!receiptPath) return { error: "Баримт алга.", status: 404 };
  try {
    const [url] = await adminBucket().file(receiptPath).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
      responseType: "application/pdf",
      responseDisposition: "inline",
    });
    return { url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage холбогдсонгүй.";
    return { error: `Firebase Storage бэлэн биш байна. ${message}`, status: 503 };
  }
}

export async function syncSalaryExpense(input: { adminId: string; name: string; cycle: SalaryCycle; amount: number; paid: boolean; paidAt: number }) {
  const ref = adminDb().collection("expenses").doc(salaryExpenseId(input.adminId, input.cycle.id));
  const existing = await ref.get();
  const previous = expenseReceiptPath(existing.data()?.receiptPath);
  const draft = input.paid
    ? salaryExpenseDraft({
      name: input.name,
      payoutLabel: input.cycle.payoutLabel,
      spentOn: salaryPayoutDate(input.cycle),
      amount: input.amount,
      createdAt: input.paidAt || Date.now(),
    })
    : null;
  if (!draft) {
    if (!existing.exists) return "none" as const;
    await ref.delete();
    await deleteReceiptIfUnused(previous);
    return "removed" as const;
  }
  await ref.set(previous ? { ...draft, receiptPath: previous } : draft);
  return "added" as const;
}
