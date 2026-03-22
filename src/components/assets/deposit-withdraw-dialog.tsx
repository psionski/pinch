"use client";

import { useState, useEffect, useCallback } from "react";
import { isoToday } from "@/lib/date-ranges";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import type { AssetWithMetrics } from "@/lib/validators/assets";

interface DepositWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "deposit" | "withdraw";
  asset: AssetWithMetrics;
  onSubmit: (data: {
    quantity: number;
    pricePerUnit: number;
    date: string;
    description?: string;
  }) => void;
  loading?: boolean;
}

async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
  try {
    const params = new URLSearchParams({ symbol: from, currency: to, date: isoToday() });
    const res = await fetch(`/api/financial/price?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { price: number };
    return data.price;
  } catch {
    return null;
  }
}

export function DepositWithdrawDialog({
  open,
  onOpenChange,
  mode,
  asset,
  onSubmit,
  loading,
}: DepositWithdrawDialogProps): React.ReactElement {
  const today = isoToday();
  const isEur = asset.currency === "EUR";

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  // Advanced mode for EUR deposits: converting from another currency
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sourceCurrency, setSourceCurrency] = useState("");
  const [sourceAmount, setSourceAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [fetchingAdvancedRate, setFetchingAdvancedRate] = useState(false);

  // For non-EUR deposits, exchange rate is always shown.
  // Initialize loading to true for non-EUR so the effect only sets false (async).
  const [nonEurRate, setNonEurRate] = useState("");
  const [fetchingNonEurRate, setFetchingNonEurRate] = useState(!isEur);
  const [rateFetchFailed, setRateFetchFailed] = useState(false);

  // Fetch exchange rate for non-EUR deposits on open
  useEffect(() => {
    if (!open || isEur) return;
    let cancelled = false;
    void (async () => {
      const rate = await fetchExchangeRate(asset.currency, "EUR");
      if (!cancelled) {
        if (rate !== null) {
          setNonEurRate(rate.toFixed(4));
        } else {
          setRateFetchFailed(true);
        }
        setFetchingNonEurRate(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isEur, asset.currency]);

  // Fetch exchange rate for EUR advanced mode when source currency changes
  const fetchAdvancedRate = useCallback((currency: string) => {
    const trimmed = currency.trim().toUpperCase();
    if (trimmed.length < 3) {
      setExchangeRate("");
      return;
    }
    setFetchingAdvancedRate(true);
    void (async () => {
      const rate = await fetchExchangeRate(trimmed, "EUR");
      if (rate !== null) {
        setExchangeRate(rate.toFixed(4));
      }
      setFetchingAdvancedRate(false);
    })();
  }, []);

  // Computed EUR amount for advanced mode
  const computedEurAmount =
    showAdvanced && sourceAmount && exchangeRate
      ? parseFloat(sourceAmount) * parseFloat(exchangeRate)
      : null;

  // Computed EUR cost for non-EUR deposits
  const computedEurCost =
    !isEur && amount && nonEurRate ? parseFloat(amount) * parseFloat(nonEurRate) : null;

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError("");

    if (isEur) {
      if (showAdvanced) {
        const srcAmt = parseFloat(sourceAmount);
        if (Number.isNaN(srcAmt) || srcAmt <= 0) {
          setError("Amount must be a positive number.");
          return;
        }
        const rate = parseFloat(exchangeRate);
        if (Number.isNaN(rate) || rate <= 0) {
          setError("Exchange rate must be a positive number.");
          return;
        }
        const eurAmount = Math.round(srcAmt * rate * 100) / 100;
        onSubmit({
          quantity: eurAmount,
          pricePerUnit: 100,
          date,
          description: description.trim() || undefined,
        });
      } else {
        const amt = parseFloat(amount);
        if (Number.isNaN(amt) || amt <= 0) {
          setError("Amount must be a positive number.");
          return;
        }
        onSubmit({
          quantity: amt,
          pricePerUnit: 100,
          date,
          description: description.trim() || undefined,
        });
      }
    } else {
      const amt = parseFloat(amount);
      if (Number.isNaN(amt) || amt <= 0) {
        setError("Amount must be a positive number.");
        return;
      }
      const rate = parseFloat(nonEurRate);
      if (Number.isNaN(rate) || rate <= 0) {
        setError("Exchange rate must be a positive number.");
        return;
      }
      const pricePerUnit = Math.round(rate * 100);
      onSubmit({
        quantity: amt,
        pricePerUnit,
        date,
        description: description.trim() || undefined,
      });
    }
  }

  const actionLabel = mode === "deposit" ? "Deposit" : "Withdraw";
  const title = mode === "deposit" ? `Deposit to ${asset.name}` : `Withdraw from ${asset.name}`;
  const desc =
    mode === "deposit"
      ? "Record a deposit."
      : `Record a withdrawal. Current balance: ${asset.currentHoldings} ${asset.currency}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isEur ? (
            showAdvanced ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="dep-src-currency">Source currency</Label>
                  <Input
                    id="dep-src-currency"
                    value={sourceCurrency}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setSourceCurrency(val);
                      fetchAdvancedRate(val);
                    }}
                    placeholder="e.g. USD"
                    maxLength={10}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dep-src-amount">Amount ({sourceCurrency || "..."})</Label>
                  <Input
                    id="dep-src-amount"
                    type="number"
                    step="any"
                    min="0"
                    value={sourceAmount}
                    onChange={(e) => setSourceAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dep-rate">Exchange rate ({sourceCurrency || "..."} → EUR)</Label>
                  <div className="relative">
                    <Input
                      id="dep-rate"
                      type="number"
                      step="any"
                      min="0"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      placeholder="Auto-fetched"
                      disabled={loading}
                    />
                    {fetchingAdvancedRate && (
                      <Loader2 className="text-muted-foreground absolute top-2.5 right-3 size-4 animate-spin" />
                    )}
                  </div>
                </div>
                {computedEurAmount !== null && !Number.isNaN(computedEurAmount) && (
                  <p className="text-sm font-medium">
                    = {formatCurrency(Math.round(computedEurAmount * 100))} EUR
                  </p>
                )}
                <button
                  type="button"
                  className="text-muted-foreground text-xs underline"
                  onClick={() => setShowAdvanced(false)}
                >
                  Simple mode
                </button>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="dep-amount">Amount (EUR)</Label>
                  <Input
                    id="dep-amount"
                    type="number"
                    step="any"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    disabled={loading}
                  />
                </div>
                <button
                  type="button"
                  className="text-muted-foreground text-xs underline"
                  onClick={() => setShowAdvanced(true)}
                >
                  Converting from another currency?
                </button>
              </>
            )
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="dep-amount">Amount ({asset.currency})</Label>
                <Input
                  id="dep-amount"
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  disabled={loading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dep-rate">Exchange rate (EUR per 1 {asset.currency})</Label>
                <div className="relative">
                  <Input
                    id="dep-rate"
                    type="number"
                    step="any"
                    min="0"
                    value={nonEurRate}
                    onChange={(e) => setNonEurRate(e.target.value)}
                    placeholder="Auto-fetched"
                    disabled={loading}
                  />
                  {fetchingNonEurRate && (
                    <Loader2 className="text-muted-foreground absolute top-2.5 right-3 size-4 animate-spin" />
                  )}
                </div>
                {rateFetchFailed && (
                  <p className="text-destructive text-xs">Could not fetch rate. Enter manually.</p>
                )}
              </div>
              {computedEurCost !== null && !Number.isNaN(computedEurCost) && (
                <p className="text-muted-foreground text-sm">
                  Cost: {formatCurrency(Math.round(computedEurCost * 100))}
                </p>
              )}
            </>
          )}

          <div className="space-y-1">
            <Label htmlFor="dep-date">Date</Label>
            <Input
              id="dep-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dep-desc">Description (optional)</Label>
            <Input
              id="dep-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Auto-generated if left blank"
              disabled={loading}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {actionLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
