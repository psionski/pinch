export interface RecurringTemplate {
  amount: number;
  type: "income" | "expense";
  description: string;
  merchant: string;
  categoryId: number;
  frequency: "monthly";
  dayOfMonth: number;
  startDate: string;
  lastGenerated: string;
}

/**
 * Build recurring transaction template definitions.
 * These match the fixed monthly events generated in transactions.ts.
 */
export function generateRecurringTemplates(
  catIds: Record<string, number>,
  startDate: string,
  lastGenerated: string
): RecurringTemplate[] {
  return [
    {
      amount: 750,
      type: "expense",
      description: "Monthly rent",
      merchant: "Landlord",
      categoryId: catIds.Rent,
      frequency: "monthly",
      dayOfMonth: 1,
      startDate,
      lastGenerated,
    },
    {
      amount: 15.99,
      type: "expense",
      description: "Netflix Standard",
      merchant: "Netflix",
      categoryId: catIds.Subscriptions,
      frequency: "monthly",
      dayOfMonth: 1,
      startDate,
      lastGenerated,
    },
    {
      amount: 8.99,
      type: "expense",
      description: "Amazon Prime",
      merchant: "Amazon",
      categoryId: catIds.Subscriptions,
      frequency: "monthly",
      dayOfMonth: 1,
      startDate,
      lastGenerated,
    },
    {
      amount: 9.99,
      type: "expense",
      description: "Spotify Premium",
      merchant: "Spotify",
      categoryId: catIds.Subscriptions,
      frequency: "monthly",
      dayOfMonth: 5,
      startDate,
      lastGenerated,
    },
    {
      amount: 0.99,
      type: "expense",
      description: "iCloud+ 50GB",
      merchant: "Apple",
      categoryId: catIds.Subscriptions,
      frequency: "monthly",
      dayOfMonth: 10,
      startDate,
      lastGenerated,
    },
    {
      amount: 29.99,
      type: "expense",
      description: "Internet bill",
      merchant: "Telekom",
      categoryId: catIds.Utilities,
      frequency: "monthly",
      dayOfMonth: 15,
      startDate,
      lastGenerated,
    },
    {
      amount: 2800,
      type: "income",
      description: "Monthly salary",
      merchant: "Employer",
      categoryId: catIds.Income,
      frequency: "monthly",
      dayOfMonth: 25,
      startDate,
      lastGenerated,
    },
  ];
}
