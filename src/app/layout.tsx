import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import { AuthProvider } from "@/lib/auth/ui/AuthProvider";
import { DailySpinLogo } from "@/lib/brand/DailySpinLogo";
import { AutoBackfillRunner } from "@/lib/spotify/ui/AutoBackfillRunner";
import { SpotifyWebPlayer } from "@/lib/spotify/player/SpotifyWebPlayer";
import { FullscreenToggle } from "@/lib/ui";
import { PwaRegister } from "@/lib/pwa/PwaRegister";

import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://daily-spin.tioluwani.dev"),
  title: "Daily Spin",
  description: "A daily companion for people who actually care about the music they listen to.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Daily Spin"
  },
  applicationName: "Daily Spin",
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#f4efe9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <AuthProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-[840px] flex-col px-4 pb-36 pt-5 sm:px-8 sm:pb-40 sm:pt-10">
            <header className="mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-center sm:justify-between">
              <DailySpinLogo />
              <nav className="flex w-full items-center justify-between gap-2 rounded-lg border border-ambient-edge bg-ambient-surface p-1 font-mono text-mono-sm text-ambient-muted shadow-ambient backdrop-blur sm:w-auto sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                <Link className="flex-1 rounded-md px-3 py-2 text-center transition hover:bg-ambient-alt hover:text-ambient-accent sm:flex-none sm:px-0 sm:py-0 sm:hover:bg-transparent" href="/playlists">
                  Playlists
                </Link>
                <Link className="flex-1 rounded-md px-3 py-2 text-center transition hover:bg-ambient-alt hover:text-ambient-accent sm:flex-none sm:px-0 sm:py-0 sm:hover:bg-transparent" href="/recap">
                  Recap
                </Link>
                <Link className="flex-1 rounded-md px-3 py-2 text-center transition hover:bg-ambient-alt hover:text-ambient-accent sm:flex-none sm:px-0 sm:py-0 sm:hover:bg-transparent" href="/setup">
                  Setup
                </Link>
              </nav>
            </header>
            <main className="flex-1">{children}</main>
            <FullscreenToggle />
            <PwaRegister />
            <AutoBackfillRunner />
            <SpotifyWebPlayer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
