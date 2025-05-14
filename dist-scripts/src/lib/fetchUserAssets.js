import searchAssets from "./das/searchAssets";
import umiWithCurrentWalletAdapter from "./umi/umiWithCurrentWalletAdapter";
const fetchUserAssets = async () => {
    const umi = umiWithCurrentWalletAdapter();
    const collectionId = process.env.NEXT_PUBLIC_COLLECTION;
    if (!collectionId) {
        throw new Error("Collection not found");
    }
    return await searchAssets({
        owner: umi.identity.publicKey,
        collection: collectionId,
        burnt: false,
    });
};
export default fetchUserAssets;
