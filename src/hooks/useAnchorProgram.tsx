import { AnchorWallet, useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, Idl } from '@project-serum/anchor';

import { useEffect, useState } from 'react';
import { fetchIdlFromChain } from '@/services/fetchIDL';
import { programId } from '@/constants/constants';

export function useAnchorProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [program, setProgram] = useState<Program | null>(null);
  const [provider, setProvider] = useState<AnchorProvider | null>(null);

  useEffect(() => {
    const initializeProgram = async () => {
      if (wallet && connection) {
        const fetchedIdl = await fetchIdlFromChain(programId.toBase58());
        try {
          const provider = new AnchorProvider(connection, wallet as AnchorWallet, { preflightCommitment: 'confirmed' });
          const program = new Program(fetchedIdl as Idl, programId, provider);

          setProgram(program);
          setProvider(provider);
        } catch (error) {
          console.error('Error creating program:', error);
        }
      }
    }

    initializeProgram();
  }, [wallet, connection]);

  return { program, provider };
}
