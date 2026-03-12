import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snowy AI Sales Engine",
  description: "Internal sales engine dashboard for Snowy AI by Snowball Labs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
