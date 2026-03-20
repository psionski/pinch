"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssetWithMetrics } from "@/lib/validators/assets";
import type { SymbolMap } from "@/lib/validators/assets";

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    type: "deposit" | "investment" | "crypto" | "other";
    currency: string;
    symbolMap?: SymbolMap;
    icon?: string;
    color?: string;
  }) => void;
  initialData?: AssetWithMetrics | null;
  loading?: boolean;
}

const ASSET_TYPES = [
  { value: "deposit", label: "Deposit (savings/bank)" },
  { value: "investment", label: "Investment (stocks/ETFs)" },
  { value: "crypto", label: "Crypto" },
  { value: "other", label: "Other" },
] as const;

/** Infer the default provider for a given asset type. */
function defaultProvider(type: string): string {
  if (type === "crypto") return "coingecko";
  return "alpha-vantage";
}

/** Extract the first symbol value from a symbolMap, or empty string. */
function symbolFromMap(map: Record<string, string> | null | undefined): string {
  if (!map) return "";
  const values = Object.values(map);
  return values[0] ?? "";
}

export function AssetFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  loading,
}: AssetFormDialogProps): React.ReactElement {
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name ?? "");
  const [type, setType] = useState<string>(initialData?.type ?? "deposit");
  const [currency, setCurrency] = useState(initialData?.currency ?? "EUR");
  const [symbol, setSymbol] = useState(symbolFromMap(initialData?.symbolMap));
  const [icon, setIcon] = useState(initialData?.icon ?? "");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!currency.trim()) {
      setError("Currency is required.");
      return;
    }

    const trimmedSymbol = symbol.trim();
    const symbolMap = trimmedSymbol ? { [defaultProvider(type)]: trimmedSymbol } : undefined;

    onSubmit({
      name: name.trim(),
      type: type as "deposit" | "investment" | "crypto" | "other",
      currency: currency.trim().toUpperCase(),
      symbolMap,
      icon: icon.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Asset" : "New Asset"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Emergency Fund, SPX, Bitcoin"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="asset-currency">Currency</Label>
            <Input
              id="asset-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="EUR"
              maxLength={10}
              disabled={loading}
            />
          </div>
          {type !== "deposit" && (
            <div className="space-y-1">
              <Label htmlFor="asset-symbol">Market Symbol (optional)</Label>
              <Input
                id="asset-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={type === "crypto" ? "e.g. bitcoin" : "e.g. AAPL"}
                disabled={loading}
              />
              <p className="text-muted-foreground text-xs">
                Enables automatic price tracking. CoinGecko ID for crypto, ticker for stocks.
              </p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="asset-icon">Icon (emoji, optional)</Label>
            <Input
              id="asset-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🏦"
              disabled={loading}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
