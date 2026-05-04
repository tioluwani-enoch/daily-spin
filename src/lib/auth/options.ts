import SpotifyProvider from "next-auth/providers/spotify";

import { getServerEnv } from "@/lib/env/server";
import { SPOTIFY_SCOPES } from "@/lib/auth/spotify-scopes";

import type { NextAuthOptions } from "next-auth";

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
                  scope: SPOTIFY_SCOPES,
                  show_dialog: "true"
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

        if (account?.scope) {
          token.spotifyScopes = account.scope;
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
          expiresAt: typeof token.spotifyExpiresAt === "number" ? token.spotifyExpiresAt : null,
          scopes: typeof token.spotifyScopes === "string" ? token.spotifyScopes.split(" ") : []
        };

        return session;
      }
    }
  };
}
