import NextAuth, { type DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    supabaseAccessToken?: string
    user: {
      id: string
      twitterHandle?: string
    } & DefaultSession["user"]
  }

  interface JWT {
    twitterHandle?: string
  }
}