import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Connection, ConnectionConfig } from '@solana/web3.js';
import { tap } from 'rxjs';
import { isNotNullOrUndefined } from './internals';

/**
 * @module ConnectionConfig
 * @memberof global
 */

/**
 * Injection token for connection configuration.
 * @const {InjectionToken<ConnectionConfig>}
 * @see ConnectionConfig
 */
export const CONNECTION_CONFIG = new InjectionToken<ConnectionConfig>(
  'connectionConfig'
);

/**
 * Provider factory for connection configuration.
 * @param {ConnectionConfig} [config={}] - Connection configuration.
 * @returns {Provider} A provider for connection configuration.
 * @see CONNECTION_CONFIG
 */
export const connectionConfigProviderFactory = (
  config: ConnectionConfig = {}
) => ({
  provide: CONNECTION_CONFIG,
  useValue: {
    commitment: 'confirmed',
    ...config,
  },
});

/**
 * Interface representing the connection state.
 * @interface
 * @property {Connection | null} connection - The connection.
 * @property {string | null} endpoint - The endpoint.
 */
interface ConnectionState {
  connection: Connection | null;
  endpoint: string | null;
}

// /**
//  * Represents the connection state.
//  * @typedef {Object} ConnectionState
//  * @property {Connection | null} connection - The connection.
//  * @property {string | null} endpoint - The endpoint.
//  */

// /**
//  * Store for managing connection state.
//  * @class
//  * @extends ComponentStore<ConnectionState>
//  */
@Injectable()
export class ConnectionStore extends ComponentStore<ConnectionState> {
  private readonly _endpoint$ = this.select(
    this.state$,
    ({ endpoint }) => endpoint
  );
  readonly connection$ = this.select(
    this.state$,
    ({ connection }) => connection
  );

  /**
   * Creates an instance of ConnectionStore.
   * @constructor
   * @param {ConnectionConfig} [_config] - The connection configuration.
   */
  constructor(
    @Optional()
    @Inject(CONNECTION_CONFIG)
    private _config: ConnectionConfig
  ) {
    super({
      connection: null,
      endpoint: null,
    });
  }

  /**
   * Sets the endpoint.
   * @param {string} endpoint - The endpoint to set.
   * @memberof global
   * @method
   */
  readonly setEndpoint = this.updater((state, endpoint: string) => ({
    ...state,
    endpoint,
  }));

  /**
   * Effect to handle changes in the endpoint.
   * @memberof global
   * @method
   */
  readonly onEndpointChange = this.effect(() =>
    this._endpoint$.pipe(
      isNotNullOrUndefined,
      tap((endpoint) =>
        this.patchState({
          connection: new Connection(endpoint, this._config),
        })
      )
    )
  );
}
