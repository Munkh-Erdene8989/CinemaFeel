export function playbackProvider(input: { fallback?: boolean; muxPlaybackId?: string; muxStatus?: string }) {
  if (input.fallback) return "firebase" as const;
  if (input.muxPlaybackId && input.muxStatus === "ready") return "mux" as const;
  return "firebase" as const;
}
