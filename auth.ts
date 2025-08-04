import NextAuth, { NextAuthOptions } from "next-auth"
import TwitterProvider from "next-auth/providers/twitter"

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token' 
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  callbacks: {
    async jwt({ token, account, user, profile }) {
      if (account) {
        token.accessToken = account.access_token
      }
      if (user) {
        token.email = user.email
        token.name = user.name
        token.image = user.image
      }
      // Capture Twitter username from profile
      if (profile && account?.provider === 'twitter') {
        token.twitterHandle = (profile as any).data?.username || (profile as any).username
      }
      return token
    },
    async session({ session, token }) {
      // Pass token data to session
      if (token) {
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.image as string
        // Add Twitter handle to session
        if (token.twitterHandle) {
          (session.user as any).twitterHandle = token.twitterHandle as string
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

// Export auth function for App Router
export const { auth } = NextAuth(authOptions)