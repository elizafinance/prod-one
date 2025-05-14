import { toast } from "@/hooks/use-toast";
import { isValidPublicKey } from "@/lib/utils";
// Validation function to ensure all fields are filled
function validateFormData(data) {
    // Check if all string fields are filled
    const stringFields = ["name", "uri"];
    for (let field of stringFields) {
        if (!data[field] && data[field].length !== 0) {
            toast({
                description: `${field} is required.`,
                variant: "destructive",
            });
            return false; // Validation fails
        }
    }
    const publicKeyFields = ["collection", "token", "feeLocation"];
    for (let field of publicKeyFields) {
        if (!data[field] || !isValidPublicKey(data[field])) {
            toast({
                title: "Invalid Public Key",
                description: `${field} is required and must be a valid public key.`,
                variant: "destructive",
            });
            return false; // Validation fails
        }
    }
    // Validate numeric fields (ensure they're numbers and greater than or equal to 0)
    if (isNaN(data.min) || data.min < 0) {
        toast({
            description: "minIndex is required and must be a positive number.",
            variant: "destructive",
        });
        return false;
    }
    if (isNaN(data.max) || data.max < 0) {
        toast({
            description: "maxIndex is required and must be a positive number.",
            variant: "destructive",
        });
        return false;
    }
    if (isNaN(data.amount) || data.amount <= 0) {
        toast({
            description: "tokenAmount is required and must be greater than 0.",
            variant: "destructive",
        });
        return false;
    }
    if (isNaN(data.feeAmount) || data.feeAmount < 0) {
        toast({
            description: "tokenFeeAmount is required and must be a positive number.",
            variant: "destructive",
        });
        return false;
    }
    if (isNaN(data.solFeeAmount) || data.solFeeAmount < 0) {
        toast({
            description: "solFeeAmount is required and must be a positive number.",
            variant: "destructive",
        });
        return false;
    }
    return true; // Validation passes
}
export default validateFormData;
