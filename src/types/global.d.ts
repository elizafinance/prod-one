declare module '@project-serum/anchor' {
  import { PublicKey, Transaction } from '@solana/web3.js';

  export class Program {
    constructor(idl: Idl, programId: string | PublicKey, provider?: Provider);
    // Add other methods/properties if your hooks use them, e.g.:
    // methods: any;
    // account: any;
  }

  export class AnchorProvider implements Provider {
    constructor(connection: any, wallet: any, opts: any);
    // Add other methods/properties if your hooks use them, e.g.:
    // sendAndConfirm(tx: Transaction, signers?: Signer[], opts?: ConfirmOptions): Promise<string>;
  }

  export interface Provider {
    // Define provider interface based on usage
  }

  export interface Idl {
    // Define IDL structure if needed, or use 'any'
  }

  export const web3: any; // For anchor.web3.SystemProgram etc.
  export const BN: any; // If you still import BN from here elsewhere
}

declare module '@/idl/yield_program.json' {
  const value: any;
  export default value;
}

declare module 'bn.js' {
  class BN {
    constructor(number: number | string | number[] | Uint8Array | Buffer, base?: number | 'hex', endian?: 'le' | 'be');
    toNumber(): number;
    toString(base?: number | 'hex', padding?: number): string;
    // minimal subset – extend as needed
  }
  export default BN;
} 