import { shortenAddress } from "@/lib/utils";
import useEscrowStore from "@/store/useEscrowStore";
import { EscrowV1 } from "@metaplex-foundation/mpl-hybrid";
import UpdateEscrowForm from "../forms/updateEscrowForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Settings, AlertTriangle, Check, X, Copy } from "lucide-react";
import { Button } from "../ui/button";
import { NO_REROLL_PATH } from "@/lib/constants";

interface EscrowSettingsProps {
  escrowData: EscrowV1 | undefined;
}

const EscrowSettings = () => {
  const escrowAddress = process.env.NEXT_PUBLIC_ESCROW;
  const escrowData = useEscrowStore.getState().escrow;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Escrow Configuration
        </CardTitle>
        <CardDescription>
          Current escrow settings and parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!escrowAddress && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">Escrow address not configured</span>
          </div>
        )}
        
        {escrowData && (
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="font-medium">{escrowData.name}</span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Collection</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{shortenAddress(escrowData.collection)}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(escrowData.collection)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-start py-2">
              <span className="text-sm text-muted-foreground">Base URI</span>
              <div className="text-right max-w-[250px]">
                <span className="text-sm font-mono break-all">{escrowData.uri}</span>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Treasury</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{shortenAddress(escrowData.feeLocation)}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(escrowData.feeLocation)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Swap Count</div>
                <div className="text-lg font-bold">{Number(escrowData.count)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Index Range</div>
                <div className="text-lg font-bold">
                  {Number(escrowData.min)} - {Number(escrowData.max)}
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">ReRoll Enabled</span>
              <Badge variant={escrowData.path === NO_REROLL_PATH ? "destructive" : "default"} className="flex items-center gap-1">
                {escrowData.path === NO_REROLL_PATH ? (
                  <><X className="h-3 w-3" /> Disabled</>
                ) : (
                  <><Check className="h-3 w-3" /> Enabled</>
                )}
              </Badge>
            </div>
          </div>
        )}
        
        {escrowData && (
          <div className="pt-4">
            <UpdateEscrowForm escrowData={escrowData} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EscrowSettings;
