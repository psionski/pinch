const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

/** Format cents as EUR display string, e.g. 12345 → "123,45 €" */
export function formatCurrency(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/** Format a percentage with 1 decimal, e.g. 75.5 → "75.5%" */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Format YYYY-MM to a short month name, e.g. "2026-03" → "Mar 2026" */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  // Construct date from known components — timezone doesn't affect the result
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/** Format YYYY-MM-DD to a short date, e.g. "2026-03-18" → "Mar 18" */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  const last = n % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

/** Format recurring frequency + schedule to human-readable text. */
export function formatFrequency(item: {
  frequency: string;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  startDate: string;
}): string {
  const startParts = item.startDate.split("-").map(Number);

  switch (item.frequency) {
    case "daily":
      return "Daily";
    case "weekly": {
      const dow =
        item.dayOfWeek ?? new Date(startParts[0], startParts[1] - 1, startParts[2]).getDay();
      return `Weekly on ${DAY_NAMES[dow]}`;
    }
    case "monthly": {
      const dom = item.dayOfMonth ?? startParts[2];
      return `Monthly on the ${ordinal(dom)}`;
    }
    case "yearly": {
      const d = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      return `Yearly on ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    default:
      return item.frequency;
  }
}
