import type { Metadata } from "next";
import { WatchView } from "@/components/watch-view";
import { isMature } from "@/lib/mature";
import { readSeries } from "@/lib/public-series";

export const revalidate = 300;
export const preferredRegion = "icn1";

type Props = { params: Promise<{ seriesId: string; episode: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seriesId } = await params;
  const series = await readSeries(seriesId);
  if (!series) return { title: "CinemaFeel" };
  if (isMature(series)) return { title: "CinemaFeel", description: "Насанд хүрэгчдэд зориулсан контент." };
  const title = series.title || "CinemaFeel";
  const description = series.description || "";
  const image = series.cover || series.image || "";
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
  const series = await readSeries(seriesId);
  const initialFilm = series && series.status === "Нийтлэгдсэн" && !isMature(series) ? series : null;
  return <WatchView seriesId={seriesId} episodeNumber={Number(episode) || 1} initialFilm={initialFilm} />;
}
