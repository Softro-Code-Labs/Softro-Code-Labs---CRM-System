// Vercel build: apply database migrations, then build the app.
// Migrations run on Production deployments only (or when MIGRATE_ON_BUILD=true, e.g. for a Preview
// that has its own Neon branch), so a preview build can never change the live database.
// If a migration fails, the build fails and the current live version keeps running.
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const env = process.env.VERCEL_ENV ?? "development";
const migrate = env === "production" || process.env.MIGRATE_ON_BUILD === "true";

if (migrate) {
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    console.error("✖ DATABASE_URL is not set for this environment, so migrations can't run.");
    process.exit(1);
  }
  console.log(`Applying database migrations (${env})…`);
  run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
} else {
  console.log(`Skipping database migrations for a ${env} build. Set MIGRATE_ON_BUILD=true to run them.`);
}

run("pnpm", ["exec", "next", "build"]);
