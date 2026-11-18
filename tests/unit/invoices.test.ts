import { describe, expect, it } from "vitest";
import { amountInWords, numberToWords } from "@/lib/amount-in-words";
import { balanceDue, invoiceState, isEditable } from "@/lib/invoices";

describe("amount in words", () => {
  it("writes whole numbers", () => {
    expect(numberToWords(0)).toBe("Zero");
    expect(numberToWords(15)).toBe("Fifteen");
    expect(numberToWords(105)).toBe("One Hundred Five");
    expect(numberToWords(1_250_000)).toBe("One Million Two Hundred Fifty Thousand");
  });

  it("writes rupees and cents the way Sri Lankan invoices do", () => {
    expect(amountInWords(125_050.5, "LKR")).toBe("Rupees One Hundred Twenty-Five Thousand Fifty and Cents Fifty Only");
    expect(amountInWords(450_000, "LKR")).toBe("Rupees Four Hundred Fifty Thousand Only");
  });

  it("rounds cents without drifting", () => {
    expect(amountInWords(0.29, "LKR")).toContain("Cents Twenty-Nine");
    expect(amountInWords(1.005, "USD")).not.toContain("Cents Zero");
  });
});

describe("invoice state", () => {
  const today = new Date("2026-11-18T06:00:00Z");
  const base = { status: "ISSUED", total: "100000", amountPaid: "0", dueDate: new Date("2026-11-30T00:00:00Z") };

  it("is unpaid before the due date, due soon near it, overdue after", () => {
    expect(invoiceState(base, today)).toBe("unpaid");
    expect(invoiceState({ ...base, dueDate: new Date("2026-11-20T00:00:00Z") }, today)).toBe("due-soon");
    expect(invoiceState({ ...base, dueDate: new Date("2026-11-10T00:00:00Z") }, today)).toBe("overdue");
  });

  it("shows part payments, paid and void", () => {
    expect(invoiceState({ ...base, amountPaid: "40000" }, today)).toBe("part-paid");
    expect(invoiceState({ ...base, status: "PAID", amountPaid: "100000" }, today)).toBe("paid");
    expect(invoiceState({ ...base, status: "VOID" }, today)).toBe("void");
  });

  it("works out the balance in cents", () => {
    expect(balanceDue({ total: "1000.10", amountPaid: "999.90" })).toBe(0.2);
  });

  it("can only be edited before any money arrives", () => {
    expect(isEditable(base)).toBe(true);
    expect(isEditable({ ...base, amountPaid: "1" })).toBe(false);
    expect(isEditable({ ...base, status: "VOID" })).toBe(false);
  });
});
