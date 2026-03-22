"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ALL_TIMEZONES = Intl.supportedValuesOf("timeZone");

interface SettingsClientProps {
  initialTimezone: string | null;
}

export function SettingsClient({ initialTimezone }: SettingsClientProps): React.ReactElement {
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timezone, setTimezone] = useState(initialTimezone ?? detectedTz);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isFirstSetup = initialTimezone === null;

  async function handleSave(): Promise<void> {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/timezone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      if (isFirstSetup) {
        window.location.href = "/";
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
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
          <Label htmlFor="timezone">Timezone</Label>
          <TimezonePicker value={timezone} onChange={setTimezone} />
          <p className="text-muted-foreground text-xs">
            Determines what &quot;today&quot; and &quot;this month&quot; mean throughout the app.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : isFirstSetup ? "Get Started" : "Save"}
          </Button>
          {saved && !isFirstSetup && (
            <span className="text-muted-foreground flex items-center gap-1 text-sm">
              <Check className="size-4" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
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
        <Button variant="outline" className="w-full justify-start font-normal">
          {value || "Select timezone..."}
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
