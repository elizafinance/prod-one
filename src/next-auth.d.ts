import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's X ID. */
      xId?: string | null;
      /** The user's database ID. */
      dbId?: string | null;
      /** The user's wallet address. */
      walletAddress?: string | null;
    } & DefaultSession['user']; // Combine with default user properties (name, email, image)
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * and the user object passed to the `session` and `jwt` callbacks.
   */
  interface User extends DefaultUser {
    xId?: string | null;
    dbId?: string | null;
    walletAddress?: string | null;
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT {
    /** OpenID ID Token */
    xId?: string | null;
    dbId?: string | null;
    walletAddress?: string | null;
  }
} 