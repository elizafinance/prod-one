import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

// Define the structure of the properties you are adding to the user object
interface ExtendedUser {
  dbId?: string | null;
  xId?: string | null;
  walletAddress?: string | null;
  walletChain?: string | null;
  role?: string | null;
  points?: number | null;
  isActive?: boolean | null;
  referralCode?: string | null;
  agentId?: string | null;
  agentStatus?: 'PENDING' | 'DEPLOYING' | 'RUNNING' | 'FAILED' | 'ARCHIVED' | null;
  agentUrl?: string | null;
  agentType?: string | null;
  agentDeployedAt?: string | Date | null; // Keep as string if ISOString, or Date
  // Add any other custom fields you expect on the user session object
}

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: ExtendedUser & DefaultSession["user"]; // Combine with default user properties (name, email, image)
    accessToken?: string; // Example if you were to add access tokens
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   */
  interface User extends DefaultUser, ExtendedUser {}
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT, ExtendedUser {
    // dbId is already good example here as it's often added to token
    // Add other fields you pass through the JWT callback to the session callback
  }
} 