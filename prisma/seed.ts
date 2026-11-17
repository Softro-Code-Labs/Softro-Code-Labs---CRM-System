import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// Softro's sales process: listen → show how we'd build it and what it costs → design approval.
const PIPELINE_NAME = "Softro Projects";
const DEFAULT_STAGES = [
  { name: "Discovery call", probability: 20 },
  { name: "Proposal & quote", probability: 50 },
  { name: "Design approval", probability: 80 },
  { name: "Won", probability: 100, isWon: true },
  { name: "Lost", probability: 0, isLost: true },
];

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@softrocodelabs.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe@123";
  const name = process.env.SEED_ADMIN_NAME ?? "Softro Admin";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✔ Admin user already exists: ${email}`);
  } else {
    await db.user.create({
      data: { email, name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true },
    });
    console.log(`✔ Created admin user: ${email}`);
  }

  const pipeline = await db.pipeline.findFirst({
    where: { isDefault: true },
    include: { _count: { select: { deals: true } } },
  });
  const stages = DEFAULT_STAGES.map((stage, position) => ({ ...stage, position }));

  if (!pipeline) {
    await db.pipeline.create({ data: { name: PIPELINE_NAME, isDefault: true, stages: { create: stages } } });
    console.log("✔ Created default sales pipeline");
  } else if (pipeline._count.deals === 0) {
    // No deals yet, so it's safe to bring the stages up to date.
    await db.$transaction([
      db.pipelineStage.deleteMany({ where: { pipelineId: pipeline.id } }),
      db.pipeline.update({ where: { id: pipeline.id }, data: { name: PIPELINE_NAME, stages: { create: stages } } }),
    ]);
    console.log("✔ Updated default pipeline stages");
  } else {
    console.log("✔ Default pipeline already in use; stages left unchanged (edit them in Settings later)");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
