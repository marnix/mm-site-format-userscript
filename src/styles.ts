// One injected stylesheet for the styling that is common across the page, so the
// generated HTML reads as class names rather than inline-style soup and a visual
// tweak is a one-line edit here. Genuinely dynamic values stay inline at their
// call sites: the collapse show/hide (render.ts), the measured calc-box width
// and the view show/hide (index.ts, view.ts), and each spacer's padding
// (space.ts). The hover highlight colours live in highlight.ts because they come
// from config and pair with the CSS Custom Highlight registration.

// Class names (all prefixed `mm-site-format-`):
// - `…-calc`            the calculation box (a <div>)
// - `…-calc-op`         the left column: the ⇐/⇔ operator and a leaf's (Ref)
// - `…-calc-expr`       an expression cell (hanging indent for wrapped lines)
// - `…-calc-hint`       a `{ using … }` hint cell (indented after the operator;
//                       wraps with a hanging indent by the width of "{ ")
// - `…-calc-subcalc`    an indented nested sub-calculation cell
// - `…-calc-faded`      a deemphasized "small" step's hint / continuation
// - `…-calc-row--hint`, `--subcalc`  vertical space around hints / sub-calcs
//   (EWD1300 layout: symmetric space around hints, more around sub-calculations)
// - `…-fold`            the ▶/▼ disclosure marker
const CSS = `
.mm-site-format-calc { box-sizing:border-box; border:1px solid #ccc; padding:6px 10px; margin:8px 0; text-align:left; font-weight:normal }
.mm-site-format-calc table { border:none; border-collapse:collapse; margin:0 }
.mm-site-format-calc td { border:none; vertical-align:top }
.mm-site-format-calc-op { padding-right:0.6em; white-space:nowrap; text-align:right }
.mm-site-format-calc-expr { padding-left:1.6em; text-indent:-1.6em }
.mm-site-format-calc-hint { padding-left:calc(1.5em + 1.3ch); text-indent:-1.3ch }
.mm-site-format-calc-subcalc { padding-left:2em }
.mm-site-format-calc-faded { opacity:0.2 }
.mm-site-format-calc-row--hint > td { padding-top:0.3em; padding-bottom:0.3em }
.mm-site-format-calc-row--subcalc > td { padding-top:0.5em; padding-bottom:0.5em }
.mm-site-format-fold { cursor:pointer; user-select:none; opacity:0.6 }
`;

const STYLE_ID = "mm-site-format-styles";

/** Injects the stylesheet once (idempotent). Browser only. */
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
