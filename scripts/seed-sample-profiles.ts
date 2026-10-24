import { createDb } from "@/db/client";
import { publishSampleProfiles } from "@/lib/public/sample-profiles";

// Development only: publishes fictional profiles through the research pipeline
// so the public site has something to show. Never run against production.
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to publish sample profiles in production");
  }
  const fillers = Number(process.argv[2] ?? 0);
  const db = createDb(url, { max: 1 });
  try {
    const slugs = await publishSampleProfiles(db, { fillers });
    console.log(
      slugs.length ? `Published sample profiles: ${slugs.join(", ")}` : "Samples already present.",
    );
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
