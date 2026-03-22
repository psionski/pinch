"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Check, ChevronDown, Download, RotateCcw, Plus, HardDrive } from "lucide-react";
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

const ALL_TIMEZONES = Intl.supportedValuesOf("timeZone");

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
  const [saving, setSaving] = useState(false);
  const isFirstSetup = initialTimezone === null;

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/timezone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
      if (!res.ok) throw new Error("Failed to save");
      // Reload so the layout re-reads the timezone and TimezoneInit propagates it
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        {isFirstSetup && (
          <p className="text-muted-foreground mt-1">
            Welcome to Pinch! Please select your timezone to get started.
          </p>
        )}
      </div>

      <div className="max-w-md space-y-4">
        <div className="space-y-2">
          <Label>Timezone</Label>
          <TimezonePicker value={timezone} onChange={setTimezone} />
          <p className="text-muted-foreground text-xs">
            Determines what &quot;today&quot; and &quot;this month&quot; mean throughout the app.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : isFirstSetup ? "Get Started" : "Save"}
          </Button>
        </div>
      </div>

      {!isFirstSetup && <BackupManager initialBackups={initialBackups} />}
    </div>
  );
}

// ─── Backup Manager ──────────────────────────────────────────────────────────

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
      // Reload the page after restore so the app picks up the restored DB
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Database Backups</h2>
          <p className="text-muted-foreground text-sm">
            Backups are created automatically every day. You can also create one manually or restore
            from a previous backup.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleCreate()}
          disabled={creating}
        >
          <Plus className="mr-1.5 size-4" />
          {creating ? "Creating..." : "Create Backup"}
        </Button>
      </div>

      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}

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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRestoreTarget(b.filename)}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={restoreTarget !== null} onOpenChange={(open) => !open && setRestoreTarget(null)}>
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
            <Button
              variant="destructive"
              onClick={() => void handleRestore()}
              disabled={restoring}
            >
              <Download className="mr-1.5 size-4" />
              {restoring ? "Restoring..." : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

// ─── Timezone Picker ──────────────────────────────────────────────────────────

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
