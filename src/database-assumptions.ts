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
// `\u22a2` (|-) on Unicode pages, so there is one top rule per mode.
export const GIF_TOP_RULE: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: [TOP_TYPE, "|-", "chi"],
};
export const UNI_TOP_RULE: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: [TOP_TYPE, "\u22a2", "chi"],
};

// Syntax-definition pages always pulled into the grammar, because the site's
// "Syntax hints" systematically omit them.
//  - `cv` (setvar->class coercion): listed on no page at all.
//  - `wcel` (in) / `wceq` (=): dropped when operands are setvars (e.g. `x in
//    y` on elirrv / elequ1); the site uses `wel` / `weq` there instead.
//  - `weq` (setvar =) / `wel` (setvar in): $p syntax theorems; omitted because
//    the site's syntax-hint collector only scanned $a statements (the binary
//    fix on branch syntax-hints-def-bodies corrects this upstream).
// Loaded the same way as any hinted page (fetched and extracted), not hardcoded
// -- so if set.mm ever renames them this list is the single thing to update.
export const PRIMITIVE_SYNTAX_PAGES = ["cv", "wcel", "wceq", "weq", "wel"];

// The ILE rendering labels the setvar typecode as "set" in the colour legend
// (the older <FONT> variant). Wherever we see or need "set" as a kind, treat it
// as "setvar" (the actual typecode in the database).
export const KIND_ALIASES: Record<string, string> = { set: "setvar" };

// The site's rendering uses the CSS class "symvar" for dot-prefixed
// operator-as-variable tokens (e.g. .||. rendered as a symbol with a dotted
// underline). These are always class-typed; "symvar" is effectively a rendering
// variant of the "class" kind.
export const SYMVAR_CSS_CLASS = "symvar";
export const SYMVAR_KIND = "class";
