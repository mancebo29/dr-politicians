"use server";

import { db } from "@/db";
import {
  CommunityError,
  createComment,
  deleteOwnComment,
  editComment,
  reportComment,
} from "@/lib/community/comments";
import type { ReportReason } from "@/lib/community/report-reasons";
import { getSession } from "@/lib/session";

export type CommentActionResult = { error?: string; notice?: string };

// Server actions are public endpoints: their arguments are untrusted input.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (value: unknown) => (typeof value === "string" ? value : "");
function id(value: unknown) {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new CommunityError("No encontramos ese comentario.", 404);
  }
  return value;
}

const pendingNotice = "Tu comentario quedó pendiente de revisión por el equipo de moderación.";

// Each action re-checks the session; createComment and friends enforce the
// rest (verified email, bans, edit window, rate limits).
async function run(
  work: (userId: string) => Promise<CommentActionResult | void>,
): Promise<CommentActionResult> {
  const session = await getSession();
  if (!session) return { error: "Inicia sesión para participar." };
  try {
    return (await work(session.user.id)) ?? {};
  } catch (error) {
    if (error instanceof CommunityError) return { error: error.message };
    throw error;
  }
}

export async function postCommentAction(input: {
  slug: string;
  parentId: string | null;
  body: string;
}) {
  return run(async (userId) => {
    const comment = await createComment(db, {
      userId,
      slug: text(input.slug),
      parentId: input.parentId === null ? null : id(input.parentId),
      body: text(input.body),
    });
    if (comment.status === "pending") return { notice: pendingNotice };
  });
}

export async function editCommentAction(input: { commentId: string; body: string }) {
  return run(async (userId) => {
    const comment = await editComment(db, {
      userId,
      commentId: id(input.commentId),
      body: text(input.body),
    });
    if (comment.status === "pending") return { notice: pendingNotice };
  });
}

export async function deleteCommentAction(commentId: string) {
  return run((userId) => deleteOwnComment(db, { userId, commentId: id(commentId) }));
}

export async function reportCommentAction(input: {
  commentId: string;
  reason: ReportReason;
  detail: string;
}) {
  return run(async (userId) => {
    await reportComment(db, {
      userId,
      commentId: id(input.commentId),
      reason: text(input.reason) as ReportReason,
      detail: text(input.detail),
    });
    return { notice: "Gracias. El equipo de moderación revisará el comentario." };
  });
}
