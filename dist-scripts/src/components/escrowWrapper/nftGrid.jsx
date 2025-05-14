import { Card } from "../ui/card";
const NftGrid = ({ assets }) => {
    const assetList = assets
        .sort((a, b) => a.content.metadata.name.localeCompare(b.content.metadata.name, undefined, { numeric: true }))
        .map((asset) => {
        const image = asset.content.files
            ? asset.content.files[0]["cdn_uri"]
            : "fallback.png";
        return (<Card key={asset.id} className="p-2 flex flex-col gap-4">
          <img src={image} alt={asset.content.metadata.name} className="rounded-lg w-full aspect-square"/>
          <div className="col-span-3">
            <p className="">{asset.content.metadata.name}</p>
          </div>
        </Card>);
    });
    return (<div className="grid grid-cols-5 gap-4 overflow-auto p-2">{assetList}</div>);
};
export default NftGrid;
