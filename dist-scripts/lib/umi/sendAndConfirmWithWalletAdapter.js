import useUmiStore from "@/store/useUmiStore";
import { setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { signerIdentity } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
const sendAndConfirmWalletAdapter = async (tx, settings) => {
    const umi = useUmiStore.getState().umi;
    const currentSigner = useUmiStore.getState().signer;
    umi.use(signerIdentity(currentSigner));
    const blockhash = await umi.rpc.getLatestBlockhash({
        commitment: (settings === null || settings === void 0 ? void 0 : settings.commitment) || "confirmed",
    });
    const transactions = tx
        .add(setComputeUnitPrice(umi, { microLamports: BigInt(100000) }))
        .setBlockhash(blockhash);
    const signedTx = await transactions.buildAndSign(umi);
    const signature = await umi.rpc
        .sendTransaction(signedTx, {
        preflightCommitment: (settings === null || settings === void 0 ? void 0 : settings.commitment) || "confirmed",
        commitment: (settings === null || settings === void 0 ? void 0 : settings.commitment) || "confirmed",
        skipPreflight: (settings === null || settings === void 0 ? void 0 : settings.skipPreflight) || false,
    })
        .catch((err) => {
        throw new Error(`Transaction failed: ${err}`);
    });
    const confirmation = await umi.rpc.confirmTransaction(signature, {
        strategy: Object.assign({ type: "blockhash" }, blockhash),
        commitment: (settings === null || settings === void 0 ? void 0 : settings.commitment) || "confirmed",
    });
    return {
        signature: base58.deserialize(signature),
        confirmation,
    };
};
export default sendAndConfirmWalletAdapter;
