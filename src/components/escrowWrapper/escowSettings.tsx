import { shortenAddress } from "@/lib/utils";
import useEscrowStore from "@/store/useEscrowStore";
import { EscrowV1 } from "@metaplex-foundation/mpl-hybrid";
import UpdateEscrowForm from "../forms/updateEscrowForm";
import { Card } from "../ui/card";
import { NO_REROLL_PATH } from "@/lib/constants";

interface EscrowSettingsProps {
  escrowData: EscrowV1 | undefined;
}

const EscrowSettings = () => {
  const escrowAddress = process.env.NEXT_PUBLIC_ESCROW;
  const escrowData = useEscrowStore.getState().escrow;

  return (
    <Card className="flex flex-col flex-1 min-h-[300px] p-8 gap-4">
      <div className="text-xl">Escrow Settings</div>

      {!escrowAddress && (
        <div className="flex flex-1 flex-col justify-center w-full items-center">
          <div className="text-red-500">Escrow address not set in env</div>
        </div>
      )}
      {escrowData && (
        <div className="flex flex-col gap-2 w-full">
          <div>
            Name: <span>{escrowData.name}</span>
          </div>
          <div>
            Collection: <span>{shortenAddress(escrowData.collection)}</span>
          </div>
          <div className="truncate text-nowrap max-w-[500px]">
            Base URI: <span>{escrowData.uri}</span>
          </div>
          <div>
            Treasury: <span>{shortenAddress(escrowData.feeLocation)}</span>
          </div>
          <div>
            Swap Count: <span>{Number(escrowData.count)}</span>
          </div>
          <div>
            Index Range:{" "}
            <span>
              {Number(escrowData.min)} - {Number(escrowData.max)}{" "}
            </span>
          </div>
          <div>
            ReRoll Enabled:{" "}
            <span>{escrowData.path === NO_REROLL_PATH ? "false" : "true"}</span>
          </div>
        </div>
      )}
      {escrowData && <UpdateEscrowForm escrowData={escrowData} />}
    </Card>
  );
};

export default EscrowSettings;
