import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://quotr.vercel.app"
  ),
  title: "Quotr — free quote calculator for contractors with profit tracking",
  description:
    "Quote fast, close the job out, see your real profit. Built for US tradespeople. Credit packs, no subscription. First close-out free.",
  openGraph: {
    title: "Quotr — quote it, close it out, see if you made money",
    description:
      "Free quote calculator. Paid close-out shows quoted vs. actual, profit, variance. No subscription.",
    url: "/",
    siteName: "Quotr",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-chalk font-sans">
        {children}
      </body>
    </html>
  );
}
