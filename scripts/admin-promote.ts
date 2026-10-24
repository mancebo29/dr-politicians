import { createDb } from "@/db/client";
import { promoteToAdmin } from "@/lib/admin/promote";

async function main() {
  const identifier = process.argv[2];
  if (!identifier) throw new Error("Usage: pnpm admin:promote <email-or-username>");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = createDb(url, { max: 1 });
  try {
    const result = await promoteToAdmin(db, identifier);
    console.log(
      result.changed ? `${result.email} is now an admin.` : `${result.email} was already an admin.`,
    );
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
