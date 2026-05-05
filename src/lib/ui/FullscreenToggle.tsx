"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();

    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();
  }

  return (
    <button
      className="fixed right-3 top-24 z-40 hidden h-10 w-10 place-items-center rounded-md border border-ambient-edge bg-ambient-surface text-ambient-muted shadow-ambient backdrop-blur-xl transition hover:border-ambient-accent hover:text-ambient-accent sm:grid"
      type="button"
      onClick={toggleFullscreen}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    >
      {isFullscreen ? <Minimize2 className="h-4 w-4" strokeWidth={1.5} /> : <Maximize2 className="h-4 w-4" strokeWidth={1.5} />}
    </button>
  );
}
