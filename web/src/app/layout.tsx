import type { Metadata } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const sans = Schibsted_Grotesk({
  variable: "--font-sans-face",
  subsets: ["latin", "latin-ext"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "MonadDrive — Araç sicili, zincirde",
  description:
    "Her aracın servis geçmişi bir dinamik NFT. Kilometre geri alınamaz, kaza kaydı silinemez.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
