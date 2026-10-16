export const MATURE_CATEGORY = "+18";
const consentKey = "cinemafeel-mature-consent";

export function isMatureLabel(value: unknown) {
  const token = String(value ?? "").trim().toLocaleLowerCase("mn").replace(/\s+/g, "");
  return token === "+18" || token === "18+" || token === "18" || token === "r18" || token === "+21" || token === "21+" || token === "21";
}

export function isMature(film: { age?: unknown; genre?: unknown }) {
  return isMatureLabel(film.age) || isMatureLabel(film.genre);
}

export function normalizeAge(value: unknown) {
  const raw = String(value ?? "").trim().replace(/\s+/g, "");
  if (!raw) return "13+";
  if (isMatureLabel(raw)) return "18+";
  return raw.slice(0, 12);
}

export function publicCatalog<T extends { age?: unknown; genre?: unknown }>(series: T[]) {
  return series.filter((film) => !isMature(film));
}

export function matureCatalog<T extends { age?: unknown; genre?: unknown }>(series: T[]) {
  return series.filter((film) => isMature(film));
}

export function coverFilm<T extends { age?: unknown; genre?: unknown; featured?: boolean }>(series: T[]) {
  const safe = publicCatalog(series);
  return safe.find((film) => film.featured) ?? safe[0];
}

export function readMatureConsent() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(consentKey) === "yes";
  } catch {
    return false;
  }
}

export function writeMatureConsent() {
  window.localStorage.setItem(consentKey, "yes");
}
