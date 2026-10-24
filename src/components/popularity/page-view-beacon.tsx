"use client";

import { useEffect } from "react";

// Reports one view of a profile per browser tab session to /api/page-views,
// which feeds the weekly ranking. Renders nothing.
export function PageViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    // Automated browsers (tests, crawlers that run JavaScript) are not visitors.
    if (navigator.webdriver) return;
    const key = `page-view:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage can be unavailable (private mode); count the view anyway.
    }
    const body = JSON.stringify({ slug });
    const sent = navigator.sendBeacon?.(
      "/api/page-views",
      new Blob([body], { type: "application/json" }),
    );
    if (!sent) {
      fetch("/api/page-views", {
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  }, [slug]);
  return null;
}
