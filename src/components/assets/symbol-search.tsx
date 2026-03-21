"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const MAX_PER_PROVIDER = 5;
const DEBOUNCE_MS = 300;

interface SymbolSearchResult {
  provider: string;
  symbol: string;
  name: string;
  type?: string;
}

/** The symbolMap: one symbol per provider. */
type SymbolMap = Record<string, string>;

interface SymbolSearchProps {
  value: SymbolMap;
  onChange: (map: SymbolMap) => void;
  disabled?: boolean;
}

function groupByProvider(results: SymbolSearchResult[]): Map<string, SymbolSearchResult[]> {
  const grouped = new Map<string, SymbolSearchResult[]>();
  for (const r of results) {
    const list = grouped.get(r.provider) ?? [];
    if (list.length < MAX_PER_PROVIDER) {
      list.push(r);
    }
    grouped.set(r.provider, list);
  }
  return grouped;
}

const PROVIDER_LABELS: Record<string, string> = {
  coingecko: "CoinGecko",
  "alpha-vantage": "Alpha Vantage",
};

export function SymbolSearch({ value, onChange, disabled }: SymbolSearchProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string): Promise<void> => {
    if (q.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/financial/search-symbol?query=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = (await res.json()) as SymbolSearchResult[];
        setResults(data);
        setShowDropdown(data.length > 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(val: string): void {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void doSearch(val), DEBOUNCE_MS);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleResult(result: SymbolSearchResult): void {
    const next = { ...value };
    if (next[result.provider] === result.symbol) {
      delete next[result.provider];
    } else {
      next[result.provider] = result.symbol;
    }
    onChange(next);
  }

  function removeEntry(provider: string): void {
    const next = { ...value };
    delete next[provider];
    onChange(next);
  }

  const selectedEntries = Object.entries(value);
  const grouped = groupByProvider(results);

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Search symbols across providers…"
          className="pl-9"
          disabled={disabled}
        />
        {loading && (
          <Loader2 className="text-muted-foreground absolute top-2.5 right-3 size-4 animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div className="bg-popover border-border max-h-64 overflow-y-auto rounded-md border shadow-md">
          {[...grouped.entries()].map(([provider, items]) => (
            <div key={provider}>
              <div className="text-muted-foreground bg-muted/50 px-3 py-1.5 text-xs font-medium">
                {PROVIDER_LABELS[provider] ?? provider}
              </div>
              {items.map((item) => {
                const isSelected = value[item.provider] === item.symbol;
                return (
                  <button
                    key={`${item.provider}-${item.symbol}`}
                    type="button"
                    className={`hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                      isSelected ? "bg-accent/50 font-medium" : ""
                    }`}
                    onClick={() => toggleResult(item)}
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && <span className="text-xs">✓</span>}
                    </span>
                    <span className="min-w-0 truncate">{item.name}</span>
                    {item.type && (
                      <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
                        {item.type}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {selectedEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEntries.map(([provider, symbol]) => (
            <span
              key={provider}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
            >
              <span className="text-muted-foreground">
                {PROVIDER_LABELS[provider] ?? provider}:
              </span>
              <span className="font-medium">{symbol}</span>
              <button
                type="button"
                onClick={() => removeEntry(provider)}
                className="hover:text-destructive ml-0.5"
                disabled={disabled}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
