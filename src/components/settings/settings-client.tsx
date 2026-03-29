"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { BackupInfo } from "@/lib/services/backup";
import { Section } from "./settings-section";
import { TimezonePicker } from "./timezone-picker";
import { CashBalanceSection } from "./cash-balance-section";
import { SavingsSection } from "./savings-section";
import { InvestmentsSection } from "./investments-section";
import { ProvidersSection } from "./providers-section";
import { BackupManager } from "./backup-manager";

// ─── Onboarding steps (after timezone) ──────────────────────────────────────

type OnboardingStep = "cash" | "savings" | "investments" | "providers" | "backups" | "done";
const ONBOARDING_ORDER: OnboardingStep[] = [
  "cash",
  "savings",
  "investments",
  "providers",
  "backups",
  "done",
];

function nextStep(current: OnboardingStep): OnboardingStep {
  const idx = ONBOARDING_ORDER.indexOf(current);
  return ONBOARDING_ORDER[Math.min(idx + 1, ONBOARDING_ORDER.length - 1)];
}

function stepReached(current: OnboardingStep, target: OnboardingStep): boolean {
  return ONBOARDING_ORDER.indexOf(current) >= ONBOARDING_ORDER.indexOf(target);
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface SettingsClientProps {
  initialTimezone: string | null;
  initialBackups: BackupInfo[];
}

export function SettingsClient({
  initialTimezone,
  initialBackups,
}: SettingsClientProps): React.ReactElement {
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timezone, setTimezone] = useState(initialTimezone ?? detectedTz);
  const [savingTz, setSavingTz] = useState(false);
  const isFirstSetup = initialTimezone === null;

  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(
    isFirstSetup ? "cash" : "done"
  );
  const [timezoneSaved, setTimezoneSaved] = useState(!isFirstSetup);

  const allRevealed = onboardingStep === "done";
  const lastRevealedRef = useRef<HTMLDivElement>(null);

  const scrollToRevealed = useCallback(() => {
    if (lastRevealedRef.current) {
      lastRevealedRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    if (isFirstSetup && !allRevealed) {
      scrollToRevealed();
    }
  }, [onboardingStep, timezoneSaved, isFirstSetup, allRevealed, scrollToRevealed]);

  async function handleSaveTimezone(): Promise<void> {
    setSavingTz(true);
    try {
      const res = await fetch("/api/settings/timezone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
      if (!res.ok) throw new Error("Failed to save");
      if (isFirstSetup) {
        setTimezoneSaved(true);
      } else {
        window.location.reload();
      }
    } finally {
      setSavingTz(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        {isFirstSetup && (
          <p className="text-muted-foreground mt-1">
            Welcome to Pinch! Please select your timezone to get started.
          </p>
        )}
      </div>

      <Section title="Timezone" icon={null}>
        <div className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <TimezonePicker value={timezone} onChange={setTimezone} />
            <p className="text-muted-foreground text-xs">
              Determines what &quot;today&quot; and &quot;this month&quot; mean throughout the app.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => void handleSaveTimezone()} disabled={savingTz}>
              {savingTz ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Section>

      {timezoneSaved && (
        <>
          {stepReached(onboardingStep, "cash") && (
            <div ref={onboardingStep === "cash" ? lastRevealedRef : undefined}>
              <CashBalanceSection
                isOnboarding={onboardingStep === "cash"}
                onContinue={() => setOnboardingStep(nextStep("cash"))}
              />
            </div>
          )}

          {stepReached(onboardingStep, "savings") && (
            <div ref={onboardingStep === "savings" ? lastRevealedRef : undefined}>
              <SavingsSection
                isOnboarding={onboardingStep === "savings"}
                onContinue={() => setOnboardingStep(nextStep("savings"))}
              />
            </div>
          )}

          {stepReached(onboardingStep, "investments") && (
            <div ref={onboardingStep === "investments" ? lastRevealedRef : undefined}>
              <InvestmentsSection
                isOnboarding={onboardingStep === "investments"}
                onContinue={() => setOnboardingStep(nextStep("investments"))}
              />
            </div>
          )}

          {stepReached(onboardingStep, "providers") && (
            <div ref={onboardingStep === "providers" ? lastRevealedRef : undefined}>
              <ProvidersSection
                isOnboarding={onboardingStep === "providers"}
                onContentLoaded={onboardingStep === "providers" ? scrollToRevealed : undefined}
                onContinue={() => setOnboardingStep(nextStep("providers"))}
              />
            </div>
          )}

          {stepReached(onboardingStep, "backups") && (
            <div ref={onboardingStep === "backups" ? lastRevealedRef : undefined}>
              <BackupManager
                initialBackups={initialBackups}
                isOnboarding={onboardingStep === "backups"}
                onContinue={() => {
                  setOnboardingStep("done");
                  window.location.href = "/";
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
