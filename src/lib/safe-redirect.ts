// Only same-site paths are allowed as post-login destinations, so a crafted
// ?next= link cannot bounce users to another site.
export function safeRedirectPath(value: string | string[] | undefined, fallback = "/"): string {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  return path;
}
