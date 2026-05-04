"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";

import { Button } from "@/lib/ui";

export function SpotifyConnectButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Button type="button" variant="quiet" disabled>
        Checking Spotify
      </Button>
    );
  }

  if (session?.user) {
    return (
      <Button type="button" variant="ghost" onClick={() => signOut()}>
        <LogOut className="h-4 w-4" strokeWidth={1.5} />
        Disconnect {session.user.name ?? "Spotify"}
      </Button>
    );
  }

  return (
    <Button type="button" variant="accent" onClick={() => signIn("spotify")}>
      <LogIn className="h-4 w-4" strokeWidth={1.5} />
      Connect Spotify
    </Button>
  );
}
