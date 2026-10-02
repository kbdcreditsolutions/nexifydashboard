import { cache } from "react";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth: authEdge } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isActive = true;

        // The JWT is long-lived, so role/active-status changes (a demotion,
        // a deactivation, an Owner handing off Finance access) must take
        // effect on the next request rather than waiting for the token to
        // expire. Prisma can't run in the edge runtime that `middleware.ts`
        // executes in, so this re-check only runs in the Node runtime —
        // i.e. every server component and server action, which is where
        // every actual page render and mutation happens; middleware only
        // ever needs "is there a token at all", not the fresh role.
        if (process.env.NEXT_RUNTIME !== "edge") {
          const current = await prisma.user.findUnique({ where: { id: token.id as string }, select: { role: true, isActive: true } });
          session.user.role = current?.role ?? "";
          session.user.isActive = current?.isActive ?? false;
        }
      }
      return session;
    },
  },
});

// `auth()` is called from the shared layout *and* independently from every
// page's own RBAC guard (revenue/invoices/settings/etc. each re-check the
// role themselves rather than trusting the layout already did) — without
// memoization that's the session callback's database read firing 2-3+
// times per single navigation. React's cache() dedupes repeat zero-arg
// calls within one request. Only valid in the Node/RSC runtime, so
// middleware.ts (edge runtime) imports `authEdge` above instead.
export const auth = cache(authEdge);
