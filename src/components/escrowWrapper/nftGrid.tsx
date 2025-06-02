import {
    DasApiAsset
} from "@metaplex-foundation/digital-asset-standard-api";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Image as ImageIcon } from "lucide-react";

const NftGrid = ({ assets }: { assets: DasApiAsset[] }) => {

  const assetList = assets
    .sort((a, b) =>
      a.content.metadata.name.localeCompare(
        b.content.metadata.name,
        undefined,
        { numeric: true }
      )
    )
    .map((asset) => {
      const image = asset.content.files
        ? (asset.content.files[0]["cdn_uri"] as string)
        : null;

      return (
        <TooltipProvider key={asset.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:scale-105">
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                      {image ? (
                        <img
                          src={image}
                          alt={asset.content.metadata.name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium truncate">
                        {asset.content.metadata.name}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        #{asset.id.slice(-4)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <p className="font-medium">{asset.content.metadata.name}</p>
                <p className="text-muted-foreground">ID: {asset.id}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {assetList}
    </div>
  );
};

export default NftGrid;
