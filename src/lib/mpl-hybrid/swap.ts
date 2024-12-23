import { TradeState } from './../../components/swapWrapper/swapWrapper';
import useEscrowStore from "@/store/useEscrowStore";
import { DasApiAsset } from "@metaplex-foundation/digital-asset-standard-api";
import { captureV1, releaseV1 } from "@metaplex-foundation/mpl-hybrid";
import fetchEscrowAssets from "../fetchEscrowAssets";
import sendAndConfirmWalletAdapter from "../umi/sendAndConfirmWithWalletAdapter";
import umiWithCurrentWalletAdapter from "../umi/umiWithCurrentWalletAdapter";
import { REROLL_PATH } from '../constants';

const swap = async ({
  swapOption,
  selectedNft,
}: {
  swapOption: TradeState;
  selectedNft?: DasApiAsset;
}) => {
  console.log({ swapOption, selectedNft });

  const umi = umiWithCurrentWalletAdapter();

  const escrow = useEscrowStore.getState().escrow;

  if (!escrow) {
    console.error("No escrow found");
    return;
  }

  switch (swapOption) {
    case TradeState.nft:
      console.log("Swapping NFT");

      if (!selectedNft) {
        throw new Error("No NFT selected");
      }

      const releaseTx = releaseV1(umi, {
        owner: umi.identity,
        escrow: escrow.publicKey,
        asset: selectedNft.id,
        collection: escrow.collection,
        token: escrow.token,
        feeProjectAccount: escrow.feeLocation,
      });

      return await sendAndConfirmWalletAdapter(releaseTx);
    case TradeState.tokens:
      console.log("Swapping Tokens");

      let nft: DasApiAsset | undefined = selectedNft;

      if (escrow.path === REROLL_PATH && !selectedNft) {
        console.log(
          "Fetching Escrows NFTs and picking the first one for reroll swap"
        );

        const escrowAssets = await fetchEscrowAssets();
        console.log({ escrowAssets });  

        if (!escrowAssets || escrowAssets.total === 0) {
          throw new Error("No NFTs available to swap in escrow");
        }

        nft = escrowAssets.items[0];
      }
      if (!nft) {
        throw new Error("Something went wrong, during NFT selection");
      }


      const captureTx = captureV1(umi, {
        owner: umi.identity,
        escrow: escrow.publicKey,
        asset: nft.id,
        collection: escrow.collection,
        token: escrow.token,
        feeProjectAccount: escrow.feeLocation,
      });

      return await sendAndConfirmWalletAdapter(captureTx);
    default:
      throw new Error("Invalid swap option");
  }
};

export default swap;
