import { HomeView } from "@/components/home-view";
import { readHomeFeatured } from "@/lib/public-series";

export const revalidate = 300;

export default async function HomePage() {
  const initialFeatured = await readHomeFeatured();
  return <HomeView initialFeatured={initialFeatured} />;
}
