// Bootstrap a research API token straight in the database, e.g. for a local
// pilot before any admin has signed in. Normally tokens are created in
// /admin/investigacion/tokens. The token is printed once; only its hash is stored.
import { createDb } from "@/db/client";
import { createResearchToken } from "@/lib/research/tokens";

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error("Usage: pnpm research:token <name>");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = createDb(url, { max: 1 });
  try {
    const { token } = await createResearchToken(db, { name });
    console.log(token);
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
