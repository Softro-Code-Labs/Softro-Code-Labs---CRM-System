import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` (run on install) doesn't need a database, so don't fail
    // when DATABASE_URL isn't set, e.g. during a Vercel or Docker install.
    // Commands that do need it (migrate, seed) will still report it missing.
    // Migrations use DIRECT_URL when set: Neon's direct (non "-pooler") connection string.
    // The app itself always connects with DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
