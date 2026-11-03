import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circle.social — Real People. Open Conversations.",
  description:
    "Discover communities, share experiences, and join open conversations on Circle.social.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
