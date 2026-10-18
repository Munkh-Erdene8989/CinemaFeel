export type Mp4Box = { type: string; start: number; size: number };

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "udta", "mvex", "tref"]);

function view(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  let text = "";
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(bytes[offset + index] ?? 0);
  return text;
}

export function faststartPlan(boxes: Mp4Box[]) {
  const moov = boxes.find((box) => box.type === "moov");
  const mdat = boxes.find((box) => box.type === "mdat");
  if (!moov || !mdat) return { action: "skip" as const, reason: "no-moov-or-mdat" };
  if (boxes.some((box) => box.type === "moof")) return { action: "skip" as const, reason: "fragmented" };
  if (moov.start < mdat.start) return { action: "skip" as const, reason: "faststart" };
  return {
    action: "rewrite" as const,
    shift: moov.size,
    moov,
    prefix: boxes.filter((box) => box.type !== "moov" && box.start < mdat.start),
    rest: boxes.filter((box) => box.type !== "moov" && box.start >= mdat.start),
  };
}

function patchTable(out: Uint8Array, pos: number, size: number, header: number, kind: "stco" | "co64", move: (offset: number) => number) {
  const data = view(out);
  const table = pos + header;
  const count = data.getUint32(table + 4);
  const width = kind === "stco" ? 4 : 8;
  const entries = table + 8;
  if (count < 0 || entries + count * width > pos + size) throw new Error("offset хүснэгт тасархай");
  for (let index = 0; index < count; index += 1) {
    const at = entries + index * width;
    const current = kind === "stco" ? data.getUint32(at) : Number(data.getBigUint64(at));
    if (!Number.isSafeInteger(current)) throw new Error("offset хэтэрсэн");
    const next = move(current);
    if (!Number.isSafeInteger(next) || next < 0 || (kind === "stco" && next > 0xffffffff)) throw new Error("stco хэтэрсэн");
    if (kind === "stco") data.setUint32(at, next);
    else data.setBigUint64(at, BigInt(next));
  }
  return count;
}

export function relocationMap(plan: { shift: number; moov: Mp4Box; prefix: Mp4Box[]; rest: Mp4Box[] }) {
  const segments: { start: number; end: number; delta: number }[] = [];
  let cursor = 0;
  const place = (box: Mp4Box) => {
    segments.push({ start: box.start, end: box.start + box.size, delta: cursor - box.start });
    cursor += box.size;
  };
  for (const box of plan.prefix) place(box);
  place(plan.moov);
  for (const box of plan.rest) place(box);
  return (offset: number) => {
    const segment = segments.find((item) => offset >= item.start && offset < item.end);
    if (!segment) throw new Error("offset хайрцагт биш");
    const next = offset + segment.delta;
    if (!Number.isSafeInteger(next) || next < 0) throw new Error("offset буруу");
    return next;
  };
}

export function patchChunkOffsets(moov: Uint8Array, shift: number | ((offset: number) => number)) {
  const move = typeof shift === "function" ? shift : (offset: number) => offset + shift;
  if (typeof shift === "number" && (!Number.isSafeInteger(shift) || shift <= 0)) throw new Error("shift буруу");
  const out = new Uint8Array(moov);
  if (ascii(out, 4, 4) !== "moov") throw new Error("moov биш");
  let patched = 0;
  const walk = (start: number, end: number) => {
    let pos = start;
    while (pos + 8 <= end) {
      const data = view(out);
      let size = data.getUint32(pos);
      const kind = ascii(out, pos + 4, 4);
      let header = 8;
      if (size === 1) {
        if (pos + 16 > end) throw new Error("box header");
        size = Number(data.getBigUint64(pos + 8));
        header = 16;
      } else if (size === 0) size = end - pos;
      if (!Number.isSafeInteger(size) || size < header || pos + size > end) throw new Error(`${kind} хайрцаг тасархай`);
      if (kind === "stco" || kind === "co64") patched += patchTable(out, pos, size, header, kind, move);
      else if (CONTAINERS.has(kind)) walk(pos + header, pos + size);
      pos += size;
    }
  };
  walk(view(out).getUint32(0) === 1 ? 16 : 8, out.length);
  if (!patched) throw new Error("stco олдсонгүй");
  return out;
}

async function indexBlob(file: Blob) {
  const boxes: Mp4Box[] = [];
  let pos = 0;
  while (pos + 8 <= file.size) {
    const head = new Uint8Array(await file.slice(pos, Math.min(file.size, pos + 16)).arrayBuffer());
    const data = view(head);
    let size = data.getUint32(0);
    const type = ascii(head, 4, 4);
    if (!/^[\u0020-\u007e]{4}$/.test(type)) throw new Error("хайрцагны төрөл буруу");
    if (size === 1) size = Number(data.getBigUint64(8));
    else if (size === 0) size = file.size - pos;
    if (!Number.isSafeInteger(size) || size < 8 || pos + size > file.size) throw new Error(`${type} хайрцаг тасархай`);
    boxes.push({ type, start: pos, size });
    pos += size;
  }
  if (pos !== file.size) throw new Error("файл тасархай");
  return boxes;
}

function ranges(boxes: Mp4Box[]) {
  const merged: { start: number; end: number }[] = [];
  for (const box of boxes) {
    const last = merged.at(-1);
    if (last && last.end === box.start) last.end = box.start + box.size;
    else merged.push({ start: box.start, end: box.start + box.size });
  }
  return merged;
}

export async function playableMp4(file: Blob) {
  const name = file instanceof File ? file.name.toLowerCase() : "";
  const mp4 = file.type.includes("mp4") || file.type.includes("quicktime") || name.endsWith(".mp4") || name.endsWith(".mov");
  if (!mp4) return file;
  try {
    const boxes = await indexBlob(file);
    const plan = faststartPlan(boxes);
    if (plan.action !== "rewrite" || plan.moov.size > 64 * 1024 * 1024) return file;
    const moov = new Uint8Array(await file.slice(plan.moov.start, plan.moov.start + plan.moov.size).arrayBuffer());
    const patched = patchChunkOffsets(moov, relocationMap(plan));
    const parts: BlobPart[] = [];
    for (const range of ranges(plan.prefix)) parts.push(file.slice(range.start, range.end));
    parts.push(new Blob([patched]));
    for (const range of ranges(plan.rest)) parts.push(file.slice(range.start, range.end));
    return new Blob(parts, { type: file.type || "video/mp4" });
  } catch {
    return file;
  }
}
