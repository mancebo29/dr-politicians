import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog, users } from "@/db/schema";
import { createTestDb, truncateAll } from "@/test/db";
import { promoteToAdmin } from "./promote";

const db = createTestDb();

afterAll(async () => {
  await db.$client.end();
});

beforeEach(async () => {
  await truncateAll(db);
  await db.insert(users).values({ name: "Ana", email: "ana@example.org", username: "ana" });
});

describe("promoteToAdmin", () => {
  it("promotes by email or username and records an audit entry once", async () => {
    const first = await promoteToAdmin(db, "ANA@example.org");
    expect(first).toMatchObject({ role: "admin", changed: true });

    const again = await promoteToAdmin(db, "ana");
    expect(again.changed).toBe(false);

    const [user] = await db.select().from(users).where(eq(users.email, "ana@example.org"));
    expect(user.role).toBe("admin");
    expect(await db.select().from(auditLog)).toHaveLength(1);
  });

  it("fails for unknown accounts", async () => {
    await expect(promoteToAdmin(db, "nadie@example.org")).rejects.toThrow(/No account/);
  });
});
