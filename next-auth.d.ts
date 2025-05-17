import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's xId. */
      xId?: string | null;
      /** The user's database ID. */
      dbId?: string | null;
      /** The user's wallet address. */
      walletAddress?: string | null;
      /** The user's role. */
      role?: string | null;
      /** Name and image are already in DefaultSession but keeping explicit for clarity */
      id?: string | null;
      name?: string | null;
      image?: string | null;
    } & DefaultSession["user"]; // Keep existing properties like name, email, image
  }

  interface User extends DefaultUser {
    xId?: string | null;
    dbId?: string | null;
    walletAddress?: string | null;
    role?: string | null;
    id?: string | null;
    name?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT {
    xId?: string | null;
    dbId?: string | null;
    walletAddress?: string | null;
    role?: string | null;
  }
} 