import { Inject, Injectable, InjectionToken } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import {
  Adapter,
  SendTransactionOptions,
  WalletError,
  WalletName,
  WalletNotConnectedError,
  WalletNotReadyError,
  WalletReadyState,
} from '@solana/wallet-adapter-base';
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionSignature,
} from '@solana/web3.js';
import {
  EMPTY,
  Observable,
  catchError,
  combineLatest,
  concatMap,
  defer,
  filter,
  finalize,
  first,
  firstValueFrom,
  from,
  fromEvent,
  merge,
  of,
  pairwise,
  switchMap,
  tap,
  throwError,
  withLatestFrom,
} from 'rxjs';
import {
  LocalStorageSubject,
  WalletNotSelectedError,
  fromAdapterEvent,
  handleEvent,
  signAllTransactions,
  signMessage,
  signTransaction,
} from './internals';

/**
 * An interface for the wallet object.
 * @interface
 * @property {Adapter} adapter - the adapter of the wallet.
 * @property {WalletReadyState} readyState - set of states that the wallet can be in.
 */
export interface Wallet {
  adapter: Adapter;
  readyState: WalletReadyState;
}

/**
 * An interface for the wallet configuration object.
 * @interface
 * @property {string} localStorageKey - key string for the wallet.
 * @property {boolean} autoConnect - optional feature that alllows the automatic connection of the wallet.
 * @property {Adapter[]} adapters - list of available adapters.
 */
export interface WalletConfig {
  localStorageKey: string;
  autoConnect: boolean;
  adapters: Adapter[];
}

/**
 * @module WalletConfig
 * @memberof global
 */

/**
 * Token used to provide the wallet configuration.
 * @description This token is used to provide the wallet configuration to the dependency injection system.
 * @type {InjectionToken<WalletConfig>}
 */
export const WALLET_CONFIG = new InjectionToken<WalletConfig>('walletConfig');

/**
 * Factory function that creates a provider for the wallet configuration.
 * @description This function takes a partial configuration object for the wallet and returns a provider object for the wallet configuration. The provider object has a provide property set to WALLET_CONFIG and a useValue property set to the merged default and provided configuration values.
 * @param {Partial<WalletConfig>} config - Partial configuration object for the wallet.
 * @returns {Provider} The provider object for the wallet configuration.
 */
export const walletConfigProviderFactory = (config: Partial<WalletConfig>) => ({
  provide: WALLET_CONFIG,
  useValue: {
    autoConnect: false,
    localStorageKey: 'walletName',
    adapters: [],
    ...config,
  },
});

/**
 * An interface for the information stored in the WalletState object.
 * @interface
 * @property {Adapter[]} adapters - list of available adapters.
 * @property {Wallet[]} wallets - list of the wallets related to the available adapters.
 * @property {Wallet | null} wallet - current wallet connected, null when there's no wallet connected.
 * @property {Adapter | null} adapter - adapter of the current wallet conencted, null when there's no wallet connected.
 * @property {boolean} connecting - true while the wallet connection still in process.
 * @property {boolean} disconnecting - true while the wallet disconnection still in process.
 * @property {boolean} unloading -
 * @property {boolean} connected - true while the wallet is connected.
 * @property {WalletReadyState | null} readyState - current state of the wallet, null when there's no wallet connected.
 * @property {PublicKey | null} publicKey - public key of the wallet connected, null when there's no wallet connected.
 * @property {boolean} autoConnect - optional feature that alllows the automatic connection of the wallet.
 * @property {WalletError | null} error - error throw by the wallet, null when there's no error.
 */
interface WalletState {
  adapters: Adapter[];
  wallets: Wallet[];
  wallet: Wallet | null;
  adapter: Adapter | null;
  connecting: boolean;
  disconnecting: boolean;
  unloading: boolean;
  connected: boolean;
  readyState: WalletReadyState | null;
  publicKey: PublicKey | null;
  autoConnect: boolean;
  error: WalletError | null;
}
/**
 * Initial state of the WalletStore object.
 * @constant
 */
const initialState: {
  wallet: Wallet | null;
  adapter: Adapter | null;
  connected: boolean;
  publicKey: PublicKey | null;
  readyState: WalletReadyState | null;
} = {
  wallet: null,
  adapter: null,
  connected: false,
  publicKey: null,
  readyState: null,
};

/**
 * Injectable class representing the WalletStore.
 */
@Injectable()
export class WalletStore extends ComponentStore<WalletState> {
  /**
   * Subject of the selected wallet name.
   * @description This subject holds the selected wallet name and allows observing and updating its value.
   * @readonly
   * @private
   * @type {LocalStorageSubject<WalletName<string>>}
   */
  private readonly _name = new LocalStorageSubject<WalletName>(
    this._config.localStorageKey
  );

  /**
   * Observable with the _name subject as source.
   * @description notify de subscribers the value of the property name of the selected wallet.
   * @readonly
   * @private
   * @type {Observable<WalletName<string> | null>}
   */
  private readonly _name$ = this._name.asObservable();

  /**
   * Observable for the unloading state of the wallet.
   * @description notifiy the subscribers the vaue of the unloading property of the selected wallet.
   * @readonly
   * @private
   * @type {Observable<boolean>}
   */
  private readonly _unloading$ = this.select(({ unloading }) => unloading);

  /**
   * Observale for the list of adapters available.
   * @description notifiy the subscribers the value of the available list of adapters.
   * @readonly
   * @private
   * @type {Observable<Adapter[]>}
   */
  private readonly _adapters$ = this.select(({ adapters }) => adapters);

  /**
   * Observable for the adapter of the selected wallet.
   * @description notify the subscribers the value of the adapter related to the selected wallet.
   * @readonly
   * @private
   * @type {Observable<Adapter | null>}
   */
  private readonly _adapter$ = this.select(({ adapter }) => adapter);

  /**
   * Observable for the ready state iof the selected wallet.
   * @description notify the subcribers the value of the readyState of the selected wallet.
   * @readonly
   * @private
   * @type {Observable<WalletReadyState | null>}
   * @returns {Observable<WalletReadyState | null>}
   */
  private readonly _readyState$ = this.select(({ readyState }) => readyState);

  /**
   * Observable for the list of wallets available.
   * @description notify the subscribers the value of the available list of wallets
   * @readonly
   * @type { Observable<Wallet[]>}
   */
  readonly wallets$ = this.select(({ wallets }) => wallets);

  /**
   * Observable for the autoconnect wallet feature
   * @description notify subscribers the value of the autoConnect optional property of the wallet.
   * @readonly
   * @type {Observable<boolean>}
   */
  readonly autoConnect$ = this.select(({ autoConnect }) => autoConnect);

  /**
   * Observable for the wallet selected.
   * @description notifiy subscribers the value of the selected wallet.
   * @readonly
   * @type {Observable<Wallet | null>}
   */
  readonly wallet$ = this.select(({ wallet }) => wallet);

  /**
   * Observable for the public key of the selected wallet.
   * @description notify subscribers the value of the public key of the selected wallet.
   * @readonly
   * @type {Observable<PublicKey | null>}
   */
  readonly publicKey$ = this.select(({ publicKey }) => publicKey);

  /**
   * Observable for the connecting wallet status.
   * @description notify subscribers the value of the connecting property of the selected wallet.
   * @readonly
   * @type {Observable<boolean>}
   */
  readonly connecting$ = this.select(({ connecting }) => connecting);

  /**
   * Observable for the disconnecting wallet status.
   * @description notify subscribers the value of the disconnecting property of the selected wallet.
   * @readonly
   * @type {Observable<boolean>}
   */
  readonly disconnecting$ = this.select(({ disconnecting }) => disconnecting);

  /**
   * Observable for the connected wallet status.
   * @description notify subscribers the value of the connected property of the selected wallet.
   * @readonly
   * @type {Observable<boolean>}
   */
  readonly connected$ = this.select(({ connected }) => connected);

  /**
   * Observable for the wallet error status.
   * @description notify subscribers the value of the error property of the selected wallet.
   * @readonly
   * @type {Observable<WalletError | null>}
   */
  readonly error$ = this.select(({ error }) => error);

  /**
   * Observable for the anchor wallet
   * @description handles the wallet's signTransaction and signAllTransactions methods if supported by the adapter
   * @readonly
   **/
  readonly anchorWallet$ = this.select(
    this.publicKey$,
    this._adapter$,
    this.connected$,
    (publicKey, adapter, connected) => {
      const adapterSignTransaction =
        adapter && 'signTransaction' in adapter
          ? signTransaction(adapter, connected, (error) =>
              this._setError(error)
            )
          : undefined;
      const adapterSignAllTransactions =
        adapter && 'signAllTransactions' in adapter
          ? signAllTransactions(adapter, connected, (error) =>
              this._setError(error)
            )
          : undefined;

      return publicKey && adapterSignTransaction && adapterSignAllTransactions
        ? {
            publicKey,
            signTransaction: (transaction: Transaction) =>
              firstValueFrom(adapterSignTransaction(transaction)),
            signAllTransactions: (transactions: Transaction[]) =>
              firstValueFrom(adapterSignAllTransactions(transactions)),
          }
        : undefined;
    },
    { debounce: true }
  );

  /**
   * Creates a new WalletStore object.
   * @description sets up the initial wallet state.
   * @contructs WalletStore
   * @param {WalletConfig} _config - The configuration of the wallet.
   */
  constructor(
    @Inject(WALLET_CONFIG)
    private _config: WalletConfig
  ) {
    super({
      ...initialState,
      wallets: [],
      adapters: [],
      connecting: false,
      disconnecting: false,
      unloading: false,
      autoConnect: _config.autoConnect || false,
      readyState: null,
      error: null,
    });

    this.setAdapters(this._config.adapters);
  }

  /**
   * Updates the error property of the wallet state.
   * @description When an error ocurrs, updates the state and informs the subscribers the new status of the wallet.
   * @readonly
   * @private
   * @method
   * @returns {void}
   */
  private readonly _setError = this.updater((state, error: WalletError) => ({
    ...state,
    error: state.unloading ? state.error : error,
  }));

  /**
   * Updates the readyState property of the wallet state.
   * @description When the wallet readyState change, updates the state and informs the subscribers the new status of the wallet.
   * @readonly
   * @private
   * @method
   */
  private readonly _setReadyState = this.updater(
    (
      state,
      {
        readyState,
        walletName,
      }: { readyState: WalletReadyState; walletName: WalletName }
    ) => ({
      ...state,
      wallets: state.wallets.map((wallet) =>
        wallet.adapter.name === walletName ? { ...wallet, readyState } : wallet
      ),
      readyState:
        state.adapter?.name === walletName ? readyState : state.readyState,
    })
  );

  /**
   * Updates the adapters property of the wallet state.
   * @description When the available adapters change, updates the state and informs the subscribers the new status of the wallet.
   * @readonly
   * @method
   */
  readonly setAdapters = this.updater((state, adapters: Adapter[]) => ({
    ...state,
    adapters,
    wallets: adapters.map((adapter) => ({
      adapter,
      readyState: adapter.readyState,
    })),
  }));

  /**
   * Disconnects previous adapter and connects the new one.
   * @description When the adapter change, disconnects the previous adapter, updates the readyState for newly selected adapter and informs the subscribers the new status of the wallet.
   * @readonly
   * @method
   */
  readonly onAdapterChangeDisconnectPreviousAdapter = this.effect(() =>
    this._adapter$.pipe(
      pairwise(),
      concatMap(([adapter]) =>
        adapter && adapter.connected
          ? from(defer(() => adapter.disconnect()))
          : of(null)
      )
    )
  );

  /**
   * Updates the wallet and the adapter to match the new selection.
   * @description When the wallet changes, initialize the wallet state for newly selected wallet and informs the subscribers the new status of the wallet.
   * @readonly
   * @method
   */
  readonly onWalletChanged = this.effect(() =>
    combineLatest([this._name$, this.wallets$]).pipe(
      tap(([name, wallets]) => {
        const wallet = wallets.find(({ adapter }) => adapter.name === name);

        if (wallet) {
          this.patchState({
            wallet,
            adapter: wallet.adapter,
            connected: wallet.adapter.connected,
            publicKey: wallet.adapter.publicKey,
            readyState: wallet.adapter.readyState,
          });
        } else {
          this.patchState(initialState);
        }
      })
    )
  );

  /**
   * Connects the wallet automatically.
   * @description If autoConnect is enabled, tries to connect the wallet when any change occurs, such as window reload.
   * @readonly
   * @method
   */
  readonly onAutoConnect = this.effect(() => {
    return combineLatest([
      this._adapter$,
      this._readyState$,
      this.autoConnect$,
      this.connecting$,
      this.connected$,
    ]).pipe(
      concatMap(([adapter, readyState, autoConnect, connecting, connected]) => {
        if (
          !autoConnect ||
          adapter == null ||
          (readyState !== WalletReadyState.Installed &&
            readyState !== WalletReadyState.Loadable) ||
          connecting ||
          connected
        ) {
          return EMPTY;
        }

        this.patchState({ connecting: true });
        return from(defer(() => adapter.connect())).pipe(
          catchError(() => {
            // Clear the selected wallet
            this.selectWallet(null);
            // Don't throw error, but onError will still be called
            return EMPTY;
          }),
          finalize(() => this.patchState({ connecting: false }))
        );
      })
    );
  });

  /**
   * Updates the unloading property of the wallet state.
   * @description If the window is closing or reloading, ignore the adapter's disconnect and error events.
   * @readonly
   * @method
   */
  readonly onWindowUnload = this.effect(() => {
    if (typeof window === 'undefined') {
      return of(null);
    }

    return fromEvent(window, 'beforeunload').pipe(
      tap(() => this.patchState({ unloading: true }))
    );
  });

  /**
   * Updates the wallet connected and publick key properties of the wallet state.
   * @description When the wallet connects, updates the state and informs the subscribers the new status of the wallet.
   * @readonly
   * @method
   */
  readonly onConnect = this.effect(() => {
    return this._adapter$.pipe(
      handleEvent((adapter) =>
        fromAdapterEvent(adapter, 'connect').pipe(
          tap(() =>
            this.patchState({
              connected: adapter.connected,
              publicKey: adapter.publicKey,
            })
          )
        )
      )
    );
  });

  /**
   * Cleans the wallet selected data.
   * @description When the wallet disconnects, remove the previos wallet data, updates the state and informs the subscribers the new status of the wallet.
   * @readonly
   * @method
   */
  readonly onDisconnect = this.effect(() => {
    return this._adapter$.pipe(
      handleEvent((adapter) =>
        fromAdapterEvent(adapter, 'disconnect').pipe(
          concatMap(() => of(null).pipe(withLatestFrom(this._unloading$))),
          filter(([, unloading]) => !unloading),
          tap(() => this.selectWallet(null))
        )
      )
    );
  });

  /**
   * Handle the error events of the wallet.
   * @description When an error occurs, updates the state and informs the subscribers the new status of the wallet.
   * @readonly
   * @method
   */
  readonly onError = this.effect(() => {
    return this._adapter$.pipe(
      handleEvent((adapter) =>
        fromAdapterEvent(adapter, 'error').pipe(
          tap((error) => this._setError(error))
        )
      )
    );
  });

  /**
   * Handle the changes of the readyState of the wallet.
   * @description When the readyState of an adapter change, updates all the adapters readyState properties and informs the subscribers of the new state.
   * @readonly
   * @method
   */
  readonly onReadyStateChanges = this.effect(() => {
    return this._adapters$.pipe(
      switchMap((adapters) =>
        merge(
          ...adapters.map((adapter) =>
            fromAdapterEvent(adapter, 'readyStateChange').pipe(
              tap((readyState) =>
                this._setReadyState({ readyState, walletName: adapter.name })
              )
            )
          )
        )
      )
    );
  });

  /**
   * Updates the selected wallet.
   * @description This method is used to update the selected wallet with the specified wallet name.
   * @method
   * @param {WalletName} walletName - The new wallet selected.
   * @returns {void}
   */
  selectWallet(walletName: WalletName | null) {
    this._name.next(walletName);
  }

  /**
   * Connects the adapter to the wallet.
   * @description Connects the adapter to the wallet by checking if it is not already connected, connecting or disconnecting. If there is no adapter selected, it throws a WalletNotSelectedError. If the readyState of the wallet is not Installed or Loadable, it throws a WalletNotReadyError. Otherwise, it connects to the adapter and updates the state accordingly.
   * @method
   * @type {Observable<unknown>}
   * @throws {WalletNotSelectedError} When there's no wallet selected.
   */
  connect(): Observable<unknown> {
    return combineLatest([
      this.connecting$,
      this.disconnecting$,
      this.connected$,
      this._adapter$,
      this._readyState$,
    ]).pipe(
      first(),
      filter(
        ([connecting, disconnecting, connected]) =>
          !connected && !connecting && !disconnecting
      ),
      concatMap(([, , , adapter, readyState]) => {
        if (!adapter) {
          const error = new WalletNotSelectedError();
          this._setError(error);
          return throwError(() => error);
        }

        if (
          !(
            readyState === WalletReadyState.Installed ||
            readyState === WalletReadyState.Loadable
          )
        ) {
          this.selectWallet(null);

          if (typeof window !== 'undefined') {
            window.open(adapter.url, '_blank');
          }

          const error = new WalletNotReadyError();
          this._setError(error);
          return throwError(() => error);
        }

        this.patchState({ connecting: true });

        return from(defer(() => adapter.connect())).pipe(
          catchError((error) => {
            this.selectWallet(null);
            return throwError(() => error);
          }),
          finalize(() => this.patchState({ connecting: false }))
        );
      })
    );
  }

  /**
   * Disconnects the adapter from the wallet.
   * @description Disconnects the adapter from the wallet by checking if it is not already disconnecting. If there is no adapter selected, it selects null as the wallet. Otherwise, it disconnects from the adapter and updates the state accordingly.
   * @method
   * @type {Observable<unknown>}
   */
  disconnect(): Observable<unknown> {
    return combineLatest([this.disconnecting$, this._adapter$]).pipe(
      first(),
      filter(([disconnecting]) => !disconnecting),
      concatMap(([, adapter]) => {
        if (!adapter) {
          this.selectWallet(null);
          return EMPTY;
        }

        this.patchState({ disconnecting: true });
        return from(defer(() => adapter.disconnect())).pipe(
          catchError((error) => {
            this.selectWallet(null);
            // Rethrow the error, and handleError will also be called
            return throwError(() => error);
          }),
          finalize(() => {
            this.patchState({ disconnecting: false });
          })
        );
      })
    );
  }

  /**
   * Sends a transaction using the provided connection.
   * @description Sends a transaction using the provided connection by checking if there is an adapter selected and if it is connected. If there is no adapter selected, it throws a WalletNotSelectedError. If there is no wallet connected, it throws a WalletNotConnectedError. Otherwise, it sends the transaction using the adapter.
   * @method
   * @param {Transaction} transaction - The Transaction to send.
   * @param {Connection} connection - The connection used to send the transaction.
   * @param {SendTransactionOptions} options - The configurations required to send the transaction.
   * @returns {Observable<TransactionSignature>} - Observable for the transaction signature.
   * @throws {WalletNotSelectedError} When there's no wallet selected.
   * @throws {WalletNotConnectedError} When there's no wallet conencted.
   */
  sendTransaction(
    transaction: Transaction,
    connection: Connection,
    options?: SendTransactionOptions
  ): Observable<TransactionSignature> {
    return combineLatest([this._adapter$, this.connected$]).pipe(
      first(),
      concatMap(([adapter, connected]) => {
        if (!adapter) {
          const error = new WalletNotSelectedError();
          this._setError(error);
          return throwError(() => error);
        }

        if (!connected) {
          const error = new WalletNotConnectedError();
          this._setError(error);
          return throwError(() => error);
        }

        return from(
          defer(() => adapter.sendTransaction(transaction, connection, options))
        );
      })
    );
  }

  /**
   * Sign a transaction if the wallet supports it.
   * @description Sign a transaction if the wallet supports it by checking if there is an adapter selected and if it has the signTransaction method. If it does, it signs the transaction using the adapter. Otherwise, it returns undefined.
   * @method
   * @param {Transaction} transaction - The transaction to sign.
   * @returns {Observable<Transaction> | undefined} - Observable for the signed transaction.
   */
  signTransaction(
    transaction: Transaction
  ): Observable<Transaction> | undefined {
    const { adapter, connected } = this.get();

    return adapter && 'signTransaction' in adapter
      ? signTransaction(adapter, connected, (error) => this._setError(error))(
          transaction
        )
      : undefined;
  }

  /**
   * Sign multiple transactions if the wallet supports it.
   * @description Sign multiple transactions if the wallet supports it by checking if there is an adapter selected and if it has the signAllTransactions method. If it does, it signs all the transactions using the adapter. Otherwise, it returns undefined.
   * @method
   * @param {Transaction[]} transactions - List of transactions to sign
   * @returns {Observable<Transaction[]> | undefined} - Observable for the transactions signed.
   */
  signAllTransactions(
    transactions: Transaction[]
  ): Observable<Transaction[]> | undefined {
    const { adapter, connected } = this.get();

    return adapter && 'signAllTransactions' in adapter
      ? signAllTransactions(adapter, connected, (error) =>
          this._setError(error)
        )(transactions)
      : undefined;
  }

  /**
   * Sign an arbitrary message if the wallet supports it.
   * @description Sign an arbitrary message if the wallet supports it by checking if there is an adapter selected and if it has the signMessage method. If it does, it signs the message using the adapter. Otherwise, it returns undefined.
   * @method
   * @param {Uint8Array} message - The message to sign.
   * @returns {Observable<Uint8Array> | undefined} - Observable for the message signed.
   */
  signMessage(message: Uint8Array): Observable<Uint8Array> | undefined {
    const { adapter, connected } = this.get();

    return adapter && 'signMessage' in adapter
      ? signMessage(adapter, connected, (error) => this._setError(error))(
          message
        )
      : undefined;
  }
}
