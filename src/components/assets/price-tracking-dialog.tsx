"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SymbolSearch } from "./symbol-search";
import type { AssetWithMetrics, SymbolMap } from "@/lib/validators/assets";

interface PriceTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetWithMetrics;
  onSubmit: (symbolMap: SymbolMap | null) => void;
  loading?: boolean;
}

export function PriceTrackingDialog({
  open,
  onOpenChange,
  asset,
  onSubmit,
  loading,
}: PriceTrackingDialogProps): React.ReactElement {
  const [symbolMap, setSymbolMap] = useState<SymbolMap>(
    asset.symbolMap ? { ...asset.symbolMap } : {}
  );

  function handleSave(): void {
    const hasSymbols = Object.keys(symbolMap).length > 0;
    onSubmit(hasSymbols ? symbolMap : null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {asset.type === "deposit" ? "Exchange Rate Tracking" : "Price Tracking"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <SymbolSearch value={symbolMap} onChange={setSymbolMap} disabled={loading} />
          <p className="text-muted-foreground text-xs">
            {asset.type === "deposit"
              ? "Search for your currency to enable automatic exchange rate updates."
              : "Search for symbols to enable automatic price tracking. You can select one per provider for redundancy."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
