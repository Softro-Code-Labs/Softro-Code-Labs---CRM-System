import "server-only";
import { db } from "@/lib/db";

/** The default pipeline with its stages in order. Created by `db:seed`. */
export async function getDefaultPipeline() {
  const pipeline = await db.pipeline.findFirst({
    where: { isDefault: true },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  if (!pipeline) throw new Error("No default pipeline found. Run the database seed (pnpm db:seed).");
  return {
    ...pipeline,
    openStages: pipeline.stages.filter((s) => !s.isWon && !s.isLost),
    wonStage: pipeline.stages.find((s) => s.isWon) ?? null,
    lostStage: pipeline.stages.find((s) => s.isLost) ?? null,
  };
}
