import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Connection, ConnectionConfig } from '@solana/web3.js';
import { tap } from 'rxjs';
import { isNotNullOrUndefined } from './internals';

/**
 * Injection token for connection configuration.
 */
export const CONNECTION_CONFIG = new InjectionToken<ConnectionConfig>(
	'connectionConfig'
);

/**
 * Provider factory for connection configuration.
 * @param {ConnectionConfig} [config={}] - Connection configuration.
 * @returns {Provider} A provider for connection configuration.
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
 * Connection state.
 * @typedef {Object} ConnectionState
 * @property {Connection | null} connection - The connection.
 * @property {string | null} endpoint - The endpoint.
 */
interface ConnectionState {
	connection: Connection | null;
	endpoint: string | null;
}

/**
 * Store for connection.
 */
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
	 * @param {string} endpoint - The endpoint.
	 */
	readonly setEndpoint = this.updater((state, endpoint: string) => ({
		...state,
		endpoint,
	}));

	/**
	 * Effect to handle changes in the endpoint.
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
