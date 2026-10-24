import { revalidateTag } from "next/cache";
import { db } from "@/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { env } from "@/lib/env";
import { isCronAuthorized } from "@/lib/popularity/cron-auth";
import { runWeeklyRanking } from "@/lib/popularity/ranking";
import { isMonday, weekOf } from "@/lib/popularity/week";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request, env().CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedWeek = new URL(request.url).searchParams.get("week");
  if (requestedWeek && !isMonday(requestedWeek)) {
    return Response.json({ error: "week must be a Monday in YYYY-MM-DD format" }, { status: 400 });
  }

  try {
    const result = await runWeeklyRanking(db, {
      week: requestedWeek ? weekOf(requestedWeek) : undefined,
      trigger: requestedWeek ? "manual" : "cron",
    });
    revalidateTag(CACHE_TAGS.ranking, "max");
    return Response.json(result);
  } catch (error) {
    console.error("Popularity ranking failed", error);
    return Response.json({ error: "Ranking failed" }, { status: 500 });
  }
}
