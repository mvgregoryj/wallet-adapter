import { ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { provideComponentStore } from '@ngrx/component-store';
import { ConnectionConfig } from '@solana/web3.js';
import {
  ConnectionStore,
  connectionConfigProviderFactory,
} from './connection.store';
import {
  WalletConfig,
  WalletStore,
  walletConfigProviderFactory,
} from './wallet.store';

/**
 * @module WalletConfig
 * @memberof global
 */

/**
 * Provides a wallet adapter.
 * @param {Partial<WalletConfig>} walletConfig - Wallet settings.
 * @param {ConnectionConfig} [connectionConfig] - Connection settings.
 * @returns {Provider[]} An array of providers.
 */
export function provideWalletAdapter(
  walletConfig: Partial<WalletConfig>,
  connectionConfig?: ConnectionConfig
): Provider[] {
  return [
    walletConfigProviderFactory(walletConfig),
    connectionConfigProviderFactory(connectionConfig),
    provideComponentStore(WalletStore),
  ];
}

/**
 * Module to provide an HD wallet adapter.
 * @module HdWalletAdapterModule
 * @example
 * import { HdWalletAdapterModule } from './hd-wallet-adapter.module';
 *
 * @NgModule({
 *   imports: [
 *     HdWalletAdapterModule.forRoot(walletConfig, connectionConfig),
 *   ],
 * })
 * export class AppModule {}
 */
@NgModule({})
export class HdWalletAdapterModule {
  static forRoot(
    walletConfig: Partial<WalletConfig>,
    connectionConfig?: ConnectionConfig
  ): ModuleWithProviders<HdWalletAdapterModule> {
    return {
      ngModule: HdWalletAdapterModule,
      providers: [
        walletConfigProviderFactory(walletConfig),
        connectionConfigProviderFactory(connectionConfig),
        ConnectionStore,
        WalletStore,
      ],
    };
  }
}
