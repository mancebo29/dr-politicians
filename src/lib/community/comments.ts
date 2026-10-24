import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Database, Executor } from "@/db/client";
import {
  auditLog,
  commentReports,
  comments,
  MAX_COMMENT_DEPTH,
  politicians,
  users,
} from "@/db/schema";
import { normalizeText } from "@/lib/popularity/query";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { MAX_COMMENT_LENGTH, type ReportReason, reportReasons } from "./report-reasons";
import { type CommentSettings, loadSetting } from "@/lib/site-settings";

// Comments on published profiles (PLAN §7.4). Every rule is enforced here,
// not in the UI: who may post, thread depth, the edit window, pre-moderation,
// blocked terms and auto-hide after reports.

export class CommunityError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 429 = 400,
  ) {
    super(message);
  }
}

type BanState = { banned: boolean | null; banExpires: Date | null };

// Better Auth lifts an expired ban only at the next sign-in, so the expiry is
// checked here too.
export function isBanned(user: BanState, now = new Date()): boolean {
  return Boolean(user.banned) && (!user.banExpires || user.banExpires > now);
}

export type Participation = "ok" | "signed_out" | "unverified" | "banned" | "no_username";

type Author = BanState & { id: string; emailVerified: boolean; username: string | null };

export function participation(author: Author | null, now = new Date()): Participation {
  if (!author) return "signed_out";
  if (isBanned(author, now)) return "banned";
  if (!author.emailVerified) return "unverified";
  // The username is the public handle; Google accounts start without one.
  if (!author.username) return "no_username";
  return "ok";
}

const participationError: Record<Exclude<Participation, "ok">, string> = {
  signed_out: "Inicia sesión para participar.",
  banned: "Tu cuenta está suspendida y no puede participar.",
  unverified: "Confirma tu correo para participar.",
  no_username: "Elige un nombre de usuario para participar.",
};

export async function loadAuthor(db: Executor, userId: string | null): Promise<Author | null> {
  if (!userId) return null;
  const [author] = await db
    .select({
      id: users.id,
      emailVerified: users.emailVerified,
      username: users.username,
      banned: users.banned,
      banExpires: users.banExpires,
    })
    .from(users)
    .where(eq(users.id, userId));
  return author ?? null;
}

async function requireParticipant(db: Executor, userId: string, now: Date) {
  const author = await loadAuthor(db, userId);
  const state = participation(author, now);
  if (state !== "ok") throw new CommunityError(participationError[state], 403);
  return author!;
}

export function containsBlockedTerm(body: string, terms: readonly string[]): boolean {
  const text = normalizeText(body);
  return terms.some((term) => {
    const needle = normalizeText(term).trim();
    return needle.length > 0 && text.includes(` ${needle} `);
  });
}

function reviewStatus(body: string, settings: CommentSettings) {
  return settings.preModeration || containsBlockedTerm(body, settings.blockedTerms)
    ? ("pending" as const)
    : ("visible" as const);
}

function cleanBody(body: string) {
  const text = body.replace(/\r\n?/g, "\n").trim();
  if (!text) throw new CommunityError("Escribe un comentario.");
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new CommunityError(
      `El comentario puede tener como máximo ${MAX_COMMENT_LENGTH} caracteres.`,
    );
  }
  return text;
}

async function publishedPoliticianId(db: Executor, slug: string) {
  const [row] = await db
    .select({ id: politicians.id })
    .from(politicians)
    .where(and(eq(politicians.slug, slug), eq(politicians.status, "published")));
  if (!row) throw new CommunityError("El perfil no existe.", 404);
  return row.id;
}

async function rateLimited(
  db: Executor,
  key: string,
  rules: Parameters<typeof consumeRateLimit>[2],
  now: Date,
) {
  if (!(await consumeRateLimit(db, key, rules, now))) {
    throw new CommunityError("Vas demasiado rápido. Espera un momento e inténtalo de nuevo.", 429);
  }
}

export async function createComment(
  db: Database,
  input: { userId: string; slug: string; parentId?: string | null; body: string },
  now = new Date(),
) {
  const settings = await loadSetting(db, "comments");
  if (!settings.enabled) throw new CommunityError("Los comentarios están desactivados.", 403);
  await requireParticipant(db, input.userId, now);
  const body = cleanBody(input.body);
  const politicianId = await publishedPoliticianId(db, input.slug);

  let parentId: string | null = null;
  let depth = 0;
  if (input.parentId) {
    const [parent] = await db
      .select({ id: comments.id, parentId: comments.parentId, depth: comments.depth })
      .from(comments)
      .where(
        and(
          eq(comments.id, input.parentId),
          eq(comments.politicianId, politicianId),
          eq(comments.status, "visible"),
        ),
      );
    if (!parent)
      throw new CommunityError("El comentario al que respondes ya no está disponible.", 404);
    // Threads stop at three levels: a reply to a third-level comment becomes
    // its sibling, so the conversation continues at that level.
    if (parent.depth >= MAX_COMMENT_DEPTH) {
      parentId = parent.parentId;
      depth = parent.depth;
    } else {
      parentId = parent.id;
      depth = parent.depth + 1;
    }
  }

  await rateLimited(db, `comment:${input.userId}`, RATE_LIMITS.comment, now);
  const [comment] = await db
    .insert(comments)
    .values({
      politicianId,
      userId: input.userId,
      parentId,
      depth,
      body,
      status: reviewStatus(body, settings),
      // Same clock as the edit window and rate limit checks.
      createdAt: now,
    })
    .returning({ id: comments.id, status: comments.status });
  return comment;
}

async function ownComment(db: Executor, userId: string, commentId: string) {
  const [comment] = await db
    .select()
    .from(comments)
    .where(
      and(eq(comments.id, commentId), eq(comments.userId, userId), ne(comments.status, "deleted")),
    );
  if (!comment) throw new CommunityError("No encontramos ese comentario.", 404);
  return comment;
}

export function editDeadline(
  createdAt: Date,
  settings: Pick<CommentSettings, "editWindowMinutes">,
) {
  return new Date(createdAt.getTime() + settings.editWindowMinutes * 60_000);
}

export async function editComment(
  db: Database,
  input: { userId: string; commentId: string; body: string },
  now = new Date(),
) {
  const settings = await loadSetting(db, "comments");
  if (!settings.enabled) throw new CommunityError("Los comentarios están desactivados.", 403);
  await requireParticipant(db, input.userId, now);
  const comment = await ownComment(db, input.userId, input.commentId);
  if (comment.status === "hidden") {
    throw new CommunityError("Un comentario oculto por moderación no se puede editar.", 409);
  }
  if (editDeadline(comment.createdAt, settings) <= now) {
    throw new CommunityError("Ya pasó el tiempo para editar este comentario.", 409);
  }
  const body = cleanBody(input.body);
  const status = comment.status === "pending" ? "pending" : reviewStatus(body, settings);
  const [updated] = await db
    .update(comments)
    .set({ body, status, editedAt: now })
    .where(eq(comments.id, comment.id))
    .returning({ id: comments.id, status: comments.status });
  return updated;
}

// Authors can always delete their own comments. The row stays (replies keep
// their place and moderators keep the record); the public sees a placeholder.
export async function deleteOwnComment(db: Database, input: { userId: string; commentId: string }) {
  const comment = await ownComment(db, input.userId, input.commentId);
  await db.update(comments).set({ status: "deleted" }).where(eq(comments.id, comment.id));
}

export async function reportComment(
  db: Database,
  input: { userId: string; commentId: string; reason: ReportReason; detail?: string },
  now = new Date(),
) {
  if (!Object.hasOwn(reportReasons, input.reason)) throw new CommunityError("Elige un motivo.");
  await requireParticipant(db, input.userId, now);
  const [comment] = await db
    .select({ id: comments.id, userId: comments.userId, status: comments.status })
    .from(comments)
    .where(eq(comments.id, input.commentId));
  if (!comment || comment.status !== "visible") {
    throw new CommunityError("Ese comentario ya no está disponible.", 404);
  }
  if (comment.userId === input.userId) {
    throw new CommunityError("No puedes reportar tu propio comentario.", 409);
  }
  await rateLimited(db, `report:${input.userId}`, RATE_LIMITS.report, now);

  const detail = input.detail?.trim().slice(0, 500);
  const reason = `${reportReasons[input.reason]}${detail ? `: ${detail}` : ""}`;
  const settings = await loadSetting(db, "comments");

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(commentReports)
      .values({ commentId: comment.id, reporterUserId: input.userId, reason })
      .onConflictDoNothing()
      .returning({ id: commentReports.id });
    if (inserted.length === 0) throw new CommunityError("Ya reportaste este comentario.", 409);

    // report_count is the number of open reports; the row lock keeps two
    // simultaneous reports from both missing the threshold.
    const [locked] = await tx
      .select({ status: comments.status })
      .from(comments)
      .where(eq(comments.id, comment.id))
      .for("update");
    const [{ open }] = await tx
      .select({ open: sql<number>`count(*)::int` })
      .from(commentReports)
      .where(and(eq(commentReports.commentId, comment.id), isNull(commentReports.resolvedAt)));
    const hide = locked.status === "visible" && open >= settings.autoHideThreshold;
    await tx
      .update(comments)
      .set({ reportCount: open, ...(hide && { status: "hidden" as const }) })
      .where(eq(comments.id, comment.id));
    if (hide) {
      await tx.insert(auditLog).values({
        action: "comment.auto_hide",
        entity: "comment",
        entityId: comment.id,
        before: { status: "visible" },
        after: { status: "hidden", openReports: open },
      });
    }
    return { hidden: hide };
  });
}

export type CommentNode = {
  id: string;
  depth: number;
  // null when the comment is removed or its author deleted the account.
  author: string | null;
  body: string | null;
  // Anyone but the author gets a `pending` comment as a placeholder (body
  // null), and only when visible replies hang from it.
  state: "visible" | "pending" | "hidden" | "deleted";
  createdAt: string;
  editedAt: string | null;
  mine: boolean;
  editableUntil: string | null;
  replies: CommentNode[];
};

// The thread of a published profile as `viewerId` may see it: removed
// comments become placeholders only where visible replies hang from them,
// and pending ones are shown to their author alone.
export async function loadThread(
  db: Executor,
  input: { slug: string; viewerId: string | null; settings: CommentSettings },
  now = new Date(),
): Promise<CommentNode[] | null> {
  const [politician] = await db
    .select({ id: politicians.id })
    .from(politicians)
    .where(and(eq(politicians.slug, input.slug), eq(politicians.status, "published")));
  if (!politician) return null;

  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      depth: comments.depth,
      userId: comments.userId,
      body: comments.body,
      status: comments.status,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      username: sql<string | null>`coalesce(${users.displayUsername}, ${users.username})`,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.userId))
    .where(eq(comments.politicianId, politician.id))
    .orderBy(asc(comments.createdAt));

  const nodes = new Map<string, CommentNode>();
  for (const row of rows) {
    const mine = input.viewerId !== null && row.userId === input.viewerId;
    // Others only see a comment's content once it is visible.
    const shown = row.status === "visible" || (row.status === "pending" && mine);
    const deadline = editDeadline(row.createdAt, input.settings);
    nodes.set(row.id, {
      id: row.id,
      depth: row.depth,
      author: shown ? row.username : null,
      body: shown ? row.body : null,
      state: row.status,
      createdAt: row.createdAt.toISOString(),
      editedAt: shown ? (row.editedAt?.toISOString() ?? null) : null,
      mine,
      editableUntil:
        mine && shown && input.settings.enabled && deadline > now ? deadline.toISOString() : null,
      replies: [],
    });
  }
  const roots: CommentNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    if (!row.parentId) roots.push(node);
    else nodes.get(row.parentId)?.replies.push(node);
  }

  // A comment without content is kept only as the placeholder its visible
  // replies hang from.
  const keep = (node: CommentNode): boolean => {
    node.replies = node.replies.filter(keep);
    return node.body !== null || node.replies.length > 0;
  };
  // Newest conversations first; replies stay in the order they were written.
  return roots.filter(keep).reverse();
}
