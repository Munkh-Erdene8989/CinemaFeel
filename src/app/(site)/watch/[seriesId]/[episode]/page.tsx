import type { Metadata } from "next";
import { WatchView } from "@/components/watch-view";
import { isMature } from "@/lib/mature";
import { readSeries } from "@/lib/public-series";

export const dynamic = "force-static";
export const revalidate = 300;
export const preferredRegion = "icn1";

type Props = { params: Promise<{ seriesId: string; episode: string }> };

const unavailable: Metadata = {
  title: "Кино олдсонгүй",
  description: "Энэ кино одоо байхгүй.",
  robots: { index: false, follow: false },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seriesId } = await params;
  const series = await readSeries(seriesId);
  if (!series || series.status !== "Нийтлэгдсэн") return unavailable;
  if (isMature(series)) return { title: "CinemaFeel", description: "Насанд хүрэгчдэд зориулсан контент.", robots: { index: false, follow: false } };
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
