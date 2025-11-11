import NextAuth, { type DefaultSession, type NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}

const MAX_SESSION_AGE = 30 * 24 * 60 * 60; // 30 days
const SESSION_UPDATE_AGE = 24 * 60 * 60; // 24 hours

const missingEnv: string[] = [];
const authEnvState = globalThis as typeof globalThis & { __AUTH_ENV_WARNED__?: boolean };

if (!process.env.NEXTAUTH_SECRET) {
  missingEnv.push("NEXTAUTH_SECRET");
}
if (!process.env.GOOGLE_CLIENT_ID) {
  missingEnv.push("GOOGLE_CLIENT_ID");
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  missingEnv.push("GOOGLE_CLIENT_SECRET");
}

if (missingEnv.length > 0 && !authEnvState.__AUTH_ENV_WARNED__) {
  console.warn(
    `[auth] Missing environment variable(s): ${missingEnv.join(
      ", "
    )}. Sign-in requires these to be defined in .env.local.`
  );
  authEnvState.__AUTH_ENV_WARNED__ = true;
}

const isSecureCookie = process.env.NEXTAUTH_URL?.startsWith("https://");
const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  jwt: {
    maxAge: MAX_SESSION_AGE,
  },
  session: {
    strategy: "jwt",
    maxAge: MAX_SESSION_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  cookies: {
    sessionToken: {
      name: isSecureCookie ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: Boolean(isSecureCookie),
        maxAge: MAX_SESSION_AGE,
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : token.sub;
        session.user.email = session.user.email ?? (token.email as string | null | undefined) ?? null;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
