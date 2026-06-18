// The metamath / set.mm-specific assumptions the rest of the script builds on,
// collected here (just below the config) so they are easy to find and audit.
// Everything else about a page's grammar is *derived* from the page; these are
// the few things we bake in about how metamath expressions and the site work.

import type { InferenceRule } from "./proof";

/** The synthetic target type for "parse a whole assertion". Parsing an assertion
 *  means proving it at this type; `$...` is never a valid MM token, so it cannot
 *  clash with a real one. */
export const TOP_TYPE = "$TOP";

// An assertion is `<turnstile> <wff>`. The one built-in rule turns "prove this
// statement" into "parse a wff after the turnstile" -- i.e. the top of every
// expression is a wff. The turnstile differs by rendering: `|-` on GIF pages,
// `\u22a2` on Unicode pages, so there is one top rule per mode.
export const GIF_TOP_RULE: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: [TOP_TYPE, "|-", "chi"],
};
export const UNI_TOP_RULE: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: [TOP_TYPE, "\u22a2", "chi"],
};

// Syntax-definition pages always pulled into the grammar, because the site's
// "Syntax hints" systematically omit them: `cv` (the setvar->class coercion) is
// listed on no page at all, and `wcel` (in) / `wceq` (=) are dropped whenever
// their operands are setvars (e.g. `x in y`, `x = y`, as on elirrv / elequ1).
// Loaded the same way as any hinted page (fetched and extracted), not hardcoded
// -- so if set.mm ever renames them this list is the single thing to update.
export const PRIMITIVE_SYNTAX_PAGES = ["cv", "wcel", "wceq"];
