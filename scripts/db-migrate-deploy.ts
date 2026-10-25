import { deployMigrationUrl, runMigrations } from "@/db/migrate";

// Runs before `next build` on Vercel (vercel.json buildCommand).
async function main() {
  const url = deployMigrationUrl(process.env);
  if (!url) {
    console.log(`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
    return;
  }
  await runMigrations(url);
  console.log("Migrations applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
