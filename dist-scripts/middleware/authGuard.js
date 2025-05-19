import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
/**
 * Wrapper for App Router API handlers that enforces authenticated session and optional
 * wallet signature verification.
 *
 * Usage:
 *   export const POST = withAuth(async (request, session) => { ... })
 */
export function withAuth(handler) {
    return async function (request) {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || typeof session.user.walletAddress !== "string") {
            return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
        }
        // Optional signed-message verification – if client provides headers we enforce them.
        // x-wallet-sig  : base58 signature of (nonce||path)
        // x-wallet-msg  : the nonce/message that was signed
        const sigB58 = request.headers.get("x-wallet-sig");
        const msg = request.headers.get("x-wallet-msg");
        if (sigB58 && msg) {
            try {
                const pubkey = new PublicKey(session.user.walletAddress);
                const sig = bs58.decode(sigB58);
                const verified = nacl.sign.detached.verify(Buffer.from(msg, "utf8"), sig, pubkey.toBytes());
                if (!verified) {
                    return NextResponse.json({ error: "Invalid wallet signature" }, { status: 401 });
                }
            }
            catch (e) {
                console.error("Signature verification failed", e);
                return NextResponse.json({ error: "Signature verification error" }, { status: 400 });
            }
        }
        return handler(request, session);
    };
}
