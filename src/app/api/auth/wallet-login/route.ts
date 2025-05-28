import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectToDatabase, UserDocument } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// Re-use the regexes from link-wallet
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const getSecret = () => process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret' : undefined);

const signJwt = (payload: any) => {
  const secret = getSecret();
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set');
  return jwt.sign(payload, secret, { expiresIn: '30d' });
};

export async function POST(request: Request) {
  const { walletAddress, chain } = await request.json();

  if (!walletAddress || !EVM_ADDRESS_REGEX.test(walletAddress))
    return NextResponse.json(
      { error: "Invalid walletAddress" },
      { status: 400 }
    );
  if (!chain)
    return NextResponse.json({ error: "chain required" }, { status: 400 });

  const { db } = await connectToDatabase();
  const users = db.collection<UserDocument>("users");

  const existing = await users.findOne({ walletAddress });
  let userId: ObjectId;

  if (existing) {
    userId = existing._id;
    // Optionally, update walletChain and walletLinkedAt if they differ or are missing
    if (existing.walletChain !== chain || !existing.walletLinkedAt) {
      await users.updateOne(
        { _id: userId },
        { $set: { walletChain: chain, walletLinkedAt: new Date(), updatedAt: new Date() } }
      );
    }
  } else {
    const now = new Date();
    const insertResult = await users.insertOne({
      walletAddress,
      walletChain: chain,
      walletLinkedAt: now,
      createdAt: now,
      updatedAt: now,
      completedActions: ["wallet_login_completed"], // Changed from wallet_linked
      // Ensure other potentially required fields by UserDocument are initialized if necessary
      // For example, if xId was previously mandatory, decide how to handle it:
      // xId: null, // or some placeholder if the schema requires it
    } as Omit<UserDocument, '_id'> as UserDocument); // Added type assertion
    userId = insertResult.insertedId;
  }

  const token = signJwt({ uid: userId.toHexString(), walletAddress: walletAddress, chain: chain }); // Added walletAddress and chain to JWT
  const res = NextResponse.json({ success: true, userId: userId.toHexString(), walletAddress: walletAddress });
  cookies().set("auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
} 