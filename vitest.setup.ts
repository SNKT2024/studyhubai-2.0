/**
 * Runs before any test module is imported.
 *
 * `lib/llm/llmClient.ts` throws at import time when no API key is set, and the route modules
 * pull it in transitively, so the value has to exist before the first import rather than inside
 * a `beforeAll`. Nothing here reaches a real service: `lib/prisma` is mocked in every test that
 * would query, and no route makes a network call in these tests.
 */

process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
process.env.DATABASE_URL =
  "postgresql://test:test@127.0.0.1:5432/test?schema=public";
process.env.GUEST_COOKIE_SECRET = "test-guest-cookie-secret";

export {};
