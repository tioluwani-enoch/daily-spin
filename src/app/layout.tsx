import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import { AuthProvider } from "@/lib/auth/ui/AuthProvider";
import { DailySpinLogo } from "@/lib/brand/DailySpinLogo";
import { AutoBackfillRunner } from "@/lib/spotify/ui/AutoBackfillRunner";
import { SpotifyWebPlayer } from "@/lib/spotify/player/SpotifyWebPlayer";
import { FullscreenToggle } from "@/lib/ui";

import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Daily Spin",
  description: "A daily companion for people who actually care about the music they listen to.",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <AuthProvider>
          <div className="mx-auto flex min-h-screen w-full max-w-[840px] flex-col px-5 py-6 sm:px-8 sm:py-10">
            <header className="mb-12 flex items-center justify-between gap-4">
              <DailySpinLogo />
              <nav className="flex items-center gap-4 font-mono text-mono-sm text-ambient-muted">
                <Link className="transition hover:text-ambient-accent" href="/playlists">
                  Playlists
                </Link>
                <Link className="transition hover:text-ambient-accent" href="/recap">
                  Recap
                </Link>
                <Link className="transition hover:text-ambient-accent" href="/setup">
                  Setup
                </Link>
              </nav>
            </header>
            <main className="flex-1">{children}</main>
            <FullscreenToggle />
            <AutoBackfillRunner />
            <SpotifyWebPlayer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
