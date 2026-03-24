"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  Check,
  ChevronDown,
  Download,
  RotateCcw,
  Plus,
  HardDrive,
  Wallet,
  PiggyBank,
  TrendingUp,
  Key,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BackupInfo } from "@/lib/services/backup";
import type { ProviderStatusResponse } from "@/lib/validators/financial";
import { PROVIDER_LABELS } from "@/lib/providers/types";

const ALL_TIMEZONES = Intl.supportedValuesOf("timeZone");

// ─── Onboarding steps (after timezone) ──────────────────────────────────────

type OnboardingStep = "cash" | "savings" | "investments" | "providers" | "done";
const ONBOARDING_ORDER: OnboardingStep[] = ["cash", "savings", "investments", "providers", "done"];

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

  // Progressive reveal: which onboarding step the user has reached.
  // Returning users (timezone already set) see everything ("done").
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(
    isFirstSetup ? "cash" : "done"
  );
  // Track whether the timezone has been saved during this session (first-setup flow).
  const [timezoneSaved, setTimezoneSaved] = useState(!isFirstSetup);

  const allRevealed = onboardingStep === "done";

  function revealAll(): void {
    setOnboardingStep("done");
  }

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
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        {isFirstSetup && !timezoneSaved && (
          <p className="text-muted-foreground mt-1">
            Welcome to Pinch! Please select your timezone to get started.
          </p>
        )}
        {isFirstSetup && timezoneSaved && !allRevealed && (
          <p className="text-muted-foreground mt-1">
            Great! Now let&apos;s set up your starting balances.{" "}
            <button type="button" className="text-primary underline" onClick={revealAll}>
              Set up later
            </button>
          </p>
        )}
      </div>

      {/* ── Timezone ─────────────────────────────────────────────────── */}
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
              {savingTz ? "Saving..." : isFirstSetup && !timezoneSaved ? "Continue" : "Save"}
            </Button>
          </div>
        </div>
      </Section>

      {/* Everything below requires timezone to be saved */}
      {timezoneSaved && (
        <>
          {/* ── Cash Balance ──────────────────────────────────────── */}
          {stepReached(onboardingStep, "cash") && (
            <CashBalanceSection
              isOnboarding={!allRevealed}
              onContinue={() => setOnboardingStep(nextStep("cash"))}
            />
          )}

          {/* ── Savings ───────────────────────────────────────────── */}
          {stepReached(onboardingStep, "savings") && (
            <SavingsSection
              isOnboarding={!allRevealed}
              onContinue={() => setOnboardingStep(nextStep("savings"))}
            />
          )}

          {/* ── Investments ───────────────────────────────────────── */}
          {stepReached(onboardingStep, "investments") && (
            <InvestmentsSection
              isOnboarding={!allRevealed}
              onContinue={() => setOnboardingStep(nextStep("investments"))}
            />
          )}

          {/* ── Data Providers ────────────────────────────────────── */}
          {stepReached(onboardingStep, "providers") && (
            <ProvidersSection
              isOnboarding={!allRevealed}
              onContinue={() => {
                setOnboardingStep("done");
                window.location.href = "/";
              }}
            />
          )}

          {/* ── Backups ───────────────────────────────────────────── */}
          {allRevealed && <BackupManager initialBackups={initialBackups} />}
        </>
      )}
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      {children}
    </div>
  );
}

// ─── Cash Balance Section ───────────────────────────────────────────────────

function CashBalanceSection({
  isOnboarding,
  onContinue,
}: {
  isOnboarding: boolean;
  onContinue: () => void;
}): React.ReactElement {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(): Promise<void> {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) {
      onContinue();
      return;
    }
    setSaving(true);
    try {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cents,
          type: "transfer",
          description: "Opening balance",
        }),
      });
      setSaved(true);
      if (isOnboarding) onContinue();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Checking Account Balance"
      description="How much is in your main bank account right now? Creates an opening balance without inflating income reports."
      icon={<Wallet className="text-muted-foreground size-5" />}
    >
      <div className="max-w-md space-y-3">
        <div className="space-y-2">
          <Label htmlFor="cash-balance">Current balance</Label>
          <div className="relative">
            <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
              &euro;
            </span>
            <Input
              id="cash-balance"
              type="number"
              step="0.01"
              min="0"
              placeholder="5000.00"
              className="pl-7"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={saved}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void handleSave()} disabled={saving || saved}>
            {saving ? "Saving..." : saved ? "Saved" : isOnboarding ? "Continue" : "Save"}
            {isOnboarding && !saving && !saved && <ArrowRight className="ml-1.5 size-4" />}
          </Button>
          {isOnboarding && !saved && (
            <Button variant="ghost" size="sm" onClick={onContinue}>
              Skip
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}

// ─── Savings Section ────────────────────────────────────────────────────────

interface SavingsEntry {
  name: string;
  balance: string;
}

function SavingsSection({
  isOnboarding,
  onContinue,
}: {
  isOnboarding: boolean;
  onContinue: () => void;
}): React.ReactElement {
  const [entries, setEntries] = useState<SavingsEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(): Promise<void> {
    const valid = entries.filter((e) => e.name.trim() && parseFloat(e.balance) > 0);
    if (valid.length === 0) {
      onContinue();
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      for (const entry of valid) {
        const balance = Math.round(parseFloat(entry.balance) * 100);
        const assetRes = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: entry.name, type: "deposit", currency: "EUR" }),
        });
        if (!assetRes.ok) continue;
        const asset = await assetRes.json();
        await fetch(`/api/assets/${asset.id}/lots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: balance / 100, pricePerUnit: 100, date: today }),
        });
      }
      setSaved(true);
      if (isOnboarding) onContinue();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Savings Accounts"
      description="Add savings accounts with their current balance."
      icon={<PiggyBank className="text-muted-foreground size-5" />}
    >
      <div className="max-w-md space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder="Account name"
              value={entry.name}
              disabled={saved}
              onChange={(e) => {
                const next = [...entries];
                next[i] = { ...next[i], name: e.target.value };
                setEntries(next);
              }}
            />
            <div className="relative min-w-[140px]">
              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                &euro;
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Balance"
                className="pl-7"
                value={entry.balance}
                disabled={saved}
                onChange={(e) => {
                  const next = [...entries];
                  next[i] = { ...next[i], balance: e.target.value };
                  setEntries(next);
                }}
              />
            </div>
            {!saved && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 px-2"
                onClick={() => setEntries(entries.filter((_, j) => j !== i))}
              >
                &times;
              </Button>
            )}
          </div>
        ))}
        {!saved && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEntries([...entries, { name: "", balance: "" }])}
          >
            + Add savings account
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void handleSave()} disabled={saving || saved}>
            {saving ? "Saving..." : saved ? "Saved" : isOnboarding ? "Continue" : "Save"}
            {isOnboarding && !saving && !saved && <ArrowRight className="ml-1.5 size-4" />}
          </Button>
          {isOnboarding && !saved && (
            <Button variant="ghost" size="sm" onClick={onContinue}>
              Skip
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}

// ─── Investments Section ────────────────────────────────────────────────────

interface InvestmentEntry {
  name: string;
  type: "investment" | "crypto";
  quantity: string;
  costBasis: string;
}

function InvestmentsSection({
  isOnboarding,
  onContinue,
}: {
  isOnboarding: boolean;
  onContinue: () => void;
}): React.ReactElement {
  const [entries, setEntries] = useState<InvestmentEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(): Promise<void> {
    const valid = entries.filter((e) => e.name.trim() && parseFloat(e.quantity) > 0);
    if (valid.length === 0) {
      onContinue();
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      for (const entry of valid) {
        const quantity = parseFloat(entry.quantity);
        const costBasis = entry.costBasis.trim()
          ? Math.round(parseFloat(entry.costBasis) * 100)
          : 0;
        const pricePerUnit = costBasis > 0 ? Math.round(costBasis / quantity) : 0;

        const assetRes = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: entry.name, type: entry.type, currency: "EUR" }),
        });
        if (!assetRes.ok) continue;
        const asset = await assetRes.json();
        await fetch(`/api/assets/${asset.id}/lots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity, pricePerUnit, date: today }),
        });
      }
      setSaved(true);
      if (isOnboarding) onContinue();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Investments"
      description="Stocks, ETFs, or crypto you already own. You can set up price tracking later."
      icon={<TrendingUp className="text-muted-foreground size-5" />}
    >
      <div className="max-w-md space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex gap-2">
              <Input
                placeholder="Name (e.g. Bitcoin, SPX ETF)"
                value={entry.name}
                disabled={saved}
                onChange={(e) => {
                  const next = [...entries];
                  next[i] = { ...next[i], name: e.target.value };
                  setEntries(next);
                }}
              />
              <select
                className="border-input bg-background rounded-md border px-2 text-sm"
                value={entry.type}
                disabled={saved}
                onChange={(e) => {
                  const next = [...entries];
                  next[i] = { ...next[i], type: e.target.value as "investment" | "crypto" };
                  setEntries(next);
                }}
              >
                <option value="investment">Stock/ETF</option>
                <option value="crypto">Crypto</option>
              </select>
              {!saved && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 px-2"
                  onClick={() => setEntries(entries.filter((_, j) => j !== i))}
                >
                  &times;
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 10 or 0.5"
                  value={entry.quantity}
                  disabled={saved}
                  onChange={(e) => {
                    const next = [...entries];
                    next[i] = { ...next[i], quantity: e.target.value };
                    setEntries(next);
                  }}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Total cost basis</Label>
                <div className="relative">
                  <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    &euro;
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Optional"
                    className="pl-7"
                    value={entry.costBasis}
                    disabled={saved}
                    onChange={(e) => {
                      const next = [...entries];
                      next[i] = { ...next[i], costBasis: e.target.value };
                      setEntries(next);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
        {!saved && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setEntries([
                ...entries,
                { name: "", type: "investment", quantity: "", costBasis: "" },
              ])
            }
          >
            + Add investment
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void handleSave()} disabled={saving || saved}>
            {saving ? "Saving..." : saved ? "Saved" : isOnboarding ? "Continue" : "Save"}
            {isOnboarding && !saving && !saved && <ArrowRight className="ml-1.5 size-4" />}
          </Button>
          {isOnboarding && !saved && (
            <Button variant="ghost" size="sm" onClick={onContinue}>
              Skip
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}

// ─── Data Providers Section ─────────────────────────────────────────────────

function ProvidersSection({
  isOnboarding,
  onContinue,
}: {
  isOnboarding: boolean;
  onContinue: () => void;
}): React.ReactElement {
  const [providers, setProviders] = useState<ProviderStatusResponse[] | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [savedProviders, setSavedProviders] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetch("/api/financial/providers")
      .then((r) => r.json())
      .then((data: ProviderStatusResponse[]) => setProviders(data));
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
          <Button size="sm" onClick={onContinue}>
            Finish Setup
            <Check className="ml-1.5 size-4" />
          </Button>
        )}
      </div>
    </Section>
  );
}

// ─── Backup Manager ─────────────────────────────────────────────────────────

interface BackupManagerProps {
  initialBackups: BackupInfo[];
}

function BackupManager({ initialBackups }: BackupManagerProps): React.ReactElement {
  const [backups, setBackups] = useState<BackupInfo[]>(initialBackups);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshBackups(): Promise<void> {
    const res = await fetch("/api/backups");
    if (res.ok) {
      setBackups(await res.json());
    }
  }

  async function handleCreate(): Promise<void> {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/backups", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Backup failed");
      }
      await refreshBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore(): Promise<void> {
    if (!restoreTarget) return;
    setRestoring(true);
    setError(null);
    try {
      const res = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: restoreTarget }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Restore failed");
      }
      setRestoreTarget(null);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
      setRestoring(false);
    }
  }

  return (
    <Section
      title="Database Backups"
      description="Backups are created automatically every day. You can also create one manually or restore from a previous backup."
      icon={<HardDrive className="text-muted-foreground size-5" />}
    >
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void handleCreate()} disabled={creating}>
          <Plus className="mr-1.5 size-4" />
          {creating ? "Creating..." : "Create Backup"}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {backups.length === 0 ? (
        <p className="text-muted-foreground text-sm">No backups available.</p>
      ) : (
        <div className="divide-border divide-y rounded-md border">
          {backups.map((b) => (
            <div key={b.filename} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <HardDrive className="text-muted-foreground size-4 shrink-0" />
                  <span className="truncate text-sm font-medium">{b.filename}</span>
                </div>
                <div className="text-muted-foreground mt-0.5 flex gap-3 text-xs">
                  <span>{b.createdAt.replace("T", " ")}</span>
                  <span>{formatBytes(b.sizeBytes)}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRestoreTarget(b.filename)}>
                <RotateCcw className="mr-1.5 size-3.5" />
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Database</DialogTitle>
            <DialogDescription>
              This will replace the current database with the backup{" "}
              <span className="font-medium">{restoreTarget}</span>. A safety backup of the current
              database will be created automatically before restoring.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreTarget(null)} disabled={restoring}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleRestore()} disabled={restoring}>
              <Download className="mr-1.5 size-4" />
              {restoring ? "Restoring..." : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

// ─── Timezone Picker ────────────────────────────────────────────────────────

interface TimezonePickerProps {
  value: string;
  onChange: (tz: string) => void;
}

function TimezonePicker({ value, onChange }: TimezonePickerProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, []);

  const filtered = useMemo(() => {
    if (!search) return ALL_TIMEZONES;
    const lower = search.toLowerCase();
    return ALL_TIMEZONES.filter((tz) => tz.toLowerCase().includes(lower));
  }, [search]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          {value || "Select timezone..."}
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="p-2">
          <Input
            ref={inputRef}
            placeholder="Search timezones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto border-t">
          {filtered.length === 0 ? (
            <div className="text-muted-foreground p-3 text-center text-sm">No timezones found</div>
          ) : (
            filtered.map((tz) => (
              <button
                key={tz}
                type="button"
                className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                onClick={() => {
                  onChange(tz);
                  setOpen(false);
                }}
              >
                <Check
                  className={`size-3.5 shrink-0 ${tz === value ? "opacity-100" : "opacity-0"}`}
                />
                {tz}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
