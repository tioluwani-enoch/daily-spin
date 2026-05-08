"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";
import { useEffect } from "react";

import { SPOTIFY_SCOPES } from "@/lib/auth/spotify-scopes";
import { Button } from "@/lib/ui";

export async function reconnectSpotify() {
  window.sessionStorage.setItem("daily-spin:spotify-reconnect", "1");
  await signOut({ callbackUrl: "/" });
}

export function SpotifyConnectButton() {
  const { data: session, status } = useSession();
  const grantedScopes = session?.spotify?.scopes ?? [];
  const missingScopes = grantedScopes.length > 0 ? SPOTIFY_SCOPES.split(" ").filter((scope) => !grantedScopes.includes(scope)) : [];

  useEffect(() => {
    if (status !== "unauthenticated" || window.sessionStorage.getItem("daily-spin:spotify-reconnect") !== "1") {
      return;
    }

    window.sessionStorage.removeItem("daily-spin:spotify-reconnect");
    void signIn("spotify", { callbackUrl: "/" }, { scope: SPOTIFY_SCOPES, show_dialog: "true" });
  }, [status]);

  if (status === "loading") {
    return (
      <Button type="button" variant="quiet" disabled className="w-full sm:w-auto">
        Checking Spotify
      </Button>
    );
  }

  if (session?.user && missingScopes.length > 0) {
    return (
      <Button type="button" variant="accent" onClick={() => void reconnectSpotify()} className="w-full sm:w-auto">
        <LogIn className="h-4 w-4" strokeWidth={1.5} />
        Reconnect Spotify permissions
      </Button>
    );
  }

  if (session?.user) {
    return (
      <Button type="button" variant="ghost" onClick={() => signOut({ callbackUrl: "/" })} className="w-full sm:w-auto">
        <LogOut className="h-4 w-4" strokeWidth={1.5} />
        Disconnect {session.user.name ?? "Spotify"}
      </Button>
    );
  }

  return (
    <Button type="button" variant="accent" onClick={() => signIn("spotify", { callbackUrl: "/" }, { scope: SPOTIFY_SCOPES, show_dialog: "true" })} className="w-full sm:w-auto">
      <LogIn className="h-4 w-4" strokeWidth={1.5} />
      Connect Spotify
    </Button>
  );
}
