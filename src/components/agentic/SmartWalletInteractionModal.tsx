'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet as useCrossmintWalletContext } from '@crossmint/client-sdk-react-ui'; // Renamed to avoid conflict
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react'; // For receive QR code
import { CopyIcon, ExternalLinkIcon } from 'lucide-react';

interface SmartWalletInteractionModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  mode: 'send' | 'receive';
  smartWalletAddress: string | undefined;
  solBalance: number | null;
  defaiBalance: number | null;
  defaiDecimals: number;
  onTransactionSuccess?: () => void; // Callback to refresh balances
}

export default function SmartWalletInteractionModal({
  isOpen,
  setIsOpen,
  mode,
  smartWalletAddress,
  solBalance,
  defaiBalance,
  defaiDecimals,
  onTransactionSuccess
}: SmartWalletInteractionModalProps) {
  const { connection } = useConnection();
  const { wallet: crossmintWallet } = useCrossmintWalletContext(); // From Crossmint SDK

  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [tokenToSend, setTokenToSend] = useState<'SOL' | 'DEFAI'>('SOL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaiMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS;

  useEffect(() => {
    // Reset form when modal opens or mode changes
    if (isOpen) {
      setRecipientAddress('');
      setSendAmount('');
      setTokenToSend('SOL');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, mode]);

  const handleSend = async () => {
    if (!smartWalletAddress || !crossmintWallet || !recipientAddress || !sendAmount || !defaiMintAddress) {
      setError('Missing required information for sending.');
      return;
    }
    if (!connection) {
        setError('Connection not available.');
        return;
    }

    setIsLoading(true);
    setError(null);
    toast.info('Preparing transaction...');

    try {
      const amountNum = parseFloat(sendAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Invalid amount.');
      }

      const transaction = new Transaction();
      const payerPublicKey = new PublicKey(smartWalletAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);

      if (tokenToSend === 'SOL') {
        if (solBalance === null || amountNum > solBalance) {
          throw new Error('Insufficient SOL balance.');
        }
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: payerPublicKey,
            toPubkey: recipientPublicKey,
            lamports: amountNum * LAMPORTS_PER_SOL,
          })
        );
        toast.info(`Sending ${amountNum} SOL to ${recipientPublicKey.toBase58().substring(0,6)}...`);
      } else { // DEFAI
        if (defaiBalance === null || amountNum > defaiBalance) {
          throw new Error('Insufficient DEFAI balance.');
        }
        const defaiMintPubkey = new PublicKey(defaiMintAddress);
        
        const sourceAta = await getAssociatedTokenAddress(
            defaiMintPubkey,
            payerPublicKey,
            true // allowOwnerOffCurve for smart wallet
        );

        const destAta = await getAssociatedTokenAddress(
            defaiMintPubkey,
            recipientPublicKey
            // false, // allowOwnerOffCurve can be false for normal wallets
            // TOKEN_PROGRAM_ID, // programId
            // ASSOCIATED_TOKEN_PROGRAM_ID // associatedTokenProgramId
        );
        
        // Check if destination ATA exists, if not, it might need to be created by the recipient first
        // For simplicity, we assume it exists or will be created by the first deposit.
        // A robust solution would check and potentially include create ATA instruction if recipient is the payer.
        // However, Crossmint smart wallet might not support creating ATAs for others directly.
        try {
            await getAccount(connection, destAta);
        } catch (e: any) {
            if (e.name === 'TokenAccountNotFoundError') {
                // If we control the recipient (e.g. another of our wallets), we could add a create ATA instruction here.
                // But for sending to arbitrary external wallets, they should have their ATA already.
                // For now, we'll proceed; if the ATA truly doesn't exist, transfer will fail, which is okay.
                console.warn(`Destination DEFAI ATA ${destAta.toBase58()} for ${recipientAddress} not found. Transfer might fail if it's not implicitly created.`);
            } else {
                throw e; // re-throw other errors
            }
        }

        const tokenAmountLamports = BigInt(Math.floor(amountNum * Math.pow(10, defaiDecimals)));

        transaction.add(
          createTransferInstruction(
            sourceAta,
            destAta,
            payerPublicKey,
            tokenAmountLamports // Use the pre-calculated BigInt
            // [], // Temporarily remove explicit multiSigners for testing linter
            // TOKEN_PROGRAM_ID // Temporarily remove explicit programId for testing linter
          )
        );
        toast.info(`Sending ${amountNum} DEFAI to ${recipientPublicKey.toBase58().substring(0,6)}...`);
      }
      
      // Sign and send with Crossmint wallet
      // Note: Crossmint's signAndSendTransaction might not be available directly
      // We might need to use signTransaction and then connection.sendRawTransaction
      // or rely on a simpler sendTransaction if it handles signing internally.
      
      // The Crossmint wallet adapter should expose a sendTransaction method similar to standard wallet adapters.
      // It will handle the signing via the Crossmint service.
      if (!crossmintWallet.sendTransaction) {
        throw new Error('Crossmint wallet does not support sendTransaction. Please ensure you are using the correct provider/SDK version.');
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payerPublicKey; // Smart wallet pays fees

      // Convert to VersionedTransaction
      const messageV0 = new TransactionMessage({
        payerKey: payerPublicKey,
        recentBlockhash: blockhash,
        instructions: transaction.instructions, // 올바른 instructions 배열을 사용합니다.
      }).compileToV0Message();
      const versionedTransaction = new VersionedTransaction(messageV0);

      // Use type assertion to handle potential @solana/web3.js version mismatches
      const signature = await crossmintWallet.sendTransaction(versionedTransaction as any);
      toast.info('Transaction sent. Confirming...', { id: signature });
      console.log('Transaction sent from smart wallet, signature:', signature);
      
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      toast.success('Transaction confirmed!', { id: signature });
      
      setIsOpen(false);
      if (onTransactionSuccess) {
        onTransactionSuccess();
      }

    } catch (err: any) {
      console.error('Send transaction error:', err);
      setError(err.message || 'Failed to send transaction.');
      toast.error(`Error: ${err.message || 'Failed to send transaction.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAddress = () => {
    if (smartWalletAddress) {
      navigator.clipboard.writeText(smartWalletAddress)
        .then(() => toast.success('Smart Wallet address copied!'))
        .catch(() => toast.error('Failed to copy address.'));
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'send' ? 'Send Tokens' : 'Receive Tokens'}</DialogTitle>
          <DialogDescription>
            {mode === 'send'
              ? 'Send SOL or DEFAI from your smart wallet.'
              : 'Your smart wallet address for receiving tokens.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'receive' && smartWalletAddress && (
          <div className="mt-4 flex flex-col items-center space-y-4">
            <QRCodeSVG value={smartWalletAddress} size={160} level="H" />
            <div className="flex items-center space-x-2 p-2 bg-muted rounded-md w-full">
              <input 
                type="text" 
                value={smartWalletAddress} 
                readOnly 
                className="flex-grow p-1 bg-transparent text-sm font-mono focus:outline-none truncate"
              />
              <Button variant="ghost" size="icon" onClick={handleCopyAddress} className="shrink-0">
                <CopyIcon className="h-4 w-4" />
              </Button>
            </div>
            <a 
                href={`https://solscan.io/account/${smartWalletAddress}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                View on Solscan <ExternalLinkIcon className="h-3 w-3" />
              </a>
          </div>
        )}

        {mode === 'send' && (
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="token">Token</Label>
              <div className="flex space-x-2 mt-1">
                <Button 
                  variant={tokenToSend === 'SOL' ? 'default' : 'outline'} 
                  onClick={() => setTokenToSend('SOL')}
                  className="flex-1"
                >
                  SOL
                </Button>
                <Button 
                  variant={tokenToSend === 'DEFAI' ? 'default' : 'outline'} 
                  onClick={() => setTokenToSend('DEFAI')}
                  className="flex-1"
                >
                  DEFAI
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="recipient">Recipient Address</Label>
              <Input 
                id="recipient" 
                value={recipientAddress} 
                onChange={(e) => setRecipientAddress(e.target.value)} 
                placeholder="Solana address (e.g. AbC...xYz)"
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input 
                id="amount" 
                type="number" 
                value={sendAmount} 
                onChange={(e) => setSendAmount(e.target.value)} 
                placeholder={`0.00 ${tokenToSend}`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: {tokenToSend === 'SOL' ? (solBalance?.toFixed(4) ?? '0.0000') : (defaiBalance?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: defaiDecimals}) ?? '0.00')} {tokenToSend}
              </p>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="outline">{mode === 'send' ? 'Cancel' : 'Close'}</Button>
          </DialogClose>
          {mode === 'send' && (
            <Button onClick={handleSend} disabled={isLoading || !recipientAddress || !sendAmount}>
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 