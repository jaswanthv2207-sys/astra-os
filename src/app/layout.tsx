import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { LaunchTransition } from "@/components/shared";
import { CommandPalette } from "@/sections/shared/command-palette";
import { OnboardingTour } from "@/sections/shared/onboarding-tour";
import { PwaRegister } from "@/sections/shared/pwa-register";
import { SettingsModal } from "@/sections/shared/settings-modal";

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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Astra OS",
    statusBarStyle: "black-translucent",
  },
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
        {/* Guided tour — auto on first manager visit, manual elsewhere. */}
        <OnboardingTour />
        {/* Settings (AI · GitHub · sync · sound · install) — one dialog. */}
        <SettingsModal />
        {/* Offline shell — production service worker registration. */}
        <PwaRegister />
      </body>
    </html>
  );
}
