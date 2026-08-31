import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
});

/**
 * Resolves the signed-in user's id, verifying the row still exists in the
 * database. Sessions use the JWT strategy, so a session survives even after
 * its underlying User row is gone (a dev DB reset, an admin removing the
 * account) -- nothing re-validates it against the database automatically.
 * Trusting a stale id straight from the session crashes any write that uses
 * it as a foreign key (e.g. joining an org) with an unhandled Prisma
 * constraint violation instead of just asking the user to sign back in, so
 * every write action that keys off session.user.id should call this first.
 * Returns null if there's no session, or if the session's user no longer
 * exists (in which case the stale cookie is cleared via signOut when
 * possible -- see below).
 */
export async function getVerifiedUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const exists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });

  if (!exists) {
    try {
      await signOut({ redirectTo: "/login" });
    } catch {
      // signOut() mutates the session cookie, which Next.js only allows
      // from a Server Action or Route Handler. This function is also
      // called from plain page/layout renders (e.g. getVerifiedSiteAdminUserId
      // checking nav visibility), where that throws instead of clearing the
      // cookie. Swallow it here -- returning null still makes the caller
      // treat the session as unauthenticated, and a subsequent write
      // action will retry the signOut from a context where it can succeed.
    }
    return null;
  }

  return session.user.id;
}

/**
 * Resolves the signed-in user's id if -- and only if -- they hold the
 * platform-level Site Admin flag, re-querying User.isSiteAdmin from the
 * database on every call rather than trusting the JWT session. isSiteAdmin
 * is deliberately NOT embedded in the session token: for a security-
 * sensitive flag like this, JWT staleness (see getVerifiedUserId above)
 * would mean a revoked site admin keeps nav access and mutation rights
 * until their token expires instead of losing them on their next request.
 * Call this in the admin area's layout gate, in each /admin page (matching
 * how player pages re-check auth() even though the layout already
 * redirects), and inside every site-admin server action.
 * Returns null if there's no session, the session's user no longer exists,
 * or the user exists but isSiteAdmin is false.
 */
export async function getVerifiedSiteAdminUserId(): Promise<string | null> {
  const userId = await getVerifiedUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSiteAdmin: true },
  });

  return user?.isSiteAdmin ? userId : null;
}
