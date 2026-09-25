import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

/*
 * Archivo is loaded as a variable font with its width axis, because the whole
 * datasheet voice lives on that axis: condensed and heavy for headlines, normal
 * width for body text. A fixed-width cut would lose half the typography.
 */
const sans = Archivo({
  variable: "--font-sans-face",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "MonadDrive MDV-1 — Araç sicili, zincirde",
  description:
    "Her aracın servis geçmişi bir dinamik NFT. Kilometre geri alınamaz, kaza kaydı silinemez.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
