import { auth, currentUser } from "@clerk/nextjs/server";
import type { User } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { GUEST_COOKIE, isValidGuestId } from "./guest-cookie";
import { prisma } from "./prisma";

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

async function resolveGuest(guestId: string): Promise<Viewer | null> {
  const existing = await prisma.user.findUnique({
    where: { id: guestId },
    select: { credits: true, isGuest: true },
  });

  if (existing) {
    // A row with this id that is not a guest means the cookie was forged to name a real
    // account. Refuse it rather than handing back that user's data.
    if (!existing.isGuest) return null;

    return { kind: "guest", userId: guestId, credits: existing.credits };
  }

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

  const guestId = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!isValidGuestId(guestId)) return null;

  return resolveGuest(guestId);
}
