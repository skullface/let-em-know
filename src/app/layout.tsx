import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Next Ball - Cleveland Cavaliers',
  description: 'Next upcoming game information for the Cleveland Cavaliers',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
