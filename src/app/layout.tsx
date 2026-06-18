import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QQQM Daily Podcast",
  description:
    "A daily 10-minute market podcast covering the top 10 holdings in QQQM, generated fresh every trading day at 5 PM ET.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
