import { createReadStream, createWriteStream } from "node:fs";
import { open, mkdir, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { adminBucket, adminDb } from "../src/lib/firebase-admin.ts";
import { faststartPlan, patchChunkOffsets, relocationMap } from "../src/lib/mp4-faststart.ts";

const root = "/Volumes/Munkhuu's data/tmp-cinemafeel-remux";
const apply = process.argv.includes("--apply");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

async function indexFile(filePath) {
  const handle = await open(filePath, "r");
  const { size } = await handle.stat();
  const header = Buffer.alloc(16);
  const boxes = [];
  let pos = 0;
  while (pos + 8 <= size) {
    await handle.read(header, 0, 16, pos);
    let boxSize = header.readUInt32BE(0);
    const type = header.toString("ascii", 4, 8);
    if (!/^[ -~]{4}$/.test(type)) throw new Error(`хайрцагны төрөл буруу @ ${pos}`);
    if (boxSize === 1) boxSize = Number(header.readBigUInt64BE(8));
    else if (boxSize === 0) boxSize = size - pos;
    if (!Number.isSafeInteger(boxSize) || boxSize < 8 || pos + boxSize > size) throw new Error(`${type} хайрцаг тасархай`);
    boxes.push({ type, start: pos, size: boxSize });
    pos += boxSize;
  }
  await handle.close();
  if (pos !== size) throw new Error("файл тасархай");
  return { size, boxes };
}

async function appendRange(src, dest, start, end) {
  if (end < start) return;
  await pipeline(createReadStream(src, { start, end }), dest, { end: false });
}

function ranges(boxes) {
  const merged = [];
  for (const box of boxes) {
    const start = box.start;
    const end = box.start + box.size - 1;
    const last = merged.at(-1);
    if (last && last.end + 1 === start) last.end = end;
    else merged.push({ start, end });
  }
  return merged;
}

async function rewrite(src, dest, plan) {
  const moov = Buffer.alloc(plan.moov.size);
  const handle = await open(src, "r");
  await handle.read(moov, 0, plan.moov.size, plan.moov.start);
  await handle.close();
  const patched = patchChunkOffsets(moov, relocationMap(plan));
  const out = createWriteStream(dest);
  for (const range of ranges(plan.prefix)) await appendRange(src, out, range.start, range.end);
  if (!out.write(patched)) await new Promise((resolve) => out.once("drain", resolve));
  for (const range of ranges(plan.rest)) await appendRange(src, out, range.start, range.end);
  await new Promise((resolve, reject) => out.end((error) => (error ? reject(error) : resolve())));
}

async function download(remote, dest) {
  let received = 0;
  let lastLog = 0;
  const stream = remote.createReadStream();
  stream.on("data", (chunk) => {
    received += chunk.length;
    if (received - lastLog >= 64 * 1024 * 1024) {
      lastLog = received;
      console.log(`  татсан ${(received / 1024 / 1024).toFixed(0)} МБ`);
    }
  });
  await pipeline(stream, createWriteStream(dest));
}

async function targets() {
  const snap = await adminDb().collectionGroup("episodes").get();
  const rows = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const storagePath = String(data.storagePath || "");
    if (!storagePath || data.source === "youtube") continue;
    const seriesId = doc.ref.parent.parent?.id;
    if (!seriesId) continue;
    const series = await doc.ref.parent.parent.get();
    rows.push({
      seriesId,
      episodeId: doc.id,
      title: String(series.data()?.title || seriesId),
      status: String(series.data()?.status || ""),
      storagePath,
      number: Number(data.number || 0),
    });
  }
  return rows;
}

async function classifyHead(remote) {
  const [meta] = await remote.getMetadata();
  const size = Number(meta.size || 0);
  const end = Math.min(size, 512 * 1024) - 1;
  const [head] = await remote.download({ start: 0, end });
  const boxes = [];
  let pos = 0;
  let moovBeforeMdat = false;
  let sawMdat = false;
  while (pos + 8 <= head.length) {
    let boxSize = head.readUInt32BE(pos);
    const type = head.toString("ascii", pos + 4, pos + 8);
    if (boxSize === 1) {
      if (pos + 16 > head.length) break;
      boxSize = Number(head.readBigUInt64BE(pos + 8));
    }
    if (boxSize < 8) break;
    if (type === "mdat") sawMdat = true;
    if (type === "moov" && !sawMdat) moovBeforeMdat = true;
    if (type === "moov" && !sawMdat) return { size, kind: "faststart" };
    if (pos + boxSize > head.length) break;
    boxes.push(type);
    pos += boxSize;
  }
  return { size, kind: moovBeforeMdat ? "faststart" : "rewrite", head: boxes.slice(0, 6).join(",") };
}

await mkdir(root, { recursive: true });
const rows = await targets();
console.log(`анги ${rows.length}`);
const pending = [];
for (const row of rows) {
  const remote = adminBucket().file(row.storagePath);
  const [exists] = await remote.exists();
  if (!exists) {
    console.log(`АЛГА ${row.title} #${row.number} файл байхгүй`);
    continue;
  }
  const info = await classifyHead(remote);
  console.log(`${info.kind === "faststart" ? "OK" : "ЗАСАХ"} ${row.status} ${row.title} #${row.number} ${(info.size / 1024 / 1024).toFixed(0)}МБ ${info.head || ""}`);
  if (info.kind === "rewrite") pending.push({ ...row, size: info.size });
}

if (!apply) {
  console.log(`засах ${pending.length}. --apply гэж ажиллуулна.`);
  process.exit(0);
}

pending.sort((a, b) => a.size - b.size);
for (const row of pending.slice(0, limit)) {
  console.log(`\n${row.title} #${row.number}`);
  const src = `${root}/in.mp4`;
  const dest = `${root}/out.mp4`;
  await rm(src, { force: true });
  await rm(dest, { force: true });
  const remote = adminBucket().file(row.storagePath);
  await download(remote, src);
  const indexed = await indexFile(src);
  const plan = faststartPlan(indexed.boxes);
  if (plan.action !== "rewrite") {
    console.log(`  алгасах: ${plan.reason}`);
    continue;
  }
  console.log(`  moov ${plan.moov.size} байт, mdat ${plan.rest.length}`);
  await rewrite(src, dest, plan);
  const check = await indexFile(dest);
  const checked = faststartPlan(check.boxes);
  if (checked.action !== "skip" || checked.reason !== "faststart" || check.size !== indexed.size) {
    throw new Error("хувиргалт баталгаажсангүй");
  }
  const nextPath = `videos/${row.seriesId}/${Date.now()}-fast.mp4`;
  console.log(`  илгээж байна`);
  await adminBucket().upload(dest, {
    destination: nextPath,
    metadata: { contentType: "video/mp4", cacheControl: "private, max-age=3600" },
    resumable: true,
  });
  const uploaded = adminBucket().file(nextPath);
  const [meta] = await uploaded.getMetadata();
  if (Number(meta.size) !== indexed.size) throw new Error("илгээсэн хэмжээ зөрүүтэй");
  await adminDb().collection("series").doc(row.seriesId).collection("episodes").doc(row.episodeId).update({
    storagePath: nextPath,
    contentType: "video/mp4",
  });
  console.log(`  солигдсон ${row.storagePath}`);
  await rm(src, { force: true });
  await rm(dest, { force: true });
}

const left = await stat(root).catch(() => null);
if (left) await rm(root, { recursive: true, force: true });
console.log("дууссан");
