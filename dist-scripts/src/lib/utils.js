import { publicKey } from "@metaplex-foundation/umi";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
/**
 * Formats a token amount or Token account into a human-readable string with proper decimal places
 * @param tokenAccountOrAmount - Either a Token object or raw bigint amount to format
 * @param decimals - Optional number of decimal places when passing raw bigint amount. Required when passing an amount.
 * @returns Formatted string with proper decimal places and thousands separators
 * @example
 * // Token account with 9 decimals and amount 1234567890
 * formatTokenAmount(tokenAccount) // Returns "1.234567890"
 *
 * // Raw amount with 6 decimals
 * formatTokenAmount(1234567890n, 6) // Returns "1,234.567890"
 */
export function formatTokenAmount(tokenAccountOrAmount, decimals) {
    if (typeof tokenAccountOrAmount === 'bigint' && !decimals) {
        throw new Error("decimals value is required when passing a raw bigint amount");
    }
    const tokenAccount = typeof tokenAccountOrAmount === 'bigint' ? { amount: tokenAccountOrAmount, header: { lamports: { decimals: decimals } } } : tokenAccountOrAmount;
    const divisor = BigInt(10 ** tokenAccount.header.lamports.decimals);
    const whole = tokenAccount.amount / divisor;
    const remainder = tokenAccount.amount % divisor;
    // Pad remainder with leading zeros to match decimal places
    const remainderStr = remainder.toString().padStart(tokenAccount.header.lamports.decimals, '0');
    // Remove trailing zeros and add commas for cleaner display
    const formatted = `${whole.toLocaleString()}.${remainderStr}`.replace(/\.?0+$/, '');
    return formatted;
}
export const shortenAddress = (address, chars = 4) => {
    return address.slice(0, chars) + "..." + address.slice(-chars);
};
export const isValidPublicKey = (key) => {
    console.log("validating key", key);
    try {
        publicKey(key);
    }
    catch (error) {
        return false;
    }
    return true;
};
