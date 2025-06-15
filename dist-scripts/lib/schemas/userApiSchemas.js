import { z } from 'zod';
// Schema for /api/users/my-points response
export const MyPointsResponseSchema = z.object({
    points: z.number().nonnegative().finite().default(0),
});
// Schema for a successful /api/users/my-rank response (user found in ranks)
export const MyRankSuccessResponseSchema = z.object({
    _id: z.string(), // Assuming ObjectId is serialized to string
    walletAddress: z.string(),
    xUsername: z.string().optional().nullable(),
    points: z.number().nonnegative().finite(),
    rank: z.number().int().positive(),
    totalRankedUsers: z.number().int().nonnegative(),
});
// Schema for /api/users/my-rank response when user is not in ranks (e.g., 0 points)
export const MyRankNotFoundResponseSchema = z.object({
    message: z.string(),
    rank: z.null(),
    points: z.number().nonnegative().finite().default(0),
    walletAddress: z.string(),
});
// Union schema for /api/users/my-rank to cover both cases
export const MyRankResponseSchema = z.union([
    MyRankSuccessResponseSchema,
    MyRankNotFoundResponseSchema,
]);
// Example of how you might use these in your API routes (for validation - conceptual)
// export async function GET(request: NextRequest) {
//   // ... fetch data ...
//   try {
//     const validatedData = MyPointsResponseSchema.parse(dataFromDb);
//     return NextResponse.json(validatedData);
//   } catch (error) {
//     // Handle validation error
//     return NextResponse.json({ error: "Invalid data format" }, { status: 500 });
//   }
// } 
