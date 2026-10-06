import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { LaunchTransition } from "@/components/shared";
import { CommandPalette } from "@/sections/shared/command-palette";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Astra OS",
    template: "%s · Astra OS",
  },
  description:
    "Astra OS — a premium, dark-first interface built with Next.js 15, Tailwind CSS and a token-driven design system.",
  applicationName: "Astra OS",
  keywords: ["Astra OS", "Next.js", "design system", "Tailwind CSS"],
};

export const viewport: Viewport = {
  themeColor: "#050507",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <LaunchTransition />
        {/* App-wide ⌘K surface — mounts on every route. */}
        <CommandPalette />
      </body>
    </html>
  );
}
