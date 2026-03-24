import type { FinancialDataProvider, ProviderName } from "./types";
import type { SettingsService } from "@/lib/services/settings";
import { FrankfurterProvider } from "./frankfurter";
import { EcbProvider } from "./ecb";
import { CoinGeckoProvider } from "./coingecko";
import { OpenExchangeRatesProvider } from "./open-exchange-rates";
import { AlphaVantageProvider } from "./alpha-vantage";
import { financialLogger } from "@/lib/logger";

// ─── Provider Metadata ───────────────────────────────────────────────────────

export interface ProviderMeta {
  readonly name: ProviderName;
  readonly type: "exchange-rates" | "market-prices";
  readonly apiKeyRequired: "none" | "optional" | "required";
  readonly create: (apiKey?: string) => FinancialDataProvider;
}

/** Central registry of all providers. Order defines discovery priority. */
const PROVIDER_REGISTRY: readonly ProviderMeta[] = [
  {
    name: "frankfurter",
    type: "exchange-rates",
    apiKeyRequired: "none",
    create: () => new FrankfurterProvider(),
  },
  {
    name: "ecb",
    type: "exchange-rates",
    apiKeyRequired: "none",
    create: () => new EcbProvider(),
  },
  {
    name: "coingecko",
    type: "market-prices",
    apiKeyRequired: "optional",
    create: (key) => new CoinGeckoProvider(key),
  },
  {
    name: "open-exchange-rates",
    type: "exchange-rates",
    apiKeyRequired: "required",
    create: (key) => new OpenExchangeRatesProvider(key!),
  },
  {
    name: "alpha-vantage",
    type: "market-prices",
    apiKeyRequired: "required",
    create: (key) => new AlphaVantageProvider(key!),
  },
];

// ─── Query Helpers ───────────────────────────────────────────────────────────

/** Get metadata for a provider by name. */
export function getProviderMeta(name: ProviderName): ProviderMeta {
  const meta = PROVIDER_REGISTRY.find((m) => m.name === name);
  if (!meta) throw new Error(`Unknown provider: ${name}`);
  return meta;
}

/** Get all provider names in discovery order. */
export function getAllProviderNames(): ProviderName[] {
  return PROVIDER_REGISTRY.map((m) => m.name);
}

/** Get the data type for a provider. */
export function getProviderType(name: ProviderName): ProviderMeta["type"] {
  return getProviderMeta(name).type;
}

// ─── Instantiation ───────────────────────────────────────────────────────────

/**
 * Instantiate a provider by name, reading API keys from settings.
 * Returns null when a key-requiring provider has no key configured.
 */
export function getProvider(
  name: ProviderName,
  settings: SettingsService
): FinancialDataProvider | null {
  const meta = getProviderMeta(name);
  const key = settings.get(`provider.${name}.key`) ?? undefined;

  if (meta.apiKeyRequired === "required" && !key) return null;
  return meta.create(key);
}

/** Instantiate all available providers (skips key-required without keys). */
export function getAllProviders(settings: SettingsService): FinancialDataProvider[] {
  return PROVIDER_REGISTRY.map((meta) => getProvider(meta.name, settings)).filter(
    (p): p is FinancialDataProvider => p !== null
  );
}

/** Get names of providers that accept/require a key but don't have one configured. */
export function getUnconfiguredProviders(settings: SettingsService): ProviderName[] {
  return PROVIDER_REGISTRY.filter(
    (meta) => meta.apiKeyRequired !== "none" && !settings.get(`provider.${meta.name}.key`)
  ).map((meta) => meta.name);
}

// ─── Provider Status ─────────────────────────────────────────────────────────

export interface ProviderStatus {
  name: ProviderName;
  type: "exchange-rates" | "market-prices";
  apiKeyRequired: "none" | "optional" | "required";
  apiKeySet: boolean;
  healthy: boolean | null;
}

/** Build full provider status including health checks. */
export async function getProviderStatuses(settings: SettingsService): Promise<ProviderStatus[]> {
  const statuses: ProviderStatus[] = PROVIDER_REGISTRY.map((meta) => ({
    name: meta.name,
    type: meta.type,
    apiKeyRequired: meta.apiKeyRequired,
    apiKeySet: meta.apiKeyRequired === "none" || !!settings.get(`provider.${meta.name}.key`),
    healthy: null,
  }));

  const checks = await Promise.allSettled(
    PROVIDER_REGISTRY.map((meta) => {
      const provider = getProvider(meta.name, settings);
      return provider?.healthCheck ? provider.healthCheck() : Promise.resolve(false);
    })
  );

  checks.forEach((result, i) => {
    statuses[i].healthy = result.status === "fulfilled" ? result.value : false;
  });

  financialLogger.debug(
    { providers: statuses.map((s) => ({ name: s.name, healthy: s.healthy })) },
    "Provider health check completed"
  );

  return statuses;
}
