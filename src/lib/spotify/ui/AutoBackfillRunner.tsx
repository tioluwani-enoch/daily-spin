"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AutoBackfillRunner() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    function refreshSyncedViews() {
      router.refresh();
    }

    window.addEventListener("daily-spin:backfill-complete", refreshSyncedViews);
    return () => window.removeEventListener("daily-spin:backfill-complete", refreshSyncedViews);
  }, [router]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.spotify?.hasAccessToken) {
      return;
    }

    const key = `daily-spin:auto-backfill:${session.spotify.id ?? session.user?.email ?? session.user?.name ?? "spotify"}`;
    const lastRun = window.localStorage.getItem(key);
    const today = new Date().toISOString().slice(0, 10);

    if (lastRun === today) {
      return;
    }

    let isCancelled = false;

    async function runBackfill() {
      const response = await fetch("/api/spotify/backfill", {
        method: "POST"
      });

      if (!isCancelled && response.ok) {
        window.localStorage.setItem(key, today);
        window.dispatchEvent(new CustomEvent("daily-spin:backfill-complete"));
      }
    }

    runBackfill();

    return () => {
      isCancelled = true;
    };
  }, [session, status]);

  return null;
}
