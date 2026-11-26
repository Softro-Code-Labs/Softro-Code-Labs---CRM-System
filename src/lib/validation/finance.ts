import { z } from "zod";

/** Commission rates (Settings → Commission). */
const percent = (label: string) =>
  z.preprocess((v) => (typeof v === "string" ? Number(v.trim() || "x") : v), z.number({ error: `Enter ${label} as a number` }).min(0, "Can't be negative").max(100, "100% at most"));

export const commissionRatesSchema = z.object({
  commissionSalesPercent: percent("the sales person's commission"),
  commissionManagerPercent: percent("the manager's commission"),
  commissionLeaderPercent: percent("the Manager or Admin commission"),
});
