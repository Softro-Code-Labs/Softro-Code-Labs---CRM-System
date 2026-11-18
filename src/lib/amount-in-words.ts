/**
 * Amounts in words, as printed on Sri Lankan invoices and receipts:
 * 125050.5 LKR → "Rupees One Hundred Twenty-Five Thousand Fifty and Cents Fifty Only".
 */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES: [number, string][] = [
  [1_000_000_000, "Billion"],
  [1_000_000, "Million"],
  [1_000, "Thousand"],
];

function underThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
}

export function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  for (const [size, name] of SCALES) {
    if (n >= size) {
      parts.push(`${numberToWords(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(underThousand(n));
  return parts.join(" ");
}

const NAMES: Record<string, [string, string]> = {
  LKR: ["Rupees", "Cents"],
  USD: ["US Dollars", "Cents"],
  AUD: ["Australian Dollars", "Cents"],
  GBP: ["Pounds", "Pence"],
  EUR: ["Euros", "Cents"],
};

export function amountInWords(amount: number, currency: string) {
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  const [major, minor] = NAMES[currency] ?? [currency, "Cents"];
  return `${major} ${numberToWords(whole)}${fraction ? ` and ${minor} ${numberToWords(fraction)}` : ""} Only`;
}
