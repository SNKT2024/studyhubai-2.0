import { describe, expect, it } from "vitest";

import {
  createGuestCookieValue,
  createGuestId,
  isValidGuestId,
  verifyGuestCookieValue,
} from "@/lib/guest-cookie";

/** Splits a cookie value at its final dot, the way the verifier does. */
function halves(value: string): [string, string] {
  const at = value.lastIndexOf(".");
  return [value.slice(0, at), value.slice(at + 1)];
}

describe("createGuestCookieValue", () => {
  it("round-trips through the verifier", () => {
    const value = createGuestCookieValue();

    const guestId = verifyGuestCookieValue(value);

    expect(guestId).not.toBeNull();
    expect(isValidGuestId(guestId ?? undefined)).toBe(true);
  });

  it("issues a distinct identity each time", () => {
    expect(createGuestCookieValue()).not.toBe(createGuestCookieValue());
  });

  it("signs the id rather than encoding it", () => {
    const [guestId, signature] = halves(createGuestCookieValue());

    expect(signature).not.toBe("");
    expect(signature).not.toContain(guestId);
  });
});

describe("verifyGuestCookieValue", () => {
  it("rejects a missing cookie", () => {
    expect(verifyGuestCookieValue(undefined)).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(verifyGuestCookieValue("")).toBeNull();
  });

  it("rejects a bare id with no signature", () => {
    expect(verifyGuestCookieValue(createGuestId())).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const [guestId, signature] = halves(createGuestCookieValue());
    // Flip the final character, keeping the length so this is not caught by the length guard.
    const lastChar = signature.at(-1) ?? "A";
    const flipped = lastChar === "A" ? "B" : "A";

    expect(
      verifyGuestCookieValue(`${guestId}.${signature.slice(0, -1)}${flipped}`),
    ).toBeNull();
  });

  it("rejects a truncated signature without throwing", () => {
    // timingSafeEqual throws on a length mismatch, so the length has to be ruled out first.
    const [, signature] = halves(createGuestCookieValue());

    expect(() =>
      verifyGuestCookieValue(`${createGuestId()}.${signature.slice(0, 10)}`),
    ).not.toThrow();
    expect(
      verifyGuestCookieValue(`${createGuestId()}.${signature.slice(0, 10)}`),
    ).toBeNull();
  });

  it("rejects a forged id carrying a signature minted for another id", () => {
    const [, signature] = halves(createGuestCookieValue());

    expect(verifyGuestCookieValue(`${createGuestId()}.${signature}`)).toBeNull();
  });

  it("rejects a value that is not a guest id at all, however it is signed", () => {
    // A Clerk user id must never be reachable by presenting a cookie.
    const value = createGuestCookieValue();
    const [, signature] = halves(value);

    expect(
      verifyGuestCookieValue(`user_2abcDEFghijklMNO.${signature}`),
    ).toBeNull();
  });

  it("rejects a malformed id with no signature separator", () => {
    expect(verifyGuestCookieValue("guest_not-a-uuid")).toBeNull();
  });
});

describe("isValidGuestId", () => {
  it("accepts a generated id", () => {
    expect(isValidGuestId(createGuestId())).toBe(true);
  });

  it("rejects undefined and non-uuids", () => {
    expect(isValidGuestId(undefined)).toBe(false);
    expect(isValidGuestId("guest_1234")).toBe(false);
    expect(isValidGuestId("user_2abc")).toBe(false);
  });
});
