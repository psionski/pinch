"use client";

import { useState } from "react";
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
import type { AssetWithMetrics } from "@/lib/validators/assets";

interface RecordPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetWithMetrics;
  onSubmit: (data: { pricePerUnit: number }) => void;
  loading?: boolean;
}

export function RecordPriceDialog({
  open,
  onOpenChange,
  asset,
  onSubmit,
  loading,
}: RecordPriceDialogProps): React.ReactElement {
  const currentDisplay =
    asset.latestPrice !== null
      ? `Current: ${(asset.latestPrice / 100).toFixed(2)} ${asset.currency} per unit`
      : "No price recorded yet";

  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError("");

    const priceNum = parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      setError("Price must be a positive number.");
      return;
    }

    onSubmit({ pricePerUnit: Math.round(priceNum * 100) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Price — {asset.name}</DialogTitle>
          <DialogDescription>{currentDisplay}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="new-price">New price per unit ({asset.currency})</Label>
            <Input
              id="new-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 360.00"
              disabled={loading}
              autoFocus
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
