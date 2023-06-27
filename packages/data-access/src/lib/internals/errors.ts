import { WalletError } from '@solana/wallet-adapter-base';

/**
 * Error thrown when a wallet is not selected.
 */
export class WalletNotSelectedError extends WalletError {
  override name = 'WalletNotSelectedError';
}
