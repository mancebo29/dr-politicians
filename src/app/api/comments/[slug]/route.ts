import { db } from "@/db";
import { auth } from "@/lib/auth";
import { loadAuthor, loadThread, participation } from "@/lib/community/comments";
import { loadSetting } from "@/lib/site-settings";

// Comments are read by the browser so profile pages stay fully static
// (ensureStatic = "navigation"); the answer depends on who is asking.
export async function GET(request: Request, { params }: RouteContext<"/api/comments/[slug]">) {
  const { slug } = await params;
  const session = await auth.api.getSession({ headers: request.headers });
  const [settings, viewer] = await Promise.all([
    loadSetting(db, "comments"),
    loadAuthor(db, session?.user.id ?? null),
  ]);
  const comments = await loadThread(db, { slug, viewerId: viewer?.id ?? null, settings });
  if (!comments) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(
    { enabled: settings.enabled, participation: participation(viewer), comments },
    { headers: { "cache-control": "private, no-store" } },
  );
}
