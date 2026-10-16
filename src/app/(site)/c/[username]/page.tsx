import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CreatorView } from "@/components/creator-view";
import { loadPublicCreator } from "@/lib/creator-public";
import { creatorPath, creatorUsernameParam } from "@/lib/creator-site";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const creator = await loadPublicCreator(username);
  if (!creator) return { title: "Олдсонгүй · CinemaFeel" };
  const title = `${creator.name} · CinemaFeel`;
  const description = creator.contentType ? `${creator.name} — ${creator.contentType}` : `${creator.name}-ийн кино`;
  return {
    title,
    description,
    openGraph: { title, description, url: creatorPath(creator.username) },
  };
}

export default async function CreatorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const normalized = creatorUsernameParam(username);
  if (!normalized) notFound();
  if (username !== normalized) redirect(creatorPath(normalized));
  return <CreatorView username={normalized} />;
}
