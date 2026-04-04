"use client";

import { useState, useEffect } from "react";
import { Check, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProviderStatusResponse } from "@/lib/validators/financial";
import { PROVIDER_LABELS } from "@/lib/providers/labels";
import { Section } from "./settings-section";

interface ProvidersSectionProps {
  isOnboarding: boolean;
  onContinue: () => void;
  onContentLoaded?: () => void;
}

export function ProvidersSection({
  isOnboarding,
  onContinue,
  onContentLoaded,
}: ProvidersSectionProps): React.ReactElement {
  const [providers, setProviders] = useState<ProviderStatusResponse[] | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [savedProviders, setSavedProviders] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetch("/api/financial/providers")
      .then((r) => r.json())
      .then((data: ProviderStatusResponse[]) => {
        setProviders(data);
        onContentLoaded?.();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveKey(provider: string): Promise<void> {
    const key = keys[provider];
    if (!key) return;
    const res = await fetch(`/api/financial/providers/${provider}/key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      setSavedProviders((prev) => new Set(prev).add(provider));
    }
  }

  return (
    <Section
      title="Market Data Providers"
      description="Free providers (Frankfurter, CoinGecko) work without keys. Add API keys for premium providers or higher rate limits."
      icon={<Key className="text-muted-foreground size-5" />}
    >
      <div className="max-w-md space-y-3">
        {providers === null ? (
          <p className="text-muted-foreground text-sm">Loading providers...</p>
        ) : (
          providers
            .filter((p) => p.apiKeyRequired !== "none")
            .map((p) => {
              const isSaved = savedProviders.has(p.name) || p.apiKeySet;
              return (
                <div key={p.name} className="space-y-1.5">
                  <Label className="capitalize">{PROVIDER_LABELS[p.name]}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder={isSaved ? "Key already set" : "API key"}
                      value={keys[p.name] ?? ""}
                      disabled={isSaved}
                      onChange={(e) => setKeys({ ...keys, [p.name]: e.target.value })}
                    />
                    {!isSaved && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!keys[p.name]}
                        onClick={() => void saveKey(p.name)}
                      >
                        Save
                      </Button>
                    )}
                    {isSaved && (
                      <div className="flex items-center px-2">
                        <Check className="text-primary size-4" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
        )}
        <p className="text-muted-foreground text-xs">
          Alpha Vantage provides stock/ETF prices &mdash; get a free key at{" "}
          <a
            href="https://www.alphavantage.co/support/#api-key"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            alphavantage.co
          </a>{" "}
          (25 requests/day).
        </p>
        {isOnboarding && (
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={onContinue}>
              Continue
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}
