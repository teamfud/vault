import type { Metadata } from "next";
import { Geist_Mono, Pixelify_Sans } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pixel = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: BRAND.name,
  description: `per-box credential vault for ${BRAND.team}`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistMono.variable} ${pixel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-[13px]">{children}</body>
    </html>
  );
}
