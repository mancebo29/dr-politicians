import { createDb } from "@/db/client";
import { seedReferenceData } from "@/db/seed/reference";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = createDb(url);
  try {
    await seedReferenceData(db);
    console.log("Reference data seeded.");
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
