import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getDefaultPipeline } from "@/lib/queries/pipeline";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { PipelineEditor } from "./pipeline-editor";

export const metadata: Metadata = { title: "Sales pipeline" };

export default async function PipelineSettingsPage() {
  await requirePermission("pipeline:manage");
  const pipeline = await getDefaultPipeline();
  const counts = await db.deal.groupBy({ by: ["stageId"], where: { pipelineId: pipeline.id }, _count: true });
  const countFor = (id: string) => counts.find((c) => c.stageId === id)?._count ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Sales pipeline"
        description={`Stages of the "${pipeline.name}" pipeline, in order. Deals move left to right on the board.`}
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Sales pipeline" }]}
      />
      <Card>
        <CardHeader
          title="Stages"
          description="The % is how likely a deal at that stage is to be won; it drives the weighted forecast. Won and Lost are built in and always last."
        />
        <PipelineEditor
          pipelineId={pipeline.id}
          stages={pipeline.stages.map((s) => ({
            id: s.id,
            name: s.name,
            probability: s.probability,
            isWon: s.isWon,
            isLost: s.isLost,
            dealCount: countFor(s.id),
          }))}
        />
      </Card>
    </div>
  );
}
