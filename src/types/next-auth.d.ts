import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    spotify?: {
      id: string | null;
      hasAccessToken: boolean;
      expiresAt: number | null;
      scopes: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    spotifyAccessToken?: string;
    spotifyRefreshToken?: string;
    spotifyExpiresAt?: number;
    spotifyId?: string;
    spotifyScopes?: string;
  }
}
