import {
  WalletAdapter,
  WalletAdapterEvents,
} from '@solana/wallet-adapter-base';
import { Observable, fromEventPattern } from 'rxjs';

/**
 * Type representing the first parameter of a function.
 */
type FirstParameter<T> = T extends () => unknown
  ? void
  : T extends (arg1: infer U, ...args: unknown[]) => unknown
  ? U
  : unknown;

/**
 * @module WalletAdapterEvents
 * @memberof global
 */

/**
 * Creates an observable from a wallet adapter event.
 * @param {WalletAdapter} adapter - The wallet adapter to listen to.
 * @param {EventName} eventName - The name of the event to listen to.
 * @returns {Observable<CallbackParameter>} An observable of event callback parameters.
 */
export const fromAdapterEvent = <
  EventName extends keyof WalletAdapterEvents,
  CallbackParameter extends FirstParameter<WalletAdapterEvents[EventName]>
>(
  adapter: WalletAdapter,
  eventName: EventName
): Observable<CallbackParameter> =>
  fromEventPattern(
    (addHandler) => adapter.on(eventName, addHandler),
    (removeHandler) => adapter.off(eventName, removeHandler)
  );
