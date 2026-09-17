import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Guest identity is a signed id in an httpOnly cookie.
 *
 * The signature matters even though the id is random: without it a client can present any
 * well-formed value it likes, which lets one visitor replay another's id and spend their
 * balance. `GUEST_ID_PATTERN` alone only ever prevented a forged value from naming a real
 * Clerk row (`user_...`) — it never made the value trustworthy.
 *
 * This module stays free of Prisma and Clerk so `proxy.ts`, which mints the cookie, does not
 * have to pull either in. `node:crypto` is fine there — proxy runs on the Node runtime.
 */

export const GUEST_COOKIE = "studyhub_guest";

const GUEST_ID_PATTERN =
  /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Used only outside production, so a local checkout runs without extra setup. */
const DEVELOPMENT_SECRET = "studyhub-insecure-development-guest-secret";

function getSecret(): string {
  const secret = process.env.GUEST_COOKIE_SECRET;
  if (secret) return secret;

  // Refusing is the point: a fallback here would silently sign every visitor's cookie with a
  // value that is public in the repository, which is the same as not signing at all.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "GUEST_COOKIE_SECRET is not set. Add it to the environment before deploying — guest " +
        "cookies cannot be verified without it.",
    );
  }

  return DEVELOPMENT_SECRET;
}

export function createGuestId(): string {
  return `guest_${randomUUID()}`;
}

/** Shape check: accepts only ids this app could have generated. */
export function isValidGuestId(value: string | undefined): value is string {
  return typeof value === "string" && GUEST_ID_PATTERN.test(value);
}

function sign(guestId: string): string {
  return createHmac("sha256", getSecret()).update(guestId).digest("base64url");
}

/** A new identity, signed and ready to be set as the cookie value. */
export function createGuestCookieValue(): string {
  const guestId = createGuestId();
  return `${guestId}.${sign(guestId)}`;
}

/**
 * The guest id when `value` carries a valid signature, otherwise `null`.
 *
 * Both halves are checked: the id must match the expected shape, and the signature must match
 * the one this deployment would produce for it.
 */
export function verifyGuestCookieValue(value: string | undefined): string | null {
  if (typeof value !== "string") return null;

  // lastIndexOf, not split: guest ids contain no dots, so the final dot is always the separator.
  const separator = value.lastIndexOf(".");
  if (separator === -1) return null;

  const guestId = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  if (!signature || !isValidGuestId(guestId)) return null;

  const expected = Buffer.from(sign(guestId));
  const provided = Buffer.from(signature);

  // timingSafeEqual throws on a length mismatch, so that has to be ruled out first. Neither
  // length is secret, so comparing them directly leaks nothing.
  if (expected.length !== provided.length) return null;

  return timingSafeEqual(expected, provided) ? guestId : null;
}
