import { updateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

// Call from every Server Action that publishes, edits, archives, unpublishes or
// rolls back a profile, after the change commits. updateTag makes the next
// public read wait for fresh data, so an unpublished profile disappears at once.
export function invalidatePublicProfile(slug: string) {
  updateTag(CACHE_TAGS.politician(slug));
  updateTag(CACHE_TAGS.politicians);
}
