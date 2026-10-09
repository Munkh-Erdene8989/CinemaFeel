"use client";

import { SiteProvider } from "@/components/site-provider";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteProvider>{children}</SiteProvider>;
}
