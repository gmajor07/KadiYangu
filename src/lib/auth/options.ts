import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";
import { dummyHash, verifyPassword } from "./password";
import { allowAuthAttempt } from "./rate-limit";
export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        try {
          if (!(await allowAuthAttempt("login-total", "global", 300)))
            return null;
          if (!(await allowAuthAttempt("login", parsed.data.email, 10)))
            return null;
          const user = await getDb().user.findUnique({
            where: { email: parsed.data.email },
          });
          const valid = await verifyPassword(
            parsed.data.password,
            user?.passwordHash ?? dummyHash,
          );
          if (!valid || !user || user.status !== "ACTIVE") return null;
          return { id: user.id, name: user.name, email: user.email };
        } catch {
          console.error("Authentication unavailable");
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  logger: {
    error(code) {
      console.error("Authentication error:", code);
    },
    warn(code) {
      console.warn("Authentication warning:", code);
    },
    debug() {},
  },
};
