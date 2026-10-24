import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  actionRateLimits,
  auditLog,
  commentReports,
  comments,
  feedback,
  politicians,
  researchJobs,
  sessions,
  siteSettings,
  users,
} from "@/db/schema";
import { consumeRateLimit } from "@/lib/rate-limit";
import { saveSetting, SettingsError } from "@/lib/site-settings";
import { createTestDb, truncateAll } from "@/test/db";
import {
  CommunityError,
  createComment,
  deleteOwnComment,
  editComment,
  loadThread,
  reportComment,
} from "./comments";
import { convertFeedbackToResearchJob, setFeedbackStatus, submitFeedback } from "./feedback";
import { banUser, deleteUserAccount, moderateComment, setUserRole } from "./moderation";

const db = createTestDb();
const now = new Date("2026-10-24T12:00:00Z");
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

let ana: string;
let beto: string;
let carla: string;
let moderator: string;
let admin: string;
let profileId: string;

async function user(username: string, extra: Partial<typeof users.$inferInsert> = {}) {
  const [row] = await db
    .insert(users)
    .values({
      name: username,
      email: `${username}@example.org`,
      username,
      emailVerified: true,
      ...extra,
    })
    .returning({ id: users.id });
  return row.id;
}

async function setComments(value: Record<string, unknown>) {
  await db
    .insert(siteSettings)
    .values({ key: "comments", value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value } });
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(CommunityError);
  return (error as CommunityError).message;
}

const thread = (viewerId: string | null, at = now) =>
  loadThread(
    db,
    {
      slug: "ana-politica",
      viewerId,
      settings: {
        enabled: true,
        preModeration: false,
        autoHideThreshold: 3,
        blockedTerms: [],
        editWindowMinutes: 15,
      },
    },
    at,
  );

beforeEach(async () => {
  await truncateAll(db);
  ana = await user("ana");
  beto = await user("beto");
  carla = await user("carla");
  moderator = await user("mod", { role: "moderator" });
  admin = await user("admin", { role: "admin" });
  [{ id: profileId }] = await db
    .insert(politicians)
    .values([
      { slug: "ana-politica", fullName: "Ana Política", status: "published", publishedAt: now },
      { slug: "borrador", fullName: "Borrador", status: "draft" },
    ])
    .returning({ id: politicians.id });
});

afterAll(async () => {
  await db.$client.end();
});

describe("posting comments", () => {
  it("only lets verified, unbanned accounts with a username comment on published profiles", async () => {
    const unverified = await user("nuevo", { emailVerified: false });
    const google = await user("g", { username: null });
    const banned = await user("baneado", { banned: true });
    const expired = await user("expirado", { banned: true, banExpires: new Date("2026-10-01") });
    const post = (userId: string, slug = "ana-politica") =>
      createComment(db, { userId, slug, body: "Hola" }, now);

    expect(await rejection(post(unverified))).toMatch(/Confirma tu correo/);
    expect(await rejection(post(google))).toMatch(/nombre de usuario/);
    expect(await rejection(post(banned))).toMatch(/suspendida/);
    expect(await rejection(post(ana, "borrador"))).toMatch(/no existe/);
    expect((await post(expired)).status).toBe("visible");
    expect(
      await rejection(createComment(db, { userId: ana, slug: "ana-politica", body: "  " })),
    ).toMatch(/Escribe/);
  });

  it("caps threads at three levels by making deeper replies siblings", async () => {
    const root = await createComment(db, { userId: ana, slug: "ana-politica", body: "Raíz" }, now);
    const reply = await createComment(
      db,
      { userId: beto, slug: "ana-politica", parentId: root.id, body: "Respuesta" },
      later(1),
    );
    const third = await createComment(
      db,
      { userId: carla, slug: "ana-politica", parentId: reply.id, body: "Tercer nivel" },
      later(2),
    );
    const fourth = await createComment(
      db,
      { userId: ana, slug: "ana-politica", parentId: third.id, body: "Más profundo" },
      later(3),
    );
    const [row] = await db.select().from(comments).where(eq(comments.id, fourth.id));
    expect(row).toMatchObject({ parentId: reply.id, depth: 2 });

    const [top] = (await thread(null))!;
    expect(top.replies[0].replies.map((c) => c.body)).toEqual(["Tercer nivel", "Más profundo"]);
  });

  it("holds comments for review under pre-moderation or with a blocked term", async () => {
    await setComments({ blockedTerms: ["estafa"] });
    const flagged = await createComment(
      db,
      { userId: ana, slug: "ana-politica", body: "Esto es una ESTAFÁ" },
      now,
    );
    expect(flagged.status).toBe("pending");
    await setComments({ preModeration: true });
    expect(
      (await createComment(db, { userId: ana, slug: "ana-politica", body: "Hola" }, now)).status,
    ).toBe("pending");

    // Pending comments are shown to their author only.
    expect(await thread(beto)).toEqual([]);
    expect((await thread(ana))!.map((c) => c.state)).toEqual(["pending", "pending"]);
  });

  it("refuses everything while comments are disabled", async () => {
    await setComments({ enabled: false });
    expect(
      await rejection(createComment(db, { userId: ana, slug: "ana-politica", body: "Hola" })),
    ).toMatch(/desactivados/);
  });

  it("rate limits bursts of comments", async () => {
    for (let i = 0; i < 5; i++) {
      await createComment(db, { userId: ana, slug: "ana-politica", body: `n${i}` }, now);
    }
    expect(
      await rejection(createComment(db, { userId: ana, slug: "ana-politica", body: "otra" }, now)),
    ).toMatch(/demasiado rápido/);
    // Other people and the next minute are unaffected.
    await createComment(db, { userId: beto, slug: "ana-politica", body: "hola" }, now);
    await createComment(db, { userId: ana, slug: "ana-politica", body: "luego" }, later(1));
  });
});

describe("editing and deleting", () => {
  it("lets authors edit within the window and marks the edit", async () => {
    const { id } = await createComment(
      db,
      { userId: ana, slug: "ana-politica", body: "Hola" },
      now,
    );
    expect(
      await rejection(editComment(db, { userId: beto, commentId: id, body: "x" }, now)),
    ).toMatch(/No encontramos/);
    await editComment(db, { userId: ana, commentId: id, body: "Hola, corregido" }, later(10));
    const [view] = (await thread(ana, later(10)))!;
    expect(view).toMatchObject({ body: "Hola, corregido", mine: true });
    expect(view.editedAt).not.toBeNull();
    expect(view.editableUntil).toBe(later(15).toISOString());

    expect((await thread(ana, later(16)))![0].editableUntil).toBeNull();
    expect(
      await rejection(editComment(db, { userId: ana, commentId: id, body: "tarde" }, later(16))),
    ).toMatch(/Ya pasó el tiempo/);
  });

  it("keeps a deleted comment as a placeholder only while replies hang from it", async () => {
    const root = await createComment(db, { userId: ana, slug: "ana-politica", body: "Raíz" }, now);
    const lonely = await createComment(
      db,
      { userId: ana, slug: "ana-politica", body: "Sola" },
      now,
    );
    await createComment(
      db,
      { userId: beto, slug: "ana-politica", parentId: root.id, body: "Respuesta" },
      now,
    );
    await deleteOwnComment(db, { userId: ana, commentId: root.id });
    await deleteOwnComment(db, { userId: ana, commentId: lonely.id });

    const view = (await thread(beto))!;
    expect(view).toHaveLength(1);
    expect(view[0]).toMatchObject({ state: "deleted", body: null, author: null });
    expect(view[0].replies[0].body).toBe("Respuesta");
  });

  it("shows comments of deleted accounts as anonymous", async () => {
    await createComment(db, { userId: carla, slug: "ana-politica", body: "Hola" }, now);
    await deleteUserAccount(db, { actor: { id: admin, role: "admin" }, userId: carla });
    expect((await thread(null))![0]).toMatchObject({ author: null, body: "Hola" });
  });
});

describe("reports and moderation", () => {
  it("auto-hides at the threshold and a moderator restore lets reports start over", async () => {
    await setComments({ autoHideThreshold: 2 });
    const { id } = await createComment(
      db,
      { userId: ana, slug: "ana-politica", body: "Hola" },
      now,
    );

    expect(
      await rejection(reportComment(db, { userId: ana, commentId: id, reason: "spam" }, now)),
    ).toMatch(/propio/);
    expect(
      (await reportComment(db, { userId: beto, commentId: id, reason: "spam" }, now)).hidden,
    ).toBe(false);
    expect(
      await rejection(reportComment(db, { userId: beto, commentId: id, reason: "abuse" }, now)),
    ).toMatch(/Ya reportaste/);
    expect(
      (
        await reportComment(
          db,
          { userId: carla, commentId: id, reason: "other", detail: "Ofensivo" },
          now,
        )
      ).hidden,
    ).toBe(true);

    const [hidden] = await db.select().from(comments).where(eq(comments.id, id));
    expect(hidden).toMatchObject({ status: "hidden", reportCount: 2 });
    expect(await thread(beto)).toEqual([]);
    const [autoHide] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "comment.auto_hide"));
    expect(autoHide).toMatchObject({ entityId: id, actorUserId: null });

    await moderateComment(db, { actorUserId: moderator, commentId: id, action: "restore" }, now);
    const [restored] = await db.select().from(comments).where(eq(comments.id, id));
    expect(restored).toMatchObject({ status: "visible", reportCount: 0 });
    const reports = await db.select().from(commentReports).where(eq(commentReports.commentId, id));
    expect(
      reports.every((r) => r.resolution === "dismissed" && r.resolvedByUserId === moderator),
    ).toBe(true);

    // New reporters can hide it again; earlier ones cannot report twice.
    const dana = await user("dana");
    const eva = await user("eva");
    await reportComment(db, { userId: dana, commentId: id, reason: "spam" }, now);
    expect(
      (await reportComment(db, { userId: eva, commentId: id, reason: "spam" }, now)).hidden,
    ).toBe(true);
    expect(
      await db.$count(
        auditLog,
        and(eq(auditLog.action, "comment.restore"), eq(auditLog.actorUserId, moderator)),
      ),
    ).toBe(1);
  });

  it("approves pending comments", async () => {
    await setComments({ preModeration: true });
    const { id } = await createComment(
      db,
      { userId: ana, slug: "ana-politica", body: "Hola" },
      now,
    );
    await moderateComment(db, { actorUserId: moderator, commentId: id, action: "approve" }, now);
    expect((await thread(null))![0].body).toBe("Hola");
  });
});

describe("account management", () => {
  it("bans with an expiry, signs the account out and stops it from commenting", async () => {
    await db.insert(sessions).values({ userId: ana, token: "t1", expiresAt: later(600) });
    await banUser(
      db,
      { actor: { id: moderator, role: "moderator" }, userId: ana, reason: "Spam", days: 7 },
      now,
    );
    const [banned] = await db.select().from(users).where(eq(users.id, ana));
    expect(banned).toMatchObject({ banned: true, banReason: "Spam" });
    expect(banned.banExpires?.toISOString()).toBe("2026-10-31T12:00:00.000Z");
    expect(await db.$count(sessions, eq(sessions.userId, ana))).toBe(0);
    expect(
      await rejection(createComment(db, { userId: ana, slug: "ana-politica", body: "x" }, now)),
    ).toMatch(/suspendida/);
  });

  it("keeps moderators to regular accounts and staff off their own account", async () => {
    const asModerator = { id: moderator, role: "moderator" as const };
    expect(
      await rejection(banUser(db, { actor: asModerator, userId: admin, reason: "x", days: null })),
    ).toMatch(/administrador/);
    expect(
      await rejection(banUser(db, { actor: asModerator, userId: moderator, reason: "x", days: 1 })),
    ).toMatch(/propia cuenta/);
    expect(
      await rejection(setUserRole(db, { actor: asModerator, userId: ana, role: "admin" })),
    ).toMatch(/Solo un administrador/);
    expect(
      await rejection(
        setUserRole(db, { actor: { id: admin, role: "admin" }, userId: admin, role: "user" }),
      ),
    ).toMatch(/propia cuenta/);

    await setUserRole(db, { actor: { id: admin, role: "admin" }, userId: ana, role: "moderator" });
    const [promoted] = await db.select({ role: users.role }).from(users).where(eq(users.id, ana));
    expect(promoted.role).toBe("moderator");
  });
});

describe("feedback", () => {
  it("validates input and links corrections to the profile", async () => {
    expect(
      await rejection(submitFeedback(db, { kind: "bug", message: "corto", userId: null })),
    ).toMatch(/al menos 10/);
    expect(
      await rejection(
        submitFeedback(db, {
          kind: "correction",
          message: "La fecha de inicio está mal.",
          sourceUrl: "javascript:alert(1)",
          userId: null,
        }),
      ),
    ).toMatch(/http/);

    const { id } = await submitFeedback(db, {
      kind: "correction",
      message: "La fecha de inicio está mal.",
      politicianSlug: "ana-politica",
      section: "trayectoria",
      sourceUrl: "https://example.org/fuente",
      contactEmail: "",
      userId: null,
    });
    const [row] = await db.select().from(feedback).where(eq(feedback.id, id));
    expect(row).toMatchObject({
      politicianId: profileId,
      section: "trayectoria",
      contactEmail: null,
    });
  });

  it("turns a correction into a research job once, then closes it with a note", async () => {
    const { id } = await submitFeedback(db, {
      kind: "correction",
      message: "La fecha de inicio está mal.",
      politicianSlug: "ana-politica",
      section: "trayectoria",
      sourceUrl: "https://example.org/fuente",
      userId: beto,
    });
    const job = await convertFeedbackToResearchJob(db, { actorUserId: admin, feedbackId: id });
    expect(job).toMatchObject({
      kind: "targeted_correction",
      politicianId: profileId,
      status: "queued",
    });
    expect(job.instructions).toContain("(sección: Trayectoria): La fecha de inicio está mal.");
    expect(job.instructions).toContain("Fuente aportada: https://example.org/fuente");
    expect(await db.$count(researchJobs)).toBe(1);
    expect(
      await rejection(convertFeedbackToResearchJob(db, { actorUserId: admin, feedbackId: id })),
    ).toMatch(/ya tiene/);

    expect(
      await rejection(
        setFeedbackStatus(db, { actorUserId: moderator, feedbackId: id, status: "resolved" }),
      ),
    ).toMatch(/Explica/);
    await setFeedbackStatus(db, {
      actorUserId: moderator,
      feedbackId: id,
      status: "resolved",
      note: "Corregido en el perfil.",
    });
    const [row] = await db.select().from(feedback).where(eq(feedback.id, id));
    expect(row).toMatchObject({
      status: "resolved",
      researchJobId: job.id,
      resolutionNote: "Corregido en el perfil.",
    });
  });
});

describe("site settings and rate limits", () => {
  it("stores validated settings with an audit entry", async () => {
    await expect(
      saveSetting(db, { key: "comments", value: { enabled: true }, actorUserId: admin }),
    ).rejects.toBeInstanceOf(SettingsError);
    const value = {
      enabled: true,
      preModeration: true,
      autoHideThreshold: 2,
      blockedTerms: ["estafa"],
      editWindowMinutes: 5,
    };
    await saveSetting(db, { key: "comments", value, actorUserId: admin });
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "site_setting.update"));
    expect(entry).toMatchObject({
      entityId: "comments",
      before: null,
      after: value,
      actorUserId: admin,
    });
  });

  it("counts fixed windows per key and prunes old buckets", async () => {
    const rule = [{ max: 2, windowSeconds: 60 }];
    expect(await consumeRateLimit(db, "k", rule, now)).toBe(true);
    expect(await consumeRateLimit(db, "k", rule, now)).toBe(true);
    expect(await consumeRateLimit(db, "k", rule, now)).toBe(false);
    expect(await consumeRateLimit(db, "other", rule, now)).toBe(true);
    expect(await consumeRateLimit(db, "k", rule, later(1))).toBe(true);
    await consumeRateLimit(db, "k", rule, later(3 * 24 * 60));
    expect(await db.$count(actionRateLimits)).toBe(1);
  });
});
