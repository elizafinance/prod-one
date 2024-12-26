import { DasApiAsset } from "@metaplex-foundation/digital-asset-standard-api";
import NftPicker from "../nftPicker";
import { Card } from "../ui/card";
import CollectionImg from "@/assets/images/collectionImage.jpg";
import useEscrowStore from "@/store/useEscrowStore";
import { TradeState } from "./swapWrapper";
import { NO_REROLL_PATH, REROLL_PATH } from "@/lib/constants";

interface NftCardProps {
  tradeState: TradeState;
  setSelectedAsset: (selectedNft: DasApiAsset) => void;
  selectedAsset: DasApiAsset | undefined;
}

const NftCard = (props: NftCardProps) => {
  const { escrow } = useEscrowStore();

  const card = (
    <Card className="flex flex-col items-start w-full border border-foreground-muted rounded-xl shadow-lg p-4 gap-4">
      <div className="flex flex-row gap-4 items-center">
        <img
          src={
            props.selectedAsset && props.selectedAsset.content.links
              ? (
                  props.selectedAsset.content.links as unknown as {
                    image: string;
                  }
                ).image
              : CollectionImg.src
          }
          className="rounded-xl w-24 aspect-square"
          alt="nft collection image"
        />
        <div>
          <div className="text-lg">
            {props.tradeState === TradeState.tokens && escrow?.path === REROLL_PATH ? (
              "Receive Random NFT"
            ) : props.selectedAsset ? (
              props.selectedAsset.content.metadata.name
            ) : (
              <span className="text-muted-foreground">Select an NFT</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <>
      {props.tradeState === TradeState.nft ||
      (props.tradeState === TradeState.tokens && escrow?.path === NO_REROLL_PATH) ? (
        <NftPicker
          wallet={props.tradeState === TradeState.nft ? "user" : "escrow"}
          setSelectedAsset={(selectedNft) => {
            props.setSelectedAsset(selectedNft);
            console.log(selectedNft);
          }}
        >
          {card}
        </NftPicker>
      ) : (
        card
      )}
    </>
  );
};

export default NftCard;
