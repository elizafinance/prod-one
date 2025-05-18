import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth"; // Correct path to your authOptions

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 