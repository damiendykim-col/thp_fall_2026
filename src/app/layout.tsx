import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meme Club",
  description: "Image gallery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" id="top" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
