import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { applyMuxUpdate, muxClient, muxConfigured, readAsset } from "@/lib/mux";

export async function POST(request: NextRequest) {
  if (!muxConfigured() || !process.env.MUX_WEBHOOK_SECRET) return jsonError("Mux webhook тохируулаагүй.", 503);
  const body = await request.text();
  try {
    const event = await muxClient().webhooks.unwrap(body, request.headers);
    if (event.type === "video.asset.ready" || event.type === "video.asset.errored") {
      const passthrough = String(event.data.passthrough ?? "");
      await applyMuxUpdate(passthrough, readAsset(event.data));
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("Mux webhook хүлээж авсангүй.", error);
    return jsonError("Webhook баталгаажсангүй.", 401);
  }
}
