import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// Default sales pipeline for an IT services company.
const DEFAULT_STAGES = [
  { name: "Discovery", probability: 10 },
  { name: "Requirements & Scoping", probability: 25 },
  { name: "Proposal Sent", probability: 50 },
  { name: "Negotiation", probability: 75 },
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
      data: { email, name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`✔ Created admin user: ${email}`);
  }

  const pipeline = await db.pipeline.findFirst({ where: { isDefault: true } });
  if (pipeline) {
    console.log("✔ Default pipeline already exists");
  } else {
    await db.pipeline.create({
      data: {
        name: "IT Services Sales",
        isDefault: true,
        stages: { create: DEFAULT_STAGES.map((stage, position) => ({ ...stage, position })) },
      },
    });
    console.log("✔ Created default sales pipeline");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
