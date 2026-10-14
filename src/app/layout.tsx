import type { Metadata } from "next";
import { MetaPixel } from "@/components/meta-pixel";
import "./globals.css";

export const metadata: Metadata = {
  title: "CinemaFeel",
  description: "Богино түүх, том мэдрэмж.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body>
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
