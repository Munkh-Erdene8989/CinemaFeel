"use client";

import { use } from "react";
import { WatchView } from "@/components/watch-view";

export default function WatchPage({ params }: { params: Promise<{ seriesId: string; episode: string }> }) {
  const { seriesId, episode } = use(params);
  return <WatchView seriesId={seriesId} episodeNumber={Number(episode) || 1} />;
}
