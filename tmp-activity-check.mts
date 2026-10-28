import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildActivityReport } from "/Volumes/Munkhuu's data/CinemaFeel/src/lib/activity.ts";

const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64!, "base64").toString("utf8"));
initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) });
const db = getFirestore();
const [userSnap, viewSnap, daySnap, paymentSnap, settingsSnap] = await Promise.all([
  db.collection("users").select("displayName", "email", "phone", "joined", "subscriptionExpiresAt", "plan").get(),
  db.collection("views").select("uid", "seriesId", "createdAt").get(),
  db.collection("viewDays").select("uid", "seriesId", "createdAt").get(),
  db.collection("payments").select("uid", "mode", "status", "amount", "createdAt").get(),
  db.collection("settings").doc("app").get(),
]);

const text = (value: unknown) => String(value ?? "").trim();
const users = userSnap.docs.map((item) => {
  const data = item.data();
  return {
    uid: item.id,
    name: text(data.displayName),
    email: text(data.email),
    phone: text(data.phone),
    joined: text(data.joined),
    expiresAt: Number(data.subscriptionExpiresAt) || 0,
    plan: text(data.plan),
  };
});
const views = viewSnap.docs.map((item) => {
  const data = item.data();
  return { uid: text(data.uid), seriesId: text(data.seriesId), createdAt: Number(data.createdAt) || 0 };
});
const days = daySnap.docs.map((item) => {
  const data = item.data();
  return { uid: text(data.uid), seriesId: text(data.seriesId), createdAt: Number(data.createdAt) || 0 };
});
const payments = paymentSnap.docs.map((item) => {
  const data = item.data();
  return { uid: text(data.uid), mode: text(data.mode), status: text(data.status), amount: Number(data.amount) || 0, createdAt: Number(data.createdAt) || 0 };
});

const price = Number(String(settingsSnap.data()?.price ?? "").replace(/\D/g, "")) || 14900;
const current = buildActivityReport({ monthlyPrice: price, users, views, payments });
const corrected = buildActivityReport({ monthlyPrice: price, users, views: [...views, ...days], payments });

const modes: Record<string, number> = {};
const statuses: Record<string, number> = {};
for (const payment of payments) {
  const key = `${payment.status}|${payment.mode || "(хоосон)"}`;
  modes[key] = (modes[key] ?? 0) + 1;
  statuses[payment.status || "(хоосон)"] = (statuses[payment.status || "(хоосон)"] ?? 0) + 1;
}

const now = Date.now();
const day = 86400000;
const firstByUser = new Map<string, number>();
const dayByUser = new Map<string, number>();
let missingCreated = 0;
for (const view of views) {
  if (!view.createdAt) missingCreated += 1;
  firstByUser.set(view.uid, Math.max(firstByUser.get(view.uid) ?? 0, view.createdAt));
}
for (const view of days) {
  dayByUser.set(view.uid, Math.max(dayByUser.get(view.uid) ?? 0, view.createdAt));
}
let laterReplay = 0;
let replayMovesRecent = 0;
const currentRecent = new Set(current.groups.recent.map((row) => row.uid));
const correctedRecent = new Set(corrected.groups.recent.map((row) => row.uid));
for (const uid of dayByUser.keys()) {
  const first = firstByUser.get(uid) ?? 0;
  const latest = dayByUser.get(uid) ?? 0;
  if (latest - first > day) laterReplay += 1;
}
for (const uid of correctedRecent) if (!currentRecent.has(uid)) replayMovesRecent += 1;

const plusNoPayment = users.filter((user) => user.expiresAt > now && user.plan === "Plus" && !payments.some((payment) => payment.uid === user.uid && payment.status === "Амжилттай" && (payment.mode === "weekly" || payment.mode === "subscription"))).length;

const summary = {
  users: users.length,
  viewDocs: views.length,
  viewDayDocs: days.length,
  missingViewCreatedAt: missingCreated,
  payments: modes,
  groupsNow: {
    recent: current.groups.recent.length,
    dormant: current.groups.dormant.length,
    prospects: current.groups.prospects.length,
    expiring: current.groups.expiring.length,
  },
  groupsIfReplayCounts: {
    recent: corrected.groups.recent.length,
    dormant: corrected.groups.dormant.length,
    prospects: corrected.groups.prospects.length,
    expiring: corrected.groups.expiring.length,
  },
  forecast30: {
    renewal: current.windows[30].renewal.length,
    acquisition: current.windows[30].acquisition.length,
    base: current.windows[30].totals.base,
  },
  forecast30IfReplayCounts: {
    renewal: corrected.windows[30].renewal.length,
    acquisition: corrected.windows[30].acquisition.length,
    base: corrected.windows[30].totals.base,
  },
  usersWhoseLatestPlayIsAfterFirstWatch: laterReplay,
  recentMissingBecauseReplayIgnored: replayMovesRecent,
  plusWithoutSubscriptionPayment: plusNoPayment,
};
console.log(JSON.stringify(summary, null, 2));
