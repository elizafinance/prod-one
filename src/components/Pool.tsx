"use client";
import React, { useState } from 'react';
import { StakeModal } from './modals/StakeModal';
import { UnstakeModal } from './modals/UnstakeModal';
import { HarvestModal } from './modals/HarvestModal';
import { Button } from './ui/button';
import { PublicKey } from '@solana/web3.js';
import { useTotalLiquidity } from '@/hooks/useTotalLiquidity';
import { poolState as defaultPoolState } from '@/constants/constants';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import BN from 'bn.js';

interface StakeInfo {
  signature: string;
  stakeEntryAddress: PublicKey;
  stakedAmount: BN;
  positionMintAddress?: PublicKey;
}

export const Pool: React.FC = () => {
  const { connected } = useWallet();
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [isUnstakeModalOpen, setIsUnstakeModalOpen] = useState(false);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
  const [currentStakeInfo, setCurrentStakeInfo] = useState<StakeInfo | null>(null);

  const { totalLiquidity, loading: liquidityLoading, error: liquidityError } = useTotalLiquidity(defaultPoolState);

  const handleStakeSuccess = (result: StakeInfo) => {
    console.log('Stake successful in Pool component:', result);
    setCurrentStakeInfo(result);
  };

  return (
    <div className="border p-6 rounded-lg shadow-lg bg-card text-card-foreground">
      <h2 className="text-2xl font-semibold mb-4">Yield Pool</h2>
      
      {!connected ? (
        <div className="flex flex-col items-center">
          <p className="mb-2">Please connect your wallet to interact with the pool.</p>
          <WalletMultiButton />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <h3 className="text-lg font-medium">Pool Liquidity</h3>
            {liquidityLoading && <p>Loading total liquidity...</p>}
            {liquidityError && <p className="text-red-500">Error: {liquidityError}</p>}
            {totalLiquidity && !liquidityLoading && (
              <p className="text-xl">{totalLiquidity.toString()} units</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 mb-4">
            <Button onClick={() => setIsStakeModalOpen(true)} className="w-full sm:w-auto">Stake</Button>
            <Button 
              onClick={() => setIsUnstakeModalOpen(true)} 
              disabled={!currentStakeInfo} 
              variant="outline" 
              className="w-full sm:w-auto"
            >
              Unstake
            </Button>
            <Button 
              onClick={() => setIsHarvestModalOpen(true)} 
              disabled={!currentStakeInfo} 
              variant="outline"
              className="w-full sm:w-auto"
            >
              Harvest Rewards
            </Button>
          </div>

          {currentStakeInfo && (
            <div className="mt-4 p-3 bg-muted rounded-md text-sm">
              <p><strong>Last Stake Entry:</strong> {currentStakeInfo.stakeEntryAddress.toBase58()}</p>
              <p><strong>Staked Amount:</strong> {currentStakeInfo.stakedAmount.toString()}</p>
            </div>
          )}
        </>
      )}

      {isStakeModalOpen && (
        <ModalWrapper title="Stake Tokens" onClose={() => setIsStakeModalOpen(false)}>
          <StakeModal 
            setIsStakeModalOpen={setIsStakeModalOpen} 
            onStakeSuccess={handleStakeSuccess} 
          />
        </ModalWrapper>
      )}

      {isUnstakeModalOpen && (
        <ModalWrapper title="Unstake Tokens" onClose={() => setIsUnstakeModalOpen(false)}>
          <UnstakeModal setIsUnstakeModalOpen={setIsUnstakeModalOpen} />
        </ModalWrapper>
      )}

      {isHarvestModalOpen && (
        <ModalWrapper title="Harvest Rewards" onClose={() => setIsHarvestModalOpen(false)}>
          <HarvestModal 
            setIsHarvestModalOpen={setIsHarvestModalOpen} 
            stakeEntryAddressFromPool={currentStakeInfo?.stakeEntryAddress.toBase58()} 
          />
        </ModalWrapper>
      )}
    </div>
  );
};

interface ModalWrapperProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ title, onClose, children }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}; 