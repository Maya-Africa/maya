/**
 * Derive the URL-safe slug from a user-supplied display name.
 *
 * Mirrors the server's deriveUsernameSlug algorithm so the client can:
 * - preview the shop URL on signup
 * - look up the right account on signin (since the server's /api/auth/challenge
 *   route looks up users by exact stored slug, not by typed display name)
 *
 * Rules, in order:
 *   1. lowercase
 *   2. NFKD-normalize and strip combining marks (so `é → e`)
 *   3. replace any run of non [a-z0-9] characters with a single hyphen
 *   4. trim leading/trailing hyphens
 *   5. collapse consecutive hyphens
 *
 * Length / reserved-word validation lives server-side — the client's job
 * is just to produce the canonical slug shape.
 */
export function deriveUsernameSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}
