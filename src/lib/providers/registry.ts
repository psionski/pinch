import type { FinancialDataProvider } from "./types";
import type { ProviderName } from "./types";
import type { SettingsService } from "@/lib/services/settings";
import type { SymbolMap } from "@/lib/validators/assets";
import { FrankfurterProvider } from "./frankfurter";
import { EcbProvider } from "./ecb";
import { CoinGeckoProvider } from "./coingecko";
import { OpenExchangeRatesProvider } from "./open-exchange-rates";
import { AlphaVantageProvider } from "./alpha-vantage";

/**
 * Instantiate a provider by name, reading API keys from settings.
 * Returns null when a key-requiring provider has no key configured.
 */
export function getProvider(
  name: ProviderName,
  settings: SettingsService
): FinancialDataProvider | null {
  switch (name) {
    case "frankfurter":
      return new FrankfurterProvider();
    case "ecb":
      return new EcbProvider();
    case "coingecko":
      return new CoinGeckoProvider(settings.get("provider.coingecko.key") ?? undefined);
    case "open-exchange-rates": {
      const key = settings.get("provider.open-exchange-rates.key");
      return key ? new OpenExchangeRatesProvider(key) : null;
    }
    case "alpha-vantage": {
      const key = settings.get("provider.alpha-vantage.key");
      return key ? new AlphaVantageProvider(key) : null;
    }
  }
}

/**
 * Resolve a SymbolMap to an ordered list of (provider, symbol) pairs.
 * Skips providers that can't be instantiated (missing API key).
 */
export function resolveProviders(
  symbolMap: SymbolMap,
  settings: SettingsService
): Array<{ provider: FinancialDataProvider; symbol: string }> {
  const result: Array<{ provider: FinancialDataProvider; symbol: string }> = [];
  for (const [name, symbol] of Object.entries(symbolMap)) {
    const provider = getProvider(name as ProviderName, settings);
    if (provider) result.push({ provider, symbol });
  }
  return result;
}
