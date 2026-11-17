"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";

const stageSchema = z.object({
  name: z.string().trim().min(1, "Enter a stage name").max(60),
  probability: z.coerce.number({ error: "Enter a number from 0 to 100" }).int("Use a whole number").min(0).max(100),
});

type Result = { message?: string };

function refresh() {
  revalidatePath("/settings/pipeline");
  revalidatePath("/deals", "layout");
  revalidatePath("/dashboard");
}

export async function updateStage(id: string, formData: FormData): Promise<Result> {
  const user = await authorizeAction("pipeline:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const stage = await db.pipelineStage.findUnique({ where: { id } });
  if (!stage) return { message: "This stage no longer exists." };
  const parsed = stageSchema.safeParse({
    name: formData.get("name"),
    // Won and Lost always count as 100% and 0%.
    probability: stage.isWon ? 100 : stage.isLost ? 0 : formData.get("probability"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const clash = await db.pipelineStage.findFirst({
    where: { pipelineId: stage.pipelineId, name: { equals: parsed.data.name, mode: "insensitive" }, NOT: { id } },
  });
  if (clash) return { message: "Another stage already has that name." };

  await db.pipelineStage.update({ where: { id }, data: parsed.data });
  await audit({ actorId: user.id, action: "update", entity: "PipelineStage", entityId: id, summary: `${stage.name} → ${parsed.data.name} (${parsed.data.probability}%)` });
  refresh();
  return {};
}

/** Adds an open stage just before Won. */
export async function addStage(pipelineId: string, formData: FormData): Promise<Result> {
  const user = await authorizeAction("pipeline:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const parsed = stageSchema.safeParse({ name: formData.get("name"), probability: formData.get("probability") });
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const stages = await db.pipelineStage.findMany({ where: { pipelineId }, orderBy: { position: "asc" } });
  if (!stages.length) return { message: "Pipeline not found." };
  if (stages.some((s) => s.name.toLowerCase() === parsed.data.name.toLowerCase())) return { message: "A stage with that name already exists." };

  const firstClosed = stages.find((s) => s.isWon || s.isLost);
  const insertAt = firstClosed ? firstClosed.position : stages[stages.length - 1].position + 1;

  await db.$transaction(async (tx) => {
    // Shift the closed stages up one, highest first, to keep positions unique.
    for (const s of [...stages].reverse()) {
      if (s.position >= insertAt) await tx.pipelineStage.update({ where: { id: s.id }, data: { position: s.position + 1 } });
    }
    await tx.pipelineStage.create({ data: { pipelineId, position: insertAt, ...parsed.data } });
  });
  await audit({ actorId: user.id, action: "create", entity: "PipelineStage", summary: `${parsed.data.name} (${parsed.data.probability}%)` });
  refresh();
  return {};
}

/** Swaps an open stage with its open neighbour. */
export async function moveStage(id: string, direction: "up" | "down"): Promise<Result> {
  const user = await authorizeAction("pipeline:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const stage = await db.pipelineStage.findUnique({ where: { id } });
  if (!stage || stage.isWon || stage.isLost) return { message: "Only open stages can be moved." };
  const open = await db.pipelineStage.findMany({
    where: { pipelineId: stage.pipelineId, isWon: false, isLost: false },
    orderBy: { position: "asc" },
  });
  const index = open.findIndex((s) => s.id === id);
  const other = open[direction === "up" ? index - 1 : index + 1];
  if (!other) return {};

  await db.$transaction([
    db.pipelineStage.update({ where: { id: stage.id }, data: { position: -1 } }),
    db.pipelineStage.update({ where: { id: other.id }, data: { position: stage.position } }),
    db.pipelineStage.update({ where: { id: stage.id }, data: { position: other.position } }),
  ]);
  await audit({ actorId: user.id, action: "update", entity: "PipelineStage", entityId: id, summary: `Moved ${stage.name} ${direction}` });
  refresh();
  return {};
}

export async function deleteStage(id: string): Promise<Result> {
  const user = await authorizeAction("pipeline:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const stage = await db.pipelineStage.findUnique({ where: { id }, include: { _count: { select: { deals: true } } } });
  if (!stage) return { message: "This stage no longer exists." };
  if (stage.isWon || stage.isLost) return { message: "Won and Lost can't be removed." };
  if (stage._count.deals > 0) return { message: `Move the ${stage._count.deals} deal(s) in "${stage.name}" to another stage first.` };
  const openCount = await db.pipelineStage.count({ where: { pipelineId: stage.pipelineId, isWon: false, isLost: false } });
  if (openCount <= 1) return { message: "Keep at least one open stage." };

  await db.$transaction(async (tx) => {
    await tx.pipelineStage.delete({ where: { id } });
    // Close the gap, lowest first.
    const rest = await tx.pipelineStage.findMany({ where: { pipelineId: stage.pipelineId }, orderBy: { position: "asc" } });
    for (const [i, s] of rest.entries()) {
      if (s.position !== i) await tx.pipelineStage.update({ where: { id: s.id }, data: { position: i } });
    }
  });
  await audit({ actorId: user.id, action: "delete", entity: "PipelineStage", entityId: id, summary: stage.name });
  refresh();
  return {};
}
