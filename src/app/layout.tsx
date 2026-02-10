import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://letemknow.land"),
  title: "Next Cavs game stats | letemknow.land",
  description:
    "Upcoming game information for the Cleveland Cavaliers. Injury reports, last head-to-head matchup, and more.",
  openGraph: {
    title: "Next Cavs game stats | letemknow.land",
    description:
      "Upcoming game information for the Cleveland Cavaliers. Injury reports, last head-to-head matchup, and more.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-surface text-foreground antialiased">
        <div className="container mx-auto p-4 md:p-8 max-w-3xl">{children}</div>
      </body>
    </html>
  );
}
