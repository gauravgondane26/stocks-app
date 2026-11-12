const NEXT_MAX_LENGTH = 512;

// Browsers read "/\host" as "//host" and drop tabs and newlines from a URL, so
// "/\evil.example" or "/<tab>/evil.example" would leave the site.
const hasUnsafeCharacter = (value: string): boolean =>
  [...value].some((char) => {
    const code = char.charCodeAt(0);
    return char === "\\" || code < 0x20 || code === 0x7f;
  });

// Where to go after signing in or up. Only a path on this site is allowed, so a
// crafted link can't use the sign-in page to send someone to another site.
export const safeNextPath = (value: unknown): string => {
  if (typeof value !== "string" || value.length > NEXT_MAX_LENGTH) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (hasUnsafeCharacter(value)) return "/";
  return value;
};

// The sign-in or sign-up page, set to come back to `next` afterwards.
export const authPath = (page: "/sign-in" | "/sign-up", next?: unknown): string => {
  const path = safeNextPath(next);
  return path === "/" ? page : `${page}?next=${encodeURIComponent(path)}`;
};
