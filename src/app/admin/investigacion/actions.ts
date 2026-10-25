"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLog, researchJobs } from "@/db/schema";
import { invalidatePublicProfile } from "@/lib/public/invalidate";
import { PublishError, publishSections, publishSubmission } from "@/lib/research/publish";
import {
  approveRoster,
  createDiscoveryJob,
  createJob,
  createJobs,
  decideSubmission,
  QueueError,
  reviseSubmission,
  updateJobStatus,
} from "@/lib/research/queue";
import { checkSourcesOverHttp } from "@/lib/research/source-check";
import { createResearchToken, revokeResearchToken } from "@/lib/research/tokens";
import { requireRole } from "@/lib/session";

export type ActionState = {
  error?: string;
  issues?: string[];
  token?: string;
  notice?: string;
  noticeItems?: string[];
} | null;

const ADMIN = ["admin"] as const;
const MAX_BULK_JOBS = 300;
// Discovery jobs are started per wave segment (startDiscoveryAction).
const kinds = researchJobs.kind.enumValues.filter((k) => k !== "roster_discovery");

function field(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function failure(error: unknown): ActionState {
  if (error instanceof QueueError) return { error: error.message, issues: error.issues };
  if (error instanceof PublishError) return { error: error.message };
  throw error;
}

export async function createJobAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireRole(ADMIN, "/admin/investigacion");
  const kind = field(form, "kind") as (typeof kinds)[number];
  if (!kinds.includes(kind)) return { error: "Tipo de investigación no válido." };
  const politicianId = field(form, "politicianId") || null;
  const requestedName = field(form, "requestedName") || null;
  if (kind === "new_profile" && !requestedName) return { error: "Indica el nombre de la persona." };
  if (kind !== "new_profile" && !politicianId) return { error: "Elige el perfil a actualizar." };
  await createJob(db, {
    kind,
    politicianId,
    requestedName,
    instructions: field(form, "instructions") || null,
    priority: Number(field(form, "priority") || 0),
    wave: field(form, "wave") ? Number(field(form, "wave")) : null,
    createdByUserId: user.id,
  });
  revalidatePath("/admin/investigacion");
  return null;
}

// One person per line: "Nombre completo" or "Nombre completo | instrucciones".
export async function createJobsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireRole(ADMIN, "/admin/investigacion");
  const people = field(form, "people")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split("|");
      return { name: name.trim(), instructions: rest.join("|").trim() || null };
    })
    .filter((person) => person.name);
  if (!people.length) return { error: "Escribe al menos un nombre, uno por línea." };
  if (people.length > MAX_BULK_JOBS) {
    return { error: `Agrega como máximo ${MAX_BULK_JOBS} personas a la vez.` };
  }
  const waveText = field(form, "wave");
  const { created, skipped } = await createJobs(db, {
    people,
    priority: Number(field(form, "priority") || 0),
    wave: waveText ? Number(waveText) : null,
    createdByUserId: user.id,
  });
  revalidatePath("/admin/investigacion");
  return {
    notice: `${created.length} en cola${skipped.length ? `; ${skipped.length} omitidas:` : "."}`,
    noticeItems: skipped.map((s) => `${s.name}: ${s.reason}`),
  };
}

export async function startDiscoveryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireRole(ADMIN, "/admin/investigacion");
  try {
    await createDiscoveryJob(db, { segmentKey: field(form, "segment"), createdByUserId: user.id });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/investigacion");
  return { notice: "Descubrimiento en cola. El investigador automático lo tomará primero." };
}

// Checkboxes are named "person:<index in the roster>".
export async function approveRosterAction(
  submissionId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireRole(ADMIN, "/admin/investigacion");
  const selected = [...form.keys()]
    .filter((key) => key.startsWith("person:"))
    .map((key) => Number(key.slice("person:".length)));
  try {
    await approveRoster(db, {
      submissionId,
      reviewerUserId: user.id,
      selected,
      note: field(form, "note"),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/investigacion");
}

export async function jobStatusAction(jobId: string, action: "cancel" | "release") {
  const { user } = await requireRole(ADMIN, "/admin/investigacion");
  await updateJobStatus(db, { jobId, actorUserId: user.id, action });
  revalidatePath("/admin/investigacion");
}

export async function publishAction(
  submissionId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireRole(ADMIN, "/admin/investigacion");
  const sections = publishSections.filter((s) => form.get(`section:${s}`) === "on");
  let slug: string;
  try {
    ({ slug } = await publishSubmission(db, {
      submissionId,
      reviewerUserId: user.id,
      sections,
      note: field(form, "note"),
    }));
  } catch (error) {
    return failure(error);
  }
  invalidatePublicProfile(slug);
  revalidatePath("/admin", "layout");
  redirect(`/admin/perfiles/${slug}`);
}

export async function decideAction(
  submissionId: string,
  decision: "needs_changes" | "rejected",
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireRole(ADMIN, "/admin/investigacion");
  try {
    await decideSubmission(db, {
      submissionId,
      reviewerUserId: user.id,
      decision,
      note: field(form, "note"),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/investigacion", "layout");
  return null;
}

export async function reviseAction(
  submissionId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireRole(ADMIN, "/admin/investigacion");
  let payload: unknown;
  try {
    payload = JSON.parse(field(form, "payload"));
  } catch {
    return { error: "El JSON no es válido." };
  }
  try {
    await reviseSubmission(db, {
      submissionId,
      reviewerUserId: user.id,
      payload,
      checkSources: checkSourcesOverHttp,
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/investigacion", "layout");
  return null;
}

export async function createTokenAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireRole(ADMIN, "/admin/investigacion/tokens");
  const name = field(form, "name");
  if (!name) return { error: "Ponle un nombre al token." };
  const { id, token } = await createResearchToken(db, { name, createdByUserId: user.id });
  await db.insert(auditLog).values({
    actorUserId: user.id,
    action: "research_token.create",
    entity: "research_token",
    entityId: id,
    after: { name },
  });
  revalidatePath("/admin/investigacion/tokens");
  return { token };
}

export async function revokeTokenAction(tokenId: string) {
  const { user } = await requireRole(ADMIN, "/admin/investigacion/tokens");
  await revokeResearchToken(db, tokenId);
  await db.insert(auditLog).values({
    actorUserId: user.id,
    action: "research_token.revoke",
    entity: "research_token",
    entityId: tokenId,
  });
  revalidatePath("/admin/investigacion/tokens");
}
