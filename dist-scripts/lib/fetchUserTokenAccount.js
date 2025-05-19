import useUmiStore from "@/store/useUmiStore";
import fetchTokenBalance from "./fetchTokenBalance";
const fetchUserTokenAccount = async () => {
    const tokenAddress = process.env.NEXT_PUBLIC_TOKEN;
    if (!tokenAddress) {
        throw new Error("Token address is not provided");
    }
    const user = useUmiStore.getState().signer;
    if (!user) {
        throw new Error("User is not signed in");
    }
    return await fetchTokenBalance(tokenAddress, user === null || user === void 0 ? void 0 : user.publicKey);
};
export default fetchUserTokenAccount;
