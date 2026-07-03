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
