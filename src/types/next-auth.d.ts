import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's X ID. */
      xId?: string | null;
      /** The user's MongoDB _id. */
      dbId?: string | null;
    } & DefaultSession["user"]; // Inherit default fields like name, email, image
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   */
  interface User extends DefaultUser {
    xId?: string | null;
    dbId?: string | null;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT {
    /** X User ID */
    xId?: string | null;
    /** MongoDB User _id */
    dbId?: string | null;
  }
} 