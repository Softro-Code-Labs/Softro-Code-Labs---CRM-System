import { describe, expect, it } from "vitest";
import { commissionSplits, estimateTax, financeMonths, resolveFinancePeriod, splitPayment, taxYearOf } from "@/lib/finance-math";

const rates = { sales: 16, manager: 4, leader: 20 };

describe("sales commission", () => {
  it("gives a sales person 16% and their manager 4%", () => {
    expect(commissionSplits(100_000, { id: "s", role: "SALES", managerId: "m" }, rates)).toEqual([
      { userId: "s", role: "SELLER", percent: 16, amount: 16_000 },
      { userId: "m", role: "MANAGER", percent: 4, amount: 4_000 },
    ]);
  });

  it("gives a Manager or Admin who sells the whole 20%", () => {
    expect(commissionSplits(100_000, { id: "m", role: "MANAGER", managerId: null }, rates)).toEqual([{ userId: "m", role: "SELLER", percent: 20, amount: 20_000 }]);
    expect(commissionSplits(100_000, { id: "a", role: "ADMIN", managerId: "x" }, rates)).toEqual([{ userId: "a", role: "SELLER", percent: 20, amount: 20_000 }]);
  });

  it("adds no manager line when the sales person has no manager", () => {
    expect(commissionSplits(50_000, { id: "s", role: "SALES", managerId: null }, rates)).toEqual([{ userId: "s", role: "SELLER", percent: 16, amount: 8_000 }]);
  });

  it("skips zero rates and nothing paid", () => {
    expect(commissionSplits(50_000, { id: "s", role: "SALES", managerId: "m" }, { ...rates, manager: 0 })).toHaveLength(1);
    expect(commissionSplits(0, { id: "s", role: "SALES", managerId: "m" }, rates)).toEqual([]);
  });

  it("rounds to cents", () => {
    expect(commissionSplits(33_333.33, { id: "s", role: "SALES", managerId: null }, rates)[0].amount).toBe(5_333.33);
  });
});

describe("payments: income and VAT", () => {
  it("takes the invoice's share of VAT out of each payment", () => {
    // Invoice 100,000 + 18% VAT = 118,000; a half payment of 59,000 has 9,000 VAT.
    expect(splitPayment({ amount: 59_000, amountLkr: null, currency: "LKR", invoiceTotal: 118_000, invoiceTax: 18_000 })).toEqual({ received: 59_000, vat: 9_000, net: 50_000, foreign: false });
  });

  it("uses the rupees credited for foreign currency, and needs them", () => {
    expect(splitPayment({ amount: 1_000, amountLkr: 300_000, currency: "USD", invoiceTotal: 1_000, invoiceTax: 0 })).toEqual({ received: 300_000, vat: 0, net: 300_000, foreign: true });
    expect(splitPayment({ amount: 1_000, amountLkr: null, currency: "USD", invoiceTotal: 1_000, invoiceTax: 0 })).toBeNull();
  });
});

describe("profit and tax estimate", () => {
  it("taxes local profit at 30% and export profit at 15%, sharing costs in proportion", () => {
    // Income 6M (4M local, 2M export), costs 2.5M → profit 3.5M; export share 1/3.
    const t = estimateTax({ localIncome: 4_000_000, exportIncome: 2_000_000, expenses: 2_000_000, commissions: 500_000, rate: 30, exportRate: 15 });
    expect(t.profit).toBe(3_500_000);
    expect(t.exportProfit).toBe(1_166_666.67);
    expect(t.localProfit).toBe(2_333_333.33);
    expect(t.tax).toBe(875_000);
    expect(t.effectiveRate).toBe(25);
  });

  it("is zero on a loss", () => {
    expect(estimateTax({ localIncome: 100, exportIncome: 0, expenses: 500, commissions: 0, rate: 30, exportRate: 15 })).toMatchObject({ profit: -400, tax: 0 });
  });
});

describe("tax-year periods (April to March, Colombo time)", () => {
  const nov = new Date("2026-11-26T06:00:00Z");

  it("knows which tax year a date is in", () => {
    expect(taxYearOf(nov)).toBe(2026);
    expect(taxYearOf(new Date("2027-03-31T12:00:00Z"))).toBe(2026);
    expect(taxYearOf(new Date("2027-03-31T18:31:00Z"))).toBe(2027); // 1 April 00:01 in Colombo
  });

  it("defaults to this tax year", () => {
    const p = resolveFinancePeriod({}, nov);
    expect(p.key).toBe("this-tax-year");
    expect(p.from.toISOString()).toBe("2026-03-31T18:30:00.000Z");
    expect(p.to.toISOString()).toBe("2027-03-31T18:30:00.000Z");
    expect(p.label).toContain("2026/27");
  });

  it("has the four quarters of the tax year", () => {
    expect(resolveFinancePeriod({ period: "q1" }, nov).to.toISOString()).toBe("2026-06-30T18:30:00.000Z");
    const q4 = resolveFinancePeriod({ period: "q4" }, nov);
    expect(q4.from.toISOString()).toBe("2026-12-31T18:30:00.000Z");
    expect(q4.label).toContain("Jan–Mar 2027");
  });

  it("takes a custom range, both days included", () => {
    const p = resolveFinancePeriod({ from: "2026-04-01", to: "2026-07-31" }, nov);
    expect(p.key).toBe("custom");
    expect(p.to.toISOString()).toBe("2026-07-31T18:30:00.000Z");
    expect(financeMonths(p).map((m) => m.label)).toEqual(["Apr 2026", "May 2026", "Jun 2026", "Jul 2026"]);
  });
});
