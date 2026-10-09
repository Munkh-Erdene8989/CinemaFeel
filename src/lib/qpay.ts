type TokenCache = { accessToken: string; expiresAt: number };

let cache: TokenCache | null = null;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} дутуу байна.`);
  return value;
}

export function qpayConfig() {
  return {
    clientId: required("QPAY_CLIENT_ID"),
    clientSecret: required("QPAY_CLIENT_SECRET"),
    invoiceCode: required("QPAY_INVOICE_CODE"),
    baseUrl: (process.env.QPAY_BASE_URL || "https://merchant.qpay.mn").replace(/\/$/, ""),
    receiverCode: process.env.QPAY_RECEIVER_CODE || "terminal",
  };
}

async function accessToken() {
  if (cache && cache.expiresAt > Date.now() + 60_000) return cache.accessToken;
  const { clientId, clientSecret, baseUrl } = qpayConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v2/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    message?: string;
    error?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(data.message || data.error || "QPay token авч чадсангүй.");
  }
  cache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

export async function qpayRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { baseUrl } = qpayConfig();
  const token = await accessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.message || data.error || `QPay алдаа (${response.status})`);
  }
  return data;
}

export type QPayInvoice = {
  invoice_id: string;
  qr_text?: string;
  qr_image?: string;
  qPay_shortUrl?: string;
  urls?: { name: string; description: string; logo: string; link: string }[];
};

export async function createInvoice(input: {
  senderInvoiceNo: string;
  description: string;
  amount: number;
  callbackUrl: string;
}) {
  const { invoiceCode, receiverCode } = qpayConfig();
  return qpayRequest<QPayInvoice>("POST", "/v2/invoice", {
    invoice_code: invoiceCode,
    sender_invoice_no: input.senderInvoiceNo,
    invoice_receiver_code: receiverCode,
    invoice_description: input.description,
    amount: input.amount,
    callback_url: input.callbackUrl,
  });
}

export type QPayCheck = {
  count?: number;
  paid_amount?: number | string;
  rows?: {
    payment_id?: string;
    payment_status?: string;
    payment_amount?: number | string;
  }[];
};

export async function checkInvoice(invoiceId: string) {
  return qpayRequest<QPayCheck>("POST", "/v2/payment/check", {
    object_type: "INVOICE",
    object_id: invoiceId,
    offset: { page_number: 1, page_limit: 100 },
  });
}

export function paymentResult(check: QPayCheck, amount: number) {
  const row = (check.rows ?? []).find((item) => {
    const status = (item.payment_status ?? "").toUpperCase();
    return status === "PAID" || status === "SUCCESS" || Number(item.payment_amount ?? 0) >= amount;
  });
  const paidAmount = Number(row?.payment_amount ?? check.paid_amount ?? 0);
  const status = (row?.payment_status ?? "").toUpperCase();
  const paid = status === "PAID" || status === "SUCCESS" || (paidAmount >= amount && amount > 0 && (row || Number(check.count ?? 0) > 0));
  return { paid, paymentId: row?.payment_id || "" };
}

export function paidRow(check: QPayCheck) {
  return (check.rows ?? []).find((row) => {
    const status = (row.payment_status ?? "").toUpperCase();
    return status === "PAID" || status === "SUCCESS" || Number(row.payment_amount ?? 0) > 0;
  });
}

export async function refundPayment(paymentId: string) {
  return qpayRequest<unknown>("DELETE", `/v2/payment/refund/${paymentId}`);
}
