// Configuration for the MM Site Format userscript -- edit these to taste.

/** Background colour used to highlight the hovered sub-expression. */
export const HIGHLIGHT_COLOR = "#ffe066";

/** A lighter shade of HIGHLIGHT_COLOR, used to mark the *other* occurrences of
 *  the hovered sub-expression elsewhere on the page. */
export const HIGHLIGHT_MATCH_COLOR = "#fff3bf";

/** Colour used to highlight the changed sub-expressions on `<==` hover. */
export const DIFF_COLOR = "#ffd0d0";

/** Width of the calculation box as a fraction of the proof table's width.
 *  A value > 1 gives headroom so lines don't wrap more than in the table. */
export const CALC_WIDTH_FACTOR = 1.1;

// --- Development-only flags (keep false in committed code) ---

/**
 * When true, the cache bypasses all storage (both in-memory memo and
 * sessionStorage): every `get()` recomputes from scratch and nothing is
 * persisted. Flip to `true` during development to always observe cold-cache
 * behaviour without manually clearing sessionStorage.
 */
export const DEV_BYPASS_CACHE = false;

/**
 * When true, performance timing is logged to console for each processing phase.
 * Flip to `true` during development to profile hot-path performance.
 */
export const DEV_PERF_LOG = false;

/**
 * When true, runs the expensive shared-subtree coverage self-check (builds a
 * mini-calc for each shared node to verify completeness). O(S*N) on large
 * proofs; disable in production.
 */
export const DEV_CHECK_SHARED_COVERAGE =
  // Always enabled in test runs (vitest sets import.meta.env.MODE to "test").
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === "test";

/**
 * When true, logs spine-choice decisions and their metric scores to the console
 * for every proof step. Useful for diagnosing why a particular hypothesis was
 * (or was not) chosen as the spine.
 */
export const DEV_SPINE_LOG = false;
