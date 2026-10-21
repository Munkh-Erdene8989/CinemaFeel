import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@/components/google-analytics";
import { MetaPixel } from "@/components/meta-pixel";
import "./globals.css";

export const metadata: Metadata = {
  title: "Контентоо бүтээ. Орлогоо нэм.",
  description: "Богино түүх, том мэдрэмж.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body>
        <GoogleAnalytics />
        <MetaPixel />
        <Analytics />
        <SpeedInsights />
        {children}
      </body>
    </html>
  );
}
