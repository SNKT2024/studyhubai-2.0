import { auth, currentUser } from "@clerk/nextjs/server";
import type { User } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";

import { GUEST_COOKIE, verifyGuestCookieValue } from "./guest-cookie";
import { prisma } from "./prisma";
import { RATE_LIMITS, checkRateLimit, clientIp } from "./rate-limit";

/** A signed-in user starts with 50 AI calls. Never refills. */
export const USER_CREDITS = 50;
/** A guest gets 20, so the whole app can be explored without signing up. Never refills. */
export const GUEST_CREDITS = 20;

/**
 * Who is making the request. Every route handler resolves this instead of trusting a `userId`
 * from the URL, which is what closed the hole where any caller could read any chat.
 */
export type Viewer =
  | { kind: "user"; userId: string; credits: number; email: string | null }
  | { kind: "guest"; userId: string; credits: number };

/** The primary email, falling back to the first on the account. Read directly rather than via
 *  the `primaryEmailAddress` getter so this also works if the value arrives as plain JSON. */
function pickEmail(user: User | null): string | null {
  if (!user) return null;

  const primary = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  );

  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

async function resolveClerkUser(userId: string): Promise<Viewer> {
  const user = await currentUser();
  const email = pickEmail(user);
  const profile = {
    email,
    firstName: user?.firstName ?? null,
    lastName: user?.lastName ?? null,
    imageUrl: user?.imageUrl ?? null,
  };

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      credits: true,
      email: true,
      firstName: true,
      lastName: true,
      imageUrl: true,
      isGuest: true,
    },
  });

  if (!existing) {
    // First request from this Clerk user — mirror them into Postgres. `credits` is only ever
    // set here, so a returning user can never be topped back up.
    const created = await prisma.user.create({
      data: { id: userId, ...profile, credits: USER_CREDITS },
      select: { credits: true },
    });

    return { kind: "user", userId, credits: created.credits, email };
  }

  // Only write when something actually changed, so the common path is a single SELECT. Skipped
  // entirely when `currentUser()` came back null, so a transient Clerk API failure cannot blank
  // out a real profile with nulls.
  const changed =
    user !== null &&
    (existing.email !== profile.email ||
      existing.firstName !== profile.firstName ||
      existing.lastName !== profile.lastName ||
      existing.imageUrl !== profile.imageUrl ||
      existing.isGuest);

  if (changed) {
    await prisma.user.update({
      where: { id: userId },
      data: { ...profile, isGuest: false },
    });
  }

  return { kind: "user", userId, credits: existing.credits, email };
}

/**
 * Whether this request may bring a *new* guest row into existence.
 *
 * Without this the guest tier is unlimited: clearing the cookie makes `proxy.ts` mint a fresh
 * id, and `resolveGuest` below would hand that id a brand new balance of `GUEST_CREDITS`. The
 * cookie signature stops an id being forged, but it cannot stop a client from discarding its
 * own, so the cap has to live here.
 *
 * Checked only on the create path, so an established guest never pays for a counter read.
 */
async function mayIssueGuestIdentity(): Promise<boolean> {
  const ip = clientIp(await headers());

  // No IP to key on. Allowing it is the lesser evil: a shared bucket would let one caller
  // exhaust the day's identities for everyone behind the same unidentifiable path.
  if (!ip) return true;

  const result = await checkRateLimit(`guest-issue:${ip}`, RATE_LIMITS.guestIssue);

  return result.allowed;
}

async function resolveGuest(guestId: string): Promise<Viewer | null> {
  const existing = await prisma.user.findUnique({
    where: { id: guestId },
    select: { credits: true, isGuest: true },
  });

  if (existing) {
    // Defence in depth. The cookie is signed, so this should be unreachable — but a row with
    // this id that is not a guest would mean the id names a real account, and handing back that
    // user's data is never the right answer.
    if (!existing.isGuest) return null;

    return { kind: "guest", userId: guestId, credits: existing.credits };
  }

  if (!(await mayIssueGuestIdentity())) return null;

  const created = await prisma.user.create({
    data: { id: guestId, isGuest: true, credits: GUEST_CREDITS },
    select: { credits: true },
  });

  return { kind: "guest", userId: guestId, credits: created.credits };
}

/**
 * Resolves the caller, or `null` when they are neither signed in nor carrying a valid guest
 * cookie. Creates the guest row on first sight so credits have somewhere to live.
 */
export async function getViewer(): Promise<Viewer | null> {
  const { userId } = await auth();
  if (userId) return resolveClerkUser(userId);

  const guestId = verifyGuestCookieValue((await cookies()).get(GUEST_COOKIE)?.value);
  if (!guestId) return null;

  return resolveGuest(guestId);
}
