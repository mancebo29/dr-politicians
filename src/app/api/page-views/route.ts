import { db } from "@/db";
import { isLikelyBot, recordPageView } from "@/lib/popularity/page-views";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Keeps other sites from inflating counts through visitors' browsers.
function isSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

// Counts a profile view sent by <PageViewBeacon>. Only an aggregate per
// profile and day is stored: no IP, cookie or user id. The answer is always
// 204 so the endpoint does not reveal which slugs exist.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });

  let slug: unknown;
  try {
    ({ slug } = await request.json());
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof slug !== "string" || slug.length > 200 || !SLUG.test(slug)) {
    return new Response(null, { status: 400 });
  }

  if (!isLikelyBot(request.headers.get("user-agent"))) await recordPageView(db, slug);
  return new Response(null, { status: 204 });
}
