// Local assets only in Phase 2. No server-side remote fetch or arbitrary URL.
// Add a vetted CDN allowlist here when object storage is introduced.
export function isSafeImagePath(value: string) {
  return /^\/(?:images|demo)\/[a-zA-Z0-9/_-]+\.(?:svg|png|jpe?g|webp|avif)$/.test(
    value,
  );
}
export const fallbackImage = "/images/invitation-placeholder.svg";
