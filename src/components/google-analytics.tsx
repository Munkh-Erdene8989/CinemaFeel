"use client";

import { getAnalytics, initializeAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { firebaseConfigured, firebaseMeasurementId, getFirebaseApp } from "@/lib/firebase";

let analyticsPromise: Promise<Analytics | null> | null = null;

function clientAnalytics() {
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => {
        if (!supported || !firebaseConfigured() || !firebaseMeasurementId()) return null;
        const app = getFirebaseApp();
        try {
          return initializeAnalytics(app, { config: { send_page_view: false } });
        } catch {
          return getAnalytics(app);
        }
      })
      .catch(() => null);
  }
  return analyticsPromise;
}

function pagePath(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function GoogleAnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    clientAnalytics().then((analytics) => {
      if (!analytics || cancelled) return;
      logEvent(analytics, "page_view", {
        page_path: pagePath(pathname, searchParams),
        page_location: window.location.href,
        page_title: document.title,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, searchParams]);

  return null;
}

export function GoogleAnalytics() {
  return (
    <Suspense fallback={null}>
      <GoogleAnalyticsPageView />
    </Suspense>
  );
}
