import { describe, expect, it } from "vitest";
import { formatBytes, planLimit, projectedUse, usageLevel, usagePercent } from "@/lib/usage-math";

describe("plan usage", () => {
  it("warns from 80% and flags nearly full from 95%", () => {
    expect(usageLevel(50, 100)).toBe("ok");
    expect(usageLevel(80, 100)).toBe("warn");
    expect(usageLevel(96, 100)).toBe("full");
    expect(usageLevel(null, 100)).toBe("unknown");
  });

  it("caps the percentage at 100", () => {
    expect(usagePercent(42.5 * 1024 ** 2, 1024 ** 3)).toBe(4.2);
    expect(usagePercent(2, 1)).toBe(100);
  });

  it("writes sizes the way people read them", () => {
    expect(formatBytes(512)).toBe("512 bytes");
    expect(formatBytes(1.5 * 1024 ** 2)).toBe("1.5 MB");
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });

  it("uses the free-plan limit unless one is set", () => {
    expect(planLimit(undefined, 1024)).toBe(1024);
    expect(planLimit("", 100)).toBe(100);
    expect(planLimit("10240", 1024)).toBe(10240);
    expect(planLimit("abc", 5)).toBe(5);
  });

  it("projects the month from its pace, once a day has passed", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    const end = new Date("2026-12-01T00:00:00Z");
    expect(projectedUse(20, start, end, new Date("2026-11-16T00:00:00Z"))).toBeCloseTo(40);
    expect(projectedUse(5, start, end, new Date("2026-11-01T06:00:00Z"))).toBeNull();
  });
});
