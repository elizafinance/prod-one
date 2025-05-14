import { toast } from "@/hooks/use-toast";
import fetchEscrow from "@/lib/mpl-hybrid/fetchEscrow";
import updateEscrow from "@/lib/mpl-hybrid/updateEscrow";
import useEscrowStore from "@/store/useEscrowStore";
import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import validateFormData from "./validateUpdateEscrowForm";
import Spinner from "@/icons/spinner";
const UpdateEscrowForm = ({ escrowData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const form = new FormData(e.currentTarget);
        const formData = {
            name: form.get("name"),
            collection: form.get("collection"),
            token: form.get("token"),
            feeLocation: form.get("treasury"),
            uri: form.get("baseUri"),
            min: Number(form.get("minIndex")),
            max: Number(form.get("maxIndex")),
            amount: Number(form.get("tokenAmount")),
            feeAmount: Number(form.get("tokenFeeAmount")),
            solFeeAmount: Number(form.get("solFeeAmount")),
            // path: form.get("reroll") ? 1 : 0,
        };
        if (validateFormData(formData)) {
            console.log("Form data is valid");
            await updateEscrow(formData).then((res) => {
                toast({
                    title: "Success",
                    description: "Escrow Updated",
                });
                setIsOpen(false);
                setIsSubmitting(false);
                fetchEscrow().then((escrow) => {
                    useEscrowStore.setState({ escrow });
                });
            });
        }
    };
    return (<Dialog open={isOpen} onOpenChange={(e) => setIsOpen(e)}>
      <DialogTrigger asChild>
        <Button className="w-[200px] self-end">Edit Escrow</Button>
      </DialogTrigger>
      <DialogContent className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Edit Escrow Settings</DialogTitle>
          <DialogDescription>
            Use this form to change the escrow settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="name">Escrow Name</Label>
              <Input id="name" name="name" defaultValue={escrowData.name} required/>
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="collection">Collection</Label>
              <Input id="collection" name="collection" defaultValue={escrowData.collection}/>
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="token">Token</Label>
              <Input id="token" name="token" defaultValue={escrowData.token} required/>
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="treasury">Treasury Wallet</Label>
              <Input id="treasury" name="treasury" defaultValue={escrowData.feeLocation} required/>
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="baseUri">Metadata Base URI</Label>
              <Input id="baseUri" name="baseUri" defaultValue={escrowData.uri} required/>
            </div>
            <div className="flex gap-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="minIndex">Min Index</Label>
                <Input type="number" id="minIndex" name="minIndex" defaultValue={Number(escrowData.min)} required/>
              </div>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="maxIndex">Max Index</Label>
                <Input type="number" id="maxIndex" name="maxIndex" defaultValue={Number(escrowData.max)} required/>
              </div>
            </div>
            {/* <div className="flex items-center space-x-2">
          <Checkbox
            id="reroll"
            defaultChecked={escrowData.path === 1 ? true : false}
            className="h-4 w-4"
            name="reroll"
          />
          <label
            htmlFor="reroll"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Enable Reroll
          </label>
        </div> */}
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="tokenAmount">Token Swap Amount</Label>
              <Input type="number" id="tokenAmount" name="tokenAmount" defaultValue={Number(escrowData.amount)} required/>
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="tokenFeeAmount">Token Fee Amount</Label>
              <Input type="number" id="tokenFeeAmount" name="tokenFeeAmount" defaultValue={Number(escrowData.feeAmount)} required/>
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="solFeeAmount">Sol Fee Amount</Label>
              <Input type="number" id="solFeeAmount" name="solFeeAmount" defaultValue={Number(escrowData.feeAmount)} required/>
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner className="h-4 w-4"/> : "Submit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>);
};
export default UpdateEscrowForm;
