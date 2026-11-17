// Shared by the client period picker; mirrors PERIODS in lib/reports.ts (which is server-only).
export const PERIOD_OPTIONS = [
  { value: "last-12", label: "Last 12 months" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-quarter", label: "This quarter" },
  { value: "last-quarter", label: "Last quarter" },
  { value: "this-year", label: "This year" },
  { value: "last-year", label: "Last year" },
] as const;
