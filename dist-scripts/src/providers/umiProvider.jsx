"use client";
import useUmiStore from "@/store/useUmiStore";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect } from "react";
function UmiProvider({ children }) {
    const wallet = useWallet();
    const { updateSigner } = useUmiStore();
    useEffect(() => {
        if (!wallet.publicKey)
            return;
        // When wallet.publicKey changes, update the signer in umiStore with the new wallet adapter.
        updateSigner(wallet);
    }, [wallet, updateSigner]);
    return <>{children}</>;
}
export { UmiProvider };
