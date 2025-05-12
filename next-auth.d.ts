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
      /** The user's wallet address, after linking. */
      walletAddress?: string | null;
    } & DefaultSession['user']; // Keep existing DefaultSession user properties like name, email, image
  }

  /** Passed as a parameter to the `signIn` callback. */
  interface User {
    xId?: string | null;
    dbId?: string | null;
    walletAddress?: string | null;
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and sent to the `session` callback. */
  interface JWT {
    xId?: string | null;
    dbId?: string | null;
    walletAddress?: string | null;
  }
} 