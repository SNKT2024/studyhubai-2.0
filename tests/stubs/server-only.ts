/**
 * Stand-in for the `server-only` package, which Next resolves internally and which throws when
 * imported outside a React Server Component context.
 *
 * `lib/prompts/*` and `lib/rate-limit.ts` import it to stop prompt text and server logic from
 * reaching a client bundle. Under vitest there is no bundler to enforce that, so the import is
 * aliased here to an empty module. See `vitest.config.ts`.
 */

export {};
