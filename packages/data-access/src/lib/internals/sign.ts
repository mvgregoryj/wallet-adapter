import {
  MessageSignerWalletAdapter,
  SignerWalletAdapter,
  WalletError,
  WalletNotConnectedError,
} from '@solana/wallet-adapter-base';
import { Transaction } from '@solana/web3.js';
import { Observable, defer, from, throwError } from 'rxjs';

/**
 * Type representing an error handler function.
 */
type ErrorHandlerFunction = (error: WalletError) => unknown;

/**
 * Type representing a message signing function.
 */
type MessageSigningFunction = (message: Uint8Array) => Observable<Uint8Array>;

/**
 * Type representing a transaction signing function.
 */
type TransactionSigningFunction = (
  transaction: Transaction
) => Observable<Transaction>;

/**
 * Type representing a transactions signing function.
 */
type TransactionsSigningFunction = (
  transactions: Transaction[]
) => Observable<Transaction[]>;

/**
 * @module Sign
 * @memberof global
 */

/**
 * Signs a message using the provided adapter.
 * @param {MessageSignerWalletAdapter} adapter - The adapter to use for signing.
 * @param {boolean} connected - Whether the adapter is connected.
 * @param {ErrorHandlerFunction} errorHandler - Error handler function.
 * @returns {MessageSigningFunction} A function that takes a message and returns an observable of the signed message.
 */
export const signMessage = (
  adapter: MessageSignerWalletAdapter,
  connected: boolean,
  errorHandler: ErrorHandlerFunction
): MessageSigningFunction => {
  return (message: Uint8Array) => {
    if (!connected) {
      return throwError(() => errorHandler(new WalletNotConnectedError()));
    }

    return from(defer(() => adapter.signMessage(message)));
  };
};

/**
 * Signs a transaction using the provided adapter.
 * @param {SignerWalletAdapter} adapter - The adapter to use for signing.
 * @param {boolean} connected - Whether the adapter is connected.
 * @param {ErrorHandlerFunction} errorHandler - Error handler function.
 * @returns {TransactionSigningFunction} A function that takes a transaction and returns an observable of the signed transaction.
 */
export const signTransaction = (
  adapter: SignerWalletAdapter,
  connected: boolean,
  errorHandler: ErrorHandlerFunction
): TransactionSigningFunction => {
  return (transaction: Transaction) => {
    if (!connected) {
      return throwError(() => errorHandler(new WalletNotConnectedError()));
    }

    return from(defer(() => adapter.signTransaction(transaction)));
  };
};

/**
 * Signs all transactions using the provided adapter.
 * @param {SignerWalletAdapter} adapter - The adapter to use for signing.
 * @param {boolean} connected - Whether the adapter is connected.
 * @param {ErrorHandlerFunction} errorHandler - Error handler function.
 * @returns {TransactionsSigningFunction} A function that takes an array of transactions and returns an observable of the signed transactions.
 */
export const signAllTransactions = (
  adapter: SignerWalletAdapter,
  connected: boolean,
  errorHandler: ErrorHandlerFunction
): TransactionsSigningFunction => {
  return (transactions: Transaction[]) => {
    if (!connected) {
      return throwError(() => errorHandler(new WalletNotConnectedError()));
    }

    return from(defer(() => adapter.signAllTransactions(transactions)));
  };
};
