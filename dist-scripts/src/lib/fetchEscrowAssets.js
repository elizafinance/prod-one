import searchAssets from "./das/searchAssets";
const fetchEscrowAssets = async () => {
    const escrowAddress = process.env.NEXT_PUBLIC_ESCROW;
    const collectionId = process.env.NEXT_PUBLIC_COLLECTION;
    if (!escrowAddress) {
        throw new Error("Escrow address not found");
    }
    if (!collectionId) {
        throw new Error("Collection not found");
    }
    return await searchAssets({
        owner: escrowAddress,
        collection: collectionId,
        burnt: false,
    });
};
export default fetchEscrowAssets;
