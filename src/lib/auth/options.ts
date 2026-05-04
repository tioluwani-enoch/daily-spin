import SpotifyProvider from "next-auth/providers/spotify";

import { getServerEnv } from "@/lib/env/server";

import type { NextAuthOptions } from "next-auth";

const SPOTIFY_SCOPES = [
  "user-library-read",
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-follow-read",
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "streaming"
].join(" ");

export function getAuthOptions(): NextAuthOptions {
  const env = getServerEnv();

  return {
    providers:
      env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET
        ? [
            SpotifyProvider({
              clientId: env.SPOTIFY_CLIENT_ID,
              clientSecret: env.SPOTIFY_CLIENT_SECRET,
              authorization: {
                params: {
                  scope: SPOTIFY_SCOPES
                }
              }
            })
          ]
        : [],
    secret: env.NEXTAUTH_SECRET,
    session: {
      strategy: "jwt"
    },
    callbacks: {
      jwt({ token, account, profile }) {
        const spotifyProfile = profile as { id?: string; sub?: string } | undefined;

        if (account?.provider === "spotify" && (spotifyProfile?.id || spotifyProfile?.sub)) {
          token.spotifyId = spotifyProfile.id ?? spotifyProfile.sub;
        }

        if (account?.access_token) {
          token.spotifyAccessToken = account.access_token;
        }

        if (account?.refresh_token) {
          token.spotifyRefreshToken = account.refresh_token;
        }

        if (account?.expires_at) {
          token.spotifyExpiresAt = account.expires_at;
        }

        return token;
      },
      session({ session, token }) {
        session.spotify = {
          id: typeof token.spotifyId === "string" ? token.spotifyId : null,
          hasAccessToken: Boolean(token.spotifyAccessToken),
          expiresAt: typeof token.spotifyExpiresAt === "number" ? token.spotifyExpiresAt : null
        };

        return session;
      }
    }
  };
}
