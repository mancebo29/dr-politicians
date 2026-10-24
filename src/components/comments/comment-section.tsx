"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import {
  type CommentActionResult,
  deleteCommentAction,
  editCommentAction,
  postCommentAction,
  reportCommentAction,
} from "@/app/(public)/politicos/[slug]/actions";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import type { CommentNode, Participation } from "@/lib/community/comments";
import {
  MAX_COMMENT_LENGTH,
  type ReportReason,
  reportReasons,
} from "@/lib/community/report-reasons";

type Thread = { enabled: boolean; participation: Participation; comments: CommentNode[] };

const dateTime = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Santo_Domingo",
});

const textareaClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent";
const primaryButton =
  "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-60";
const linkButton = "text-sm text-muted hover:text-foreground hover:underline disabled:opacity-60";

async function fetchThread(slug: string): Promise<Thread> {
  const response = await fetch(`/api/comments/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Comments answered ${response.status}`);
  return response.json();
}

function countVisible(nodes: CommentNode[]): number {
  return nodes.reduce((n, c) => n + (c.state === "visible" ? 1 : 0) + countVisible(c.replies), 0);
}

// Comments on a profile (PLAN §7.4). Loaded in the browser from
// /api/comments/[slug] so the profile page itself stays static.
export function CommentSection({ slug }: { slug: string }) {
  const { data: session } = authClient.useSession();
  const [thread, setThread] = useState<Thread | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Captured when the thread loads, to decide which edit windows are open.
  const [loadedAt, setLoadedAt] = useState(0);
  const [message, setMessage] = useState<{ tone: "error" | "notice"; text: string } | null>(null);

  // Bumped to reload the thread after a change.
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const sessionUserId = session?.user.id;
  useEffect(() => {
    // Also reloads when the visitor signs in or out.
    let cancelled = false;
    fetchThread(slug).then(
      (loaded) => {
        if (cancelled) return;
        setThread(loaded);
        setLoadedAt(Date.now());
        setLoadError(false);
      },
      () => {
        if (!cancelled) setLoadError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [slug, sessionUserId, version]);

  // Runs a server action, shows its message and refreshes the thread.
  const act = useCallback(
    async (action: () => Promise<CommentActionResult>) => {
      const result = await action();
      if (result.error) setMessage({ tone: "error", text: result.error });
      else setMessage(result.notice ? { tone: "notice", text: result.notice } : null);
      reload();
      return !result.error;
    },
    [reload],
  );

  const canWrite = thread?.enabled === true && thread.participation === "ok";
  const total = thread ? countVisible(thread.comments) : 0;

  return (
    <section id="comentarios" aria-labelledby="comentarios-titulo" className="mt-10 scroll-mt-6">
      <h2 id="comentarios-titulo" className="border-b border-border pb-2 text-lg font-semibold">
        Comentarios{thread && total > 0 ? ` (${total})` : ""}
      </h2>

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            message.tone === "error" ? "border-danger text-danger" : "border-success text-success"
          }`}
        >
          {message.text}
        </p>
      )}

      {loadError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          No pudimos cargar los comentarios.{" "}
          <button type="button" onClick={reload} className="underline">
            Reintentar
          </button>
        </p>
      )}

      {!thread && !loadError && <p className="mt-4 text-sm text-muted">Cargando comentarios…</p>}

      {thread && (
        <>
          <div className="mt-4">
            {canWrite ? (
              <CommentForm
                label="Escribe un comentario"
                submitLabel="Publicar comentario"
                onSubmit={(body) => act(() => postCommentAction({ slug, parentId: null, body }))}
              />
            ) : (
              <ParticipationNotice
                thread={thread}
                slug={slug}
                email={session?.user.email}
                onChange={reload}
              />
            )}
          </div>

          {thread.comments.length === 0 ? (
            <p className="mt-6 text-sm text-muted">Todavía no hay comentarios.</p>
          ) : (
            <ol className="mt-6 space-y-6">
              {thread.comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  slug={slug}
                  canWrite={canWrite}
                  loadedAt={loadedAt}
                  act={act}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function ParticipationNotice({
  thread,
  slug,
  email,
  onChange,
}: {
  thread: Thread;
  slug: string;
  email?: string;
  onChange: () => void;
}) {
  const box = (children: ReactNode) => (
    <div className="rounded-lg border border-border bg-surface p-4 text-sm">{children}</div>
  );
  if (!thread.enabled) return box("Los comentarios están desactivados en este momento.");
  switch (thread.participation) {
    case "signed_out": {
      const next = encodeURIComponent(`/politicos/${slug}#comentarios`);
      return box(
        <>
          <Link href={`/iniciar-sesion?next=${next}`} className="text-accent underline">
            Inicia sesión
          </Link>{" "}
          o{" "}
          <Link href="/registro" className="text-accent underline">
            crea una cuenta
          </Link>{" "}
          para comentar.
        </>,
      );
    }
    case "unverified":
      return box(<ResendVerification email={email} slug={slug} />);
    case "banned":
      return box("Tu cuenta está suspendida y no puede comentar ni reportar.");
    case "no_username":
      return box(<ChooseUsername onDone={onChange} />);
    default:
      return null;
  }
}

function ResendVerification({ email, slug }: { email?: string; slug: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function resend() {
    if (!email) return;
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `/politicos/${slug}#comentarios`,
    });
    setState(error ? "error" : "sent");
  }
  return (
    <p>
      Confirma tu correo para comentar.{" "}
      {state === "sent" ? (
        <span role="status">Te enviamos un nuevo enlace de confirmación.</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={state === "sending"}
          className="text-accent underline disabled:opacity-60"
        >
          Reenviar el correo de confirmación
        </button>
      )}
      {state === "error" && (
        <span role="alert" className="ml-1 text-danger">
          No se pudo enviar. Inténtalo más tarde.
        </span>
      )}
    </p>
  );
}

function ChooseUsername({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = String(new FormData(event.currentTarget).get("username")).trim();
    setPending(true);
    const { error } = await authClient.updateUser({ username });
    setPending(false);
    if (error) setError(authErrorMessage(error));
    else onDone();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 font-medium">
        Elige un nombre de usuario para comentar
        <input
          name="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9_.]+"
          className={`${textareaClass} font-normal`}
        />
      </label>
      <span className="text-xs text-muted">
        Se muestra en tus comentarios. Letras, números, puntos y guiones bajos.
      </span>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className={primaryButton}>
          Guardar
        </button>
      </div>
    </form>
  );
}

function CommentForm({
  label,
  submitLabel,
  initial = "",
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  initial?: string;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const ok = await onSubmit(body);
    setPending(false);
    if (ok && !initial) setBody("");
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {label}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          required
          maxLength={MAX_COMMENT_LENGTH}
          className={`${textareaClass} font-normal`}
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || !body.trim()} className={primaryButton}>
          {pending ? "Un momento…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={linkButton}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

const placeholder: Record<CommentNode["state"], string> = {
  deleted: "Comentario eliminado.",
  hidden: "Comentario oculto por moderación.",
  pending: "Comentario en revisión.",
  visible: "",
};

type Mode = "idle" | "reply" | "edit" | "delete" | "report";

function CommentItem({
  comment,
  slug,
  canWrite,
  loadedAt,
  act,
}: {
  comment: CommentNode;
  slug: string;
  canWrite: boolean;
  loadedAt: number;
  act: (action: () => Promise<CommentActionResult>) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  // Placeholders keep the place of a removed comment that has replies.
  const removed = comment.body === null;
  const editable =
    comment.editableUntil !== null && new Date(comment.editableUntil).getTime() > loadedAt;

  return (
    <li data-testid="comment" data-state={comment.state}>
      <article
        aria-label={
          removed ? "Comentario retirado" : `Comentario de ${comment.author ?? "usuario eliminado"}`
        }
      >
        {removed ? (
          <p className="text-sm text-muted italic">{placeholder[comment.state]}</p>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-medium">{comment.author ?? "Usuario eliminado"}</span>
              <time dateTime={comment.createdAt} className="text-muted">
                {dateTime.format(new Date(comment.createdAt))}
              </time>
              {comment.editedAt && <span className="text-muted">· editado</span>}
              {comment.state === "pending" && (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                  Pendiente de revisión
                </span>
              )}
            </header>
            {mode === "edit" ? (
              <div className="mt-2">
                <CommentForm
                  label="Editar comentario"
                  submitLabel="Guardar cambios"
                  initial={comment.body ?? ""}
                  onCancel={() => setMode("idle")}
                  onSubmit={async (body) => {
                    const ok = await act(() => editCommentAction({ commentId: comment.id, body }));
                    if (ok) setMode("idle");
                    return ok;
                  }}
                />
              </div>
            ) : (
              <p className="mt-1 break-words whitespace-pre-line">{comment.body}</p>
            )}

            {mode !== "edit" && (
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                {canWrite && comment.state === "visible" && (
                  <button type="button" className={linkButton} onClick={() => setMode("reply")}>
                    Responder
                  </button>
                )}
                {comment.mine && editable && (
                  <button type="button" className={linkButton} onClick={() => setMode("edit")}>
                    Editar
                  </button>
                )}
                {comment.mine &&
                  (mode === "delete" ? (
                    <span className="flex items-center gap-2 text-sm">
                      ¿Eliminar el comentario?
                      <button
                        type="button"
                        className="font-medium text-danger hover:underline"
                        onClick={() => act(() => deleteCommentAction(comment.id))}
                      >
                        Sí, eliminar
                      </button>
                      <button type="button" className={linkButton} onClick={() => setMode("idle")}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button type="button" className={linkButton} onClick={() => setMode("delete")}>
                      Eliminar
                    </button>
                  ))}
                {canWrite && !comment.mine && comment.state === "visible" && (
                  <button type="button" className={linkButton} onClick={() => setMode("report")}>
                    Reportar
                  </button>
                )}
              </div>
            )}

            {mode === "reply" && (
              <div className="mt-3">
                <CommentForm
                  label={`Responder a ${comment.author ?? "este comentario"}`}
                  submitLabel="Publicar respuesta"
                  onCancel={() => setMode("idle")}
                  onSubmit={async (body) => {
                    const ok = await act(() =>
                      postCommentAction({ slug, parentId: comment.id, body }),
                    );
                    if (ok) setMode("idle");
                    return ok;
                  }}
                />
              </div>
            )}
            {mode === "report" && (
              <ReportForm
                onCancel={() => setMode("idle")}
                onSubmit={async (reason, detail) => {
                  const ok = await act(() =>
                    reportCommentAction({ commentId: comment.id, reason, detail }),
                  );
                  if (ok) setMode("idle");
                }}
              />
            )}
          </>
        )}
      </article>

      {comment.replies.length > 0 && (
        <ol className="mt-4 space-y-4 border-l-2 border-border pl-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              slug={slug}
              canWrite={canWrite}
              loadedAt={loadedAt}
              act={act}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

function ReportForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (reason: ReportReason, detail: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    await onSubmit(form.get("reason") as ReportReason, String(form.get("detail") ?? ""));
    setPending(false);
  }
  return (
    <form
      onSubmit={submit}
      className="mt-3 flex flex-col gap-2 rounded-lg border border-border p-3"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Motivo del reporte
        <select name="reason" required defaultValue="" className={`${textareaClass} font-normal`}>
          <option value="" disabled>
            Elige un motivo
          </option>
          {Object.entries(reportReasons).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Detalles (opcional)
        <input name="detail" maxLength={500} className={`${textareaClass} font-normal`} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          Enviar reporte
        </button>
        <button type="button" onClick={onCancel} className={linkButton}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
