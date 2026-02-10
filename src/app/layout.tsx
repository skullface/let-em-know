import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next Cavs game stats | letemknow.land",
  description:
    "Upcoming game information for the Cleveland Cavaliers. Injury reports, starting lineups, last head-to-head matchup, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-surface text-foreground antialiased">
        <div className="container mx-auto p-8 max-w-3xl">{children}</div>
      </body>
    </html>
  );
}
