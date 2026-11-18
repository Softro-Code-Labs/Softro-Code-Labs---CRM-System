import { describe, expect, it } from "vitest";
import { addWorkingDays, isColomboWeekend, replyState } from "@/lib/working-days";
import { quoteTotals } from "@/lib/quote-math";
import { responseDue, slaState } from "@/lib/tickets";
import { can, PERMISSIONS } from "@/lib/permissions";

// Colombo is UTC+05:30. 2026-11-20 is a Friday.
const colombo = (iso: string) => new Date(`${iso}+05:30`);

describe("working days (Sri Lanka time)", () => {
  it("skips the weekend", () => {
    expect(addWorkingDays(colombo("2026-11-20T15:00:00"), 2)).toEqual(colombo("2026-11-24T15:00:00")); // Fri → Tue
    expect(addWorkingDays(colombo("2026-11-17T10:00:00"), 2)).toEqual(colombo("2026-11-19T10:00:00")); // Tue → Thu
  });

  it("starts weekend enquiries on Monday at 9 am", () => {
    expect(addWorkingDays(colombo("2026-11-21T22:00:00"), 2)).toEqual(colombo("2026-11-25T09:00:00")); // Sat → Wed 9:00
  });

  it("knows the weekend in Colombo, not UTC", () => {
    expect(isColomboWeekend(colombo("2026-11-21T01:00:00"))).toBe(true); // Saturday 1 am Colombo = Friday UTC
    expect(isColomboWeekend(colombo("2026-11-20T23:59:00"))).toBe(false);
  });

  it("tracks the reply promise", () => {
    const now = colombo("2026-11-18T12:00:00");
    expect(replyState({ respondBy: colombo("2026-11-18T11:00:00"), respondedAt: null }, now)).toBe("overdue");
    expect(replyState({ respondBy: colombo("2026-11-18T20:00:00"), respondedAt: null }, now)).toBe("due-soon");
    expect(replyState({ respondBy: colombo("2026-11-20T20:00:00"), respondedAt: null }, now)).toBe("on-track");
    expect(replyState({ respondBy: null, respondedAt: now }, now)).toBe("replied");
  });
});

describe("quote totals", () => {
  it("applies line discount, quote discount and VAT in cents", () => {
    const t = quoteTotals(
      [
        { quantity: 1, unitPrice: 250000, discountPercent: 10 },
        { quantity: 3, unitPrice: 15000.5, discountPercent: 0 },
      ],
      5,
      18,
    );
    expect(t.lineTotals).toEqual([225000, 45001.5]);
    expect(t.subtotal).toBe(270001.5);
    expect(t.discountTotal).toBe(13500.08);
    expect(t.taxTotal).toBe(46170.26);
    expect(t.total).toBe(302671.68);
  });

  it("is zero for an empty quote", () => {
    expect(quoteTotals([], 10, 18).total).toBe(0);
  });
});

describe("support SLA", () => {
  const created = new Date("2026-11-17T04:00:00Z");
  it("uses the contract's promise, or the default for the priority", () => {
    expect(responseDue(created, "URGENT", null).getTime() - created.getTime()).toBe(4 * 3_600_000);
    expect(responseDue(created, "LOW", 8).getTime() - created.getTime()).toBe(8 * 3_600_000);
  });
  it("reports where a ticket stands", () => {
    const due = new Date("2026-11-17T08:00:00Z");
    expect(slaState({ status: "OPEN", responseDueAt: due, firstResponseAt: null }, new Date("2026-11-17T09:00:00Z"))).toBe("overdue");
    expect(slaState({ status: "OPEN", responseDueAt: due, firstResponseAt: null }, new Date("2026-11-17T06:00:00Z"))).toBe("due-soon");
    expect(slaState({ status: "OPEN", responseDueAt: due, firstResponseAt: new Date("2026-11-17T07:00:00Z") })).toBe("met");
    expect(slaState({ status: "OPEN", responseDueAt: due, firstResponseAt: new Date("2026-11-17T09:00:00Z") })).toBe("late-reply");
    expect(slaState({ status: "RESOLVED", responseDueAt: due, firstResponseAt: null })).toBe("none");
  });
});

describe("permissions", () => {
  it("admins can do everything", () => {
    for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) expect(can("ADMIN", p)).toBe(true);
  });
  it("viewers can look but not change", () => {
    expect(can("VIEWER", "deal:view")).toBe(true);
    expect(can("VIEWER", "lead:create")).toBe(false);
    expect(can("VIEWER", "report:export")).toBe(false);
  });
  it("keeps admin-only areas admin-only", () => {
    for (const p of ["user:manage", "integration:manage", "security:manage", "system:view", "audit:view"] as const) {
      expect(can("MANAGER", p)).toBe(false);
      expect(can("SALES", p)).toBe(false);
    }
  });
  it("lets support work tickets but not delete them", () => {
    expect(can("SUPPORT", "ticket:update")).toBe(true);
    expect(can("SUPPORT", "ticket:delete")).toBe(false);
  });
  it("treats a missing role as no access", () => {
    expect(can(null, "deal:view")).toBe(false);
  });
});

describe("project access sign-in check", async () => {
  const { checkState } = await import("@/lib/project-access");
  const created = new Date("2026-01-01T00:00:00Z");
  it("asks for a first check, then every 6 months", () => {
    expect(checkState({ googleEmail: null, lastCheckedAt: null, createdAt: created }).state).toBe("no-account");
    expect(checkState({ googleEmail: "p@gmail.com", lastCheckedAt: null, createdAt: created }).state).toBe("never");
    const checked = new Date("2026-03-01T00:00:00Z");
    expect(checkState({ googleEmail: "p@gmail.com", lastCheckedAt: checked, createdAt: created }, new Date("2026-04-01T00:00:00Z")).state).toBe("ok");
    expect(checkState({ googleEmail: "p@gmail.com", lastCheckedAt: checked, createdAt: created }, new Date("2026-08-10T00:00:00Z")).state).toBe("due-soon");
    const late = checkState({ googleEmail: "p@gmail.com", lastCheckedAt: checked, createdAt: created }, new Date("2026-09-15T00:00:00Z"));
    expect(late.state).toBe("overdue");
    expect(late.dueAt?.toISOString().slice(0, 10)).toBe("2026-08-30");
  });
});
