import type { Metadata } from "next";
import { WatchView } from "@/components/watch-view";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ seriesId: string; episode: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seriesId } = await params;
  let snap;
  try {
    snap = await adminDb().collection("series").doc(seriesId).get();
  } catch {
    return { title: "CinemaFeel" };
  }
  if (!snap.exists) return { title: "CinemaFeel" };
  const data = snap.data() ?? {};
  const title = String(data.title || "CinemaFeel");
  const description = String(data.description || "");
  const image = String(data.cover || data.image || "");
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function WatchPage({ params }: Props) {
  const { seriesId, episode } = await params;
  return <WatchView seriesId={seriesId} episodeNumber={Number(episode) || 1} />;
}
