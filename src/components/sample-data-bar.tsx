"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function SampleDataBar({ show }: { show: boolean }): React.ReactNode {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!show) return null;

  function handleClear(): void {
    const confirmed = window.confirm(
      "This will clear all sample data and reset the app so you can start fresh. Continue?"
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await fetch("/api/sample-data", { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-muted border-b px-4 py-2 text-center sticky top-0 z-10 w-full">
      <span className="text-muted-foreground text-sm">
        You&apos;re viewing <strong className="text-foreground">sample data</strong>. Clear it to
        start tracking your own finances.
      </span>
      <Button
        size="sm"
        variant="destructive"
        className="ml-3"
        disabled={isPending}
        onClick={handleClear}
      >
        {isPending ? "Clearing…" : "Clear sample data"}
      </Button>
    </div>
  );
}
