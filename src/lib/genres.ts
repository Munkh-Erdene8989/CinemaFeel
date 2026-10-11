import { adminDb } from "./firebase-admin";
import { mergeSettings, normalizeGenres, type Settings } from "./types";

const settingsRef = () => adminDb().collection("settings").doc("app");

export async function loadGenres() {
  const snap = await settingsRef().get();
  return mergeSettings(snap.data() as Partial<Settings> | undefined).genres;
}

export async function saveGenres(genres: string[]) {
  const next = normalizeGenres(genres);
  await settingsRef().set({ genres: next }, { merge: true });
  return next;
}

export function sameGenre(left: string, right: string) {
  return left.trim().toLocaleLowerCase("mn") === right.trim().toLocaleLowerCase("mn");
}

export function canonicalGenre(name: string, genres: string[]) {
  return genres.find((genre) => sameGenre(genre, name)) ?? "";
}
