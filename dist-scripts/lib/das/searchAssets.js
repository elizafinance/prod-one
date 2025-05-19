import useUmiStore from "@/store/useUmiStore";
const searchAssets = async (searchAssetArgs) => {
    const umi = useUmiStore.getState().umi;
    const collectionId = process.env.NEXT_PUBLIC_COLLECTION;
    if (!collectionId) {
        throw new Error("Collection not found");
    }
    let page = 1;
    let continueFetch = true;
    let assets;
    while (continueFetch) {
        //@ts-ignore
        const response = await umi.rpc.searchAssets({
            owner: searchAssetArgs.owner,
            grouping: ["collection", searchAssetArgs.collection],
            burnt: searchAssetArgs.burnt,
            page,
        });
        console.log(`Page: ${page}, Total assets: `, response.total);
        if (response.total < 1000) {
            console.log("Total assets less than 1000 on current page, stopping loop");
            continueFetch = false;
        }
        if (!assets) {
            assets = response;
            continueFetch = false;
        }
        else {
            response.total = response.total + assets.total;
            response.items = assets.items.concat(response.items);
        }
        page++;
    }
    return assets;
};
export default searchAssets;
