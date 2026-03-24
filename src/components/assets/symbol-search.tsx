"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

import { PROVIDER_LABELS } from "@/lib/providers/types";

export function SymbolSearch({ value, onChange, disabled }: SymbolSearchProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pending, setPending] = useState<SymbolMap>(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

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
        if (data.length > 0) {
          setPending(valueRef.current);
          setShowDropdown(true);
        } else {
          setShowDropdown(false);
        }
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

  function openDropdown(): void {
    setPending(value);
    setShowDropdown(true);
  }

  function commitAndClose(): void {
    onChange(pending);
    setShowDropdown(false);
  }

  function cancelAndClose(): void {
    setPending(valueRef.current);
    setShowDropdown(false);
  }

  // Close dropdown on outside click (acts as cancel)
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPending(valueRef.current);
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleResult(result: SymbolSearchResult): void {
    const next = { ...pending };
    if (next[result.provider] === result.symbol) {
      delete next[result.provider];
    } else {
      next[result.provider] = result.symbol;
    }
    setPending(next);
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
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => results.length > 0 && openDropdown()}
            placeholder="Search symbols across providers…"
            className="pl-9"
            disabled={disabled}
          />
          {loading && (
            <Loader2 className="text-muted-foreground absolute top-2.5 right-3 size-4 animate-spin" />
          )}
        </div>

        {showDropdown && (
          <div className="bg-popover border-border absolute top-full left-0 z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border shadow-md">
            {[...grouped.entries()].map(([provider, items]) => (
              <div key={provider}>
                <div className="text-muted-foreground bg-muted/50 px-3 py-1.5 text-xs font-medium">
                  {PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS] ?? provider}
                </div>
                {items.map((item) => {
                  const isSelected = pending[item.provider] === item.symbol;
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
                        className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                          isSelected ? "border-primary" : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <span className="bg-primary size-2 rounded-full" />}
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
            <div className="bg-popover sticky bottom-0 flex gap-2 border-t px-3 py-2">
              <Button type="button" size="sm" onClick={commitAndClose}>
                Done
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={cancelAndClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {selectedEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEntries.map(([provider, symbol]) => (
            <span
              key={provider}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
            >
              <span className="text-muted-foreground">
                {PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS] ?? provider}:
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
