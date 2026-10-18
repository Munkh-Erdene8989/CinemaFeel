import assert from "node:assert/strict";
import test from "node:test";
import { faststartPlan, patchChunkOffsets, playableMp4, relocationMap, type Mp4Box } from "./mp4-faststart.ts";

function box(type: string, payload: Buffer) {
  const out = Buffer.alloc(8 + payload.length);
  out.writeUInt32BE(out.length, 0);
  out.write(type, 4, "ascii");
  payload.copy(out, 8);
  return out;
}

function table(type: "stco" | "co64", offsets: number[]) {
  const width = type === "stco" ? 4 : 8;
  const payload = Buffer.alloc(8 + offsets.length * width);
  payload.writeUInt32BE(offsets.length, 4);
  offsets.forEach((offset, index) => {
    if (type === "stco") payload.writeUInt32BE(offset, 8 + index * 4);
    else payload.writeBigUInt64BE(BigInt(offset), 8 + index * width);
  });
  return box(type, payload);
}

test("moov at the end is moved in front of mdat", () => {
  const boxes: Mp4Box[] = [
    { type: "ftyp", start: 0, size: 32 },
    { type: "mdat", start: 32, size: 1000 },
    { type: "mdat", start: 1032, size: 500 },
    { type: "moov", start: 1532, size: 80 },
  ];
  const plan = faststartPlan(boxes);
  assert.equal(plan.action, "rewrite");
  if (plan.action !== "rewrite") return;
  assert.equal(plan.shift, 80);
  assert.deepEqual(plan.prefix.map((item) => item.type), ["ftyp"]);
  assert.deepEqual(plan.rest.map((item) => item.type), ["mdat", "mdat"]);
});

test("faststart and fragmented files are left alone", () => {
  assert.equal(faststartPlan([{ type: "ftyp", start: 0, size: 32 }, { type: "moov", start: 32, size: 10 }, { type: "mdat", start: 42, size: 10 }]).action, "skip");
  assert.equal(faststartPlan([{ type: "ftyp", start: 0, size: 32 }, { type: "moof", start: 32, size: 10 }, { type: "mdat", start: 42, size: 10 }, { type: "moov", start: 52, size: 10 }]).reason, "fragmented");
});

test("a moov between mdats only shifts the samples before it", () => {
  const boxes: Mp4Box[] = [
    { type: "ftyp", start: 0, size: 32 },
    { type: "mdat", start: 32, size: 1000 },
    { type: "moov", start: 1032, size: 80 },
    { type: "mdat", start: 1112, size: 500 },
  ];
  const plan = faststartPlan(boxes);
  assert.equal(plan.action, "rewrite");
  if (plan.action !== "rewrite") return;
  const map = relocationMap(plan);
  assert.equal(map(100), 180);
  assert.equal(map(1200), 1200);
});

test("chunk offsets move by the moov size", () => {
  const moov = box("moov", Buffer.concat([
    box("trak", box("mdia", box("minf", box("stbl", Buffer.concat([
      table("stco", [100, 400]),
      table("co64", [900]),
    ]))))),
  ]));
  const patched = patchChunkOffsets(moov, 50);
  const stco = findBox(patched, "stco");
  const co64 = findBox(patched, "co64");
  assert.equal(u32(stco, 16), 150);
  assert.equal(u32(stco, 20), 450);
  assert.equal(u64(co64, 16), 950n);
  assert.throws(() => patchChunkOffsets(moov, 0xffffffff), /stco хэтэрсэн/);
});

test("a browser file gets moov before the media data", async () => {
  const sample = box("mdat", Buffer.from("sample-bytes"));
  const moov = box("moov", box("trak", box("mdia", box("minf", box("stbl", table("stco", [40]))))));
  const original = Buffer.concat([box("ftyp", Buffer.alloc(24)), sample, moov]);
  const fixed = new Uint8Array(await (await playableMp4(new Blob([original], { type: "video/mp4" }))).arrayBuffer());
  assert.equal(ascii(fixed, 36, 4), "moov");
  const stco = findBox(fixed, "stco");
  assert.equal(u32(stco, 16), 40 + moov.length);
});

function u32(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}

function u64(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset);
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return Buffer.from(bytes.subarray(offset, offset + length)).toString("ascii");
}

function findBox(buffer: Uint8Array, type: string): Uint8Array {
  let pos = 0;
  while (pos + 8 <= buffer.length) {
    const size = u32(buffer, pos);
    const kind = ascii(buffer, pos + 4, 4);
    if (kind === type) return buffer.subarray(pos, pos + size);
    const containers = new Set(["moov", "trak", "mdia", "minf", "stbl"]);
    if (containers.has(kind)) {
      const nested = findBox(buffer.subarray(pos + 8, pos + size), type);
      if (nested.length) return nested;
    }
    pos += size;
  }
  return new Uint8Array();
}
