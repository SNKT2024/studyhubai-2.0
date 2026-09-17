/**
 * Guest identity is a random id in an httpOnly cookie. It lives in its own module with no
 * imports so `proxy.ts` (which mints the cookie) does not have to pull in Prisma or Clerk.
 */

export const GUEST_COOKIE = "studyhub_guest";

/**
 * Cookie values are not signed, so a client is free to send any value it likes. The shape
 * check is the guard: it only ever accepts an id this app could have generated, which stops a
 * forged cookie from naming a real Clerk user's row (those start with `user_`).
 */
const GUEST_ID_PATTERN =
  /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function createGuestId(): string {
  return `guest_${crypto.randomUUID()}`;
}

export function isValidGuestId(value: string | undefined): value is string {
  return typeof value === "string" && GUEST_ID_PATTERN.test(value);
}
